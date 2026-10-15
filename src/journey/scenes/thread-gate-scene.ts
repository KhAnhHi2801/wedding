import {
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusKnotGeometry,
  type Texture,
} from 'three'
import { TIE_HOLD_SECONDS, coverSize, easeOutBack, easeOutCubic, openPose, photoFade, smoothstep } from '../gate-math'
import { gate } from '../gate-state'
import { journeyProgress } from '../journey-progress'
import { photoState } from '../photo-state'
import type { JourneyFrame, SceneContext, SceneModule } from '../scene-module'
import { clamp01 } from '../scroll-progress'
import { createDust, createPetalBurst, type Dust, type PetalBurst } from './thread-effects'
import { createStrand, createTwistTexture, type Strand } from './thread-strand'

export interface ThreadGateOptions {
  /** Ảnh cặp đôi hiện ra sau khi nút thắt mở; thiếu thì chỉ có sợi chỉ và nút. */
  heroSrc: string | null
}

/** Khoảng cách tham chiếu từ camera (z = 8 khi chưa cuộn) tới mặt phẳng sợi chỉ (z = 0). */
const CAMERA_DISTANCE = 8
/** Độ cao mắt của camera ở đầu hành trình (xem journey-path.ts). */
const EYE_HEIGHT = 1.6
/** Mở lại trang khi đã cuộn quá mức này thì bỏ qua cổng (cổng mở bằng chạm se chỉ, không mở bằng cuộn). */
const SCROLL_OPENS_AT = 0.004
const PHOTO_ASPECT_FALLBACK = 2 / 3
/** Mặt phẳng ảnh hero (phủ kín màn hình) nằm sau cảnh sợi chỉ; xem coverSize. */
const PHOTO_CENTER = { y: EYE_HEIGHT, z: -3 }
/** Khi màn rộng hơn ảnh, neo ảnh lệch lên trên để không mất đầu cô dâu chú rể (0 = sát mép trên, 0.5 = giữa). */
const PHOTO_FOCAL_Y = 0.4
/** Sau lần chạm đầu tiên, hai sợi chỉ tự se lại và gặp nhau trong chừng này giây. */
const WEAVE_SECONDS = 3.2
/** Chạm mà ngón tay trượt quá ngần này px là kéo, không phải chạm: kéo không được trình duyệt tính là thao tác để phát nhạc. */
const TAP_SLOP = 12
/** Biến CSS ghi tiến độ se chỉ (0..1) để chữ HTML (tên hai bên, dòng gợi ý) mờ theo, cùng nhịp với cảnh. */
const PROGRESS_VAR = '--thread'

/**
 * Cảnh mở đầu "sợi chỉ hồng": hai sợi chỉ xoắn từ hai mép màn hình, khách chạm một lần là chúng tự se lại gặp nhau và thắt nút; cánh hoa
 * bung ra rồi cổng tự mở, ảnh cặp đôi hiện dần phía sau. Camera do cuộn trang điều khiển; cảnh chỉ vẽ vật thể của mình.
 * Cổng chỉ mở sau khi nút thắt xong (hoặc khách bấm "Bỏ qua"): không tự mở theo giờ và không mở bằng cuộn. Lần chạm đầu cũng là thao tác cho phép phát nhạc.
 */
export function createThreadGateScene({ heroSrc }: ThreadGateOptions): SceneModule {
  let ctx: SceneContext | null = null
  const rig = new Group()
  const lights = new Group()
  const disposables: Array<{ dispose: () => void }> = []
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item)
    return item
  }

  const threadMaterial = track(
    new MeshPhysicalMaterial({
      map: track(createTwistTexture()),
      roughness: 0.62,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.4,
      sheenColor: '#ffc4d0',
      transparent: true,
    }),
  )
  const knot = new Mesh(track(new TorusKnotGeometry(0.2, 0.026, 220, 14, 2, 3)), threadMaterial)
  knot.scale.setScalar(0)
  const dust: Dust = track(createDust(150))
  const burst: PetalBurst = track(createPetalBurst(110))
  rig.add(dust.points, burst.points, knot)
  rig.position.y = EYE_HEIGHT

  let strands: Strand[] = []
  let builtFor = ''
  let photo: Mesh | null = null
  let photoMaterial: MeshBasicMaterial | null = null
  let photoAspect = PHOTO_ASPECT_FALLBACK
  let photoLoaded = false

  let elapsed = 0
  let openElapsed = 0
  let gateGone = false
  let lastAspect = 0
  /** Đã chạm: hai sợi chỉ bắt đầu tự se. */
  let started = false
  /** Tiến độ se chỉ (đích, tăng đều theo thời gian sau lần chạm) và tiến độ hiển thị (đã làm mượt). */
  let target = 0
  let progress = 0
  let tied = false
  let tiedAt = 0
  const pointer = { x: 0, y: 0, down: false, startX: 0, startY: 0 }

  /**
   * Chỉ một lần CHẠM (hoặc Enter/Space) mới bắt đầu se chỉ: trình duyệt chỉ coi chạm/click là thao tác hợp lệ để phát nhạc,
   * còn kéo ngón tay trên điện thoại thì không. Nhờ vậy nhạc (bắt đầu ở cùng lần chạm này) luôn được phép vang lên.
   */
  const startWeaving = () => {
    if (started || gateGone || gate.getState() !== 'closed') return
    started = true
    ctx?.invalidate()
  }
  const onPointerDown = (event: PointerEvent) => {
    pointer.down = true
    pointer.startX = event.clientX
    pointer.startY = event.clientY
  }
  const onPointerMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1
  }
  const onPointerUp = (event: PointerEvent) => {
    const moved = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY)
    if (pointer.down && moved < TAP_SLOP) startWeaving()
    pointer.down = false
  }
  const onKey = (event: KeyboardEvent) => {
    // Enter/Space trên nút "Bỏ qua" là kích hoạt nút, không phải bắt đầu se chỉ.
    if (event.target instanceof HTMLButtonElement) return
    if (event.key === ' ' || event.key === 'Enter') startWeaving()
  }

  const halfWidth = (context: SceneContext) => (2 * CAMERA_DISTANCE * Math.tan((context.camera.fov * Math.PI) / 360) * context.camera.aspect) / 2

  const buildStrands = (context: SceneContext) => {
    strands.forEach((strand) => {
      rig.remove(strand.group)
      strand.dispose()
    })
    const half = halfWidth(context)
    // Điện thoại dọc hẹp: vòng xoắn thu nhỏ theo bề rộng để không tràn khung.
    const spiralRadius = Math.min(1.5, half * 0.6)
    const tubeRadius = 0.032
    strands = ([-1, 1] as const).map((side) => {
      const strand = createStrand({ side, reach: Math.max(3.4, half + 1.3), halfWidth: half, spiralRadius, tubeRadius }, threadMaterial)
      rig.add(strand.group)
      return strand
    })
    builtFor = `${context.camera.aspect.toFixed(3)}`
  }

  const fitPhoto = () => {
    if (!ctx || !photo) return
    const distance = CAMERA_DISTANCE - PHOTO_CENTER.z
    const { width, height } = coverSize(ctx.camera.aspect, ctx.camera.fov, distance, photoAspect)
    photo.scale.set(width, height, 1)
    const visibleHeight = 2 * distance * Math.tan((ctx.camera.fov * Math.PI) / 360)
    const overflow = Math.max(0, height - visibleHeight)
    photo.position.y = PHOTO_CENTER.y - overflow * (0.5 - PHOTO_FOCAL_Y)
  }

  const buildPhoto = (context: SceneContext) => {
    // Ảnh hero phủ kín màn hình: ẩn cho tới khi cổng mở, rồi hiện dần phía sau nút thắt.
    photoMaterial = track(new MeshBasicMaterial({ transparent: true, toneMapped: false }))
    photoMaterial.opacity = 0
    photo = new Mesh(track(new PlaneGeometry(1, 1)), photoMaterial)
    photo.position.set(0, PHOTO_CENTER.y, PHOTO_CENTER.z)
    photo.visible = false
    context.scene.add(photo)
    if (!heroSrc) return
    new TextureLoader().load(
      heroSrc,
      (texture: Texture) => {
        if (!ctx || !photo || !photoMaterial) {
          texture.dispose()
          return
        }
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = Math.min(4, context.renderer.capabilities.getMaxAnisotropy())
        track(texture)
        photoMaterial.map = texture
        photoMaterial.needsUpdate = true
        // Tải ảnh lên GPU ngay (lúc cổng còn đóng) thay vì ở khung hình đầu tiên nó được vẽ, tránh khựng khi mở.
        context.renderer.initTexture(texture)
        photoLoaded = true
        const image = texture.image as { width: number; height: number }
        photoAspect = image.width / image.height
        fitPhoto()
        context.invalidate()
      },
      undefined,
      // Ảnh lỗi: mặt phẳng ảnh giữ nguyên ẩn (không để lộ tấm trắng); cùng URL với ảnh của hero HTML.
      () => undefined,
    )
  }

  const setCssProgress = (value: number) => document.documentElement.style.setProperty(PROGRESS_VAR, value.toFixed(3))

  const removeGate = () => {
    gateGone = true
    rig.visible = false
    lights.parent?.remove(lights)
    setCssProgress(1)
    gate.finish()
  }

  return {
    id: 'gate',
    get continuous() {
      // Bụi, cánh hoa và đầu chỉ luôn chuyển động cho tới khi cổng mở xong; sau đó chỉ vẽ khi cuộn.
      return !gateGone
    },
    init(context) {
      ctx = context
      context.scene.add(rig)
      // Ánh sáng chỉ để sợi chỉ và nút có khối; nằm ngoài rig để gỡ cùng cổng.
      const key = new DirectionalLight('#fff0dd', 2.6)
      key.position.set(-3, 5, 6)
      const rim = new DirectionalLight('#ffd9c9', 1.2)
      rim.position.set(4, 2, -4)
      lights.add(new HemisphereLight('#fff6ee', '#e8cfc4', 1.5), key, rim)
      context.scene.add(lights)
      buildStrands(context)
      buildPhoto(context)
      window.addEventListener('pointerdown', onPointerDown, { passive: true })
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerup', onPointerUp, { passive: true })
      window.addEventListener('pointercancel', onPointerUp, { passive: true })
      window.addEventListener('keydown', onKey)
      setCssProgress(0)

      // Mở lại trang giữa chừng (đã cuộn xuống): bỏ qua cổng, vào thẳng cảnh sau, ảnh hiện ngay.
      if (journeyProgress.value > SCROLL_OPENS_AT) {
        removeGate()
        return
      }
      gate.close()
    },
    update({ progress: scroll, delta }: JourneyFrame) {
      if (!ctx) return
      elapsed += delta

      if (ctx.camera.aspect !== lastAspect) {
        lastAspect = ctx.camera.aspect
        if (builtFor !== ctx.camera.aspect.toFixed(3)) buildStrands(ctx)
        fitPhoto()
      }

      let threadOpacity = 1
      let knotGrow = 1
      let hero = 0
      if (!gateGone) {
        const state = gate.getState()
        if (state === 'opening') {
          openElapsed += delta
          const pose = openPose(openElapsed)
          threadOpacity = pose.thread
          knotGrow = pose.knotGrow
          hero = pose.hero
          if (pose.done) removeGate()
        } else if (state === 'open') {
          // Khách bỏ qua hiệu ứng (hoặc mở xong): nhảy thẳng tới trạng thái đã mở.
          hero = 1
          removeGate()
        }
      }

      const heroReveal = gateGone ? 1 : hero
      if (photo && photoMaterial) {
        const opacity = photoFade(scroll) * heroReveal
        photoMaterial.opacity = opacity
        photo.visible = photoLoaded && opacity > 0.001
        // Chưa có ảnh (đang tải, lỗi, không có) thì coi như 0 để cảnh vườn không mất nền.
        photoState.opacity = photoLoaded ? opacity : 0
      }
      if (gateGone) return

      // Tiến độ se chỉ: sau lần chạm, đích tăng đều tới 1; hiển thị bám theo mượt. Hai sợi gặp nhau thì thắt nút.
      if (started && target < 1) target = Math.min(1, target + delta / WEAVE_SECONDS)
      progress += (target - progress) * (1 - Math.exp(-5 * delta))
      if (target >= 1 && progress > 0.99) progress = 1
      strands.forEach((strand) => strand.setProgress(progress))
      if (progress >= 1 && !tied) {
        tied = true
        tiedAt = elapsed
      }
      const tieTime = tied ? elapsed - tiedAt : -1
      // Nút đã thắt xong và đã ngắm một lúc thì cổng tự mở (khách đã chạm nên nhạc cũng đã được phép phát).
      if (tied && tieTime > TIE_HOLD_SECONDS && gate.getState() === 'closed') gate.requestOpen()

      knot.scale.setScalar(tied ? Math.max(0, easeOutBack(clamp01(tieTime / 0.8))) * knotGrow : 0)
      knot.rotation.set(0.3, Math.max(0, tieTime) * 0.25, 0.1)
      threadMaterial.opacity = threadOpacity
      strands.forEach((strand) => strand.setGlow(threadOpacity))
      setCssProgress(progress)

      const pxPerUnit = ctx.renderer.domElement.height / (2 * Math.tan((ctx.camera.fov * Math.PI) / 360))
      const intro = easeOutCubic(Math.min(1, elapsed / 1.2))
      dust.setTime(elapsed)
      dust.setView(pxPerUnit, intro * threadOpacity)
      burst.setTime(tieTime)
      burst.setView(pxPerUnit)
      // Vào trang rồi thì không còn cánh hoa nào: mờ hết trong ~0.3s đầu của pha mở, không để rơi nốt rồi mới mất.
      burst.setFade(1 - smoothstep(0, 0.3, openElapsed))

      // Cảnh thở nhẹ và nghiêng theo con trỏ: chiều sâu mà không cần ảnh phẳng.
      rig.rotation.y += (pointer.x * 0.18 + Math.sin(elapsed * 0.25) * 0.08 - rig.rotation.y) * 0.05
      rig.rotation.x += (pointer.y * 0.1 - rig.rotation.x) * 0.05
    },
    setQuality() {
      ctx?.invalidate()
    },
    dispose() {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKey)
      strands.forEach((strand) => strand.dispose())
      strands = []
      if (ctx) {
        ctx.scene.remove(rig)
        ctx.scene.remove(lights)
        if (photo) ctx.scene.remove(photo)
      }
      disposables.splice(0).forEach((item) => item.dispose())
      document.documentElement.style.removeProperty(PROGRESS_VAR)
      photoState.opacity = 0
      gate.finish()
      ctx = null
      photo = null
      photoMaterial = null
    },
  }
}
