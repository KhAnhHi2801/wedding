// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ProbeModule = typeof import('./webgl-support')

const loseContext = vi.fn()
const getContext = vi.fn()

/** Mỗi test nạp lại module vì kết quả được cache ở cấp module. */
const loadProbe = async (): Promise<ProbeModule> => {
  vi.resetModules()
  return import('./webgl-support')
}

beforeEach(() => {
  vi.clearAllMocks()
  getContext.mockReset()
  loseContext.mockReset()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext as unknown as HTMLCanvasElement['getContext'])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('probeWebgl', () => {
  it('có WebGL2 thì true và nhả context ngay', async () => {
    getContext.mockImplementation((type: string) => (type === 'webgl2' ? { getExtension: () => ({ loseContext }) } : null))
    const { probeWebgl } = await loadProbe()
    expect(probeWebgl()).toBe(true)
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('WebGL2 không có nhưng WebGL1 có thì vẫn true', async () => {
    getContext.mockImplementation((type: string) => (type === 'webgl' ? { getExtension: () => null } : null))
    const { probeWebgl } = await loadProbe()
    expect(probeWebgl()).toBe(true)
  })

  it('không có context nào thì false (bản HTML)', async () => {
    getContext.mockReturnValue(null)
    const { probeWebgl } = await loadProbe()
    expect(probeWebgl()).toBe(false)
  })

  it('getContext ném lỗi thì false, không làm vỡ trang', async () => {
    getContext.mockImplementation(() => {
      throw new Error('blocked')
    })
    const { probeWebgl } = await loadProbe()
    expect(probeWebgl()).toBe(false)
  })

  it('kết quả được cache: lần gọi sau không thử lại', async () => {
    getContext.mockReturnValue(null)
    const { probeWebgl } = await loadProbe()
    probeWebgl()
    probeWebgl()
    expect(getContext).toHaveBeenCalledTimes(2) // webgl2 + webgl, chỉ một lần
  })
})
