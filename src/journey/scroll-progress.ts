export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Tiến độ cuộn 0..1 của cả trang; trang không cuộn được thì 0. */
export function scrollProgress(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const scrollable = scrollHeight - viewportHeight
  return scrollable <= 0 ? 0 : clamp01(scrollY / scrollable)
}

export interface ProgressAnchor {
  /** Vị trí cuộn (px). */
  y: number
  /** Tiến độ hành trình tại vị trí đó, 0..1. */
  progress: number
}

/**
 * Tiến độ hành trình theo các mốc trang (nội suy tuyến tính giữa hai mốc liền kề, kẹp ở hai đầu). Dùng để gắn các cảnh
 * 3D với đúng đoạn nội dung của chúng: ví dụ camera đi hết khu vườn trong lúc khách cuộn qua phần lịch trình, thay vì
 * chia đều theo chiều dài cả trang. Các mốc phải tăng dần theo `y`.
 */
export function anchoredProgress(scrollY: number, anchors: readonly ProgressAnchor[]): number {
  if (anchors.length === 0) return 0
  if (scrollY <= anchors[0].y) return anchors[0].progress
  for (let i = 1; i < anchors.length; i += 1) {
    const next = anchors[i]
    if (scrollY <= next.y) {
      const prev = anchors[i - 1]
      const span = next.y - prev.y
      return span <= 0 ? next.progress : prev.progress + ((next.progress - prev.progress) * (scrollY - prev.y)) / span
    }
  }
  return anchors[anchors.length - 1].progress
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
