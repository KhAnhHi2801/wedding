import { Color, Fog, MathUtils, type PerspectiveCamera, Vector3 } from 'three'
import { CHAPTERS, type Chapter, findChapterIndex } from './chapters'
import { WORLD } from './world-config'

/** Nội suy giữa hai chương kề nhau: chương hiện tại, chương kế, và phần đã đi (0..1, đã làm mượt đầu/cuối). */
function segmentAt(progress: number, chapters: readonly Chapter[]) {
  const index = findChapterIndex(progress, chapters)
  const from = chapters[index]
  const to = chapters[Math.min(index + 1, chapters.length - 1)]
  // Chương cuối: `to === from`, khoảng cách bằng 0 nên t bị kẹp về 1 và camera đứng yên ở tư thế cuối.
  const span = Math.max(to.start - from.start, 1e-6)
  const t = MathUtils.smootherstep((progress - from.start) / span, 0, 1)
  return { from, to, t }
}

/**
 * Tỉ lệ màn hình → mức "dọc" 0..1 (0 = màn ngang, 1 = điện thoại dọc) để co giãn FOV, khoảng lùi, điểm nhìn.
 * Lấy căn bậc hai để khung gần vuông đã chuyển sang bố cục dọc rõ rệt, khớp với CSS đặt chữ phía trên.
 */
export function portraitAmount(aspect: number): number {
  const { portrait, landscape } = WORLD.aspectRange
  return Math.sqrt(1 - MathUtils.clamp((aspect - portrait) / (landscape - portrait), 0, 1))
}

export interface CameraRig {
  /** Đặt camera và sương mù theo tiến độ cuộn (đã làm mượt) và độ lệch con trỏ đã làm mượt. */
  update: (progress: number, pointerX: number, pointerY: number) => void
  setAspect: (aspect: number) => void
}

export function createCameraRig(camera: PerspectiveCamera, fog: Fog, chapters: readonly Chapter[] = CHAPTERS): CameraRig {
  const position = new Vector3()
  const target = new Vector3()
  const fromVec = new Vector3()
  const toVec = new Vector3()
  const fromColor = new Color()
  const toColor = new Color()
  let portrait = 0

  const sampleVec3 = (out: Vector3, from: Chapter['camera'], to: Chapter['camera'], t: number) =>
    out.copy(fromVec.set(...from)).lerp(toVec.set(...to), t)

  return {
    setAspect(aspect) {
      portrait = portraitAmount(aspect)
      camera.aspect = aspect
      camera.fov = MathUtils.lerp(WORLD.fov.landscape, WORLD.fov.portrait, portrait)
      camera.updateProjectionMatrix()
    },
    update(progress, pointerX, pointerY) {
      const { from, to, t } = segmentAt(progress, chapters)
      sampleVec3(position, from.camera, to.camera, t)
      sampleVec3(target, from.target, to.target, t)

      // Màn dọc: kéo camera lùi ra xa điểm nhìn và đẩy điểm nhìn lên để cảnh nằm thấp hơn.
      const distance = MathUtils.lerp(WORLD.distanceScale.landscape, WORLD.distanceScale.portrait, portrait)
      position.sub(target).multiplyScalar(distance).add(target)
      target.y += WORLD.portraitLookLift * portrait

      // Parallax: camera lệch nhẹ theo con trỏ nhưng vẫn nhìn vào điểm cũ, nên lớp gần dịch nhiều hơn lớp xa.
      position.x += pointerX * WORLD.pointerAmplitude.x
      position.y += pointerY * WORLD.pointerAmplitude.y

      camera.position.copy(position)
      camera.lookAt(target)

      fromColor.set(from.fog.color)
      toColor.set(to.fog.color)
      fog.color.copy(fromColor).lerp(toColor, t)
      fog.near = MathUtils.lerp(from.fog.near, to.fog.near, t)
      fog.far = MathUtils.lerp(from.fog.far, to.fog.far, t)
    },
  }
}
