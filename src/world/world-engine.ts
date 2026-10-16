import { Fog, MathUtils, PerspectiveCamera, Scene, TextureLoader, WebGLRenderer } from 'three'
import { createCameraRig } from './camera-rig'
import { CHAPTERS, findChapterIndex } from './chapters'
import { attachPointerInput, createScrollReader, pointerInput } from './input-sources'
import { createQualityGovernor } from './quality-governor'
import { lowerTier, type QualityTier, tierById } from './quality-tier'
import { createOpeningScene } from './scene/opening-scene'
import type { SceneModule } from './scene/scene-module'
import { WORLD } from './world-config'
import { worldStore } from './world-store'

export interface WorldEngineOptions {
  /** Vùng chứa các chương: tiến độ cuộn được tính trên vùng này, không tính phần nội dung phía dưới. */
  scrollContent: HTMLElement
  /** Context WebGL được trình duyệt trả lại sau khi mất; chủ sở hữu canvas nên dựng lại engine. */
  onContextRestored: () => void
}

export interface WorldEngine {
  dispose: () => void
}

/** Mỗi bước của một khung hình là một hàm nhỏ; vòng lặp chỉ chạy lần lượt danh sách, không rẽ nhánh. */
type Tick = (dt: number) => void

/** Sau chừng này giây không cuộn, không di chuột thì hạ tốc độ vẽ và làm hoa rơi chậm lại để đỡ pin. */
const IDLE_AFTER_SECONDS = 8
const IDLE_FPS = 30
const IDLE_PACE = 0.5
/** Dung sai khi so khoảng cách khung hình với nhịp vẽ mong muốn (màn 60Hz cho khung cách nhau ~16,6ms). */
const FRAME_SLACK_SECONDS = 0.003

/**
 * Dựng renderer, scene, camera và vòng lặp. Trạng thái đổi mỗi khung hình (tiến độ mượt, con trỏ mượt, giờ hoạt ảnh)
 * nằm trong `motion` thay vì store, để React không bị đánh thức 60 lần mỗi giây.
 * Chỉ vẽ khi có hoạt ảnh đang chạy hoặc camera vừa dịch, không vượt tốc độ tối đa của tier, và dừng hẳn khi tab bị ẩn.
 */
export async function createWorldEngine(canvas: HTMLCanvasElement, options: WorldEngineOptions): Promise<WorldEngine> {
  const store = worldStore
  const controller = new AbortController()
  const { signal } = controller

  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(WORLD.colors.paper)

  const first = CHAPTERS[0].fog
  const fog = new Fog(first.color, first.near, first.far)
  const scene = new Scene()
  scene.fog = fog
  const camera = new PerspectiveCamera(WORLD.fov.landscape, 1, WORLD.camera.near, WORLD.camera.far)
  const rig = createCameraRig(camera, fog)
  const modules: SceneModule[] = [createOpeningScene()]
  const scroll = createScrollReader(options.scrollContent)

  let tier: QualityTier = tierById(store.getState().tierId)
  let lastWidth = 0

  const motion = {
    time: 0,
    dt: 0,
    progress: scroll.read(),
    pointerX: 0,
    pointerY: 0,
    dirty: true,
    animating: true,
    /** Số giây liên tiếp không có cuộn hay chuyển động con trỏ. */
    idleFor: 0,
    /** Thời gian kể từ lần vẽ trước, dùng để giữ nhịp vẽ theo tier. */
    sinceRender: 0,
  }

  const syncSize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.maxDpr))
    renderer.setSize(width, height, false)
    rig.setAspect(width / height)
    lastWidth = width
    motion.dirty = true
  }

  // Canvas cao bằng 100lvh nên chiều cao không đổi khi thanh địa chỉ trên điện thoại ẩn/hiện: chỉ resize khi chiều rộng đổi.
  const observer = new ResizeObserver(() => {
    if (canvas.clientWidth !== lastWidth && canvas.clientWidth > 0) syncSize()
  })
  observer.observe(canvas)

  const applyTier = (next: QualityTier) => {
    tier = next
    store.getState().setTier(next.id)
    modules.forEach((module) => module.applyQuality(next))
    syncSize()
  }

  const governor = createQualityGovernor(() => {
    const next = lowerTier(tier.id)
    if (next.id !== tier.id) applyTier(next)
  })

  const settled = (current: number, next: number) => Math.abs(next - current) <= WORLD.restEpsilon

  const ticks: readonly Tick[] = [
    // 1. Đồng hồ hoạt ảnh: đứng yên khi khách bật giảm chuyển động hoặc bấm tạm dừng; chậm lại khi khách ngồi yên.
    (dt) => {
      const { reducedMotion, paused } = store.getState()
      motion.animating = !(reducedMotion || paused)
      const pace = motion.idleFor > IDLE_AFTER_SECONDS ? IDLE_PACE : 1
      motion.time += dt * Number(motion.animating) * pace
      motion.dt = dt
    },
    // 2. Đọc cuộn và con trỏ, làm mượt để camera có quán tính.
    (dt) => {
      const { reducedMotion } = store.getState()
      const parallax = Number(!reducedMotion)
      const progress = MathUtils.damp(motion.progress, scroll.read(), WORLD.progressDamping, dt)
      const pointerX = MathUtils.damp(motion.pointerX, pointerInput.x * parallax, WORLD.pointerDamping, dt)
      const pointerY = MathUtils.damp(motion.pointerY, pointerInput.y * parallax, WORLD.pointerDamping, dt)
      const resting =
        settled(motion.progress, progress) && settled(motion.pointerX, pointerX) && settled(motion.pointerY, pointerY)
      motion.dirty ||= !resting
      motion.idleFor = resting ? motion.idleFor + dt : 0
      Object.assign(motion, { progress, pointerX, pointerY })
    },
    // 3. Camera và sương mù theo bảng chương; chương hiện tại báo cho HTML qua store.
    () => {
      rig.update(motion.progress, motion.pointerX, motion.pointerY)
      store.getState().setChapterIndex(findChapterIndex(motion.progress))
    },
    // 4. Các cảnh tự cập nhật phần của mình.
    () => modules.forEach((module) => module.update(motion)),
    // 5. Vẽ khi cần và không nhanh hơn nhịp của tier (hạ xuống IDLE_FPS lúc khách ngồi yên), rồi nạp thời gian
    //    cho bộ điều chỉnh chất lượng (chỉ khi khách đang tương tác, vì lúc ngồi yên ta cố ý vẽ chậm).
    (dt) => {
      motion.sinceRender += dt
      const idle = motion.idleFor > IDLE_AFTER_SECONDS
      const fps = idle ? Math.min(tier.fps, IDLE_FPS) : tier.fps
      if (!(motion.animating || motion.dirty) || motion.sinceRender < 1 / fps - FRAME_SLACK_SECONDS) return
      renderer.render(scene, camera)
      motion.dirty = false
      if (motion.animating && !idle) governor(motion.sinceRender)
      motion.sinceRender = 0
    },
  ]

  let raf = 0
  let last = 0
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    ticks.forEach((tick) => tick(dt))
  }
  const stop = () => cancelAnimationFrame(raf)
  const start = () => {
    stop()
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }

  const detachInput = attachPointerInput()

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()), { signal })
  window
    .matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', (event) => store.getState().setReducedMotion(event.matches), { signal })
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault()
      stop()
      store.getState().setStatus('lost')
    },
    { signal }
  )
  canvas.addEventListener('webglcontextrestored', options.onContextRestored, { signal })

  const dispose = () => {
    stop()
    controller.abort()
    observer.disconnect()
    scroll.dispose()
    detachInput()
    modules.forEach((module) => module.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
  }

  try {
    const context = {
      scene,
      camera,
      loader: new TextureLoader(),
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      tier,
    }
    await Promise.all(modules.map((module) => module.init(context)))
  } catch (error) {
    dispose()
    throw error
  }

  syncSize()
  store.getState().setStatus('ready')
  start()
  return { dispose }
}
