// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroPetals } from './hero-petals'

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void
const observers: Callback[] = []

let container: HTMLElement
let root: Root
const field = () => container.querySelector('.petal-field')!

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  observers.length = 0
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: Callback) {
        observers.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const intersect = (value: boolean) => act(async () => observers.forEach((cb) => cb([{ isIntersecting: value }])))

describe('HeroPetals pause logic', () => {
  it('is decorative: hidden from assistive technology', async () => {
    await act(async () => root.render(<HeroPetals />))
    expect(field().getAttribute('aria-hidden')).toBe('true')
  })

  it('starts paused until the hero is known to be on screen', async () => {
    await act(async () => root.render(<HeroPetals />))
    expect(field().classList.contains('is-paused')).toBe(true)
  })

  it('runs while the hero is visible and pauses when it scrolls away', async () => {
    await act(async () => root.render(<HeroPetals />))
    await intersect(true)
    expect(field().classList.contains('is-paused')).toBe(false)
    await intersect(false)
    expect(field().classList.contains('is-paused')).toBe(true)
    await intersect(true)
    expect(field().classList.contains('is-paused')).toBe(false)
  })

  it('uses all three petal silhouettes', async () => {
    await act(async () => root.render(<HeroPetals />))
    for (const id of [1, 2, 3]) {
      expect(container.querySelector(`use[href="#petal-${id}"]`)).not.toBeNull()
    }
  })
})
