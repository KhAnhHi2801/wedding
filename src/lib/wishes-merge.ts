import type { Wish } from './wishes-api'

/** Giữ phần tử đầu tiên cho mỗi `id`, giữ nguyên thứ tự. */
export function dedupeById(items: Wish[]): Wish[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

/**
 * Trang đầu mới tải về thay thế danh sách cũ, nhưng lời chúc đang gửi dở (chưa có id thật từ máy chủ)
 * vẫn được giữ ở đầu danh sách.
 */
export function mergeFirstPage(fetched: Wish[], pending: Wish[]): Wish[] {
  return dedupeById([...pending, ...fetched])
}

/** Thêm trang cũ hơn vào cuối, bỏ phần đã có (con trỏ theo số dòng có thể lệch nếu Sheet bị xóa dòng). */
export function appendPage(current: Wish[], page: Wish[]): Wish[] {
  return dedupeById([...current, ...page])
}
