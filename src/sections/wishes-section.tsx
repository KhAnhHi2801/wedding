import { useEffect, useMemo, useState } from 'react'
import { WishFormSheet } from '../components/wish-form-sheet'
import { WishList } from '../components/wish-list'
import { isPendingWish, useWishes } from '../hooks/use-wishes'
import { wishLights } from '../journey/wish-lights-state'

/**
 * Phần lời chúc: nút mở form và danh sách HTML (nơi đọc đầy đủ, đọc được cả khi 3D không chạy). Lời chúc cũng hiện theo
 * từng ảnh ở phần album (xem photo-wish-card); nút "Gửi lời chúc" ở đó mở cùng form này qua sự kiện `wish:compose`.
 */
export function WishesSection() {
  const wishes = useWishes()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Lời chúc đang gửi chưa có id thật nên không gắn vào ảnh: tránh nhảy ảnh khi nhận id, và không để "ma" nếu gửi lỗi.
  const sent = useMemo(() => wishes.items.filter((wish) => !isPendingWish(wish)), [wishes.items])

  // Cảnh album đọc danh sách qua kho chung (không qua React).
  useEffect(() => {
    wishLights.setWishes(sent.map(({ id, name, message }) => ({ id, name, message })))
  }, [sent])

  useEffect(() => {
    const open = () => {
      setNotice(null)
      setSheetOpen(true)
    }
    window.addEventListener('wish:compose', open)
    return () => window.removeEventListener('wish:compose', open)
  }, [])

  return (
    <section className="section section-wishes" id="wishes" aria-labelledby="wishes-title">
      <h2 className="section-title" id="wishes-title">
        Lời chúc
      </h2>
      <p className="section-sub">Mỗi lời chúc là một món quà tinh thần chúng mình trân trọng</p>

      <div className="wish-cta">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setNotice(null)
            setSheetOpen(true)
          }}
        >
          Gửi lời chúc
        </button>
      </div>

      <p className="wish-notice" role="status">
        {notice}
      </p>

      <WishList
        items={wishes.items}
        status={wishes.status}
        errorCode={wishes.errorCode}
        stale={wishes.status === 'ready' && wishes.errorCode !== null}
        hasMore={wishes.hasMore}
        loadingMore={wishes.loadingMore}
        moreError={wishes.moreError}
        onRetry={wishes.reload}
        onLoadMore={wishes.loadMore}
      />

      <WishFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSend={wishes.send}
        onSent={(hidden, id) => {
          // Lời chúc mới gắn vào ảnh khách đang xem và hiện ngay ở thẻ của ảnh đó.
          if (id) wishLights.markBorn(id)
          setNotice(
            hidden
              ? 'Cảm ơn bạn! Lời chúc đã được gửi và sẽ hiện sau khi cô dâu chú rể xem qua.'
              : 'Cảm ơn bạn đã gửi lời chúc ♡',
          )
        }}
      />
    </section>
  )
}
