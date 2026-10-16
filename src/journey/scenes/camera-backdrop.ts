import {
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type PerspectiveCamera,
  type Scene,
  type Texture,
} from 'three'

/**
 * Phông nền xa dùng ảnh nhòe (bokeh): một mặt phẳng luôn nằm trước camera và phủ kín khung nhìn như `object-fit: cover`,
 * vẽ trước mọi thứ khác. Vì nằm "vô cực" nên khi camera đi, phông gần như đứng yên còn hoa lá gần trôi qua: đó là thứ tạo
 * chiều sâu. `shift` dịch ngang phông nhẹ theo vị trí camera để có thêm chút parallax.
 */
export interface CameraBackdrop {
  mesh: Mesh
  /** `opacity` 0..1; `shift` là độ lệch ngang (đơn vị uv) tính từ vị trí camera. */
  update: (camera: PerspectiveCamera, opacity: number, shift?: number) => void
  dispose: () => void
}

const DISTANCE = 90
const forward = new Vector3()

export function createCameraBackdrop(
  scene: Scene,
  url: string,
  options: { renderOrder: number; maxAnisotropy?: number },
): CameraBackdrop {
  const material = new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  mesh.renderOrder = options.renderOrder
  mesh.frustumCulled = false
  mesh.visible = false
  scene.add(mesh)

  let texture: Texture | null = null
  let disposed = false
  new TextureLoader().load(`${import.meta.env.BASE_URL}${url}`, (loaded) => {
    if (disposed) {
      loaded.dispose()
      return
    }
    loaded.colorSpace = SRGBColorSpace
    loaded.minFilter = LinearFilter
    loaded.generateMipmaps = false
    texture = loaded
    material.map = loaded
    material.needsUpdate = true
  })

  return {
    mesh,
    update(camera, opacity, shift = 0) {
      material.opacity = opacity
      mesh.visible = opacity > 0.01 && texture !== null
      if (!mesh.visible || !texture) return
      camera.getWorldDirection(forward)
      mesh.position.copy(camera.position).addScaledVector(forward, DISTANCE)
      mesh.quaternion.copy(camera.quaternion)
      const height = 2 * DISTANCE * Math.tan((camera.fov * Math.PI) / 360)
      mesh.scale.set(height * camera.aspect, height, 1)
      // Phủ kín (cover): cắt phần dư của ảnh theo tỉ lệ khung nhìn, giữ nguyên tỉ lệ ảnh.
      const image = texture.image as { width: number; height: number }
      const imageAspect = image.width / image.height
      const viewAspect = camera.aspect
      const repeatX = Math.min(1, viewAspect / imageAspect)
      const repeatY = Math.min(1, imageAspect / viewAspect)
      texture.repeat.set(repeatX, repeatY)
      texture.offset.set((1 - repeatX) * (0.5 + shift), 1 - repeatY)
    },
    dispose() {
      disposed = true
      scene.remove(mesh)
      mesh.geometry.dispose()
      material.dispose()
      texture?.dispose()
    },
  }
}
