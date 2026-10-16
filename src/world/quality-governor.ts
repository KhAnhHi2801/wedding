/** Cửa sổ đo FPS (giây) và ngưỡng hạ tier (xem ngân sách hiệu năng trong design-system.md). */
const WINDOW_SECONDS = 2
const MIN_FPS = 45
/** Bỏ qua các cửa sổ đầu: nạp texture và biên dịch shader làm FPS thấp giả. */
const WARMUP_WINDOWS = 2

/**
 * Nhận thời gian mỗi khung hình đã vẽ; khi FPS trung bình của một cửa sổ dưới ngưỡng thì gọi `onSlow`.
 * Chỉ nạp vào các khung hình có hoạt ảnh liên tục, để lúc cảnh đứng yên không bị tính là chậm.
 */
export function createQualityGovernor(onSlow: () => void) {
  let elapsed = 0
  let frames = 0
  let windowsSeen = 0

  return (dt: number) => {
    elapsed += dt
    frames += 1
    if (elapsed < WINDOW_SECONDS) return
    const fps = frames / elapsed
    elapsed = 0
    frames = 0
    windowsSeen += 1
    if (windowsSeen > WARMUP_WINDOWS && fps < MIN_FPS) onSlow()
  }
}
