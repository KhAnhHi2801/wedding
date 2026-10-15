import { useState } from 'react'
import { WishFormSheet } from '../components/wish-form-sheet'
import { WishList } from '../components/wish-list'
import { useWishes } from '../hooks/use-wishes'

/**
 * Phần lời chúc: nút mở form, danh sách HTML. Hiệu ứng bầu trời đèn lồng (phase sau) sẽ đặt thêm ở đây,
 * danh sách này vẫn giữ làm nơi đọc đầy đủ và phương án dự phòng.
 */
export function WishesSection() {
  const wishes = useWishes()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

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
        onSent={(hidden) =>
          setNotice(
            hidden
              ? 'Cảm ơn bạn! Lời chúc đã được gửi và sẽ hiện sau khi cô dâu chú rể xem qua.'
              : 'Cảm ơn bạn đã gửi lời chúc ♡',
          )
        }
      />
    </section>
  )
}
