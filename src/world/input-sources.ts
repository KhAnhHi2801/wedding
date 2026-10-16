import { MathUtils } from 'three'

/**
 * Toạ độ con trỏ/nghiêng máy chuẩn hoá -1..1 (trục y hướng lên). Là đối tượng thường, không qua store:
 * sự kiện này bắn hàng chục lần mỗi giây và không có giao diện nào cần render lại vì nó.
 */
export const pointerInput = { x: 0, y: 0 }

export interface ScrollReader {
  /** Tiến độ cuộn 0..1 của vùng chương. Chỉ đọc `scrollY`, không đo layout. */
  read: () => number
  dispose: () => void
}

/**
 * Tiến độ tính trên riêng vùng `content` (các chương), nên phần nội dung thường phía dưới
 * (giờ, địa điểm, quà mừng) không kéo lệch camera. Độ dài cuộn được đo lại khi vùng hoặc cửa sổ đổi kích thước,
 * không đo mỗi khung hình.
 */
export function createScrollReader(content: HTMLElement): ScrollReader {
  let scrollable = 1
  const measure = () => {
    scrollable = Math.max(content.offsetHeight - window.innerHeight, 1)
  }
  measure()
  const observer = new ResizeObserver(measure)
  observer.observe(content)
  window.addEventListener('resize', measure)
  return {
    read: () => MathUtils.clamp(window.scrollY / scrollable, 0, 1),
    dispose: () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    },
  }
}

interface OrientationPermissionApi {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/** Nghiêng ±30° quanh tư thế cầm máy thoải mái (beta ≈ 45°) là chạm biên độ tối đa. */
const TILT_RANGE_DEG = 30
const COMFORT_BETA_DEG = 45

/**
 * Ghi vị trí con trỏ (chuột) và độ nghiêng máy (con quay) vào `pointerInput`.
 * iOS chỉ cho đọc con quay sau khi khách chạm, nên xin quyền ở lần chạm đầu tiên.
 * Trả về hàm gỡ listener.
 */
export function attachPointerInput(): () => void {
  const controller = new AbortController()
  const { signal } = controller

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return
      pointerInput.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerInput.y = 1 - (event.clientY / window.innerHeight) * 2
    },
    { passive: true, signal }
  )

  const onTilt = (event: DeviceOrientationEvent) => {
    if (event.gamma === null || event.beta === null) return
    pointerInput.x = MathUtils.clamp(event.gamma / TILT_RANGE_DEG, -1, 1)
    pointerInput.y = MathUtils.clamp(-(event.beta - COMFORT_BETA_DEG) / TILT_RANGE_DEG, -1, 1)
  }

  window.addEventListener(
    'pointerdown',
    async (event) => {
      if (event.pointerType !== 'touch' || typeof DeviceOrientationEvent === 'undefined') return
      const api = DeviceOrientationEvent as unknown as OrientationPermissionApi
      const permission = (await api.requestPermission?.()) ?? 'granted'
      if (permission === 'granted' && !signal.aborted) window.addEventListener('deviceorientation', onTilt, { signal })
    },
    { once: true, signal }
  )

  return () => controller.abort()
}
