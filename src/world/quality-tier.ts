export type QualityTierId = 'high' | 'mid' | 'low'

export interface QualityTier {
  id: QualityTierId
  maxDpr: number
  /** Giới hạn tốc độ vẽ. Chỉ dùng 60 hoặc 30: màn 60Hz/120Hz chia hết nên nhịp khung đều, không giật. */
  fps: 60 | 30
  /** Số cánh hoa giấy rơi. */
  petals: number
}

/** Xếp từ tốt nhất đến nhẹ nhất; hạ tier là đi sang phần tử kế tiếp. */
export const QUALITY_TIERS: readonly QualityTier[] = [
  { id: 'high', maxDpr: 2, fps: 60, petals: 90 },
  { id: 'mid', maxDpr: 1.5, fps: 60, petals: 48 },
  { id: 'low', maxDpr: 1, fps: 30, petals: 20 },
]

const tierAt = (index: number): QualityTier => QUALITY_TIERS[Math.min(Math.max(index, 0), QUALITY_TIERS.length - 1)]

/** Trình duyệt trong ứng dụng (Zalo, Facebook, Instagram, Line) cuộn và vẽ kém hơn trình duyệt thường. */
const IN_APP_BROWSER = /FBAN|FBAV|Zalo|Instagram|Line\//i

/** Điện thoại (con trỏ cảm ứng), máy ít nhân CPU và trình duyệt trong ứng dụng mỗi yếu tố đẩy tier xuống một bậc. */
export function pickInitialTier(): QualityTier {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches === true
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4
  const inApp = IN_APP_BROWSER.test(navigator.userAgent)
  return tierAt(Number(coarse) + Number(fewCores) + Number(inApp))
}

export function lowerTier(current: QualityTierId): QualityTier {
  return tierAt(QUALITY_TIERS.findIndex((tier) => tier.id === current) + 1)
}

export const tierById = (id: QualityTierId): QualityTier => QUALITY_TIERS.find((tier) => tier.id === id) ?? tierAt(0)
