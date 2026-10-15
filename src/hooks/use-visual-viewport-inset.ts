import { useEffect, useState } from 'react'

export interface KeyboardGeometry {
  /** Chiều cao bàn phím ảo (px): khoảng cách giữa đáy vùng nhìn thấy và đáy màn hình. */
  inset: number
  /** Chiều cao vùng nhìn thấy khi bàn phím mở; null khi bàn phím đóng. */
  visibleHeight: number | null
}

const CLOSED: KeyboardGeometry = { inset: 0, visibleHeight: null }

/**
 * Trên iOS Safari và Chrome Android mới, bàn phím phủ lên trang chứ không co layout, nên phần tử bám đáy phải
 * được nâng lên bằng `inset` và bị giới hạn chiều cao bằng `visibleHeight` để không tràn lên khỏi màn hình.
 */
export function useVisualViewportInset(active: boolean): KeyboardGeometry {
  const [geometry, setGeometry] = useState<KeyboardGeometry>(CLOSED)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!active || !viewport) return
    const update = () => {
      // Đang phóng to bằng hai ngón: kích thước vùng nhìn thấy đổi theo nhưng không phải do bàn phím.
      if (viewport.scale !== 1) return
      const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
      setGeometry(inset > 0 ? { inset, visibleHeight: Math.round(viewport.height) } : CLOSED)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      setGeometry(CLOSED)
    }
  }, [active])

  return geometry
}
