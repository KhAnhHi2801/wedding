import { describe, expect, it } from 'vitest'
import { clamp01, scrollProgress, smoothProgress } from './scroll-progress'

describe('scrollProgress', () => {
  it('0 ở đầu trang, 1 ở cuối trang', () => {
    expect(scrollProgress(0, 3000, 800)).toBe(0)
    expect(scrollProgress(2200, 3000, 800)).toBe(1)
  })
  it('giữa trang tỉ lệ thuận', () => {
    expect(scrollProgress(1100, 3000, 800)).toBeCloseTo(0.5)
  })
  it('kẹp trong 0..1 khi cuộn vượt biên (iOS cuộn nảy)', () => {
    expect(scrollProgress(-50, 3000, 800)).toBe(0)
    expect(scrollProgress(2500, 3000, 800)).toBe(1)
  })
  it('trang ngắn hơn màn hình → 0, không chia cho 0', () => {
    expect(scrollProgress(0, 600, 800)).toBe(0)
    expect(scrollProgress(10, 800, 800)).toBe(0)
  })
})

describe('smoothProgress', () => {
  it('sau đúng một chu kỳ bán rã còn nửa khoảng cách', () => {
    expect(smoothProgress(0, 1, 0.12, 0.12)).toBeCloseTo(0.5)
  })
  it('kết quả không phụ thuộc cách chia khung hình', () => {
    let a = 0
    for (let i = 0; i < 12; i += 1) a = smoothProgress(a, 1, 0.01)
    const b = smoothProgress(0, 1, 0.12)
    expect(a).toBeCloseTo(b, 3)
  })
  it('đủ gần thì chốt đúng đích', () => {
    expect(smoothProgress(0.9996, 1, 0.016)).toBe(1)
  })
  it('halfLife 0 (giảm chuyển động) nhảy thẳng tới đích', () => {
    expect(smoothProgress(0, 0.7, 0.016, 0)).toBe(0.7)
  })
  it('dt 0 không đổi', () => {
    expect(smoothProgress(0.2, 1, 0)).toBe(0.2)
  })
})

describe('clamp01', () => {
  it('kẹp giá trị', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.3)).toBe(0.3)
  })
})
