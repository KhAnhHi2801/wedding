import { useEffect, useRef, useState } from 'react'
import type { AssetImage } from '../config/assets'
import type { CorridorController } from '../gallery/corridor-scene'
import { useNearViewport } from '../hooks/use-near-viewport'
import { corridorScrollHeightSvh, flightProgress } from '../lib/gallery-layout'

interface PhotoCorridorProps {
  photos: AssetImage[]
  /** Mở trình xem toàn màn hình ở ảnh `index`. */
  onOpenViewer: (index: number) => void
  /** Bản yên tĩnh cho khách bật giảm chuyển động. */
  calm: boolean
  /** WebGL lỗi hoặc không dựng được: bên ngoài nên chuyển sang gallery dự phòng (kèm lý do để chẩn đoán). */
  onFail: (reason: string) => void
}

const coarsePointer = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700)

/**
 * Hành lang ký ức: một khung dính (sticky) dài vài màn hình. Cuộn trang bình thường thì camera 3D bay xuyên qua
 * các bức ảnh (không chiếm cuộn trang). Chạm ảnh để lao tới và phóng to. Module Three.js chỉ được tải khi khu
 * này đến gần màn hình và được dỡ khi đi xa; chỉ vẽ khi đang hiển thị.
 */
export function PhotoCorridor({ photos, onOpenViewer, calm, onFail }: PhotoCorridorProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<CorridorController | null>(null)
  const near = useNearViewport(wrapRef, '1200px 0px')
  const visible = useNearViewport(wrapRef, '0px')
  const [ready, setReady] = useState(false)
  const [focused, setFocused] = useState<number | null>(null)
  const [showHint, setShowHint] = useState(true)
  const failRef = useRef(onFail)
  useEffect(() => {
    failRef.current = onFail
  })

  // Dựng cảnh khi đến gần, dỡ khi đi xa để giải phóng GPU và bộ nhớ.
  useEffect(() => {
    if (!near) return
    let cancelled = false
    let created: CorridorController | null = null
    import('../gallery/corridor-scene')
      .then(({ createCorridor }) => {
        const canvas = canvasRef.current
        if (cancelled || !canvas) return
        created = createCorridor({
          canvas,
          photos,
          coarse: coarsePointer(),
          calm,
          onFocusChange: setFocused,
          onContextLost: () => failRef.current('WebGL bị trình duyệt thu hồi (hết bộ nhớ hoặc tab bị ẩn lâu)'),
        })
        controllerRef.current = created
        setReady(true)
      })
      .catch((error: unknown) => failRef.current(`không dựng được cảnh 3D: ${error instanceof Error ? error.message : String(error)}`))
    return () => {
      cancelled = true
      created?.dispose()
      controllerRef.current = null
      setReady(false)
      setFocused(null)
    }
  }, [near, photos, calm])

  // Cuộn trang điều khiển tiến độ bay; đổi kích thước thì cập nhật khung vẽ.
  useEffect(() => {
    if (!ready) return
    const controller = controllerRef.current
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!controller || !wrap || !canvas) return
    let frame = 0
    const update = () => {
      frame = 0
      const rect = wrap.getBoundingClientRect()
      const progress = flightProgress(rect.top, rect.height, window.innerHeight)
      controller.setProgress(progress)
      setShowHint(progress < 0.02)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onResize = () => {
      controller.resize(canvas.clientWidth, canvas.clientHeight)
      onScroll()
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ready])

  // Chỉ vẽ khi khu gallery đang hiện trên màn hình.
  useEffect(() => {
    if (ready) controllerRef.current?.setActive(visible)
  }, [ready, visible])

  const toNdc = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    }
  }

  return (
    <div
      ref={wrapRef}
      className="corridor-wrap"
      style={{ '--corridor-height': `${corridorScrollHeightSvh(photos.length)}svh` } as React.CSSProperties}
    >
      <div className="corridor-stage">
        <canvas
          ref={canvasRef}
          className="corridor-canvas"
          role="img"
          aria-label={`Bộ ảnh cưới gồm ${photos.length} ảnh. Dùng nút Xem tất cả ảnh để xem từng ảnh.`}
          onPointerMove={(event) => {
            if (event.pointerType !== 'mouse') return
            const { x, y } = toNdc(event)
            controllerRef.current?.setPointer(x, y)
          }}
          onPointerLeave={() => controllerRef.current?.setPointer(0, 0)}
          onClick={(event) => {
            const { x, y } = toNdc(event)
            controllerRef.current?.tap(x, y)
          }}
        />
        {!ready && (
          <p className="corridor-loading" role="status">
            Đang chuẩn bị ảnh…
          </p>
        )}
        <button
          type="button"
          className="corridor-open"
          onClick={() => onOpenViewer(focused ?? 0)}
        >
          {focused === null ? 'Xem tất cả ảnh' : 'Xem ảnh lớn'}
        </button>
        {ready && showHint && (
          <p className="corridor-hint" aria-hidden="true">
            Cuộn để bay xuyên qua · Chạm ảnh để phóng to
          </p>
        )}
      </div>
    </div>
  )
}
