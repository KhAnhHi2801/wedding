import { describe, expect, it } from 'vitest'
import { quantizeTod, todColor, todFromProgress, todRgb } from './time-of-day'

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: readonly number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a: readonly number[], b: readonly number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('todFromProgress', () => {
  it('đầu = 0, cuối = 1, kẹp ngoài biên', () => {
    expect(todFromProgress(0)).toBe(0)
    expect(todFromProgress(1)).toBe(1)
    expect(todFromProgress(-1)).toBe(0)
    expect(todFromProgress(2)).toBe(1)
  })
  it('không bao giờ giảm khi cuộn xuống', () => {
    let prev = -1
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const tod = todFromProgress(p)
      expect(tod).toBeGreaterThanOrEqual(prev)
      prev = tod
    }
  })
})

describe('quantizeTod', () => {
  it('làm tròn theo bước', () => {
    expect(quantizeTod(0.3)).toBe(0.25)
    expect(quantizeTod(0.9)).toBe(1)
    expect(quantizeTod(0)).toBe(0)
  })
})

describe('todColor', () => {
  it('đúng ba mốc màu', () => {
    expect(todColor(0)).toBe('#fbf6f0')
    expect(todColor(0.5)).toBe('#f3e3c3')
    expect(todColor(1)).toBe('#e9c2be')
  })
  it('luôn là #rrggbb hợp lệ trên toàn dải', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) expect(todColor(t)).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('chữ --ink (#3b2a2d) đạt tương phản AA ≥ 4.5 trên mọi mốc nền', () => {
    const ink = [0x3b, 0x2a, 0x2d]
    for (let t = 0; t <= 1.0001; t += 0.05) expect(contrast(ink, todRgb(t))).toBeGreaterThanOrEqual(4.5)
  })
})
