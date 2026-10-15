import { createJourneyEngine } from './journey-engine'
import { journeyProgress } from './journey-progress'
import { pickInitialTier, type QualityTier } from './quality-tier'
import { createProbeScene } from './scenes/probe-scene'

export interface StartJourneyOptions {
  canvas: HTMLCanvasElement
  /** Context WebGL mất và không hồi phục: bên ngoài chuyển sang bản HTML. */
  onFail: (reason: string) => void
  onTierChange?: (tier: QualityTier) => void
}

export interface RunningJourney {
  dispose: () => void
}

const isCoarse = () =>
  window.matchMedia?.('(pointer: coarse)').matches === true || window.innerWidth < 700

/**
 * Điểm vào duy nhất của phần 3D: lắp engine với các cảnh, nối tiến độ cuộn và kích thước khung nhìn.
 * File này (cùng Three.js) chỉ được nạp bằng `import()` khi cần, để không vào gói tải ban đầu.
 */
export function startJourney({ canvas, onFail, onTierChange }: StartJourneyOptions): RunningJourney {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const engine = createJourneyEngine({
    canvas,
    modules: [createProbeScene()],
    tier: pickInitialTier({
      coarse: isCoarse(),
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory,
    }),
    onTierChange,
    onContextLost: () => onFail('WebGL bị trình duyệt thu hồi (hết bộ nhớ hoặc tab bị ẩn lâu)'),
    onError: (error) => onFail(`lỗi khi vẽ cảnh 3D: ${error instanceof Error ? error.message : String(error)}`),
  })

  const fit = () => engine.resize(window.innerWidth, window.innerHeight)
  fit()
  window.addEventListener('resize', fit)
  const unsubscribe = journeyProgress.subscribe(engine.invalidate)

  return {
    dispose() {
      window.removeEventListener('resize', fit)
      unsubscribe()
      engine.dispose()
    },
  }
}
