import { describe, expect, it } from 'vitest'
import {
  chooseGallery,
  corridorLength,
  corridorScrollHeightSvh,
  corridorSpread,
  fitPlane,
  focusDistance,
  flightProgress,
} from './gallery-layout'

describe('chooseGallery', () => {
  const base = { webgl: true, reducedMotion: false, search: '' }

  it('uses the lively 3D corridor when WebGL works', () => {
    expect(chooseGallery(base)).toMatchObject({ mode: 'corridor', calm: false })
  })

  it('falls back to the thread gallery only when WebGL is missing', () => {
    expect(chooseGallery({ ...base, webgl: false })).toMatchObject({ mode: 'thread' })
  })

  it('keeps the corridor but calm when the guest prefers reduced motion', () => {
    expect(chooseGallery({ ...base, reducedMotion: true })).toMatchObject({ mode: 'corridor', calm: true })
  })

  it('can be forced to the thread gallery for testing', () => {
    expect(chooseGallery({ ...base, search: '?gallery=thread' })).toMatchObject({ mode: 'thread' })
  })

  it('cannot be forced to the corridor when WebGL is missing', () => {
    expect(chooseGallery({ ...base, webgl: false, search: '?gallery=corridor' })).toMatchObject({ mode: 'thread' })
  })

  it('ignores unknown values', () => {
    expect(chooseGallery({ ...base, search: '?gallery=xyz' })).toMatchObject({ mode: 'corridor' })
  })

  it('always explains the choice', () => {
    for (const env of [base, { ...base, webgl: false }, { ...base, reducedMotion: true }, { ...base, search: '?gallery=thread' }]) {
      expect(chooseGallery(env).reason.length).toBeGreaterThan(3)
    }
  })
})

describe('fitPlane', () => {
  it('fits a wide photo by width', () => {
    expect(fitPlane(1.5)).toEqual({ width: 1.9, height: 1.9 / 1.5 })
  })

  it('fits a tall photo by height and keeps its aspect', () => {
    const { width, height } = fitPlane(0.56)
    expect(height).toBeCloseTo(2.4)
    expect(width / height).toBeCloseTo(0.56)
    expect(width).toBeLessThanOrEqual(1.9)
  })

  it('keeps a square photo inside the box', () => {
    const { width, height } = fitPlane(1)
    expect(width).toBe(1.9)
    expect(height).toBe(1.9)
  })

  it('falls back to the box for a missing or invalid aspect', () => {
    expect(fitPlane(0)).toEqual({ width: 1.9, height: 2.4 })
    expect(fitPlane(NaN)).toEqual({ width: 1.9, height: 2.4 })
  })
})

describe('focusDistance', () => {
  const visible = (distance: number, aspect: number, fov: number) => {
    const height = 2 * Math.tan((fov * Math.PI) / 360) * distance
    return { width: height * aspect, height }
  }

  it.each([
    ['tall photo, narrow portrait phone', 1.1, 2.4, 0.46],
    ['wide photo, narrow portrait phone', 1.9, 1.27, 0.46],
    ['square photo, desktop', 1.9, 1.9, 1.78],
    ['wide photo, desktop', 1.9, 1.27, 1.78],
  ])('keeps the whole framed photo on screen: %s', (_name, w, h, aspect) => {
    const distance = focusDistance(w, h, aspect, 58)
    const view = visible(distance, aspect, 58)
    expect(w + 0.14).toBeLessThanOrEqual(view.width * 0.92 + 1e-9)
    expect(h + 0.14).toBeLessThanOrEqual(view.height * 0.74 + 1e-9)
  })

  it('backs further away on a narrow portrait screen than on a wide one', () => {
    expect(focusDistance(1.9, 1.9, 0.46, 58)).toBeGreaterThan(focusDistance(1.9, 1.9, 1.78, 58))
  })

  it('never gets closer than the minimum', () => {
    expect(focusDistance(0.1, 0.1, 2, 58)).toBe(1.4)
  })
})

describe('corridorSpread', () => {
  it('pulls photos toward the middle on a narrow portrait screen', () => {
    expect(corridorSpread(0.46)).toBe(0.95)
  })

  it('caps the spread on a wide screen', () => {
    expect(corridorSpread(1.78)).toBe(1.65)
  })

  it('grows with the aspect in between', () => {
    expect(corridorSpread(0.7)).toBeCloseTo(1.33)
  })
})

describe('corridor sizing', () => {
  it('lengthens with the number of photos', () => {
    expect(corridorLength(1)).toBe(5)
    expect(corridorLength(8)).toBeGreaterThan(corridorLength(7))
    expect(corridorLength(0)).toBe(5)
  })

  it('gives each photo a stretch of scroll plus one screen for the sticky stage', () => {
    expect(corridorScrollHeightSvh(8)).toBe(700)
    expect(corridorScrollHeightSvh(0)).toBe(175)
  })
})

describe('flightProgress', () => {
  const height = 700 // svh đổi ra px giả định: vùng cuộn cao 700, viewport 100
  it('is 0 until the sticky stage reaches the top of the screen', () => {
    expect(flightProgress(300, height, 100)).toBe(0)
    expect(flightProgress(0, height, 100)).toBe(0)
  })

  it('advances linearly while the stage is pinned', () => {
    expect(flightProgress(-300, height, 100)).toBeCloseTo(0.5)
  })

  it('is 1 once the whole range has been scrolled', () => {
    expect(flightProgress(-600, height, 100)).toBe(1)
    expect(flightProgress(-5000, height, 100)).toBe(1)
  })

  it('is 0 when there is no scroll range', () => {
    expect(flightProgress(-50, 100, 100)).toBe(0)
  })
})
