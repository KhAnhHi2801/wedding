// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoViewer } from './photo-viewer'

const photos = [1, 2, 3].map((n) => ({ src: `/p${n}.webp`, alt: `Ảnh ${n}` }))

let container: HTMLElement
let root: Root
const onClose = vi.fn()

/** Bao PhotoViewer bằng state thật để thấy việc chuyển ảnh. */
function Harness({ start }: { start: number | null }) {
  const [index, setIndex] = useState<number | null>(start)
  return (
    <PhotoViewer
      photos={photos}
      index={index}
      onChange={setIndex}
      onClose={() => {
        onClose()
        setIndex(null)
      }}
    />
  )
}

const q = <T extends Element>(selector: string) => container.querySelector<T>(selector)
const shownAlt = () => q<HTMLImageElement>('.photo-viewer-stage img')?.alt

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // jsdom chưa có <dialog>.showModal/close
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  onClose.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.style.overflow = ''
})

const render = (start: number | null) => act(async () => root.render(<Harness start={start} />))
const press = (selector: string) => act(async () => q<HTMLButtonElement>(selector)!.click())
const pointer = (type: string, x: number) =>
  act(async () => {
    q('.photo-viewer-stage')!.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x }))
  })

describe('PhotoViewer', () => {
  it('renders nothing and does not open while no photo is selected', async () => {
    await render(null)
    expect(shownAlt()).toBeUndefined()
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()
  })

  it('opens modally on the chosen photo with a counter', async () => {
    await render(1)
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect(shownAlt()).toBe('Ảnh 2')
    expect(q('.photo-viewer-count')?.textContent).toBe('2 / 3')
  })

  it('locks background scrolling while open and restores it after', async () => {
    await render(0)
    expect(document.body.style.overflow).toBe('hidden')
    await press('.photo-viewer-close')
    expect(document.body.style.overflow).toBe('')
  })

  it('moves with the next and previous buttons and stops at the ends', async () => {
    await render(0)
    expect(q<HTMLButtonElement>('.photo-viewer-prev')!.disabled).toBe(true)
    await press('.photo-viewer-next')
    expect(shownAlt()).toBe('Ảnh 2')
    await press('.photo-viewer-next')
    expect(shownAlt()).toBe('Ảnh 3')
    expect(q<HTMLButtonElement>('.photo-viewer-next')!.disabled).toBe(true)
    await press('.photo-viewer-prev')
    expect(shownAlt()).toBe('Ảnh 2')
  })

  it('moves with the arrow keys', async () => {
    await render(1)
    await act(async () => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(shownAlt()).toBe('Ảnh 3')
    await act(async () => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(shownAlt()).toBe('Ảnh 2')
  })

  it('keeps the arrow keys working after the next button becomes disabled at the last photo', async () => {
    await render(1)
    q<HTMLButtonElement>('.photo-viewer-next')!.focus()
    await press('.photo-viewer-next') // tới ảnh cuối: nút bị vô hiệu, focus rời khỏi dialog
    expect(shownAlt()).toBe('Ảnh 3')
    await act(async () => void document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(shownAlt()).toBe('Ảnh 2')
  })

  it('stops listening to keys once closed', async () => {
    await render(1)
    await press('.photo-viewer-close')
    await act(async () => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(shownAlt()).toBeUndefined()
  })

  it('swipes left for the next photo and right for the previous', async () => {
    await render(1)
    await pointer('pointerdown', 300)
    await pointer('pointerup', 200) // vuốt trái 100px
    expect(shownAlt()).toBe('Ảnh 3')
    await pointer('pointerdown', 100)
    await pointer('pointerup', 220) // vuốt phải 120px
    expect(shownAlt()).toBe('Ảnh 2')
  })

  it('ignores a short drag or a tap', async () => {
    await render(1)
    await pointer('pointerdown', 300)
    await pointer('pointerup', 280)
    expect(shownAlt()).toBe('Ảnh 2')
  })

  it('closes with the close button', async () => {
    await render(0)
    await press('.photo-viewer-close')
    expect(onClose).toHaveBeenCalled()
    expect(shownAlt()).toBeUndefined()
  })
})
