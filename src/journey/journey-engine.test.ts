// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJourneyEngine } from './journey-engine'
import type { SceneModule } from './scene-module'
import type { QualityTier } from './quality-tier'

type Loop = ((now: number) => void) | null

/** Renderer giả: ghi lại vòng lặp animation và số lần vẽ, không cần WebGL thật. */
interface FakeRenderer {
  loop: Loop
  renders: number
  sizes: number[][]
  dispose: ReturnType<typeof vi.fn>
  forceContextLoss: ReturnType<typeof vi.fn>
}

const gl = vi.hoisted(() => ({
  renderers: [] as FakeRenderer[],
  capabilities: undefined as { maxTextureSize?: number; isWebGL2?: boolean } | undefined,
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class FakeWebGLRenderer {
    loop: Loop = null
    renders = 0
    sizes: number[][] = []
    dispose = vi.fn()
    forceContextLoss = vi.fn()
    setPixelRatio = vi.fn()
    capabilities = gl.capabilities
    constructor() {
      gl.renderers.push(this)
    }
    setClearColor() {}
    setSize(width: number, height: number) {
      this.sizes.push([width, height])
    }
    setAnimationLoop(cb: Loop) {
      this.loop = cb
    }
    render() {
      this.renders += 1
    }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer }
})

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

const lastRenderer = (): FakeRenderer => gl.renderers[gl.renderers.length - 1]

const makeModule = (overrides: Partial<SceneModule> = {}) => ({
  id: 'test',
  init: vi.fn(),
  update: vi.fn(),
  setQuality: vi.fn(),
  dispose: vi.fn(),
  ...overrides,
})

const makeEngine = (overrides: Partial<Parameters<typeof createJourneyEngine>[0]> = {}) => {
  const canvas = document.createElement('canvas')
  const options = {
    canvas,
    modules: [makeModule()],
    tier: 'high' as QualityTier,
    onContextLost: vi.fn(),
    onTierChange: vi.fn(),
    ...overrides,
  }
  const engine = createJourneyEngine(options)
  return { engine, canvas, options }
}

/** Chạy một chuỗi khung hình với khoảng cách `gapMs`, bắt đầu từ `start`. Trả về thời điểm khung cuối. */
const runFrames = (renderer: FakeRenderer, start: number, gapMs: number, count: number): number => {
  let now = start
  for (let i = 0; i < count; i += 1) {
    const loop = renderer.loop
    if (!loop) break
    loop(now)
    now += gapMs
  }
  return now
}

beforeEach(() => {
  gl.renderers.length = 0
  gl.capabilities = undefined
  setVisibility('visible')
})

describe('createJourneyEngine: vòng lặp theo yêu cầu', () => {
  it('khởi tạo tạo một vòng lặp, vẽ một khung rồi dừng khi không có gì cần vẽ lại', () => {
    makeEngine()
    const renderer = lastRenderer()
    expect(renderer.loop).toBeTypeOf('function')
    runFrames(renderer, 0, 16, 1)
    expect(renderer.renders).toBe(1)
    expect(renderer.loop).toBeNull()
  })

  it('invalidate sau khi đã dừng thì bật lại vòng lặp', () => {
    const { engine } = makeEngine()
    const renderer = lastRenderer()
    runFrames(renderer, 0, 16, 1)
    expect(renderer.loop).toBeNull()
    engine.invalidate()
    expect(renderer.loop).toBeTypeOf('function')
    runFrames(renderer, 100, 16, 1)
    expect(renderer.renders).toBe(2)
    expect(renderer.loop).toBeNull()
  })

  it('cảnh liên tục giữ vòng lặp chạy', () => {
    makeEngine({ modules: [makeModule({ continuous: true })] })
    const renderer = lastRenderer()
    runFrames(renderer, 0, 16, 5)
    expect(renderer.renders).toBe(5)
    expect(renderer.loop).toBeTypeOf('function')
  })

  it('resize kích thước 0 bị bỏ qua, kích thước hợp lệ được áp dụng', () => {
    const { engine } = makeEngine()
    const renderer = lastRenderer()
    engine.resize(0, 600)
    expect(renderer.sizes).toEqual([])
    engine.resize(800, 600)
    expect(renderer.sizes).toEqual([[800, 600]])
  })
})

describe('createJourneyEngine: hạ bậc chất lượng theo FPS', () => {
  it('FPS thấp kéo dài sau giai đoạn làm nóng thì hạ đúng một bậc và báo cho cảnh', () => {
    const module = makeModule({ continuous: true })
    const { engine, options } = makeEngine({ modules: [module], tier: 'high' })
    const renderer = lastRenderer()
    // 50ms/khung = 20fps: 1s làm nóng + hai cửa sổ đo 1.5s liên tiếp.
    runFrames(renderer, 0, 50, 100)
    expect(engine.tier()).toBe('medium')
    expect(options.onTierChange).toHaveBeenCalledTimes(1)
    expect(options.onTierChange).toHaveBeenCalledWith('medium')
    expect(module.setQuality).toHaveBeenCalledWith('medium', expect.objectContaining({ density: 0.6 }))
  })

  it('khoảng nghỉ dài (tab ẩn, tạm dừng) không bị tính là máy chậm', () => {
    const { engine, options } = makeEngine({ modules: [makeModule({ continuous: true })], tier: 'high' })
    const renderer = lastRenderer()
    // Mỗi khung cách nhau 1s: vượt IDLE_GAP_MS nên không đưa vào bộ đo.
    runFrames(renderer, 0, 1000, 20)
    expect(engine.tier()).toBe('high')
    expect(options.onTierChange).not.toHaveBeenCalled()
  })

  it('đã ở bậc thấp nhất thì không hạ thêm', () => {
    const { engine, options } = makeEngine({ modules: [makeModule({ continuous: true })], tier: 'low' })
    runFrames(lastRenderer(), 0, 50, 200)
    expect(engine.tier()).toBe('low')
    expect(options.onTierChange).not.toHaveBeenCalled()
  })
})

describe('createJourneyEngine: mất context WebGL', () => {
  it('context mất và không hồi phục trong 3 giây thì báo onContextLost', () => {
    vi.useFakeTimers()
    try {
      const { canvas, options } = makeEngine()
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      expect(options.onContextLost).not.toHaveBeenCalled()
      vi.advanceTimersByTime(3000)
      expect(options.onContextLost).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('context hồi phục kịp thì không báo lỗi và vẽ lại', () => {
    vi.useFakeTimers()
    try {
      const { canvas, options } = makeEngine()
      const renderer = lastRenderer()
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      vi.advanceTimersByTime(500)
      canvas.dispatchEvent(new Event('webglcontextrestored'))
      vi.advanceTimersByTime(5000)
      expect(options.onContextLost).not.toHaveBeenCalled()
      expect(renderer.loop).toBeTypeOf('function')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('createJourneyEngine: dọn dẹp', () => {
  it('dispose gọi dispose từng cảnh, nhả renderer, ép mất context và không bật lại vòng lặp', () => {
    const module = makeModule({ continuous: true })
    const { engine } = makeEngine({ modules: [module] })
    const renderer = lastRenderer()
    engine.dispose()
    expect(module.dispose).toHaveBeenCalledTimes(1)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1)
    expect(renderer.loop).toBeNull()
    engine.invalidate()
    expect(renderer.loop).toBeNull()
  })
})

describe('createJourneyEngine: lỗi, khởi động và tab ẩn', () => {
  it('cảnh ném lỗi khi cập nhật: dừng vòng lặp, báo onError, không lặp lỗi mỗi khung', () => {
    const boom = new Error('hỏng')
    const update = vi.fn(() => {
      throw boom
    })
    const onError = vi.fn()
    makeEngine({ modules: [makeModule({ update, continuous: true })], onError })
    const renderer = lastRenderer()
    runFrames(renderer, 0, 16, 10)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(boom)
    expect(update).toHaveBeenCalledTimes(1)
    expect(renderer.loop).toBeNull()
  })

  it('cảnh khởi tạo lỗi: nhả renderer, dọn các cảnh và ném lỗi lên trên', () => {
    const module = makeModule({
      init: vi.fn(() => {
        throw new Error('init hỏng')
      }),
    })
    expect(() => makeEngine({ modules: [module] })).toThrow('init hỏng')
    const renderer = lastRenderer()
    expect(renderer.dispose).toHaveBeenCalled()
    expect(renderer.forceContextLoss).toHaveBeenCalled()
    expect(module.dispose).toHaveBeenCalled()
  })

  it('GPU yếu: vào thẳng bậc thấp và báo onTierChange', () => {
    gl.capabilities = { maxTextureSize: 2048, isWebGL2: true }
    const { engine, options } = makeEngine({ tier: 'high' })
    expect(engine.tier()).toBe('low')
    expect(options.onTierChange).toHaveBeenCalledWith('low')
  })

  it('GPU bình thường: giữ bậc yêu cầu', () => {
    gl.capabilities = { maxTextureSize: 8192, isWebGL2: true }
    const { engine, options } = makeEngine({ tier: 'high' })
    expect(engine.tier()).toBe('high')
    expect(options.onTierChange).not.toHaveBeenCalled()
  })

  it('tab ẩn thì không đếm hạn chờ trả context; hiện lại mới bắt đầu đếm', () => {
    vi.useFakeTimers()
    try {
      const { canvas, options } = makeEngine()
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      setVisibility('hidden')
      vi.advanceTimersByTime(60_000)
      expect(options.onContextLost).not.toHaveBeenCalled()
      setVisibility('visible')
      vi.advanceTimersByTime(2999)
      expect(options.onContextLost).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(options.onContextLost).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('context đang mất thì cuộn trang không bật lại vòng lặp vẽ', () => {
    const { engine, canvas } = makeEngine()
    const renderer = lastRenderer()
    runFrames(renderer, 0, 16, 1)
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    engine.invalidate()
    expect(renderer.loop).toBeNull()
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(renderer.loop).toBeTypeOf('function')
  })
})
