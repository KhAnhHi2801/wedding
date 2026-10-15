import type { ListStatus } from '../hooks/use-wishes'
import type { Wish, WishApiErrorCode } from '../lib/wishes-api'

interface WishListProps {
  items: Wish[]
  status: ListStatus
  errorCode: WishApiErrorCode | null
  /** Đang hiện dữ liệu cũ vì lần cập nhật gần nhất thất bại. */
  stale: boolean
  hasMore: boolean
  loadingMore: boolean
  moreError: boolean
  onRetry: () => void
  onLoadMore: () => void
}

function Skeleton() {
  return (
    <ul className="wish-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li className="wish-item skeleton" key={i}>
          <span className="skeleton-line short" />
          <span className="skeleton-line" />
        </li>
      ))}
    </ul>
  )
}

/** Danh sách lời chúc dạng HTML: nơi đọc đầy đủ, phân trang, và là phần dự phòng khi không có 3D. */
export function WishList({
  items,
  status,
  errorCode,
  stale,
  hasMore,
  loadingMore,
  moreError,
  onRetry,
  onLoadMore,
}: WishListProps) {
  if (status === 'loading' && items.length === 0) {
    return (
      <div aria-busy="true">
        <span className="visually-hidden" role="status">
          Đang tải lời chúc
        </span>
        <Skeleton />
      </div>
    )
  }

  if (status === 'error' && items.length === 0) {
    return (
      <div className="wish-state">
        <p>
          {errorCode === 'not_configured'
            ? 'Lời chúc tạm thời chưa mở. Bạn quay lại sau nhé.'
            : 'Chưa tải được lời chúc. Bạn thử lại giúp chúng mình nhé.'}
        </p>
        {errorCode !== 'not_configured' && (
          <button type="button" className="btn btn-on-sky" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="wish-state">
        <p>Hãy là người đầu tiên gửi lời chúc cho chúng mình nhé ♡</p>
      </div>
    )
  }

  return (
    <div>
      {stale && (
        <p className="wish-stale">
          Chưa cập nhật được lời chúc mới.{' '}
          <button type="button" className="link-button" onClick={onRetry}>
            Thử lại
          </button>
        </p>
      )}
      <ul className="wish-list">
        {items.map((wish) => (
          <li className="wish-item" key={wish.id}>
            {/* React tự escape: tên/lời chúc luôn hiển thị như chữ thuần. */}
            <p className="wish-name">{wish.name}</p>
            <p className="wish-message">{wish.message}</p>
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="wish-more">
          {moreError && <p>Chưa tải thêm được, bạn thử lại nhé.</p>}
          <button type="button" className="btn btn-on-sky" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? 'Đang tải…' : moreError ? 'Thử lại' : 'Xem thêm'}
          </button>
        </div>
      )}
    </div>
  )
}
