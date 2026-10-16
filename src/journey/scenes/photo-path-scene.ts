import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  Vector3,
  LinearMipmapLinearFilter,
  type ShapeGeometry,
} from 'three'
import type { AssetImage } from '../../config/assets'
import { gate } from '../gate-state'
import { JOURNEY_DEPTH } from '../journey-path'
import { clamp01 } from '../scroll-progress'
import { photoPicker } from '../photo-state'
import type { QualityTier, TierSettings } from '../quality-tier'
import type { JourneyFrame, SceneContext, SceneModule } from '../scene-module'
import { wishLights } from '../wish-lights-state'
import { ARCH_HEIGHT, createArchBorderGeometry, createArchPhotoGeometry } from './photo-arch-geometry'
import { createCameraBackdrop, type CameraBackdrop } from './camera-backdrop'
import { acquireFlora, releaseFlora } from './flora-sprites'
import { createWreath, createWreathShared, type Wreath, type WreathShared } from './photo-wreath'
import { createWishTags, type WishTags } from './photo-wish-tags'

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
const SWAY = 0
const YAW = 0
/** Tâm khung cao hơn tầm mắt: chừa chỗ cho thẻ lời chúc phía dưới màn hình (âm = cao hơn). */
const CENTER_BELOW_EYE = -0.05
const FRAME_SCALE = 0.7
/** Khoảng cách (đơn vị đường đi) từ camera tới khung: hiện dần từ xa, tan dần khi camera đi xuyên qua. */
const FADE_IN_FAR = 5.8
const FADE_IN_NEAR = 4.6
const FADE_OUT_NEAR = 3.4
const FADE_OUT_GONE = 2.2
/** Phông bokeh hiện dần khi camera tới phần ảnh và tan khi rời; khoảng tiến độ (vào, ra). */
const BACKDROP_IN: readonly [number, number] = [0.5, 0.545]
const BACKDROP_OUT: readonly [number, number] = [0.715, 0.76]
const backdropOpacity = (progress: number) =>
  clamp01((progress - BACKDROP_IN[0]) / (BACKDROP_IN[1] - BACKDROP_IN[0])) *
  (1 - clamp01((progress - BACKDROP_OUT[0]) / (BACKDROP_OUT[1] - BACKDROP_OUT[0])))
const BORDER_MARGIN = 0.09
const MAX_PHOTOS = 8

const BORDER_COLOR = new Color('#f6e7d4')
const WARM_TINT = new Color('#ffe2c2')

interface PhotoFrame {
  group: Group
  face: Mesh
  faceMaterial: MeshBasicMaterial
  borderMaterial: MeshBasicMaterial
  geometry: ShapeGeometry
  wreath: Wreath
  tags: WishTags
  baseYaw: number
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
  let sharedBorder: ShapeGeometry | null = null
  let wreathShared: WreathShared | null = null
  let backdrop: CameraBackdrop | null = null
  let floraHeld = false
  let lastTod = -1
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const tint = new Color()

  const releaseTextures = () => {
    loadToken += 1
    loaded = false
    if (floraHeld) {
      floraHeld = false
      releaseFlora()
    }
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
    floraHeld = true
    acquireFlora(anisotropy).then((list) => {
      // Đã giải phóng hoặc đã dỡ cảnh trong lúc chờ: nhả tham chiếu vừa lấy (bộ texture do kho dùng chung quản lý).
      if (token !== loadToken || !ctx) return
      wreathShared?.setTextures(list)
      ctx.invalidate()
    })
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
    wreathShared = createWreathShared()
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
        const wreath = createWreath(wreathShared as WreathShared, 1234 + i * 97, context.settings.density < 0.5 ? 0.5 : 1)
        const tags = createWishTags()
        const group = new Group()
        group.add(border, face, wreath.group, tags.group)
        // Phông bokeh vẽ ở thứ tự 1: khung ảnh, vòng hoa và thẻ nơ phải nằm trên nó.
        border.renderOrder = 2
        face.renderOrder = 2
        tags.group.traverse((object) => {
          object.renderOrder = 6
        })
        group.position.copy(position)
        // Mặt khung hướng về camera đang tới (ngược chiều đi), nghiêng nhẹ xen kẽ.
        group.rotation.y = Math.atan2(-tangent.x, -tangent.z) + side * YAW
        group.scale.setScalar(FRAME_SCALE)
        group.visible = false
        root.add(group)
        return { group, face, faceMaterial, borderMaterial, geometry, wreath, tags, baseYaw: group.rotation.y, baseY, phase: i * 1.7, u }
      }),
    )
    // Viền dùng chung một geometry: giải phóng một lần.
    sharedBorder = borderGeometry
  }

  return {
    id: 'photo-path',
    get continuous() {
      return showing
    },
    init(context) {
      ctx = context
      buildFrames(context)
      wishLights.setPhotoCount(items.length)
      // Phông nhòe ấm phủ lên vườn khi tới phần ảnh: ảnh và vòm hoa nổi lên như trên sân khấu, vườn lùi lại.
      backdrop = createCameraBackdrop(context.scene, 'assets/backdrop/photo-bokeh.webp', { renderOrder: 1 })
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
      backdrop?.update(ctx.camera, gate.getState() === 'open' ? backdropOpacity(progress) : 0, ctx.camera.position.x * 0.004)
      if (!showing) return

      // Ánh chiều ấm dần: ảnh không đổi màu gốc, chỉ nhuộm nhẹ theo giờ.
      if (Math.abs(tod - lastTod) > 0.01) {
        lastTod = tod
        const warmth = Math.min(1, Math.max(0, (tod - 0.3) / 0.5)) * 0.55
        tint.setRGB(1, 1, 1).lerp(WARM_TINT, warmth)
      }

      const activeId = wishLights.getActiveId()
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
        // Hoa nở khi ảnh tới và khép lại khi ảnh đi; thẻ nơ theo lời chúc của đúng ảnh này.
        frame.wreath.setBloom(opacity ** 1.5)
        frame.wreath.setOpacity(opacity)
        // Xoay nhẹ quanh trục đứng: các lớp ở độ sâu khác nhau lệch nhau (parallax) dù camera chỉ đi thẳng.
        frame.group.rotation.y = frame.baseYaw + Math.sin(time * 0.5 + frame.phase) * 0.07
        frame.wreath.setTime(time)
        const wishes = wishLights.wishesOfPhoto(i)
        const activeIndex = wishes.findIndex((wish) => wish.id === activeId)
        frame.tags.update(wishes.slice(0, 3).map((wish) => wish.name), activeIndex, opacity, time)
      })
      // Đã đi qua hết các ảnh thì nút "xem ảnh lớn" mở ảnh cuối.
      photoPicker.focus = focus >= 0 ? focus : frames.length - 1
      wishLights.setPhoto(photoPicker.focus)
    },
    setQuality(_tier: QualityTier, _settings: TierSettings) {
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
        frame.wreath.dispose()
        frame.tags.dispose()
      })
      wreathShared?.dispose()
      wreathShared = null
      backdrop?.dispose()
      backdrop = null
      sharedBorder?.dispose()
      sharedBorder = null
      frames.length = 0
      if (ctx) ctx.scene.remove(root)
      ctx = null
      showing = false
    },
  } satisfies SceneModule
}
