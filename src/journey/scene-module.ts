import type { CatmullRomCurve3, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { QualityTier, TierSettings } from './quality-tier'

/** Những gì engine cấp cho mỗi cảnh khi khởi tạo. */
export interface SceneContext {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  /** Đường cong camera đi qua; cảnh đặt vật thể dọc theo đường này. */
  path: CatmullRomCurve3
  tier: QualityTier
  settings: TierSettings
  /** Báo cần vẽ lại một khung (khi cảnh tự đổi mà không do cuộn trang). */
  invalidate: () => void
}

/** Trạng thái mỗi khung hình. */
export interface JourneyFrame {
  /** Tiến độ cuộn đã làm mượt, 0..1. */
  progress: number
  /** "Thời gian trong ngày", 0 = sáng, 1 = hoàng hôn. */
  tod: number
  /** Giây kể từ khi engine bắt đầu. */
  time: number
  /** Giây kể từ khung trước (đã kẹp để không nhảy vọt sau khi tạm dừng). */
  delta: number
}

/**
 * Một cảnh trong hành trình (cổng, vườn, đường ảnh, hoàng hôn, cổng kết). Mỗi cảnh tự dọn tài nguyên của mình
 * trong `dispose` (geometry, material, texture).
 */
export interface SceneModule {
  readonly id: string
  /** true khi cảnh cần vẽ liên tục (gió, hạt, nhấp nháy); false thì engine chỉ vẽ khi cuộn hoặc `invalidate`. */
  readonly continuous?: boolean
  init: (ctx: SceneContext) => void
  update: (frame: JourneyFrame) => void
  /** Engine đã đổi bậc chất lượng: cảnh điều chỉnh mật độ/hậu kỳ. */
  setQuality: (tier: QualityTier, settings: TierSettings) => void
  dispose: () => void
}
