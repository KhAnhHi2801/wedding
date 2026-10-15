export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Tiến độ cuộn 0..1 của cả trang; trang không cuộn được thì 0. */
export function scrollProgress(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const scrollable = scrollHeight - viewportHeight
  return scrollable <= 0 ? 0 : clamp01(scrollY / scrollable)
}

/**
 * Làm mượt theo hàm mũ: cứ mỗi `halfLifeSeconds` thì khoảng cách tới đích giảm một nửa, độc lập tốc độ khung hình.
 * Đủ gần đích thì chốt luôn để vòng lặp dừng được.
 */
export function smoothProgress(current: number, target: number, dtSeconds: number, halfLifeSeconds = 0.12): number {
  if (halfLifeSeconds <= 0 || dtSeconds <= 0) return halfLifeSeconds <= 0 ? target : current
  const next = current + (target - current) * (1 - 2 ** (-dtSeconds / halfLifeSeconds))
  return Math.abs(target - next) < 0.0005 ? target : next
}
