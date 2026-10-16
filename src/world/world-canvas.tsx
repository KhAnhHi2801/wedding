import { useEffect, useRef, useState } from 'react'
import { heroPhoto } from '../config/assets'
import { probeWebgl } from '../lib/webgl-support'
import { createWorldEngine, type WorldEngine } from './world-engine'
import { useWorld, worldStore } from './world-store'

/**
 * Canvas 3D cố định phía sau nội dung. Khi trình duyệt không có WebGL, nạp cảnh thất bại, hoặc mất context,
 * hiện ảnh tĩnh thay thế để trang vẫn đọc được. Mất context rồi được trả lại thì dựng lại engine (đổi `session`).
 *
 * Mỗi engine tự tạo canvas riêng: gỡ engine sẽ giải phóng context WebGL của canvas đó, nên không thể
 * dùng lại cùng một phần tử canvas cho engine kế tiếp (StrictMode gắn effect hai lần ở môi trường dev).
 */
export function WorldCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const status = useWorld((state) => state.status)
  const [session, setSession] = useState(0)

  useEffect(() => {
    const { setStatus } = worldStore.getState()
    const host = hostRef.current
    if (!host || !probeWebgl()) {
      setStatus('unsupported')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.className = 'world-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    host.append(canvas)
    // CSS ẩn/hiện canvas theo trạng thái (mờ dần khi sẵn sàng, ẩn khi dùng ảnh dự phòng).
    const syncStatus = () => {
      canvas.dataset.status = worldStore.getState().status
    }
    syncStatus()
    const unsubscribe = worldStore.subscribe(syncStatus)

    setStatus('loading')
    let cancelled = false
    let engine: WorldEngine | null = null
    // Tiến độ cuộn tính trên vùng chương (#noi-dung); nếu thiếu thì dùng cả trang.
    const scrollContent = document.getElementById('noi-dung') ?? document.documentElement
    createWorldEngine(canvas, { scrollContent, onContextRestored: () => setSession((value) => value + 1) })
      .then((created) => {
        if (cancelled) created.dispose()
        else engine = created
      })
      .catch(() => setStatus('unsupported'))

    return () => {
      cancelled = true
      unsubscribe()
      engine?.dispose()
      canvas.remove()
    }
  }, [session])

  const showFallback = status === 'unsupported' || status === 'lost'

  return (
    <>
      <div ref={hostRef} />
      {showFallback && heroPhoto ? (
        <img
          className='world-fallback'
          src={heroPhoto.src}
          width={heroPhoto.width}
          height={heroPhoto.height}
          alt=''
          aria-hidden='true'
        />
      ) : null}
    </>
  )
}
