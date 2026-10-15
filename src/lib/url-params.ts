export type Side = 'trai' | 'gai'

export interface Invite {
  /** Phía nhà được chọn qua ?nha; null = hiện cả hai nhà. */
  side: Side | null
  /** Tên khách qua ?khach; null = lời mời chung. */
  guestName: string | null
}

const MAX_GUEST_NAME_LENGTH = 40
// Cc: ký tự điều khiển (C0/C1). Cf: ký tự định dạng vô hình (zero-width, đảo chiều văn bản RLO/LRO...)
// có thể làm tên hiển thị sai lệch.
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu

function sanitizeGuestName(raw: string): string | null {
  // NFC trước khi cắt để dấu thanh tiếng Việt dạng tổ hợp không bị tách khỏi chữ cái.
  const collapsed = raw.normalize('NFC').replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ').trim()
  // Array.from đếm theo ký tự, không cắt đôi cặp surrogate.
  const clipped = Array.from(collapsed).slice(0, MAX_GUEST_NAME_LENGTH).join('').trim()
  return clipped || null
}

/**
 * Đọc tham số mời từ query string. Giá trị do người gửi link đặt nên không
 * được tin cậy: `nha` chỉ nhận `trai|gai`, `khach` chỉ dùng như text thuần.
 */
export function parseInvite(search: string): Invite {
  const params = new URLSearchParams(search)
  const nha = params.get('nha')?.trim().toLowerCase()
  const side: Side | null = nha === 'trai' || nha === 'gai' ? nha : null
  const rawGuest = params.get('khach')
  return { side, guestName: rawGuest ? sanitizeGuestName(rawGuest) : null }
}
