import { prefersReducedMotion } from '../lib/motion-preference'
import { probeWebgl } from '../lib/webgl-support'
import { gate } from './gate-state'

/** Máy này sẽ chạy hành trình 3D (có WebGL và khách không bật giảm chuyển động). */
export function willRunJourney(): boolean {
  return !prefersReducedMotion() && probeWebgl()
}

/**
 * Gọi một lần TRƯỚC khi render React. Nếu sẽ chạy 3D thì đặt hero ở trạng thái chờ ngay từ khung hình đầu tiên, để
 * ảnh cặp đôi không hiện ra rồi bị cổng chồng lên sau khi cảnh 3D tải xong. Không chạy 3D thì không làm gì: hero là
 * bản HTML đầy đủ ngay từ đầu.
 */
export function prepareJourney(): void {
  if (willRunJourney()) gate.loading()
}
