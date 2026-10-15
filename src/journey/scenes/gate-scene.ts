import {
  CylinderGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  type BufferGeometry,
} from 'three'
import { mulberry32 } from '../../lib/seeded-random'
import {
  AUTO_OPEN_SECONDS,
  INTRO_SECONDS,
  PHOTO_REVEAL_SECONDS,
  bloomScale,
  coverSize,
  easeOutCubic,
  gateDims,
  instanceCounts,
  openPose,
  photoFade,
  type GateDims,
} from '../gate-math'
import { gate } from '../gate-state'
import { hasMsaa } from '../msaa'
import { journeyProgress } from '../journey-progress'
import { photoState } from '../photo-state'
import type { QualityTier, TierSettings } from '../quality-tier'
import type { JourneyFrame, SceneContext, SceneModule } from '../scene-module'
import { createBloomTexture, createLeafTexture } from './gate-textures'

export interface GateSceneOptions {
  /** Ảnh cặp đôi hiện ra sau khi cổng mở; thiếu thì chỉ có cổng. */
  heroSrc: string | null
}

/** Khoảng cách tham chiếu từ camera (z = 8 khi chưa cuộn) tới cổng (z = 0) để tính cổng lấp đầy màn hình. */
const CAMERA_DISTANCE = 8
/** Độ cao mắt của camera ở đầu hành trình (xem journey-path.ts): tâm cổng đặt ngang mức này. */
const EYE_HEIGHT = 1.6
/** Ngay khi tiến độ cuộn vượt mức này thì coi là khách đã cuộn và cổng mở. */
const SCROLL_OPENS_AT = 0.004

const FLOWER_TINTS = ['#ffffff', '#ffffff', '#fbf3e4', '#f9dede', '#e3d9f4'].map((hex) => new Color(hex))
const LEAF_TINTS = ['#ffffff', '#e8f5e4', '#d6ebd2', '#f3fbe9'].map((hex) => new Color(hex))
const PHOTO_ASPECT_FALLBACK = 2 / 3
/**
 * Mặt phẳng ảnh nằm ngang tầm mắt camera, sau cổng đủ xa để hai cánh mở hết không cắm xuyên vào ảnh; kích thước tính
 * để phủ kín màn hình (xem coverSize).
 */
const PHOTO_CENTER = { y: EYE_HEIGHT, z: -3 }

interface Sample {
  x: number
  y: number
  z: number
}

interface InstanceLayout {
  count: number
  position: Float32Array
  rotation: Float32Array
  size: Float32Array
  delay: Float32Array
}

interface Part {
  mesh: InstancedMesh
  layout: InstanceLayout
  leaf: boolean
}

const dummy = new Object3D()

/** Điểm rải hoa/lá quanh khung cổng: dải dọc cung phía trên và hai trụ. */
function sampleFrame(random: () => number, { radius: R, post: H }: GateDims): Sample {
  const ringShare = (Math.PI * R) / (Math.PI * R + 2 * H)
  const offset = -0.2 + random() * 0.65
  const z = (random() - 0.5) * 0.6
  // Một phần hoa dồn thành cụm ở đỉnh vòm cho cổng có điểm nhấn và đọc ra hình vòm.
  if (random() < 0.12) {
    const angle = Math.PI / 2 + (random() - 0.5) * 0.7
    const r = R + 0.1 + random() * 0.35
    return { x: Math.cos(angle) * r, y: H + Math.sin(angle) * r, z: 0.15 + random() * 0.3 }
  }
  if (random() < ringShare) {
    const angle = random() * Math.PI
    const r = R + offset
    return { x: Math.cos(angle) * r, y: H + Math.sin(angle) * r, z }
  }
  const side = random() < 0.5 ? -1 : 1
  return { x: side * (R + offset), y: random() * H, z }
}

/** Điểm rải trên một cánh cổng, theo toạ độ riêng của cánh (gốc ở bản lề, x hướng vào giữa cổng). */
function sampleDoor(random: () => number, side: -1 | 1, { radius: R, post: H }: GateDims): Sample {
  const toCenter = random() * R
  const worldX = side * (R - toCenter)
  const top = H + Math.sqrt(Math.max(0, R * R - worldX * worldX))
  return { x: -side * toCenter, y: random() * top, z: (random() - 0.5) * 0.2 }
}

function makeLayout(
  count: number,
  random: () => number,
  sampler: (r: () => number) => Sample,
  leaf: boolean,
  maxDelay: number,
  sizeFactor: number,
): InstanceLayout {
  const layout: InstanceLayout = {
    count,
    position: new Float32Array(count * 3),
    rotation: new Float32Array(count * 3),
    size: new Float32Array(count),
    delay: new Float32Array(count),
  }
  for (let i = 0; i < count; i += 1) {
    const point = sampler(random)
    layout.position.set([point.x, point.y, point.z], i * 3)
    layout.rotation.set([(random() - 0.5) * 0.8, (random() - 0.5) * 0.8, random() * Math.PI * 2], i * 3)
    layout.size[i] = (leaf ? 0.45 + random() * 0.3 : 0.34 + random() * 0.34) * sizeFactor
    layout.delay[i] = random() * maxDelay
  }
  return layout
}

/** Ghi ma trận của mọi instance theo giây `bloomT` của giai đoạn nở (hoa nở lần lượt, nảy nhẹ). */
function applyLayout({ mesh, layout, leaf }: Part, bloomT: number) {
  for (let i = 0; i < layout.count; i += 1) {
    const scale = layout.size[i] * bloomScale(bloomT, layout.delay[i])
    dummy.position.set(layout.position[i * 3], layout.position[i * 3 + 1], layout.position[i * 3 + 2])
    dummy.rotation.set(layout.rotation[i * 3], layout.rotation[i * 3 + 1], layout.rotation[i * 3 + 2])
    dummy.scale.set(leaf ? scale * 0.5 : scale, scale, scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

/** Một cánh cổng nửa vòm làm nền kín dưới lớp hoa (gốc ở bản lề, mở rộng về phía x dương). */
function createDoorBackingGeometry({ radius: R, post: H }: GateDims): ShapeGeometry {
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.lineTo(R, 0)
  const steps = 18
  for (let i = steps; i >= 0; i -= 1) {
    const x = (R * i) / steps
    shape.lineTo(x, H + Math.sqrt(Math.max(0, R * R - (x - R) ** 2)))
  }
  shape.closePath()
  return new ShapeGeometry(shape)
}

/**
 * Cảnh mở đầu: cổng vòm hoa dựng bằng code (khung, hai cánh, hàng nghìn bông hoa và lá) lấp đầy màn hình, đóng kín.
 * Hoa nở lần lượt, rồi cổng mở (chạm, cuộn, hoặc tự mở sau vài giây): hai cánh xoay vào trong trên nền trống, cả cổng
 * trượt qua đầu camera. Chỉ SAU KHI cổng đã mở hẳn ảnh cặp đôi mới hiện dần. Camera do cuộn trang điều khiển; cảnh chỉ
 * di chuyển cổng chứ không đụng tới camera. Kích thước cổng tính lại theo tỉ lệ màn hình mỗi khi đổi cỡ cửa sổ.
 */
export function createGateScene({ heroSrc }: GateSceneOptions): SceneModule {
  let ctx: SceneContext | null = null
  const root = new Group()
  const frameGroup = new Group()
  const doorLeft = new Group()
  const doorRight = new Group()
  root.add(frameGroup, doorLeft, doorRight)

  /** Tài nguyên dùng suốt vòng đời cảnh (texture, vật liệu hoa/lá, ảnh) và tài nguyên của khung/cánh (dựng lại khi đổi cỡ). */
  const disposables: Array<{ dispose: () => void }> = []
  const structure: Array<{ dispose: () => void }> = []
  const track = <T extends { dispose: () => void }>(item: T, bucket = disposables): T => {
    bucket.push(item)
    return item
  }

  let parts: Part[] = []
  let dims: GateDims | null = null
  let settingsRef: TierSettings | null = null
  let photo: Mesh | null = null
  let photoMaterial: MeshBasicMaterial | null = null
  let flowerGeometry: BufferGeometry | null = null
  let flowerMaterial: MeshBasicMaterial | null = null
  let leafMaterial: MeshBasicMaterial | null = null

  let elapsed = 0
  let openElapsed = 0
  /** Giây kể từ khi cổng được gỡ; dùng để cho ảnh hiện dần sau khi cổng mở xong. */
  let goneElapsed = 0
  let introDone = false
  let gateGone = false
  let lastAspect = 0
  let photoAspect = PHOTO_ASPECT_FALLBACK
  /** Ảnh đã tải xong và có texture; trước đó mặt phẳng ảnh chỉ là tấm trắng nên phải ẩn. */
  let photoLoaded = false

  const disposeParts = () => {
    parts.forEach(({ mesh }) => {
      mesh.parent?.remove(mesh)
      mesh.dispose()
    })
    parts = []
  }

  const buildParts = (d: GateDims, density: number) => {
    if (!flowerGeometry || !flowerMaterial || !leafMaterial) return
    disposeParts()
    const counts = instanceCounts(density, d.countFactor)
    const random = mulberry32(20261220)
    const maxDelay = INTRO_SECONDS - 0.55
    const specs: Array<{ group: Group; count: number; sampler: (r: () => number) => Sample; leaf: boolean }> = [
      { group: frameGroup, count: counts.frameLeaves, sampler: (r) => sampleFrame(r, d), leaf: true },
      { group: frameGroup, count: counts.frameFlowers, sampler: (r) => sampleFrame(r, d), leaf: false },
      { group: doorLeft, count: counts.doorLeaves, sampler: (r) => sampleDoor(r, -1, d), leaf: true },
      { group: doorLeft, count: counts.doorFlowers, sampler: (r) => sampleDoor(r, -1, d), leaf: false },
      { group: doorRight, count: counts.doorLeaves, sampler: (r) => sampleDoor(r, 1, d), leaf: true },
      { group: doorRight, count: counts.doorFlowers, sampler: (r) => sampleDoor(r, 1, d), leaf: false },
    ]
    parts = specs.map(({ group, count, sampler, leaf }) => {
      const mesh = new InstancedMesh(flowerGeometry!, leaf ? leafMaterial! : flowerMaterial!, count)
      // Ma trận từng instance thay đổi nên hộp bao của hình gốc không đại diện được: tắt cắt theo khung nhìn.
      mesh.frustumCulled = false
      const layout = makeLayout(count, random, sampler, leaf, maxDelay, d.sizeFactor)
      const tints = leaf ? LEAF_TINTS : FLOWER_TINTS
      for (let i = 0; i < count; i += 1) mesh.setColorAt(i, tints[Math.floor(random() * tints.length)])
      group.add(mesh)
      const part = { mesh, layout, leaf }
      applyLayout(part, introDone ? INTRO_SECONDS : elapsed)
      return part
    })
  }

  /** Khung (vòm + hai trụ) và nền kín của hai cánh, theo kích thước hiện tại của cổng. */
  const buildStructure = (d: GateDims) => {
    const { radius: R, post: H } = d
    structure.splice(0).forEach((item) => item.dispose())
    ;[...frameGroup.children, ...doorLeft.children, ...doorRight.children].forEach((child) => {
      if (!(child instanceof InstancedMesh)) child.parent?.remove(child)
    })

    const cream = track(new MeshBasicMaterial({ color: '#efe8da' }), structure)
    const sage = track(new MeshBasicMaterial({ color: '#dde7d3', side: DoubleSide }), structure)
    const arc = new Mesh(track(new TorusGeometry(R + 0.1, 0.1, 8, 40, Math.PI), structure), cream)
    arc.position.y = H
    const postGeometry = track(new CylinderGeometry(0.1, 0.12, H, 10), structure)
    const postLeft = new Mesh(postGeometry, cream)
    postLeft.position.set(-(R + 0.1), H / 2, 0)
    const postRight = new Mesh(postGeometry, cream)
    postRight.position.set(R + 0.1, H / 2, 0)
    frameGroup.add(arc, postLeft, postRight)

    const backing = track(createDoorBackingGeometry(d), structure)
    const backingLeft = new Mesh(backing, sage)
    backingLeft.position.z = -0.04
    const backingRight = new Mesh(backing, sage)
    backingRight.position.z = -0.04
    backingRight.scale.x = -1
    doorLeft.add(backingLeft)
    doorRight.add(backingRight)
  }

  /** Tính lại kích thước cổng theo tỉ lệ màn hình; chỉ dựng lại khi kích thước thật sự đổi. */
  const fitGate = (settings: TierSettings) => {
    if (!ctx) return
    const next = gateDims(ctx.camera.aspect, ctx.camera.fov, CAMERA_DISTANCE)
    const changed = !dims || Math.abs(next.radius - dims.radius) > 1e-3 || Math.abs(next.post - dims.post) > 1e-3
    dims = next
    doorLeft.position.x = -next.radius
    doorRight.position.x = next.radius
    // Tâm cổng ngang tầm mắt camera: hai trụ chạm đáy màn hình, đỉnh vòm sát đỉnh.
    root.position.y = EYE_HEIGHT - next.height / 2
    if (changed) {
      buildStructure(next)
      if (!gateGone) buildParts(next, settings.density)
    }
  }

  /** Phủ kín màn hình theo tỉ lệ hiện tại của camera và của ảnh. */
  const fitPhoto = () => {
    if (!ctx || !photo) return
    const { width, height } = coverSize(ctx.camera.aspect, ctx.camera.fov, CAMERA_DISTANCE - PHOTO_CENTER.z, photoAspect)
    photo.scale.set(width, height, 1)
  }

  const buildPhoto = (context: SceneContext) => {
    const geometry = track(new PlaneGeometry(1, 1))
    // Ẩn hoàn toàn cho tới khi cổng mở hẳn, rồi hiện dần; mờ đi khi camera bay xuyên qua nó lúc cuộn.
    photoMaterial = track(new MeshBasicMaterial({ transparent: true, toneMapped: false }))
    photoMaterial.opacity = 0
    photo = new Mesh(geometry, photoMaterial)
    photo.position.set(0, PHOTO_CENTER.y, PHOTO_CENTER.z)
    photo.visible = false
    context.scene.add(photo)
    if (!heroSrc) return
    new TextureLoader().load(
      heroSrc,
      (texture) => {
        if (!ctx || !photo || !photoMaterial) {
          texture.dispose()
          return
        }
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = Math.min(4, context.renderer.capabilities.getMaxAnisotropy())
        track(texture)
        photoMaterial.map = texture
        photoMaterial.needsUpdate = true
        // Tải ảnh lên GPU ngay (lúc cổng còn đóng) thay vì ở khung hình đầu tiên nó được vẽ, tránh khựng giữa lúc cổng mở.
        context.renderer.initTexture(texture)
        photoLoaded = true
        const image = texture.image as { width: number; height: number }
        photoAspect = image.width / image.height
        fitPhoto()
        context.invalidate()
      },
      undefined,
      // Ảnh lỗi: mặt phẳng ảnh giữ nguyên ẩn (không để lộ tấm trắng). Cùng URL với ảnh của hero HTML nên bản dự phòng
      // cũng không có ảnh; không có gì thêm để làm ở đây.
      () => undefined,
    )
  }

  /** Mở xong hoặc bị bỏ qua: gỡ cổng khỏi cảnh để khỏi tốn công vẽ, rồi cho ảnh hiện dần. */
  const removeGate = () => {
    gateGone = true
    introDone = true
    root.visible = false
    // Cổng không bao giờ hiện lại: nhả bộ nhớ của hàng nghìn instance ngay.
    disposeParts()
    gate.finish()
  }

  const applyDoors = (angle: number) => {
    doorLeft.rotation.y = angle
    doorRight.rotation.y = -angle
  }

  return {
    id: 'gate',
    get continuous() {
      // Còn cổng (đang nở, chờ mở, đang mở) hoặc ảnh đang hiện dần thì vẽ liên tục; xong rồi thì chỉ vẽ khi cuộn.
      return !gateGone || goneElapsed < PHOTO_REVEAL_SECONDS
    },
    init(context) {
      ctx = context
      settingsRef = context.settings
      context.scene.add(root)
      flowerGeometry = track(new PlaneGeometry(1, 1))
      const bloom = track(createBloomTexture())
      const leaf = track(createLeafTexture())
      // alphaToCoverage chỉ khi thật sự có MSAA: không có thì nó rải mép hoa/lá thành các chấm (kiểu màn che).
      const alphaToCoverage = hasMsaa(context.renderer)
      flowerMaterial = track(new MeshBasicMaterial({ map: bloom, alphaTest: 0.35, alphaToCoverage, side: DoubleSide }))
      leafMaterial = track(new MeshBasicMaterial({ map: leaf, alphaTest: 0.35, alphaToCoverage, side: DoubleSide }))
      buildPhoto(context)

      // Mở lại trang giữa chừng (đã cuộn xuống): bỏ qua cổng, vào thẳng cảnh sau cổng, ảnh hiện ngay.
      if (journeyProgress.value > SCROLL_OPENS_AT) {
        goneElapsed = PHOTO_REVEAL_SECONDS
        removeGate()
        return
      }
      // Khung và hoa được dựng ở khung hình đầu tiên, khi đã biết tỉ lệ màn hình (init chạy trước lần resize đầu).
      gate.close()
    },
    update({ progress, delta }: JourneyFrame) {
      if (!ctx) return
      elapsed += delta

      if (ctx.camera.aspect !== lastAspect || (!gateGone && !dims)) {
        lastAspect = ctx.camera.aspect
        fitGate(settingsRef ?? ctx.settings)
        fitPhoto()
      }

      if (!introDone && !gateGone) {
        parts.forEach((part) => applyLayout(part, elapsed))
        if (elapsed >= INTRO_SECONDS) introDone = true
      }

      if (!gateGone) {
        if (gate.getState() === 'closed' && (elapsed >= AUTO_OPEN_SECONDS || progress > SCROLL_OPENS_AT)) gate.requestOpen()

        const state = gate.getState()
        if (state === 'opening') {
          openElapsed += delta
          const pose = openPose(openElapsed)
          applyDoors(pose.doorAngle)
          root.position.z = pose.slide
          if (pose.done) removeGate()
        } else if (state === 'open') {
          // Khách bỏ qua hiệu ứng (hoặc mở xong): nhảy thẳng tới trạng thái đã mở.
          removeGate()
        }
      } else {
        goneElapsed += delta
      }

      if (photo && photoMaterial) {
        // Ảnh chỉ hiện sau khi cổng đã gỡ hẳn, và hiện dần trong PHOTO_REVEAL_SECONDS.
        const reveal = gateGone ? easeOutCubic(Math.min(1, goneElapsed / PHOTO_REVEAL_SECONDS)) : 0
        const opacity = photoFade(progress) * reveal
        photoMaterial.opacity = opacity
        photo.visible = photoLoaded && opacity > 0.001
        // Chưa có ảnh (đang tải, lỗi, không có) thì coi như 0 để cảnh vườn không mất nền.
        photoState.opacity = photoLoaded ? opacity : 0
      }
    },
    setQuality(_tier: QualityTier, settings: TierSettings) {
      settingsRef = settings
      if (!gateGone && dims) buildParts(dims, settings.density)
      ctx?.invalidate()
    },
    dispose() {
      disposeParts()
      if (ctx) {
        ctx.scene.remove(root)
        if (photo) ctx.scene.remove(photo)
      }
      structure.splice(0).forEach((item) => item.dispose())
      disposables.splice(0).forEach((item) => item.dispose())
      photoState.opacity = 0
      gate.finish()
      ctx = null
      photo = null
      photoMaterial = null
      dims = null
    },
  }
}
