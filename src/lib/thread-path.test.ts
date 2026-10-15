import { describe, expect, it } from 'vitest'
import { buildThreadPath, countReached, findLengthAtY, lengthNearPoint } from './thread-path'

describe('buildThreadPath', () => {
  it('returns an empty path for no points and a lone move for one point', () => {
    expect(buildThreadPath([])).toBe('')
    expect(buildThreadPath([{ x: 5, y: 7 }])).toBe('M5 7')
  })

  it('passes through every point, one cubic segment per gap', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 20, y: 120 },
    ]
    const d = buildThreadPath(points)
    expect(d.startsWith('M0 0')).toBe(true)
    expect(d.match(/C/g)).toHaveLength(2)
    expect(d).toContain('100 50')
    expect(d.trim().endsWith('20 120')).toBe(true)
  })

  it('draws a straight line when the points are collinear', () => {
    const d = buildThreadPath([
      { x: 0, y: 0 },
      { x: 0, y: 30 },
      { x: 0, y: 60 },
    ])
    // mọi toạ độ x đều là 0: không có đường cong ngang
    expect(d.replace(/[MC]/g, '').split(/\s+/).filter((_, i) => i % 2 === 0).every((x) => x === '0' || x === '')).toBe(true)
  })
})

describe('buildThreadPath edge cases', () => {
  it('draws one segment for two points, ending exactly on the second point', () => {
    const d = buildThreadPath([
      { x: 0, y: 0 },
      { x: 60, y: 90 },
    ])
    expect(d.match(/C/g)).toHaveLength(1)
    expect(d.trim().endsWith('60 90')).toBe(true)
  })

  it('uses tangent-based control points (a third of the chord for the first segment of a straight line)', () => {
    // Điểm kép ở hai đầu: tiếp tuyến = (p2 - p1)/6 ở mỗi đầu mút
    expect(buildThreadPath([{ x: 0, y: 0 }, { x: 60, y: 0 }])).toBe('M0 0 C10 0 50 0 60 0')
  })
})

describe('findLengthAtY', () => {
  const samples = [
    { len: 0, y: 0 },
    { len: 100, y: 100 },
    { len: 250, y: 200 },
    { len: 300, y: 300 },
  ]

  it('is zero above the start and the full length below the end', () => {
    expect(findLengthAtY(samples, -50)).toBe(0)
    expect(findLengthAtY(samples, 999)).toBe(300)
  })

  it('returns the sample length when the target is exactly on a sample', () => {
    expect(findLengthAtY(samples, 100)).toBe(100)
    expect(findLengthAtY(samples, 200)).toBe(250)
  })

  it('interpolates between samples', () => {
    expect(findLengthAtY(samples, 50)).toBe(50)
    expect(findLengthAtY(samples, 150)).toBe(175)
  })

  it('is safe with no samples', () => {
    expect(findLengthAtY([], 10)).toBe(0)
  })

  it('stops at the first overshoot when the curve doubles back', () => {
    const wavy = [
      { len: 0, y: 0 },
      { len: 100, y: 100 },
      { len: 150, y: 80 }, // đường cong quay ngược lên
      { len: 300, y: 200 },
    ]
    expect(findLengthAtY(wavy, 90)).toBe(90)
  })
})

describe('countReached', () => {
  it('counts a pin exactly at the drawn length as reached', () => {
    expect(countReached([50], 50)).toBe(1)
    expect(countReached([50.1], 50)).toBe(0)
  })

  it('counts pins whose position is already drawn', () => {
    expect(countReached([10, 50, 90], 0)).toBe(0)
    expect(countReached([10, 50, 90], 50)).toBe(2)
    expect(countReached([10, 50, 90], 1000)).toBe(3)
  })
})

describe('lengthNearPoint edge cases', () => {
  it('returns 0 when there are no samples', () => {
    expect(lengthNearPoint([], { x: 1, y: 1 })).toBe(0)
  })
})

describe('lengthNearPoint', () => {
  it('returns the length of the closest sample', () => {
    const samples = [
      { len: 0, x: 0, y: 0 },
      { len: 40, x: 50, y: 50 },
      { len: 90, x: 100, y: 100 },
    ]
    expect(lengthNearPoint(samples, { x: 52, y: 48 })).toBe(40)
    expect(lengthNearPoint(samples, { x: 200, y: 200 })).toBe(90)
  })
})
