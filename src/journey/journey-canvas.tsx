import { useEffect, useRef, useState } from 'react'
import { probeWebgl } from '../lib/webgl-support'

interface JourneyCanvasProps {
  /** Giảm chuyển động: không dựng 3D, trang dùng bản HTML. */
  calm: boolean
}

/**
 * Canvas Three.js cố định phía sau trang: camera bay theo cuộn. Chỉ nạp Three.js khi có WebGL và khách không bật giảm
 * chuyển động; lỗi hoặc mất context thì bỏ canvas và để bản HTML (luôn có đủ thông tin) tiếp tục. Gắn
 * `data-journey="3d|html"` lên <html> để CSS biết đang ở chế độ nào.
 */
export function JourneyCanvas({ calm }: JourneyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const enabled = !calm && !failed && probeWebgl()

  useEffect(() => {
    document.documentElement.dataset.journey = enabled ? '3d' : 'html'
  }, [enabled])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!enabled || !canvas) return
    let cancelled = false
    let running: { dispose: () => void } | null = null
    import('./start-journey')
      .then(({ startJourney }) => {
        if (cancelled) return
        running = startJourney({
          canvas,
          onFail: (reason) => {
            console.warn(`[journey] chuyển sang bản HTML: ${reason}`)
            setFailed(true)
          },
        })
      })
      .catch((error: unknown) => {
        // In-app browser khó xem console: để lại dấu vết cho lần chẩn đoán qua kết nối từ xa.
        console.warn('[journey] không dựng được cảnh 3D, dùng bản HTML:', error)
        setFailed(true)
      })
    return () => {
      cancelled = true
      running?.dispose()
    }
  }, [enabled])

  if (!enabled) return null
  return <canvas ref={canvasRef} className="journey-canvas" aria-hidden="true" />
}
