import { describe, expect, it } from 'vitest'
import { createFpsGovernor, isWeakGpu, lowerTier, pickInitialTier, tierSettings } from './quality-tier'

describe('pickInitialTier', () => {
  it('desktop mạnh → high', () => {
    expect(pickInitialTier({ coarse: false, hardwareConcurrency: 8 })).toBe('high')
  })
  it('desktop ít nhân → medium', () => {
    expect(pickInitialTier({ coarse: false, hardwareConcurrency: 2 })).toBe('medium')
  })
  it('điện thoại mạnh → medium, không bao giờ high', () => {
    expect(pickInitialTier({ coarse: true, hardwareConcurrency: 8, deviceMemory: 8 })).toBe('medium')
  })
  it('điện thoại ít nhân hoặc ít RAM → low', () => {
    expect(pickInitialTier({ coarse: true, hardwareConcurrency: 4 })).toBe('low')
    expect(pickInitialTier({ coarse: true, hardwareConcurrency: 8, deviceMemory: 2 })).toBe('low')
  })
  it('thiếu thông tin phần cứng (Safari) → điện thoại medium, desktop high', () => {
    expect(pickInitialTier({ coarse: true })).toBe('medium')
    expect(pickInitialTier({ coarse: false })).toBe('high')
  })
})

describe('lowerTier / tierSettings', () => {
  it('hạ từng bậc rồi dừng', () => {
    expect(lowerTier('high')).toBe('medium')
    expect(lowerTier('medium')).toBe('low')
    expect(lowerTier('low')).toBeNull()
  })
  it('bậc thấp hơn luôn nhẹ hơn', () => {
    expect(tierSettings('high').density).toBeGreaterThan(tierSettings('medium').density)
    expect(tierSettings('medium').density).toBeGreaterThan(tierSettings('low').density)
    expect(tierSettings('low').bloom).toBe(false)
  })
})

describe('createFpsGovernor', () => {
  const feed = (governor: ReturnType<typeof createFpsGovernor>, deltaMs: number, ms: number) => {
    let slow = false
    for (let t = 0; t < ms; t += deltaMs) slow = governor.push(deltaMs) || slow
    return slow
  }

  it('bỏ qua giai đoạn làm nóng dù rất chậm', () => {
    const governor = createFpsGovernor({ warmupMs: 1000, windowMs: 1500 })
    expect(feed(governor, 100, 900)).toBe(false)
  })
  it('một cửa sổ chậm đơn lẻ chưa đủ để báo', () => {
    const governor = createFpsGovernor({ warmupMs: 1000, windowMs: 1500, minFps: 30 })
    feed(governor, 50, 1000)
    expect(feed(governor, 50, 1500)).toBe(false) // 20fps nhưng mới một cửa sổ
  })
  it('báo chậm khi hai cửa sổ liên tiếp dưới ngưỡng sau làm nóng', () => {
    const governor = createFpsGovernor({ warmupMs: 1000, windowMs: 1500, minFps: 30 })
    feed(governor, 50, 1000)
    expect(feed(governor, 50, 3000)).toBe(true) // 20fps hai cửa sổ liền
  })
  it('một cửa sổ ổn xen giữa làm đứt chuỗi cửa sổ chậm', () => {
    const governor = createFpsGovernor({ warmupMs: 1000, windowMs: 1500, minFps: 30 })
    feed(governor, 50, 1000)
    feed(governor, 50, 1500) // chậm
    feed(governor, 16.7, 1500) // ổn
    expect(feed(governor, 50, 1500)).toBe(false) // chậm lại, nhưng chuỗi bắt đầu lại từ 1
  })
  it('máy bị giới hạn 30fps (dao động quanh 30) không bị coi là chậm với ngưỡng mặc định', () => {
    const governor = createFpsGovernor()
    expect(feed(governor, 1000 / 29.5, 12000)).toBe(false)
  })
  it('không báo khi FPS ổn', () => {
    const governor = createFpsGovernor({ warmupMs: 1000, windowMs: 1500, minFps: 30 })
    expect(feed(governor, 16.7, 6000)).toBe(false)
  })
  it('reset bắt đầu lại giai đoạn làm nóng', () => {
    const governor = createFpsGovernor({ warmupMs: 1000, windowMs: 1500, minFps: 30 })
    feed(governor, 50, 1000)
    governor.reset()
    expect(feed(governor, 50, 900)).toBe(false)
  })
})

describe('isWeakGpu', () => {
  it('texture tối đa nhỏ hoặc không có WebGL2 → yếu', () => {
    expect(isWeakGpu({ maxTextureSize: 2048, isWebGL2: true })).toBe(true)
    expect(isWeakGpu({ maxTextureSize: 8192, isWebGL2: false })).toBe(true)
  })
  it('GPU bình thường → không yếu', () => {
    expect(isWeakGpu({ maxTextureSize: 8192, isWebGL2: true })).toBe(false)
    expect(isWeakGpu({ maxTextureSize: 4096 })).toBe(false)
  })
  it('thiếu thông tin → coi là ổn', () => {
    expect(isWeakGpu(undefined)).toBe(false)
    expect(isWeakGpu({})).toBe(false)
  })
})
