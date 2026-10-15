import { useRef, useState } from 'react'
import { WishFormSheet } from '../components/wish-form-sheet'
import { WishList } from '../components/wish-list'
import { WishSky } from '../components/wish-sky'
import { isPendingWish, useWishes } from '../hooks/use-wishes'

/**
 * Phần lời chúc: nút mở form, bầu trời đèn lồng và danh sách HTML (nơi đọc đầy đủ, đọc được cả khi canvas không chạy).
 */
export function WishesSection() {
  const wishes = useWishes()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const skyRef = useRef<HTMLDivElement>(null)
  // Lời chúc đang gửi chưa có id thật nên không đưa lên trời: tránh đèn nhảy vị trí khi nhận id, và không để "ma" nếu gửi lỗi.
  const skyWishes = wishes.items.filter((wish) => !isPendingWish(wish))

  return (
    <section className="section section-sky" id="wishes" aria-labelledby="wishes-title">
      <h2 className="section-title" id="wishes-title">
        Lời chúc
      </h2>
      <p className="section-sub">Mỗi lời chúc là một món quà tinh thần chúng mình trân trọng</p>

      <div className="wish-cta">
        <button
          type="button"
          className="btn btn-on-sky"
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

      <div ref={skyRef}>
        <WishSky wishes={skyWishes} highlightId={highlightId} />
      </div>

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
          if (id) {
            setHighlightId(id)
            // Đưa bầu trời vào tầm nhìn để khách thấy đèn của mình bay lên.
            skyRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
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
