import type { PerspectiveCamera, Scene, TextureLoader } from 'three'
import type { QualityTier } from '../quality-tier'

export interface SceneContext {
  scene: Scene
  camera: PerspectiveCamera
  loader: TextureLoader
  maxAnisotropy: number
  tier: QualityTier
}

/** Dữ liệu engine truyền vào `update` mỗi khung hình đã vẽ. */
export interface FrameState {
  /** Giây đã trôi qua của hoạt ảnh (đứng yên khi tạm dừng hoặc giảm chuyển động). */
  time: number
  dt: number
  /** Tiến độ cuộn đã làm mượt 0..1. */
  progress: number
}

/**
 * Một cảnh gắn vào scene chung. Engine chỉ gọi các hàm này theo danh sách module,
 * không rẽ nhánh theo tên cảnh.
 */
export interface SceneModule {
  init: (context: SceneContext) => Promise<void>
  update: (frame: FrameState) => void
  applyQuality: (tier: QualityTier) => void
  dispose: () => void
}
