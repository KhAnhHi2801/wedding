import { clamp01 } from './scroll-progress'

/** Cổng tham chiếu (màn hình trung bình): dùng để đổi diện tích cổng thật ra hệ số số lượng hoa/lá. */
const REFERENCE_AREA = 2 * 2 * 2.2 + (Math.PI * 2 * 2) / 2

/** Hoa nở lần lượt trong ~1.5s đầu. */
export const INTRO_SECONDS = 1.5
const BLOOM_SECONDS = 0.55
export const MAX_BLOOM_DELAY = INTRO_SECONDS - BLOOM_SECONDS
/** Sau ngần này giây kể từ lúc cảnh sẵn sàng mà khách chưa chạm/cuộn thì cổng tự mở. */
export const AUTO_OPEN_SECONDS = 2.5
export const OPEN_SECONDS = 2.6

const DOOR_MAX_ANGLE = 1.75
/** Quãng cổng trượt về phía camera để bay qua đầu khách (camera đứng ở z = 8 khi chưa cuộn). */
const SLIDE_DISTANCE = 16

export const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3
export const easeInCubic = (x: number): number => x ** 3
export const easeInOutCubic = (x: number): number => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
}
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Hệ số kích thước một bông hoa/lá tại giây `t` của giai đoạn nở, có độ nảy nhẹ khi vừa nở xong. */
export function bloomScale(t: number, delay: number): number {
  const x = clamp01((t - delay) / BLOOM_SECONDS)
  return x <= 0 ? 0 : easeOutBack(x)
}

export interface OpenPose {
  /** Góc mở của mỗi cánh cổng (rad), 0 = đóng kín. */
  doorAngle: number
  /** Quãng cổng đã trượt về phía camera. */
  slide: number
  /** Độ sáng của ảnh phía sau, 0 = tối, 1 = đủ sáng. */
  light: number
  done: boolean
}

/** Tư thế cổng tại giây `t` kể từ lúc bắt đầu mở: cánh mở trước, rồi cả cổng trượt qua đầu camera. */
export function openPose(t: number): OpenPose {
  return {
    doorAngle: DOOR_MAX_ANGLE * easeInOutCubic(clamp01(t / 1.5)),
    slide: SLIDE_DISTANCE * easeInCubic(clamp01((t - 0.9) / 1.7)),
    light: easeOutCubic(clamp01(t / 1.2)),
    done: t >= OPEN_SECONDS,
  }
}

export interface GateDims {
  /** Bán kính cung vòm = nửa bề rộng giữa hai trụ. */
  radius: number
  /** Chiều cao hai trụ thẳng; đỉnh cổng ở `post + radius`. */
  post: number
  /** Tổng chiều cao của cổng (`post + radius`). */
  height: number
  /** Nhân số lượng hoa/lá để cổng lớn vẫn dày hoa (đã kẹp). */
  countFactor: number
  /** Nhân kích thước từng bông cho phần diện tích còn lại mà số lượng không bù hết. */
  sizeFactor: number
}

/**
 * Kích thước cổng để lấp đầy khung nhìn ở khoảng cách `distance`: cao gần hết chiều cao màn hình (hai trụ chạm sát
 * đáy, đỉnh vòm sát đỉnh) và rộng gần hết chiều rộng. Điện thoại dọc hẹp ra một khung cửa vòm cao; màn rộng thì vòm bị
 * giới hạn theo chiều cao để không thành bán nguyệt khổng lồ.
 */
export function gateDims(aspect: number, fovDeg: number, distance: number): GateDims {
  const visibleHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360)
  const visibleWidth = visibleHeight * aspect
  // Trừ phần hoa/lá nhô ra ngoài khung (~0.3 ở cạnh, ~0.5 ở đỉnh vì có cụm hoa dồn ở đó) để chúng không bị cắt bởi mép màn hình.
  const radius = Math.min(Math.max(visibleWidth * 0.46 - 0.3, 1.1), visibleHeight * 0.42)
  const height = visibleHeight * 0.9 - 0.5
  const post = Math.max(0.6, height - radius)
  const area = 2 * radius * post + (Math.PI * radius * radius) / 2
  const raw = area / REFERENCE_AREA
  const countFactor = Math.min(2.4, Math.max(0.8, raw))
  return { radius, post, height: post + radius, countFactor, sizeFactor: Math.sqrt(Math.max(1, raw / countFactor)) }
}

/**
 * Kích thước (rộng, cao) của mặt phẳng ảnh để phủ kín khung nhìn tại khoảng cách `distance`, giống `object-fit: cover`:
 * thừa ra phía nào thì cắt phía đó, không bao giờ để lộ khoảng trống.
 */
export function coverSize(aspect: number, fovDeg: number, distance: number, imageAspect: number): { width: number; height: number } {
  const visibleHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360)
  const visibleWidth = visibleHeight * aspect
  const height = Math.max(visibleHeight, visibleWidth / imageAspect)
  return { width: height * imageAspect, height }
}

/** Ảnh phía sau cổng mờ dần khi camera bay xuyên qua nó lúc khách cuộn. */
export function photoFade(progress: number): number {
  return 1 - smoothstep(0.03, 0.1, progress)
}

export interface InstanceCounts {
  frameFlowers: number
  frameLeaves: number
  doorFlowers: number
  doorLeaves: number
}

/** Ảnh hiện dần trong ngần này giây sau khi cổng đã mở xong (cùng nhịp với chữ hiện lại ở hero). */
export const PHOTO_REVEAL_SECONDS = 0.9

const BASE_COUNTS: InstanceCounts = { frameFlowers: 380, frameLeaves: 200, doorFlowers: 250, doorLeaves: 120 }

/** Số hoa/lá theo mật độ của bậc chất lượng (1 = đủ) và độ lớn của cổng; luôn đủ để cổng không trơ trụi. */
export function instanceCounts(density: number, countFactor = 1): InstanceCounts {
  const scale = (value: number) => Math.max(40, Math.round(value * density * countFactor))
  return {
    frameFlowers: scale(BASE_COUNTS.frameFlowers),
    frameLeaves: scale(BASE_COUNTS.frameLeaves),
    doorFlowers: scale(BASE_COUNTS.doorFlowers),
    doorLeaves: scale(BASE_COUNTS.doorLeaves),
  }
}
