// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion } from './motion-preference'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefersReducedMotion', () => {
  it('true khi hệ điều hành bật giảm chuyển động', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    expect(prefersReducedMotion()).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('false khi không bật', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
    expect(prefersReducedMotion()).toBe(false)
  })

  it('môi trường không có matchMedia coi như không bật', () => {
    delete (window as Partial<Window>).matchMedia
    expect(prefersReducedMotion()).toBe(false)
  })
})
