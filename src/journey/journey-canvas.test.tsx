// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JourneyCanvas } from './journey-canvas'

const probe = vi.hoisted(() => ({ webgl: true }))
vi.mock('../lib/webgl-support', () => ({ probeWebgl: () => probe.webgl }))

let container: HTMLElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  probe.webgl = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete document.documentElement.dataset.journey
})

describe('JourneyCanvas', () => {
  it('không có WebGL: không dựng canvas, đánh dấu chế độ HTML', async () => {
    probe.webgl = false
    await act(async () => root.render(<JourneyCanvas calm={false} />))
    expect(container.querySelector('canvas')).toBeNull()
    expect(document.documentElement.dataset.journey).toBe('html')
  })

  it('giảm chuyển động: không dựng canvas dù có WebGL', async () => {
    await act(async () => root.render(<JourneyCanvas calm />))
    expect(container.querySelector('canvas')).toBeNull()
    expect(document.documentElement.dataset.journey).toBe('html')
  })

  it('có WebGL: dựng canvas ẩn khỏi trình đọc màn hình, đánh dấu chế độ 3D', async () => {
    await act(async () => root.render(<JourneyCanvas calm={false} />))
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.getAttribute('aria-hidden')).toBe('true')
    expect(document.documentElement.dataset.journey).toBe('3d')
  })
})
