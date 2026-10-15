import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { createJourneyPath } from './journey-path'
import { journeyProgress } from './journey-progress'
import { createFpsGovernor, isWeakGpu, lowerTier, tierSettings, type QualityTier } from './quality-tier'
import type { SceneContext, SceneModule } from './scene-module'

export interface JourneyEngineOptions {
  canvas: HTMLCanvasElement
  modules: SceneModule[]
  tier: QualityTier
  /** Bậc chất lượng đổi (do bộ đo FPS hạ khi máy chậm, hoặc GPU yếu lúc khởi động). */
  onTierChange?: (tier: QualityTier) => void
  /** Context WebGL mất và không hồi phục kịp: bên ngoài nên chuyển sang bản HTML. */
  onContextLost: () => void
  /** Một cảnh hoặc lần vẽ ném lỗi: engine đã dừng vòng lặp, bên ngoài nên chuyển sang bản HTML. */
  onError?: (error: unknown) => void
  /** Khung hình đầu tiên đã được vẽ lên canvas: từ đây mới nên ẩn bản HTML thay bằng 3D. */
  onReady?: () => void
}

export interface JourneyEngine {
  readonly tier: () => QualityTier
  resize: (width: number, height: number) => void
  /** Báo cần vẽ lại một khung. */
  invalidate: () => void
  dispose: () => void
}

const FOV = 58
const LOOK_AHEAD = 6
/** Khoảng cách giữa hai khung lớn hơn mức này thì coi là vừa tạm dừng, không phải máy chậm. */
const IDLE_GAP_MS = 250
/** Trình duyệt thường trả context sau vài trăm ms; quá hạn này (khi trang đang hiển thị) thì bỏ cuộc. */
const CONTEXT_RESTORE_TIMEOUT_MS = 3000

export function createJourneyEngine(options: JourneyEngineOptions): JourneyEngine {
  const { canvas, modules, onTierChange, onContextLost, onError, onReady } = options
  let tier = options.tier
  let settings = tierSettings(tier)

  // alpha: để nền trang (đổi theo "thời gian trong ngày") hiện xuyên qua khi cảnh không tự vẽ nền.
  const renderer = new WebGLRenderer({ canvas, antialias: settings.antialias, alpha: true })
  renderer.setClearColor(0x000000, 0)

  // GPU yếu (texture nhỏ, không WebGL2) thì vào thẳng bậc thấp thay vì chờ bộ đo FPS phát hiện.
  if (tier !== 'low' && isWeakGpu(renderer.capabilities)) {
    tier = 'low'
    settings = tierSettings(tier)
    onTierChange?.(tier)
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.maxDpr))

  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 160)
  const path = createJourneyPath()
  const position = new Vector3()
  const tangent = new Vector3()

  const governor = createFpsGovernor()
  let dirty = true
  let running = false
  let disposed = false
  let contextLost = false
  let readyFired = false
  let lastFrame: number | null = null
  let startedAt: number | null = null
  let restoreTimer: ReturnType<typeof setTimeout> | undefined

  const context: SceneContext = {
    scene,
    camera,
    renderer,
    path,
    tier,
    settings,
    invalidate: () => invalidate(),
  }

  const releaseRenderer = () => {
    renderer.dispose()
    // Nhả context ngay để không chiếm chỗ trong giới hạn context của trình duyệt.
    renderer.forceContextLoss()
  }

  try {
    modules.forEach((module) => module.init(context))
  } catch (error) {
    // Cảnh khởi tạo dở dang: nhả những gì đã có để không rò context, rồi để bên ngoài xử lý lỗi.
    modules.forEach((module) => {
      try {
        module.dispose()
      } catch {
        // Cảnh chưa kịp khởi tạo có thể không dọn được; bỏ qua.
      }
    })
    releaseRenderer()
    throw error
  }

  const anyContinuous = () => modules.some((module) => module.continuous)

  function frame(now: number) {
    if (disposed) return
    try {
      startedAt ??= now
      const gap = lastFrame === null ? null : now - lastFrame
      lastFrame = now
      const delta = gap === null ? 0 : Math.min(gap, 100) / 1000

      // Chỉ đo FPS trên các khung liên tiếp; khung đầu sau khi nghỉ (gap null hoặc lớn) không phản ánh tốc độ máy.
      if (gap !== null && gap < IDLE_GAP_MS && governor.push(gap)) lowerTierOnce()

      // Xóa cờ trước khi cập nhật: cảnh gọi invalidate() trong update thì khung sau vẫn được vẽ.
      dirty = false
      const progress = journeyProgress.value
      path.getPointAt(progress, position)
      path.getTangentAt(progress, tangent)
      camera.position.copy(position)
      camera.lookAt(
        position.x + tangent.x * LOOK_AHEAD,
        position.y + tangent.y * LOOK_AHEAD,
        position.z + tangent.z * LOOK_AHEAD,
      )

      const state = { progress, tod: journeyProgress.tod, time: (now - startedAt) / 1000, delta }
      modules.forEach((module) => module.update(state))
      renderer.render(scene, camera)
      if (!readyFired) {
        readyFired = true
        onReady?.()
      }

      if (!dirty && !anyContinuous()) stop()
    } catch (error) {
      // three.js đặt lịch khung kế trước khi gọi callback: không dừng thì lỗi lặp lại mỗi khung hình.
      stop()
      onError?.(error)
    }
  }

  function start() {
    if (running || disposed || contextLost) return
    running = true
    lastFrame = null
    renderer.setAnimationLoop(frame)
  }

  function stop() {
    if (!running) return
    running = false
    renderer.setAnimationLoop(null)
  }

  function invalidate() {
    dirty = true
    start()
  }

  function lowerTierOnce() {
    const next = lowerTier(tier)
    if (!next) return
    tier = next
    settings = tierSettings(next)
    context.tier = next
    context.settings = settings
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.maxDpr))
    modules.forEach((module) => module.setQuality(next, settings))
    governor.reset()
    onTierChange?.(next)
  }

  // Đồng hồ chờ trả context chỉ chạy khi trang đang hiển thị: chuyển ứng dụng (Zalo, Facebook) có thể làm mất
  // context và trình duyệt chỉ trả lại khi quay về, nên tab ẩn không được tính vào hạn chờ.
  const armRestoreTimer = () => {
    clearTimeout(restoreTimer)
    if (!contextLost || disposed || document.visibilityState !== 'visible') return
    restoreTimer = setTimeout(() => {
      if (!disposed && contextLost) onContextLost()
    }, CONTEXT_RESTORE_TIMEOUT_MS)
  }
  const onContextLostEvent = (event: Event) => {
    // preventDefault: cho phép trình duyệt trả context lại.
    event.preventDefault()
    contextLost = true
    stop()
    armRestoreTimer()
  }
  const onContextRestoredEvent = () => {
    contextLost = false
    clearTimeout(restoreTimer)
    invalidate()
  }
  canvas.addEventListener('webglcontextlost', onContextLostEvent)
  canvas.addEventListener('webglcontextrestored', onContextRestoredEvent)
  document.addEventListener('visibilitychange', armRestoreTimer)

  invalidate()

  return {
    tier: () => tier,
    resize(width, height) {
      if (width <= 0 || height <= 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      invalidate()
    },
    invalidate,
    dispose() {
      disposed = true
      stop()
      clearTimeout(restoreTimer)
      canvas.removeEventListener('webglcontextlost', onContextLostEvent)
      canvas.removeEventListener('webglcontextrestored', onContextRestoredEvent)
      document.removeEventListener('visibilitychange', armRestoreTimer)
      modules.forEach((module) => module.dispose())
      releaseRenderer()
    },
  }
}
