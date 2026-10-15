import { PROFANITY_WORDS } from './profanity-list'

export const NAME_MAX = 40
export const MESSAGE_MIN = 2
export const MESSAGE_MAX = 300

// Cc: ký tự điều khiển. Cf: ký tự định dạng vô hình (zero-width, đảo chiều văn bản...).
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu

/**
 * Chuẩn hóa văn bản người dùng nhập. Logic này được lặp lại trong apps-script/wishes.gs
 * (hàm `clean_`); `apps-script/wishes.test.ts` kiểm tra hai bản cho cùng kết quả.
 */
export function cleanText(raw: string): string {
  // Gộp khoảng trắng (gồm xuống dòng) trước khi xóa ký tự vô hình, để "A\nB" thành "A B".
  return raw.normalize('NFC').replace(/\s+/g, ' ').replace(INVISIBLE_CHARS, '').trim()
}

const length = (text: string) => Array.from(text).length

/** Tách thành các từ chữ/số rồi nối bằng dấu cách, để so khớp theo từ nguyên. */
function toWordString(text: string): string {
  return ` ${text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')} `
}

export function containsProfanity(text: string): boolean {
  const words = toWordString(text)
  return PROFANITY_WORDS.some((word) => words.includes(` ${word} `))
}

export type WishError =
  | 'name_required'
  | 'name_too_long'
  | 'message_too_short'
  | 'message_too_long'
  | 'profanity'

export type WishValidation =
  | { ok: true; name: string; message: string }
  | { ok: false; error: WishError }

export function validateWish(name: string, message: string): WishValidation {
  const cleanName = cleanText(name)
  const cleanMessage = cleanText(message)
  if (!cleanName) return { ok: false, error: 'name_required' }
  if (length(cleanName) > NAME_MAX) return { ok: false, error: 'name_too_long' }
  if (length(cleanMessage) < MESSAGE_MIN) return { ok: false, error: 'message_too_short' }
  if (length(cleanMessage) > MESSAGE_MAX) return { ok: false, error: 'message_too_long' }
  if (containsProfanity(cleanName) || containsProfanity(cleanMessage)) {
    return { ok: false, error: 'profanity' }
  }
  return { ok: true, name: cleanName, message: cleanMessage }
}

/** Câu báo lỗi thân thiện hiển thị cho khách. */
export const WISH_ERROR_TEXT: Record<WishError, string> = {
  name_required: 'Bạn cho chúng mình biết tên của bạn nhé.',
  name_too_long: `Tên hơi dài, bạn rút gọn giúp chúng mình (tối đa ${NAME_MAX} ký tự) nhé.`,
  message_too_short: 'Bạn viết thêm đôi lời chúc nhé.',
  message_too_long: `Lời chúc hơi dài, bạn rút gọn giúp chúng mình (tối đa ${MESSAGE_MAX} ký tự) nhé.`,
  profanity:
    'Tơ hồng đã se, duyên lành đã định, Bụt chỉ nhận lời chúc thanh tịnh mà thôi. Bạn vui lòng gột rửa từ ngữ rồi gửi lại nha.',
}
