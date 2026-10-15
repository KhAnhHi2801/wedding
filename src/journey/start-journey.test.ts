// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { journeyProgress } from './journey-progress'
import { startJourney } from './start-journey'

const engine = vi.hoisted(() => ({
  create: vi.fn(),
  resize: vi.fn(),
  invalidate: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('./journey-engine', () => ({ createJourneyEngine: engine.create }))

const setDevice = ({ coarse, cores, memory }: { coarse: boolean; cores?: number; memory?: number }) => {
  window.matchMedia = ((query: string) => ({ matches: coarse && query === '(pointer: coarse)' })) as typeof window.matchMedia
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: cores, configurable: true })
  Object.defineProperty(navigator, 'deviceMemory', { value: memory, configurable: true })
}

const running: Array<{ dispose: () => void }> = []
/** Mọi lần khởi động được dispose sau mỗi test để listener toàn cục không rò sang test khác. */
const start = (options: Parameters<typeof startJourney>[0]) => {
  const journey = startJourney(options)
  running.push(journey)
  return journey
}

const lastOptions = () => engine.create.mock.calls[engine.create.mock.calls.length - 1][0]

beforeEach(() => {
  vi.clearAllMocks()
  engine.create.mockReturnValue({ tier: () => 'high', resize: engine.resize, invalidate: engine.invalidate, dispose: engine.dispose })
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
  setDevice({ coarse: false, cores: 8 })
})

afterEach(() => {
  running.splice(0).forEach((journey) => journey.dispose())
  delete (window as Partial<Window>).matchMedia
})

describe('startJourney: chọn bậc chất lượng ban đầu', () => {
  it('desktop nhiều nhân → high', () => {
    start({ canvas: document.createElement('canvas'), onFail: vi.fn() })
    expect(lastOptions().tier).toBe('high')
  })

  it('điện thoại (pointer coarse) ít nhân → low', () => {
    setDevice({ coarse: true, cores: 4 })
    start({ canvas: document.createElement('canvas'), onFail: vi.fn() })
    expect(lastOptions().tier).toBe('low')
  })

  it('màn hình hẹp dưới 700px cũng được coi là điện thoại', () => {
    Object.defineProperty(window, 'innerWidth', { value: 480, configurable: true })
    setDevice({ coarse: false, cores: 8, memory: 8 })
    start({ canvas: document.createElement('canvas'), onFail: vi.fn() })
    expect(lastOptions().tier).toBe('medium')
  })
})

describe('startJourney: vòng đời', () => {
  it('fit khung nhìn ngay khi khởi động và mỗi lần resize', () => {
    start({ canvas: document.createElement('canvas'), onFail: vi.fn() })
    expect(engine.resize).toHaveBeenLastCalledWith(1024, 768)
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    window.dispatchEvent(new Event('resize'))
    expect(engine.resize).toHaveBeenLastCalledWith(800, 768)
  })

  it('tiến độ cuộn đổi thì vẽ lại; sau dispose không còn vẽ lại', () => {
    const journey = start({ canvas: document.createElement('canvas'), onFail: vi.fn() })
    journeyProgress.set(0.4, 0.1)
    expect(engine.invalidate).toHaveBeenCalledTimes(1)
    journey.dispose()
    expect(engine.dispose).toHaveBeenCalledTimes(1)
    journeyProgress.set(0.5, 0.2)
    expect(engine.invalidate).toHaveBeenCalledTimes(1)
  })

  it('dispose gỡ listener resize', () => {
    const journey = start({ canvas: document.createElement('canvas'), onFail: vi.fn() })
    engine.resize.mockClear()
    journey.dispose()
    window.dispatchEvent(new Event('resize'))
    expect(engine.resize).not.toHaveBeenCalled()
  })

  it('mất context không hồi phục được chuyển thành onFail có lý do', () => {
    const onFail = vi.fn()
    start({ canvas: document.createElement('canvas'), onFail })
    lastOptions().onContextLost()
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(onFail.mock.calls[0][0]).toMatch(/WebGL/)
  })

  it('chuyển tiếp onTierChange cho người gọi', () => {
    const onTierChange = vi.fn()
    start({ canvas: document.createElement('canvas'), onFail: vi.fn(), onTierChange })
    lastOptions().onTierChange('low')
    expect(onTierChange).toHaveBeenCalledWith('low')
  })
})
