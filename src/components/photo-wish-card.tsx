import { useEffect, useRef, useSyncExternalStore } from 'react'
import { wishLights } from '../journey/wish-lights-state'

const AUTO_EVERY_MS = 5000
/** Sau khi khách bấm "Lời chúc khác" thì ngừng tự chuyển trong chừng này mili giây. */
const IDLE_BEFORE_AUTO_MS = 8000

/**
 * Thẻ giấy kem phía dưới album: hiện lời chúc của ảnh đang ở giữa khung. Tự chuyển qua từng lời chúc của ảnh đó để khách
 * đọc thụ động, có nút "Lời chúc khác" và "Gửi lời chúc". Chữ nằm ở HTML (không vẽ trong 3D) để rõ nét và đọc được bằng
 * trình đọc màn hình; thẻ nơ treo trên vòm hoa 3D chỉ là tín hiệu "ảnh này có lời chúc".
 */
export function PhotoWishCard() {
  const photoIndex = useSyncExternalStore(wishLights.subscribe, wishLights.getPhotoIndex)
  const list = useSyncExternalStore(wishLights.subscribe, () => wishLights.wishesOfPhoto(photoIndex))
  const activeId = useSyncExternalStore(wishLights.subscribe, wishLights.getActiveId)
  const touchedAt = useRef(0)
  const index = Math.max(
    0,
    list.findIndex((wish) => wish.id === activeId),
  )
  const current = list[index] ?? null

  // Đổi ảnh hoặc danh sách đổi: chọn lời chúc đầu của ảnh đó (hoặc không chọn gì nếu ảnh chưa có lời chúc).
  useEffect(() => {
    if (list.length === 0) wishLights.setActive(null)
    else if (!list.some((wish) => wish.id === wishLights.getActiveId())) wishLights.setActive(list[0].id)
  }, [list])

  const showNext = () => {
    if (list.length > 1) wishLights.setActive(list[(index + 1) % list.length].id)
  }

  useEffect(() => {
    if (list.length < 2) return
    const timer = window.setInterval(() => {
      if (Date.now() - touchedAt.current < IDLE_BEFORE_AUTO_MS) return
      const at = list.findIndex((wish) => wish.id === wishLights.getActiveId())
      wishLights.setActive(list[(at + 1) % list.length].id)
    }, AUTO_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [list])

  return (
    <div className="photo-wish-card">
      <div className="photo-wish-text" aria-live="polite">
        {current ? (
          <>
            <p className="wish-name">{current.name}</p>
            <p className="wish-message">{current.message}</p>
          </>
        ) : (
          <p className="photo-wish-empty">Hãy là người đầu tiên chúc ở khoảnh khắc này</p>
        )}
      </div>
      <div className="photo-wish-actions">
        {list.length > 1 && (
          <button
            type="button"
            className="btn btn-on-sky"
            onClick={() => {
              touchedAt.current = Date.now()
              showNext()
            }}
          >
            Lời chúc khác ({index + 1}/{list.length})
          </button>
        )}
        <button type="button" className="btn" onClick={() => window.dispatchEvent(new CustomEvent('wish:compose'))}>
          Gửi lời chúc
        </button>
      </div>
    </div>
  )
}
