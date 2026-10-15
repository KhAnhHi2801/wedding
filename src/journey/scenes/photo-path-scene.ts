import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Float32BufferAttribute,
  BufferGeometry,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  Vector3,
  LinearMipmapLinearFilter,
  type ShapeGeometry,
} from 'three'
import type { AssetImage } from '../../config/assets'
import { mulberry32 } from '../../lib/seeded-random'
import { gate } from '../gate-state'
import { JOURNEY_DEPTH } from '../journey-path'
import { clamp01 } from '../scroll-progress'
import { photoPicker } from '../photo-state'
import type { QualityTier, TierSettings } from '../quality-tier'
import type { JourneyFrame, SceneContext, SceneModule } from '../scene-module'
import { ARCH_HEIGHT, createArchBorderGeometry, createArchPhotoGeometry } from './photo-arch-geometry'

/**
 * Đường hầm vòm ảnh: mỗi ảnh đứng NGAY GIỮA lối đi như một cổng vòm, ảnh gần nhất to đầy màn hình, ảnh kế tiếp nhỏ hơn
 * phía sau. Camera đi qua ảnh nào thì ảnh đó tan dần để lộ ảnh sau. Đặt lệch hai bên không dùng được: màn hình dọc hẹp
 * (trên điện thoại) chỉ nhìn được ~29° bề ngang nên ảnh bên cạnh lộ nửa khung ở mép.
 * Vị trí tính theo tiến độ trên đường camera; khớp mốc cuộn của phần ảnh ở use-time-of-day.
 */
const PATH_FROM = 0.585
const PATH_STEP = 0.0235
/** Ngoài khoảng này không dựng gì; trong khoảng "nạp" thì giữ texture, ngoài thì giải phóng. */
const SHOW_FROM = 0.535
const SHOW_TO = 0.8
const LOAD_FROM = 0.34
const LOAD_TO = 0.86

/** Lệch nhỏ khỏi tim đường và nghiêng nhẹ xen kẽ để các khung không xếp thẳng như một dãy cửa. */
const SWAY = 0.12
const YAW = 0.06
/** Tâm khung thấp hơn tầm mắt một chút: chừa chỗ cho tiêu đề phía trên và nút phía dưới. */
const CENTER_BELOW_EYE = 0.1
const FRAME_SCALE = 0.92
/** Khoảng cách (đơn vị đường đi) từ camera tới khung: hiện dần từ xa, tan dần khi camera đi xuyên qua. */
const FADE_IN_FAR = 5.8
const FADE_IN_NEAR = 4.6
const FADE_OUT_NEAR = 3.4
const FADE_OUT_GONE = 2.2
const BORDER_MARGIN = 0.09
const MAX_PHOTOS = 8

const BORDER_COLOR = new Color('#f6e7d4')
const WARM_TINT = new Color('#ffe2c2')
const MOTE_COUNT = 90

interface PhotoFrame {
  group: Group
  face: Mesh
  faceMaterial: MeshBasicMaterial
  borderMaterial: MeshBasicMaterial
  geometry: ShapeGeometry
  baseY: number
  phase: number
  /** Vị trí trên đường camera (tiến độ 0..1). */
  u: number
}

/** Cạnh dài tối đa của texture theo bậc: 8 ảnh 1600px tốn cả trăm MB GPU, ảnh chỉ chiếm ~1/3 màn hình. */
const textureSide = (tier: QualityTier) => (tier === 'low' ? 768 : 1024)

function loadScaledTexture(src: string, maxSide: number, maxAnisotropy: number): Promise<CanvasTexture> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('không tạo được canvas 2D để thu nhỏ ảnh'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.minFilter = LinearMipmapLinearFilter
      texture.anisotropy = Math.min(4, maxAnisotropy)
      resolve(texture)
    }
    image.onerror = () => reject(new Error(`không tải được ảnh ${src}`))
    image.src = src
  })
}

/**
 * Cảnh 3 - đường ảnh: ảnh thật trong khung vòm có viền, đứng hai bên lối đi sau khu vườn, camera lướt qua. Texture chỉ
 * được nạp (đã thu nhỏ) khi camera tới gần và được giải phóng khi đi xa. Chạm ảnh được xử lý qua `photoPicker` (canvas
 * nằm sau nội dung nên không tự nhận chạm); raycast chỉ chạy lúc chạm, không mỗi khung hình.
 */
export function createPhotoPathScene({ photos }: { photos: readonly AssetImage[] }): SceneModule {
  const items = photos.slice(0, MAX_PHOTOS)
  let ctx: SceneContext | null = null
  const root = new Group()
  const frames: PhotoFrame[] = []
  const textures: Array<CanvasTexture | null> = items.map(() => null)
  let loadToken = 0
  let loaded = false
  let showing = false
  let motes: Points | null = null
  let moteMaterial: PointsMaterial | null = null
  let sharedBorder: ShapeGeometry | null = null
  let lastTod = -1
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const tint = new Color()

  const releaseTextures = () => {
    loadToken += 1
    loaded = false
    frames.forEach((frame, i) => {
      frame.faceMaterial.map = null
      frame.faceMaterial.needsUpdate = true
      textures[i]?.dispose()
      textures[i] = null
    })
  }

  const loadTextures = () => {
    if (!ctx || loaded) return
    loaded = true
    const token = loadToken
    const side = textureSide(ctx.tier)
    const anisotropy = ctx.renderer.capabilities.getMaxAnisotropy()
    items.forEach((photo, i) => {
      loadScaledTexture(photo.src, side, anisotropy)
        .then((texture) => {
          // Đã giải phóng hoặc đã dỡ cảnh trong lúc chờ: bỏ texture vừa tải.
          if (token !== loadToken || !ctx) {
            texture.dispose()
            return
          }
          textures[i] = texture
          frames[i].faceMaterial.map = texture
          frames[i].faceMaterial.needsUpdate = true
          ctx.invalidate()
        })
        .catch((error: unknown) => {
          // Một ảnh lỗi thì khung đó giữ màu kem; ảnh khác vẫn hiện, ảnh vẫn xem được ở trình xem HTML.
          console.warn('[journey] ảnh đường ảnh lỗi:', error)
        })
    })
  }

  const buildFrames = (context: SceneContext) => {
    const borderGeometry = createArchBorderGeometry(BORDER_MARGIN)
    frames.push(
      ...items.map((photo, i): PhotoFrame => {
        const u = PATH_FROM + PATH_STEP * i
        const center = context.path.getPointAt(u)
        const tangent = context.path.getTangentAt(u)
        const side = i % 2 === 0 ? -1 : 1
        const right = new Vector3(-tangent.z, 0, tangent.x).normalize()
        const position = center.clone().addScaledVector(right, side * SWAY)
        // Chân khung sao cho tâm khung thấp hơn tầm mắt `CENTER_BELOW_EYE`.
        const baseY = Math.max(0.05, center.y - CENTER_BELOW_EYE - (ARCH_HEIGHT * FRAME_SCALE) / 2)
        position.y = baseY

        const geometry = createArchPhotoGeometry(photo.width / photo.height)
        const faceMaterial = new MeshBasicMaterial({ color: BORDER_COLOR.clone(), transparent: true, fog: false })
        const borderMaterial = new MeshBasicMaterial({ color: BORDER_COLOR.clone(), transparent: true, fog: false })
        const face = new Mesh(geometry, faceMaterial)
        face.userData.index = i
        const border = new Mesh(borderGeometry, borderMaterial)
        border.position.z = -0.015
        const group = new Group()
        group.add(border, face)
        group.position.copy(position)
        // Mặt khung hướng về camera đang tới (ngược chiều đi), nghiêng nhẹ xen kẽ.
        group.rotation.y = Math.atan2(-tangent.x, -tangent.z) + side * YAW
        group.scale.setScalar(FRAME_SCALE)
        group.visible = false
        root.add(group)
        return { group, face, faceMaterial, borderMaterial, geometry, baseY, phase: i * 1.7, u }
      }),
    )
    // Viền dùng chung một geometry: giải phóng một lần.
    sharedBorder = borderGeometry
  }

  const buildMotes = (context: SceneContext) => {
    const random = mulberry32(7919)
    const positions = new Float32Array(MOTE_COUNT * 3)
    const from = context.path.getPointAt(PATH_FROM - 0.02)
    const to = context.path.getPointAt(PATH_FROM + PATH_STEP * (MAX_PHOTOS - 1) + 0.02)
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const t = random()
      positions[i * 3] = from.x + (to.x - from.x) * t + (random() - 0.5) * 9
      positions[i * 3 + 1] = 0.4 + random() * 3.4
      positions[i * 3 + 2] = from.z + (to.z - from.z) * t + (random() - 0.5) * 3
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    moteMaterial = new PointsMaterial({ color: '#ffe7b0', size: 0.07, transparent: true, opacity: 0.75, depthWrite: false, fog: false })
    motes = new Points(geometry, moteMaterial)
    motes.frustumCulled = false
    root.add(motes)
  }

  return {
    id: 'photo-path',
    get continuous() {
      return showing
    },
    init(context) {
      ctx = context
      buildFrames(context)
      buildMotes(context)
      root.visible = false
      context.scene.add(root)

      photoPicker.pick = (x, y) => {
        if (!showing || !ctx) return null
        pointer.set(x, y)
        raycaster.setFromCamera(pointer, ctx.camera)
        const hits = raycaster.intersectObjects(
          frames.filter((frame) => frame.group.visible && frame.faceMaterial.opacity > 0.4).map((frame) => frame.face),
          false,
        )
        return hits.length > 0 ? (hits[0].object.userData.index as number) : null
      }
    },
    update({ progress, tod, time }: JourneyFrame) {
      if (!ctx) return

      const wantLoaded = progress > LOAD_FROM && progress < LOAD_TO
      if (wantLoaded && !loaded) loadTextures()
      else if (!wantLoaded && loaded) releaseTextures()

      showing = gate.getState() === 'open' && progress > SHOW_FROM && progress < SHOW_TO
      root.visible = showing
      if (!showing) return

      // Ánh chiều ấm dần: ảnh không đổi màu gốc, chỉ nhuộm nhẹ theo giờ.
      if (Math.abs(tod - lastTod) > 0.01) {
        lastTod = tod
        const warmth = Math.min(1, Math.max(0, (tod - 0.3) / 0.5)) * 0.55
        tint.setRGB(1, 1, 1).lerp(WARM_TINT, warmth)
      }

      // Khoảng cách dọc đường tới khung (dương = còn ở phía trước camera).
      let focus = -1
      let focusAhead = Infinity
      frames.forEach((frame, i) => {
        const ahead = (frame.u - progress) * JOURNEY_DEPTH
        const fadeIn = clamp01((FADE_IN_FAR - ahead) / (FADE_IN_FAR - FADE_IN_NEAR))
        const fadeOut = clamp01((ahead - FADE_OUT_GONE) / (FADE_OUT_NEAR - FADE_OUT_GONE))
        const opacity = fadeIn * fadeOut
        if (ahead > FADE_OUT_NEAR && ahead < focusAhead) {
          focusAhead = ahead
          focus = i
        }
        // Chưa có ảnh thì giữ màu kem của viền, đừng để một mảng trắng chói hiện ra.
        frame.faceMaterial.color.copy(frame.faceMaterial.map ? tint : BORDER_COLOR)
        frame.faceMaterial.opacity = opacity
        frame.borderMaterial.opacity = opacity
        frame.group.visible = opacity > 0.01
        frame.group.position.y = frame.baseY + Math.sin(time * 0.8 + frame.phase) * 0.03
      })
      // Đã đi qua hết các ảnh thì nút "xem ảnh lớn" mở ảnh cuối.
      photoPicker.focus = focus >= 0 ? focus : frames.length - 1
      if (motes) motes.rotation.y = Math.sin(time * 0.1) * 0.02
    },
    setQuality(_tier: QualityTier, settings: TierSettings) {
      if (moteMaterial) moteMaterial.size = settings.density < 0.5 ? 0.09 : 0.07
      if (motes) motes.visible = settings.density >= 0.5
      // Đổi bậc giữa chừng: nạp lại ở độ phân giải mới khi cần.
      if (loaded) {
        releaseTextures()
        loadTextures()
      }
      ctx?.invalidate()
    },
    dispose() {
      releaseTextures()
      photoPicker.pick = () => null
      frames.forEach((frame) => {
        frame.geometry.dispose()
        frame.faceMaterial.dispose()
        frame.borderMaterial.dispose()
      })
      sharedBorder?.dispose()
      sharedBorder = null
      frames.length = 0
      motes?.geometry.dispose()
      moteMaterial?.dispose()
      if (ctx) ctx.scene.remove(root)
      ctx = null
      motes = null
      moteMaterial = null
      showing = false
    },
  } satisfies SceneModule
}
