// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JourneyCanvas } from './journey-canvas'

const state = vi.hoisted(() => ({
  throwOnStart: false,
  onFail: null as null | ((reason: string) => void),
  dispose: vi.fn(),
  start: vi.fn(),
}))

vi.mock('../lib/webgl-support', () => ({ probeWebgl: () => true }))
vi.mock('./start-journey', () => ({
  startJourney: (options: { onFail: (reason: string) => void }) => {
    state.start(options)
    if (state.throwOnStart) throw new Error('shader compile failed')
    state.onFail = options.onFail
    return { dispose: state.dispose }
  },
}))

let container: HTMLElement
let root: Root

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  state.throwOnStart = false
  state.onFail = null
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete document.documentElement.dataset.journey
})

describe('JourneyCanvas: lỗi sau khi đã nạp Three.js', () => {
  it('startJourney ném lỗi đồng bộ thì bỏ canvas và chuyển sang bản HTML', async () => {
    state.throwOnStart = true
    await act(async () => root.render(<JourneyCanvas calm={false} />))
    await flush()
    expect(state.start).toHaveBeenCalledTimes(1)
    expect(container.querySelector('canvas')).toBeNull()
    expect(document.documentElement.dataset.journey).toBe('html')
  })

  it('mất context không hồi phục (onFail) thì bỏ canvas và chuyển sang bản HTML', async () => {
    await act(async () => root.render(<JourneyCanvas calm={false} />))
    await flush()
    expect(container.querySelector('canvas')).not.toBeNull()
    await act(async () => state.onFail?.('WebGL bị trình duyệt thu hồi'))
    expect(container.querySelector('canvas')).toBeNull()
    expect(document.documentElement.dataset.journey).toBe('html')
  })

  it('unmount khi đang chạy 3D thì dispose hành trình đã khởi động', async () => {
    await act(async () => root.render(<JourneyCanvas calm={false} />))
    await flush()
    await act(async () => root.unmount())
    expect(state.dispose).toHaveBeenCalledTimes(1)
    root = createRoot(container)
  })
})
