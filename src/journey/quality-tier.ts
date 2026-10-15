/** Bậc chất lượng của cảnh 3D: máy yếu chỉ giảm số lượng và hậu kỳ, không đổi cấu trúc cảnh. */
export type QualityTier = 'high' | 'medium' | 'low'

export interface TierSettings {
  /** Trần devicePixelRatio của renderer. */
  maxDpr: number
  antialias: boolean
  /** Hệ số mật độ instance/hạt (1 = đủ). Cảnh nhân số lượng của mình với hệ số này. */
  density: number
  /** Bật hậu kỳ phát sáng (bloom). */
  bloom: boolean
}

const SETTINGS: Record<QualityTier, TierSettings> = {
  high: { maxDpr: 2, antialias: true, density: 1, bloom: true },
  // Điện thoại tầm trung: giữ độ phân giải 2x và khử răng cưa, chỉ giảm số lượng; hạ độ phân giải làm cả cảnh vỡ hạt.
  medium: { maxDpr: 2, antialias: true, density: 0.75, bloom: true },
  low: { maxDpr: 1.5, antialias: false, density: 0.4, bloom: false },
}

export const tierSettings = (tier: QualityTier): TierSettings => SETTINGS[tier]

/** Bậc thấp hơn kế tiếp; null khi đã ở bậc thấp nhất. */
export function lowerTier(tier: QualityTier): QualityTier | null {
  if (tier === 'high') return 'medium'
  if (tier === 'medium') return 'low'
  return null
}

export interface DeviceHints {
  /** Màn hình cảm ứng hoặc nhỏ (điện thoại). */
  coarse: boolean
  hardwareConcurrency?: number
  /** GB RAM gần đúng; chỉ Chromium có, Safari để trống. */
  deviceMemory?: number
}

/** Bậc khởi đầu theo phần cứng; bộ đo FPS sẽ hạ tiếp nếu thực tế vẫn chậm. */
export function pickInitialTier({ coarse, hardwareConcurrency, deviceMemory }: DeviceHints): QualityTier {
  const lowMemory = deviceMemory !== undefined && deviceMemory <= 2
  // Không suy ra "máy yếu" từ số nhân CPU trên điện thoại: Safari iPhone luôn báo ~4 nhân (che số thật để chống theo
  // dõi) nên mọi iPhone sẽ bị xếp nhầm vào bậc thấp. Bộ đo FPS sẽ tự hạ bậc nếu máy thật sự không kịp.
  if (coarse) return lowMemory ? 'low' : 'medium'
  return hardwareConcurrency !== undefined && hardwareConcurrency <= 2 ? 'medium' : 'high'
}

/** Thông tin GPU từ `renderer.capabilities` (chỉ phần cần dùng, để test không cần WebGL thật). */
export interface GpuCapabilities {
  maxTextureSize?: number
  isWebGL2?: boolean
}

/** GPU yếu hoặc cũ (texture tối đa nhỏ, không có WebGL2): vào thẳng bậc thấp. Thiếu thông tin thì coi là ổn. */
export function isWeakGpu(capabilities: GpuCapabilities | undefined): boolean {
  if (!capabilities) return false
  const smallTextures = capabilities.maxTextureSize !== undefined && capabilities.maxTextureSize < 4096
  return smallTextures || capabilities.isWebGL2 === false
}

export interface FpsGovernorOptions {
  /**
   * Dưới ngưỡng này trong một cửa sổ đo thì tính là cửa sổ chậm. Đặt dưới 30 vì nhiều điện thoại bị giới hạn 30fps
   * (chế độ tiết kiệm pin) và FPS đo được dao động quanh 30.
   */
  minFps?: number
  windowMs?: number
  /** Bỏ qua khoảng đầu: biên dịch shader và tải texture làm tụt FPS tạm thời. */
  warmupMs?: number
  /** Số cửa sổ chậm liên tiếp mới báo, tránh hạ bậc vì một cú giật đơn lẻ. */
  slowWindows?: number
}

export interface FpsGovernor {
  /** Nạp thời gian một khung hình liên tiếp (ms). Trả true khi đủ số cửa sổ chậm liên tiếp. */
  push: (deltaMs: number) => boolean
  /** Đo lại từ đầu (sau khi đổi bậc, kể cả khởi động lại giai đoạn làm nóng). */
  reset: () => void
}

export function createFpsGovernor({
  minFps = 25,
  windowMs = 1500,
  warmupMs = 1000,
  slowWindows = 2,
}: FpsGovernorOptions = {}): FpsGovernor {
  let warmed = 0
  let elapsed = 0
  let frames = 0
  let slowStreak = 0
  return {
    push(deltaMs) {
      if (warmed < warmupMs) {
        warmed += deltaMs
        return false
      }
      elapsed += deltaMs
      frames += 1
      if (elapsed < windowMs) return false
      const fps = (frames * 1000) / elapsed
      elapsed = 0
      frames = 0
      slowStreak = fps < minFps ? slowStreak + 1 : 0
      if (slowStreak < slowWindows) return false
      slowStreak = 0
      return true
    },
    reset() {
      warmed = 0
      elapsed = 0
      frames = 0
      slowStreak = 0
    },
  }
}
