// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { journeyProgress } from '../journey/journey-progress'
import { useTimeOfDay } from './use-time-of-day'

function Probe({ calm }: { calm: boolean }) {
  useTimeOfDay(calm)
  return null
}

let root: Root

const setPage = (scrollY: number, scrollHeight = 3000, innerHeight = 1000) => {
  Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true })
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: scrollHeight, configurable: true })
}
const cssVar = (name: string) => document.documentElement.style.getPropertyValue(name)

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  // Chạy rAF theo đồng hồ giả để điều khiển được vòng làm mượt.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('useTimeOfDay', () => {
  it('đầu trang: ngày sáng, đúng màu nền kem', async () => {
    setPage(0)
    await act(async () => root.render(<Probe calm={false} />))
    expect(cssVar('--tod')).toBe('0.00')
    expect(cssVar('--journey-bg')).toBe('#fbf6f0')
    expect(journeyProgress.value).toBe(0)
  })

  it('mở trang giữa chừng: nhảy thẳng tới đúng vị trí, không trượt từ 0', async () => {
    setPage(2000) // cuối trang
    await act(async () => root.render(<Probe calm={false} />))
    expect(journeyProgress.value).toBe(1)
    expect(cssVar('--tod')).toBe('1.00')
    expect(cssVar('--journey-bg')).toBe('#e9c2be')
  })

  it('cuộn xuống thì tiến dần tới đích rồi dừng vòng lặp', async () => {
    setPage(0)
    await act(async () => root.render(<Probe calm={false} />))
    setPage(2000)
    await act(async () => void window.dispatchEvent(new Event('scroll')))
    await act(async () => void vi.advanceTimersByTime(48))
    expect(journeyProgress.value).toBeGreaterThan(0)
    expect(journeyProgress.value).toBeLessThan(1)
    await act(async () => void vi.advanceTimersByTime(3000))
    expect(journeyProgress.value).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('giảm chuyển động: nhảy thẳng tới đích và nền đổi theo bước', async () => {
    setPage(0)
    await act(async () => root.render(<Probe calm />))
    setPage(1000) // giữa trang: tiến độ 0.5 → tod giữa 0.1 và 0.35
    await act(async () => void window.dispatchEvent(new Event('scroll')))
    await act(async () => void vi.advanceTimersByTime(32))
    expect(journeyProgress.value).toBe(0.5)
    expect(['0.00', '0.25', '0.50']).toContain(cssVar('--tod'))
  })
})
