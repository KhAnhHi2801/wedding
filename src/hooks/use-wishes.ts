import { useCallback, useEffect, useRef, useState } from 'react'
import { validateWish, type WishError } from '../lib/wish-validation'
import {
  fetchWishes,
  getClientToken,
  newId,
  submitWish,
  WishApiError,
  type Wish,
  type WishApiErrorCode,
} from '../lib/wishes-api'
import { readCachedWishes, writeCachedWishes } from '../lib/wishes-cache'
import { appendPage, mergeFirstPage } from '../lib/wishes-merge'

export type ListStatus = 'loading' | 'ready' | 'error'
export type SendError = WishError | WishApiErrorCode
export type SendOutcome = { ok: true; hidden: boolean; id?: string } | { ok: false; error: SendError }

export interface SendInput {
  name: string
  message: string
  elapsedMs: number
  website: string
  /** Giữ nguyên khi gửi lại sau lỗi để máy chủ không ghi trùng; đổi mới sau khi gửi thành công. */
  requestId: string
}

const PENDING_PREFIX = 'local-'
const isPending = (wish: Wish) => wish.id.startsWith(PENDING_PREFIX)

/** Lời chúc đang gửi (chưa có id thật từ máy chủ). */
export const isPendingWish = isPending

export function useWishes() {
  // Hiện ngay trang đầu đã lưu lần trước, rồi cập nhật từ máy chủ (stale-while-revalidate).
  const [items, setItems] = useState<Wish[]>(() => readCachedWishes())
  const [status, setStatus] = useState<ListStatus>(items.length ? 'ready' : 'loading')
  const [errorCode, setErrorCode] = useState<WishApiErrorCode | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)

  // Bản sao mới nhất của state để các callback bất đồng bộ đọc được mà không phải khai báo phụ thuộc.
  const itemsRef = useRef(items)
  const cursorRef = useRef(nextCursor)
  useEffect(() => {
    itemsRef.current = items
    cursorRef.current = nextCursor
  })
  const loadingMoreRef = useRef(false)
  // Lời chúc của chính khách đã gửi thành công trong phiên này. Một lần tải trang đầu bắt đầu TRƯỚC khi gửi
  // có thể về sau và không chứa chúng: giữ lại cho đến khi máy chủ trả về chúng.
  const confirmedRef = useRef<Wish[]>([])

  const load = useCallback(async () => {
    try {
      const page = await fetchWishes()
      const fetchedIds = new Set(page.items.map((wish) => wish.id))
      const ownNotYetServed = confirmedRef.current.filter((wish) => !fetchedIds.has(wish.id))
      confirmedRef.current = ownNotYetServed
      setItems((current) => mergeFirstPage(page.items, [...current.filter(isPending), ...ownNotYetServed]))
      setNextCursor(page.nextCursor)
      setErrorCode(null)
      setStatus('ready')
      writeCachedWishes(page.items)
    } catch (error) {
      // Có dữ liệu cũ thì vẫn hiển thị, chỉ báo lỗi khi không có gì để cho khách xem.
      setErrorCode(error instanceof WishApiError ? error.code : 'network')
      setStatus(itemsRef.current.length ? 'ready' : 'error')
    }
  }, [])

  useEffect(() => {
    // Tải dữ liệu từ máy chủ là đồng bộ hóa với hệ thống bên ngoài; setState chỉ xảy ra sau khi có phản hồi.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  /** Nút "Thử lại": quay về trạng thái đang tải rồi tải lại. */
  const reload = useCallback(() => {
    setErrorCode(null)
    setStatus(itemsRef.current.length ? 'ready' : 'loading')
    return load()
  }, [load])

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current
    if (!cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setMoreError(false)
    try {
      const page = await fetchWishes(cursor)
      setItems((current) => appendPage(current, page.items))
      setNextCursor(page.nextCursor)
    } catch {
      setMoreError(true)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  const send = useCallback(async (input: SendInput): Promise<SendOutcome> => {
    const validation = validateWish(input.name, input.message)
    if (!validation.ok) return { ok: false, error: validation.error }

    // Hiện lời chúc ngay (optimistic); gỡ lại nếu gửi không thành công.
    const pendingId = `${PENDING_PREFIX}${newId()}`
    const optimistic: Wish = {
      id: pendingId,
      createdAt: new Date().toISOString(),
      name: validation.name,
      message: validation.message,
    }
    setItems((current) => [optimistic, ...current])
    try {
      const result = await submitWish({
        name: validation.name,
        message: validation.message,
        token: getClientToken(),
        elapsedMs: input.elapsedMs,
        website: input.website,
        requestId: input.requestId,
      })
      if (result.status === 'hidden' || !result.id) {
        // Chờ duyệt: không hiển thị công khai nên gỡ khỏi danh sách.
        setItems((current) => current.filter((wish) => wish.id !== pendingId))
        return { ok: true, hidden: true }
      }
      const confirmed: Wish = { ...optimistic, id: result.id }
      confirmedRef.current = [confirmed, ...confirmedRef.current]
      setItems((current) => current.map((wish) => (wish.id === pendingId ? confirmed : wish)))
      return { ok: true, hidden: false, id: result.id }
    } catch (error) {
      setItems((current) => current.filter((wish) => wish.id !== pendingId))
      return { ok: false, error: error instanceof WishApiError ? error.code : 'network' }
    }
  }, [])

  return {
    items,
    status,
    errorCode,
    hasMore: nextCursor !== null,
    loadingMore,
    moreError,
    reload,
    loadMore,
    send,
  }
}
