// @vitest-environment jsdom
import { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRedThread } from './use-red-thread'

// jsdom không có bố cục: đọc "hộp" của từng phần tử từ thuộc tính data-box="x,y,w,h".
const box = (el: Element) => (el.getAttribute('data-box') ?? '0,0,0,0').split(',').map(Number)
const originals = new Map<string, PropertyDescriptor | undefined>()
function stubLayout() {
  const getters: Record<string, (el: Element) => number> = {
    offsetLeft: (el) => box(el)[0],
    offsetTop: (el) => box(el)[1],
    offsetWidth: (el) => box(el)[2],
    offsetHeight: (el) => box(el)[3],
  }
  for (const [name, read] of Object.entries(getters)) {
    originals.set(name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name))
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        return read(this)
      },
    })
  }
}
function restoreLayout() {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
  }
  originals.clear()
}

const TOTAL = 1000
const PINS = [
  { box: '20,100,200,250', side: 'left' },
  { box: '150,450,200,250', side: 'right' },
  { box: '20,800,200,250', side: 'left' },
]

function Harness({ pins = PINS }: { pins?: typeof PINS }) {
  const ref = useRef<HTMLDivElement>(null)
  const { geometry, pathRef, animated, reached } = useRedThread(ref, pins.length)
  return (
    <div ref={ref} data-box="0,0,375,1200" data-testid="container">
      {pins.map((pin, i) => (
        <figure key={i} data-pin data-side={pin.side} data-box={pin.box} />
      ))}
      <div data-thread-end data-box="130,1000,100,80" />
      {geometry && (
        <svg>
          <path className="thread-shadow" d={geometry.d} />
          <path ref={pathRef} className="thread-line" d={geometry.d} />
        </svg>
      )}
      <output data-testid="state">
        {JSON.stringify({ animated, reached, pins: geometry?.pins ?? null })}
      </output>
    </div>
  )
}

let container: HTMLElement
let root: Root
let reduced = false
let containerTop = 0
let frames: Array<() => void> = []
let resizeCallbacks: Array<() => void> = []

const state = () => JSON.parse(container.querySelector('[data-testid="state"]')!.textContent!)
const line = () => container.querySelector<SVGPathElement>('.thread-line')!
const shadow = () => container.querySelector<SVGPathElement>('.thread-shadow')!
const flushFrames = () =>
  act(async () => {
    const pending = frames
    frames = []
    pending.forEach((cb) => cb())
  })
const scrollTo = async (top: number) => {
  containerTop = top
  await act(async () => void window.dispatchEvent(new Event('scroll')))
  await flushFrames()
}

async function mount(element = <Harness />) {
  root = createRoot(container)
  await act(async () => root.render(element))
  // getBoundingClientRect của container (vị trí cuộn) do test điều khiển.
  const host = container.querySelector('[data-testid="container"]') as HTMLElement
  host.getBoundingClientRect = () => ({ top: containerTop }) as DOMRect
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  stubLayout()
  reduced = false
  containerTop = 0
  frames = []
  resizeCallbacks = []
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  // Đường thẳng đứng giả: điểm ở độ dài L có y = L, nên dễ tính tay.
  const svg = window.SVGElement.prototype as unknown as Record<string, unknown>
  svg.getTotalLength = () => TOTAL
  svg.getPointAtLength = (length: number) => ({ x: 100, y: length })
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resizeCallbacks.push(cb)
      }
      observe() {}
      disconnect() {}
    },
  )
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  restoreLayout()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useRedThread', () => {
  it('places the knots on the photos’ inner top corners from layout, not from transformed boxes', async () => {
    // Một ảnh chưa hiện bị dịch/thu nhỏ bằng transform: getBoundingClientRect sẽ sai, offset* thì không.
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 999, top: 999, width: 1, height: 1 } as DOMRect)
    await mount()
    spy.mockRestore()
    const { pins } = state()
    expect(pins).toEqual([
      { x: 202, y: 118 }, // ảnh trái: góc trên bên phải, lùi vào 18px
      { x: 168, y: 468 }, // ảnh phải: góc trên bên trái
      { x: 202, y: 818 },
    ])
  })

  it('draws the thread up to the lead line and reveals only the photos it has reached', async () => {
    await mount()
    const s = state()
    expect(s.animated).toBe(true)
    // đầu bút ở 72% của 800px = 576: đã chạm ảnh 1 (y 118) và 2 (y 468), chưa tới ảnh 3 (y 818)
    expect(s.reached).toBe(2)
    expect(line().style.strokeDasharray).toBe(String(TOTAL))
    expect(line().style.strokeDashoffset).toBe(String(TOTAL - 576))
  })

  it('draws the shadow in step with the line', async () => {
    await mount()
    expect(shadow().style.strokeDashoffset).toBe(line().style.strokeDashoffset)
    expect(shadow().style.strokeDasharray).toBe(line().style.strokeDasharray)
  })

  it('extends the thread and reveals the next photo when the page scrolls down', async () => {
    await mount()
    await scrollTo(-300) // container lên 300px: đầu bút ở y = 576 + 300 = 876
    expect(state().reached).toBe(3)
    expect(line().style.strokeDashoffset).toBe(String(TOTAL - 876))
  })

  it('finishes at offset 0 when scrolled past the end', async () => {
    await mount()
    await scrollTo(-900)
    expect(line().style.strokeDashoffset).toBe('0')
  })

  it('retracts the thread when scrolling back up', async () => {
    await mount()
    await scrollTo(-300)
    await scrollTo(0)
    expect(state().reached).toBe(2)
    expect(line().style.strokeDashoffset).toBe(String(TOTAL - 576))
  })

  it('coalesces a burst of scroll events into one frame update', async () => {
    await mount()
    frames = []
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
    })
    expect(frames).toHaveLength(1)
  })

  it('shows everything at once and ignores scrolling when the guest prefers reduced motion', async () => {
    reduced = true
    await mount()
    expect(state().animated).toBe(false)
    expect(state().reached).toBe(PINS.length)
    expect(line().style.strokeDashoffset).toBe('0')
    frames = []
    await act(async () => void window.dispatchEvent(new Event('scroll')))
    expect(frames).toHaveLength(0)
  })

  it('removes its scroll and resize listeners on unmount', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    await mount()
    await act(async () => root.unmount())
    const removed = remove.mock.calls.map(([type]) => type)
    expect(removed).toContain('scroll')
    expect(removed).toContain('resize')
    root = createRoot(container) // để afterEach có gì đó mà gỡ
  })

  it('measures again when the container is resized and moves the thread to the new corners', async () => {
    await mount()
    const before = state().pins
    container.querySelector('[data-pin]')!.setAttribute('data-box', '20,160,200,250') // ảnh 1 xuống 60px
    await act(async () => resizeCallbacks.forEach((cb) => cb()))
    const after = state().pins
    expect(after[0].y).toBe(before[0].y + 60)
    expect(after[1]).toEqual(before[1])
  })

  it('does not build a thread while the container has no width (hidden or not laid out yet)', async () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 0 })
    await mount()
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original)
    expect(state().pins).toBeNull()
  })

  it('keeps the photos revealed (no hiding) until a measurement has succeeded', async () => {
    // Trạng thái ban đầu của hook: "đã chạm tới" bằng số ảnh, chưa bật chế độ ẩn.
    const html = renderToStaticMarkup(<Harness />)
    expect(html).toContain('&quot;animated&quot;:false')
    expect(html).toContain(`&quot;reached&quot;:${PINS.length}`)
  })
})
