export interface Point {
  x: number
  y: number
}

interface LengthSample {
  /** Chiều dài từ đầu sợi chỉ đến điểm này. */
  len: number
  /** Toạ độ dọc của điểm. */
  y: number
}

const round = (n: number) => Math.round(n * 10) / 10

/**
 * Nối các điểm thành một đường cong mượt đi qua đúng từng điểm (Catmull-Rom đổi sang Bézier bậc ba),
 * trả về giá trị thuộc tính `d` của <path>.
 */
export function buildThreadPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${round(points[0].x)} ${round(points[0].y)}`
  let d = `M${round(points[0].x)} ${round(points[0].y)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`
  }
  return d
}

/**
 * Sợi chỉ đã vẽ được bao nhiêu khi mép "đầu bút" nằm ở toạ độ dọc `targetY`: chiều dài của đoạn đầu tiên
 * mà điểm đầu mút chưa vượt quá `targetY`. Nội suy giữa hai mẫu để chuyển động liền mạch.
 */
export function findLengthAtY(samples: LengthSample[], targetY: number): number {
  if (samples.length === 0 || targetY <= samples[0].y) return 0
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].y > targetY) {
      const a = samples[i - 1]
      const b = samples[i]
      const span = b.y - a.y
      return span <= 0 ? a.len : a.len + ((targetY - a.y) / span) * (b.len - a.len)
    }
  }
  return samples[samples.length - 1].len
}

/** Số điểm cột (ảnh) mà sợi chỉ đã chạm tới khi đã vẽ được `drawn` chiều dài. */
export function countReached(pinLengths: number[], drawn: number): number {
  return pinLengths.filter((len) => len <= drawn).length
}

/** Chiều dài tại mẫu gần nhất với một điểm cho trước (để biết điểm cột nằm ở đâu trên sợi chỉ). */
export function lengthNearPoint(samples: Array<LengthSample & { x: number }>, point: Point): number {
  let best = 0
  let bestDistance = Infinity
  for (const sample of samples) {
    const distance = (sample.x - point.x) ** 2 + (sample.y - point.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = sample.len
    }
  }
  return best
}
