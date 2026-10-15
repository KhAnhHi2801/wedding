import { clamp01 } from './scroll-progress'

/**
 * "Thời gian trong ngày" của hành trình: 0 = buổi sáng sáng sủa, 1 = hoàng hôn.
 * Mọi thứ đổi theo ngày-đêm (nền trang, bầu trời, ánh sáng) đọc cùng một giá trị này.
 */

/** Neo (tiến độ cuộn → tod). Cảnh các phase sau đặt theo các mốc này: cổng/vườn sáng, ảnh chiều, đèn hoàng hôn. */
const STOPS: ReadonlyArray<readonly [progress: number, tod: number]> = [
  [0, 0],
  [0.35, 0.1],
  [0.55, 0.35],
  [0.75, 0.75],
  [1, 1],
]

export function todFromProgress(progress: number): number {
  const p = clamp01(progress)
  for (let i = 1; i < STOPS.length; i += 1) {
    const [p1, t1] = STOPS[i]
    if (p <= p1) {
      const [p0, t0] = STOPS[i - 1]
      return t0 + ((t1 - t0) * (p - p0)) / (p1 - p0)
    }
  }
  return 1
}

/** Giảm chuyển động: nền đổi theo bước thay vì trôi liên tục. */
export function quantizeTod(tod: number, steps = 4): number {
  return Math.round(clamp01(tod) * steps) / steps
}

/** Ba mốc màu nền: kem sáng → vàng champagne → hồng hoàng hôn. Chữ `--ink` đạt AA ở cả ba (có test). */
const COLOR_STOPS: ReadonlyArray<readonly [tod: number, rgb: readonly [number, number, number]]> = [
  [0, [0xfb, 0xf6, 0xf0]],
  [0.5, [0xf3, 0xe3, 0xc3]],
  [1, [0xe9, 0xc2, 0xbe]],
]

export function todRgb(tod: number): [number, number, number] {
  const t = clamp01(tod)
  for (let i = 1; i < COLOR_STOPS.length; i += 1) {
    const [t1, c1] = COLOR_STOPS[i]
    if (t <= t1) {
      const [t0, c0] = COLOR_STOPS[i - 1]
      const k = (t - t0) / (t1 - t0)
      return [0, 1, 2].map((ch) => Math.round(c0[ch] + (c1[ch] - c0[ch]) * k)) as [number, number, number]
    }
  }
  return [...COLOR_STOPS[COLOR_STOPS.length - 1][1]]
}

/** Màu nền dạng `#rrggbb` (tính bằng JS thay vì `color-mix` để chạy được trong in-app browser đời cũ). */
export function todColor(tod: number): string {
  return `#${todRgb(tod)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}
