import { DataTexture, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace, TextureLoader, type Texture } from 'three'

/**
 * Bộ sprite hoa lá thật (ảnh có nền trong suốt, tạo từ ảnh chụp, xem assets-src/hoa-vuon). Thứ tự khớp tên file
 * f1..f8.webp. `aspect` = rộng / cao của ảnh để dựng mặt phẳng đúng tỉ lệ.
 */
export const FLORA = [
  { id: 'daisy', aspect: 503 / 640 },
  { id: 'forget-me-not', aspect: 561 / 640 },
  { id: 'delphinium', aspect: 402 / 640 },
  { id: 'grass', aspect: 640 / 396 },
  { id: 'leaf', aspect: 640 / 315 },
  { id: 'petals', aspect: 577 / 640 },
  { id: 'cosmos', aspect: 634 / 640 },
  { id: 'poppy', aspect: 640 / 456 },
] as const

export const FLORA_DAISY = 0
export const FLORA_FORGET_ME_NOT = 1
export const FLORA_DELPHINIUM = 2
export const FLORA_GRASS = 3
export const FLORA_LEAF = 4
export const FLORA_PETALS = 5

/** Texture trong suốt 1x1 dùng tạm trong lúc ảnh thật chưa tải xong (sprite hiện ra khi ảnh về). */
export function createBlankTexture(): Texture {
  const texture = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat)
  texture.needsUpdate = true
  return texture
}

const loadAll = (maxAnisotropy: number): Promise<Texture[]> => {
  const loader = new TextureLoader()
  return Promise.all(
    FLORA.map(
      (_, i) =>
        new Promise<Texture>((resolve) => {
          loader.load(
            `${import.meta.env.BASE_URL}assets/flora/f${i + 1}.webp`,
            (texture) => {
              texture.colorSpace = SRGBColorSpace
              texture.minFilter = LinearMipmapLinearFilter
              texture.anisotropy = Math.min(4, maxAnisotropy)
              resolve(texture)
            },
            undefined,
            () => resolve(createBlankTexture()),
          )
        }),
    ),
  )
}

/**
 * Bộ texture dùng chung của vườn và các vòng hoa quanh ảnh: tải một lần, đếm tham chiếu, giải phóng khi không còn cảnh
 * nào dùng. Mỗi lần `acquireFlora` phải có đúng một `releaseFlora` tương ứng.
 */
let shared: { promise: Promise<Texture[]>; refs: number } | null = null

export function acquireFlora(maxAnisotropy: number): Promise<Texture[]> {
  if (!shared) shared = { promise: loadAll(maxAnisotropy), refs: 0 }
  shared.refs += 1
  return shared.promise
}

export function releaseFlora(): void {
  if (!shared) return
  shared.refs -= 1
  if (shared.refs > 0) return
  const { promise } = shared
  shared = null
  void promise.then((list) => list.forEach((texture) => texture.dispose()))
}
