import { Float32BufferAttribute, Shape, ShapeGeometry } from 'three'

/** Khung ảnh vòm: chữ nhật đầu bán nguyệt, gốc ở giữa đáy. */
export const ARCH_WIDTH = 1.7
export const ARCH_HEIGHT = 2.5
const FRAME_ASPECT = ARCH_WIDTH / ARCH_HEIGHT
/** Mặt người thường ở nửa trên ảnh đứng: khi phải cắt bớt chiều dọc thì giữ phần trên. */
const FACE_BIAS = 0.7

function archShape(width: number, height: number): Shape {
  const r = width / 2
  const shape = new Shape()
  shape.moveTo(-r, 0)
  shape.lineTo(r, 0)
  shape.lineTo(r, height - r)
  shape.absarc(0, height - r, r, 0, Math.PI, false)
  shape.lineTo(-r, 0)
  return shape
}

/**
 * Mặt ảnh hình vòm. UV tính tay để ảnh phủ kín khung (kiểu `object-fit: cover`) mà không cần chỉnh texture:
 * ảnh ngang bị cắt hai bên, ảnh dọc quá cao thì cắt từ dưới lên (giữ mặt người).
 */
export function createArchPhotoGeometry(photoAspect: number): ShapeGeometry {
  const geometry = new ShapeGeometry(archShape(ARCH_WIDTH, ARCH_HEIGHT), 24)
  const position = geometry.getAttribute('position')
  const uv = new Float32Array(position.count * 2)
  const wide = photoAspect > FRAME_ASPECT
  const uSpan = wide ? FRAME_ASPECT / photoAspect : 1
  const vSpan = wide ? 1 : photoAspect / FRAME_ASPECT
  const uStart = (1 - uSpan) / 2
  const vStart = (1 - vSpan) * (1 - FACE_BIAS)
  for (let i = 0; i < position.count; i += 1) {
    const u = position.getX(i) / ARCH_WIDTH + 0.5
    const v = position.getY(i) / ARCH_HEIGHT
    uv[i * 2] = uStart + u * uSpan
    uv[i * 2 + 1] = vStart + v * vSpan
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geometry
}

/** Viền khung: cùng hình vòm, lớn hơn mặt ảnh một đoạn `margin` mỗi phía. */
export function createArchBorderGeometry(margin: number): ShapeGeometry {
  const geometry = new ShapeGeometry(archShape(ARCH_WIDTH + margin * 2, ARCH_HEIGHT + margin * 2), 24)
  // Dịch xuống để đáy viền thấp hơn đáy ảnh đúng `margin`; ảnh nằm lọt giữa viền.
  geometry.translate(0, -margin, 0)
  return geometry
}
