import { useCallback, useEffect, useRef, useState } from 'react'

const RESET_AFTER_MS = 2000

/**
 * Dự phòng cho trình duyệt/in-app không có Clipboard API (hoặc không phải HTTPS).
 * Phải gọi đồng bộ trong sự kiện chạm: WebKit chỉ cho `execCommand('copy')` khi còn nằm
 * trong cử chỉ của người dùng.
 */
function legacyCopy(text: string): boolean {
  const previouslyFocused = document.activeElement as HTMLElement | null
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'fixed'
  el.style.top = '0'
  el.style.opacity = '0'
  // >= 16px để iOS không tự phóng to trang khi textarea nhận focus.
  el.style.fontSize = '16px'
  document.body.appendChild(el)
  el.select()
  el.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(el)
  // Trả focus về nút để người dùng bàn phím/đọc màn hình không mất vị trí.
  previouslyFocused?.focus?.()
  return ok
}

type CopyStatus = 'idle' | 'copied' | 'failed'

export function useCopyToClipboard() {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(async (text: string) => {
    window.clearTimeout(timer.current)
    let ok = false
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        ok = true
      } catch {
        // Bị chặn (chính sách quyền của WebView): cử chỉ có thể đã hết hiệu lực, thử dự phòng.
        ok = legacyCopy(text)
      }
    } else {
      ok = legacyCopy(text)
    }
    setStatus(ok ? 'copied' : 'failed')
    // 'failed' giữ nguyên đến lần bấm tiếp theo để khách kịp đọc hướng dẫn tự chép.
    if (ok) timer.current = window.setTimeout(() => setStatus('idle'), RESET_AFTER_MS)
    return ok
  }, [])

  return { status, copy }
}
