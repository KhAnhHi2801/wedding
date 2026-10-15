/**
 * Trạng thái cổng vòm hoa ở đầu trang, dùng chung giữa cảnh 3D (vẽ và quyết định khi nào xong) và phần chữ HTML
 * phủ lên (đổi bố cục theo trạng thái). Mặc định `open`: khi không có 3D (không WebGL, giảm chuyển động, lỗi) thì
 * trang không có cổng nào để chờ (thuộc tính `data-gate` trên <html> chỉ xuất hiện khi có 3D). `loading` chỉ có khi máy sẽ chạy 3D; mọi đường lỗi/gỡ cảnh đều quay về `open`.
 */
export type GateState = 'loading' | 'closed' | 'opening' | 'open'

type Listener = () => void

let state: GateState = 'open'
const listeners = new Set<Listener>()

const set = (next: GateState) => {
  if (next === state) return
  state = next
  // Ghi ra <html> đồng bộ để CSS ẩn/hiện cả trang theo trạng thái cổng ngay từ khung hình đầu, không chờ React render.
  if (typeof document !== 'undefined') document.documentElement.dataset.gate = next
  listeners.forEach((listener) => listener())
}

export const gate = {
  getState: (): GateState => state,
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Máy sẽ chạy 3D nhưng cảnh chưa sẵn sàng: hero chờ (chưa hiện ảnh) thay vì hiện ảnh rồi để cổng chồng lên. */
  loading() {
    set('loading')
  },
  /** Cảnh 3D đã dựng xong cổng: đóng lại và chờ mở. */
  close() {
    set('closed')
  },
  /**
   * Yêu cầu mở (chạm, cuộn, hết giờ chờ). Đang đóng thì bắt đầu mở; đang mở dở thì bỏ qua hiệu ứng, nhảy thẳng
   * tới trạng thái đã mở. Cổng chưa có (loading) thì chưa có gì để mở: bỏ qua.
   */
  requestOpen() {
    if (state === 'closed') set('opening')
    else if (state === 'opening') set('open')
  },
  /** Cổng đã mở xong, hoặc cảnh 3D bị gỡ. */
  finish() {
    set('open')
  },
}
