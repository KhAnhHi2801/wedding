import { Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Texture } from 'three'
import { PAPER_PAD_RATIO } from '../world-config'

export interface PaperLayerOptions {
  /** Texture đã nướng viền giấy và bóng đổ (scripts/lib/paper-bake.mjs): rộng hơn hình gốc một lề mỗi cạnh. */
  texture: Texture
  /** Chiều cao hình gốc, chưa tính lề, trong đơn vị thế giới. */
  height: number
}

export interface PaperLayer {
  object: Mesh
  dispose: () => void
}

/**
 * Hình giấy cắt: một mặt phẳng, một mẫu texture mỗi pixel. Viền trắng và bóng đổ cứng đã nằm sẵn trong ảnh,
 * nên lúc chạy không còn shader viền (12 mẫu mỗi pixel) hay mặt phẳng bóng riêng.
 * Lề đối xứng nên tâm mặt phẳng trùng tâm hình gốc.
 */
export function createPaperLayer({ texture, height }: PaperLayerOptions): PaperLayer {
  texture.colorSpace = SRGBColorSpace
  const image = texture.image as { width: number; height: number }
  const planeHeight = height * (1 + PAPER_PAD_RATIO * 2)
  const planeWidth = (planeHeight * image.width) / image.height

  const geometry = new PlaneGeometry(planeWidth, planeHeight)
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false })
  const object = new Mesh(geometry, material)

  return {
    object,
    dispose() {
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}
