import type { Wish } from './wishes-api'

const CACHE_KEY = 'wishes.firstPage.v1'
const MAX_CACHED = 50

/** Đọc trang đầu đã lưu lần trước. Trả về mảng rỗng nếu không có hoặc dữ liệu hỏng. */
export function readCachedWishes(): Wish[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(
      (item): item is Wish =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.name === 'string' &&
        typeof item.message === 'string',
    )
  } catch {
    // localStorage có thể bị chặn (private mode, in-app browser) hoặc JSON hỏng.
    return []
  }
}

export function writeCachedWishes(items: Wish[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, MAX_CACHED)))
  } catch {
    // Không lưu được thì thôi: cache chỉ là tiện ích.
  }
}
