import { useEffect, useRef, useState } from 'react'
import { probeWebgl } from '../lib/webgl-support'
import { gate } from './gate-state'

/** Quá thời gian này mà cảnh 3D chưa lên khung hình đầu tiên thì bỏ 3D, hiện bản HTML (mạng chậm, máy yếu, WebGL treo). */
export const READY_TIMEOUT_MS = 12000

interface JourneyCanvasProps {
  /** Giảm chuyển động: không dựng 3D, trang dùng bản HTML. */
  calm: boolean
  /** Ảnh cặp đôi hiện sau cổng khi cổng mở. */
  heroSrc?: string | null
}

/**
 * Canvas Three.js cố định phía sau trang: camera bay theo cuộn. Chỉ nạp Three.js khi có WebGL và khách không bật giảm
 * chuyển động; lỗi hoặc mất context thì bỏ canvas và để bản HTML (luôn có đủ thông tin) tiếp tục. Gắn
 * `data-journey="3d|html"` lên <html> để CSS biết đang ở chế độ nào; chỉ chuyển sang `3d` sau khi khung hình 3D
 * đầu tiên đã lên màn hình. Trong lúc chờ, hero ở trạng thái `loading` (xem gate-state.ts): chỉ có tấm lời mời trên nền
 * kem, nội dung khác ẩn. Quá `READY_TIMEOUT_MS` (chỉ tính lúc tab đang hiển thị) hoặc lỗi thì bỏ 3D, hiện bản HTML đầy đủ.
 */
export function JourneyCanvas({ calm, heroSrc = null }: JourneyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const enabled = !calm && !failed && probeWebgl()

  useEffect(() => {
    document.documentElement.dataset.journey = enabled && ready ? '3d' : 'html'
  }, [enabled, ready])

  // Không chạy 3D (giảm chuyển động, không WebGL, lỗi, quá lâu): hero phải là bản HTML đầy đủ, đừng chờ cổng nữa.
  useEffect(() => {
    if (!enabled) gate.finish()
  }, [enabled])

  // Hạn chờ chỉ tính lúc tab đang hiển thị: khi tab ẩn (mở link nền, đổi ứng dụng) trình duyệt dừng vẽ nên không có
  // khung hình nào, đó không phải lỗi. Hiện lại thì đếm lại từ đầu.
  useEffect(() => {
    if (!enabled || ready) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      timer = setTimeout(() => {
        console.warn('[journey] cảnh 3D quá lâu chưa sẵn sàng, dùng bản HTML')
        setFailed(true)
      }, READY_TIMEOUT_MS)
    }
    arm()
    document.addEventListener('visibilitychange', arm)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', arm)
    }
  }, [enabled, ready])

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
          heroSrc,
          onReady: () => setReady(true),
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
  }, [enabled, heroSrc])

  if (!enabled) return null
  return <canvas ref={canvasRef} className="journey-canvas" aria-hidden="true" />
}
