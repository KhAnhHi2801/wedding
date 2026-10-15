import { useEffect, useRef } from 'react'

export interface ViewerPhoto {
  src: string
  alt: string
}

interface PhotoViewerProps {
  photos: ViewerPhoto[]
  /** Chỉ số ảnh đang xem; null = đóng. */
  index: number | null
  onChange: (index: number) => void
  onClose: () => void
}

const SWIPE_DISTANCE = 50

/**
 * Trình xem ảnh toàn màn hình dùng <dialog> gốc: tự khóa focus, đóng bằng Esc, trả focus về ảnh đã chạm.
 * Vuốt ngang hoặc dùng nút/phím mũi tên để chuyển ảnh.
 */
export function PhotoViewer({ photos, index, onChange, onClose }: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const startX = useRef<number | null>(null)
  const open = index !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // Khóa cuộn nền khi đang xem (dialog modal không tự khóa cuộn trên iOS).
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const last = photos.length - 1
  const go = (next: number) => onChange(Math.min(Math.max(next, 0), last))
  const photo = index === null ? null : photos[index]

  // Phím mũi tên nghe ở cấp document: khi nút "Ảnh sau" bị vô hiệu ở ảnh cuối, focus rơi về <body> và sự kiện
  // phím sẽ không còn đi qua dialog.
  useEffect(() => {
    if (index === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onChange(Math.max(index - 1, 0))
      if (event.key === 'ArrowRight') onChange(Math.min(index + 1, photos.length - 1))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [index, photos.length, onChange])

  // Danh sách ảnh ngắn đi khi đang xem: đóng thay vì để hộp thoại trống.
  useEffect(() => {
    if (index !== null && !photos[index]) onClose()
  }, [index, photos, onClose])

  return (
    <dialog
      ref={dialogRef}
      className="photo-viewer"
      aria-label="Xem ảnh"
      onClose={onClose}
    >
      {photo && index !== null && (
        <div className="photo-viewer-body">
          <div
            className="photo-viewer-stage"
            onPointerDown={(event) => {
              startX.current = event.clientX
            }}
            onPointerUp={(event) => {
              if (startX.current === null) return
              const dx = event.clientX - startX.current
              startX.current = null
              if (dx <= -SWIPE_DISTANCE) go(index + 1)
              else if (dx >= SWIPE_DISTANCE) go(index - 1)
            }}
            onPointerCancel={() => {
              startX.current = null
            }}
          >
            <img src={photo.src} alt={photo.alt} draggable={false} />
          </div>
          <p className="photo-viewer-count" aria-live="polite">
            {index + 1} / {photos.length}
          </p>
          <button type="button" className="photo-viewer-close" aria-label="Đóng" onClick={onClose}>
            ✕
          </button>
          <button
            type="button"
            className="photo-viewer-nav photo-viewer-prev"
            aria-label="Ảnh trước"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-viewer-nav photo-viewer-next"
            aria-label="Ảnh sau"
            disabled={index === last}
            onClick={() => go(index + 1)}
          >
            ›
          </button>
        </div>
      )}
    </dialog>
  )
}
