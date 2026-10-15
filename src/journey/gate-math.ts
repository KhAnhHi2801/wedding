import { clamp01 } from './scroll-progress'

export const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3
export const easeInCubic = (x: number): number => x ** 3
export const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
}
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Sau khi nút thắt xong ngần này giây (nút và cánh hoa kịp ngắm) thì cổng tự mở. */
export const TIE_HOLD_SECONDS = 1.9
/** Từ lúc cổng bắt đầu mở tới lúc ảnh hero thế chỗ hoàn toàn. */
export const OPEN_SECONDS = 1.7

export interface OpenPose {
  /** Độ đục còn lại của sợi chỉ và nút thắt: 1 → 0. */
  thread: number
  /** Nút thắt phóng to về phía camera như "chui qua" nút: hệ số nhân kích thước. */
  knotGrow: number
  /** Độ hiện của ảnh hero phía sau, 0 → 1. */
  hero: number
  done: boolean
}

/** Tư thế cổng tại giây `t` kể từ lúc bắt đầu mở: chỉ mờ đi và nút phóng lớn, ảnh hero hiện dần phía sau. */
export function openPose(t: number): OpenPose {
  return {
    thread: 1 - smoothstep(0.1, 0.9, t),
    knotGrow: 1 + 9 * easeInCubic(clamp01(t / OPEN_SECONDS)),
    hero: smoothstep(0.35, 1.5, t),
    done: t >= OPEN_SECONDS,
  }
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

/** Ảnh phía sau mờ dần khi camera bay xuyên qua nó lúc khách cuộn. */
export function photoFade(progress: number): number {
  return 1 - smoothstep(0.02, 0.1, progress)
}
