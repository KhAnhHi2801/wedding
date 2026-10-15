// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { JourneyCanvas } from './journey-canvas'

vi.mock('../lib/webgl-support', () => ({ probeWebgl: () => true }))
// Mô phỏng chunk Three.js tải lỗi (mạng đứt, deploy đổi tên chunk): import() bị từ chối.
vi.mock('./start-journey', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

describe('JourneyCanvas: import() chunk 3D thất bại', () => {
  it('bỏ canvas và đánh dấu chế độ HTML thay vì để trang trống', async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      await act(async () => root.render(<JourneyCanvas calm={false} />))
      await vi.waitFor(() => expect(document.documentElement.dataset.journey).toBe('html'))
      expect(container.querySelector('canvas')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      container.remove()
      delete document.documentElement.dataset.journey
    }
  })
})
