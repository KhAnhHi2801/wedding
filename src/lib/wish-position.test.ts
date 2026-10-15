import { describe, expect, it } from 'vitest'
import { LANTERN_TONES, lanternCap, lanternSpot, pickLantern } from './wish-position'

describe('lanternSpot', () => {
  it('is deterministic per id', () => {
    expect(lanternSpot('abc')).toEqual(lanternSpot('abc'))
    expect(lanternSpot('abc')).not.toEqual(lanternSpot('abd'))
  })

  it('stays inside the visible sky with a valid tone', () => {
    for (let i = 0; i < 500; i++) {
      const s = lanternSpot(`wish-${i}`)
      expect(s.x).toBeGreaterThanOrEqual(0.07)
      expect(s.x).toBeLessThanOrEqual(0.93)
      expect(s.y).toBeGreaterThanOrEqual(0.14)
      expect(s.y).toBeLessThanOrEqual(0.84)
      expect(s.tone).toBeGreaterThanOrEqual(0)
      expect(s.tone).toBeLessThan(LANTERN_TONES)
    }
  })

  it('spreads positions instead of clustering', () => {
    const xs = Array.from({ length: 300 }, (_, i) => lanternSpot(`id-${i}`).x)
    expect(xs.filter((x) => x < 0.5).length).toBeGreaterThan(100)
    expect(xs.filter((x) => x >= 0.5).length).toBeGreaterThan(100)
  })
})

describe('lanternCap', () => {
  it('uses fewer lanterns on narrow screens', () => {
    expect(lanternCap(360)).toBeLessThan(lanternCap(1280))
  })
})

describe('pickLantern', () => {
  const centers = [
    { x: 50, y: 50 },
    { x: 100, y: 50 },
  ]
  it('picks the nearest lantern within the radius', () => {
    expect(pickLantern(centers, 90, 52, 30)).toBe(1)
    expect(pickLantern(centers, 56, 50, 30)).toBe(0)
  })
  it('returns -1 when nothing is close enough', () => {
    expect(pickLantern(centers, 200, 200, 30)).toBe(-1)
    expect(pickLantern([], 1, 1, 30)).toBe(-1)
  })
})
