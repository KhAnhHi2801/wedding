/** Vị trí và vẻ ngoài của một đèn lồng, suy ra hoàn toàn từ id nên không đổi giữa các lần tải trang. */
export interface LanternSpot {
  /** 0..1 theo chiều ngang của bầu trời. */
  x: number
  /** 0..1 theo chiều dọc (0 = đỉnh). */
  y: number
  /** Pha dao động để các đèn không nhấp nhô cùng lúc. */
  phase: number
  /** Hệ số tốc độ dao động. */
  speed: number
  /** Độ sâu: nhỏ = xa (bé, mờ, chậm), lớn = gần. */
  size: number
  /** Chỉ số màu trong bảng màu đèn. */
  tone: number
}

export const LANTERN_TONES = 3

/** FNV-1a 32 bit. */
export function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Bộ sinh số giả ngẫu nhiên xác định (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function lanternSpot(id: string): LanternSpot {
  const next = seeded(hashId(id))
  return {
    x: 0.07 + next() * 0.86,
    y: 0.14 + next() * 0.7,
    phase: next() * Math.PI * 2,
    speed: 0.6 + next() * 0.8,
    size: 0.6 + next() * 0.8,
    tone: Math.floor(next() * LANTERN_TONES),
  }
}

/** Số đèn tối đa hiển thị cùng lúc; màn hẹp thưa hơn để còn chạm trúng. */
export function lanternCap(widthPx: number): number {
  return widthPx < 520 ? 50 : 90
}

/**
 * Đèn gần điểm chạm nhất trong bán kính cho trước (px), hoặc -1.
 * `centers` là tọa độ tâm đèn theo px, cùng thứ tự với danh sách đèn.
 */
export function pickLantern(centers: ReadonlyArray<{ x: number; y: number }>, px: number, py: number, radius: number): number {
  let best = -1
  let bestDist = radius * radius
  centers.forEach((c, i) => {
    const d = (c.x - px) ** 2 + (c.y - py) ** 2
    if (d <= bestDist) {
      bestDist = d
      best = i
    }
  })
  return best
}
