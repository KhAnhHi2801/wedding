import { wishesEndpoint } from '../config/env'

export interface Wish {
  id: string
  createdAt: string
  name: string
  message: string
}

export interface WishesPage {
  items: Wish[]
  /** Con trỏ để lấy trang cũ hơn; null = đã hết. */
  nextCursor: string | null
}

export type WishApiErrorCode =
  | 'not_configured'
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'too_fast'
  | 'rejected'
  | 'server'

export class WishApiError extends Error {
  readonly code: WishApiErrorCode
  constructor(code: WishApiErrorCode) {
    super(code)
    this.name = 'WishApiError'
    this.code = code
  }
}

export const PAGE_SIZE = 50
const READ_TIMEOUT_MS = 10_000
// Ghi chờ lâu hơn: Apps Script khởi động lạnh vài giây và có thể phải đợi khóa; hết giờ sớm sẽ báo lỗi dù lời chúc đã được ghi.
const WRITE_TIMEOUT_MS = 25_000

export interface SubmitPayload {
  name: string
  message: string
  /** Mã ẩn danh theo trình duyệt, chỉ để giảm spam ngẫu nhiên (không dùng cho bảo mật). */
  token: string
  /** Thời gian khách mở form đến lúc bấm gửi; bot điền quá nhanh bị từ chối. */
  elapsedMs: number
  /** Ô bẫy cho bot: người thật không thấy nên luôn rỗng. */
  website: string
  /** Mã của lần gửi này; gửi lại cùng mã (sau khi hết giờ chờ) thì máy chủ không ghi trùng. */
  requestId: string
}

export interface SubmitResult {
  id: string
  /** 'hidden' = đã ghi nhận nhưng chờ cô dâu chú rể duyệt (vd. có từ chưa phù hợp). */
  status: 'visible' | 'hidden'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isWish = (value: unknown): value is Wish =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.name === 'string' &&
  typeof value.message === 'string'

/** Dữ liệu từ Google Sheet không đáng tin: chỉ nhận đúng hình dạng mong đợi, bỏ phần còn lại. */
export function parseWishesPage(data: unknown): WishesPage {
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.items)) {
    throw new WishApiError('server')
  }
  const nextCursor = typeof data.nextCursor === 'string' ? data.nextCursor : null
  return { items: data.items.filter(isWish).map(({ id, createdAt, name, message }) => ({ id, createdAt, name, message })), nextCursor }
}

export function parseSubmitResult(data: unknown): SubmitResult {
  if (!isRecord(data)) throw new WishApiError('server')
  if (data.ok !== true) {
    if (data.error === 'rate_limited') throw new WishApiError('rate_limited')
    if (data.error === 'too_fast') throw new WishApiError('too_fast')
    if (data.error === 'server') throw new WishApiError('server')
    throw new WishApiError('rejected')
  }
  return {
    id: typeof data.id === 'string' ? data.id : '',
    status: data.status === 'hidden' ? 'hidden' : 'visible',
  }
}

async function request(init: RequestInit, query = '', timeoutMs = READ_TIMEOUT_MS): Promise<unknown> {
  if (!wishesEndpoint) {
    console.warn('Lời chúc: chưa đặt VITE_WISHES_ENDPOINT (xem docs/wishes-setup.md).')
    throw new WishApiError('not_configured')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${wishesEndpoint}${query}`, { ...init, signal: controller.signal })
    if (!response.ok) throw new WishApiError('server')
    return await response.json()
  } catch (error) {
    if (error instanceof WishApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw new WishApiError('timeout')
    // Cả lỗi mạng lẫn JSON hỏng (Apps Script trả trang lỗi HTML) đều không dùng được.
    throw new WishApiError(error instanceof SyntaxError ? 'server' : 'network')
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchWishes(cursor: string | null = null): Promise<WishesPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (cursor) params.set('before', cursor)
  return parseWishesPage(await request({ method: 'GET' }, `?${params}`))
}

export async function submitWish(payload: SubmitPayload): Promise<SubmitResult> {
  // text/plain là "simple request": trình duyệt không gửi preflight, mà Apps Script không hỗ trợ OPTIONS.
  return parseSubmitResult(
    await request(
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      },
      '',
      WRITE_TIMEOUT_MS,
    ),
  )
}

const TOKEN_KEY = 'wishes.token'

/** Mã ẩn danh lưu ở localStorage (có thể bị chặn trong in-app/private mode: khi đó dùng mã tạm theo phiên). */
let sessionToken: string | null = null
export function getClientToken(): string {
  try {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) return stored
    const created = newId()
    localStorage.setItem(TOKEN_KEY, created)
    return created
  } catch {
    sessionToken ??= newId()
    return sessionToken
  }
}

/** Mã ngẫu nhiên cho token trình duyệt và requestId. */
export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
