import { useRef } from 'react'
import { useNearViewport } from '../hooks/use-near-viewport'

/** Bộ sinh số ngẫu nhiên có hạt giống: mỗi lần dựng ra cùng một bố cục. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Variant = 1 | 2 | 3

interface Petal {
  /** Vị trí ngang (% bề rộng hero). */
  x: number
  /** Chiều rộng = chiều cao (px). */
  size: number
  variant: Variant
  /** Độ đậm, cũng là "độ sâu": cánh xa thì nhạt và rơi chậm. */
  opacity: number
  /** Thời gian rơi hết màn hình (s). Delay âm để mỗi cánh bắt đầu ở một chỗ khác nhau. */
  fall: number
  delay: number
  /** Biên độ lắc ngang (px) và chu kỳ lắc / lật (s). */
  sway: number
  swayDur: number
  tumbleDur: number
  tumbleDelay: number
  swayDelay: number
  /** Chiều xoay: normal hoặc reverse. */
  spin: 'normal' | 'reverse'
  /** Vị trí dọc (% chiều cao hero) khi tắt chuyển động: giữ ở nửa trên, xa chữ và nút. */
  top: number
}

const PETAL_COUNT = 30

function buildPetals(count: number): Petal[] {
  const random = mulberry32(2026)
  return Array.from({ length: count }, (_, i) => {
    const depth = 0.4 + random() * 0.6 // 0.4 (xa) .. 1 (gần)
    const fall = 26 - 14 * depth // gần: ~12s, xa: ~20s
    const swayDur = 3 + random() * 2.5
    const tumbleDur = 6 + random() * 5
    return {
      x: random() * 100,
      size: 18 + random() * 16,
      variant: ((i % 3) + 1) as Variant,
      opacity: Number((0.45 + depth * 0.5).toFixed(2)),
      fall,
      delay: -random() * fall,
      sway: 12 + random() * 26,
      swayDur,
      tumbleDur,
      swayDelay: -random() * swayDur * 2,
      tumbleDelay: -random() * tumbleDur,
      spin: random() > 0.5 ? 'normal' : 'reverse',
      top: 4 + random() * 40,
    }
  })
}

const PETALS = buildPetals(PETAL_COUNT)

/**
 * Ba dáng cánh hoa đào: rơi thẳng mặt (hình giọt), nghiêng (thoi hẹp, như đang lật nghiêng) và cong (như dấu phẩy,
 * đang uốn trong gió). Vẽ sẵn các dáng nghiêng và cong nên không cần lật 3D quá mạnh mới tạo được cảm giác khối.
 */
function PetalDefs() {
  return (
    <svg width="0" height="0" className="petal-defs" focusable="false">
      <defs>
        <linearGradient id="petal-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb7c5" />
          <stop offset="60%" stopColor="#ff8fa3" />
          <stop offset="100%" stopColor="#ff758c" />
        </linearGradient>
        <linearGradient id="petal-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffc2d1" />
          <stop offset="50%" stopColor="#ff99b3" />
          <stop offset="100%" stopColor="#ff6b8b" />
        </linearGradient>
        <linearGradient id="petal-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffa6b9" />
          <stop offset="50%" stopColor="#ff7b96" />
          <stop offset="100%" stopColor="#e65c7b" />
        </linearGradient>
      </defs>
      <symbol id="petal-1" viewBox="0 0 100 100">
        <path
          d="M50,5 C30,5 15,25 25,60 C32,80 45,92 50,95 C55,92 68,80 75,60 C85,25 70,5 50,5 Z"
          fill="url(#petal-grad-1)"
        />
      </symbol>
      <symbol id="petal-2" viewBox="0 0 100 100">
        <path
          d="M50,10 C35,15 25,35 30,65 C35,85 45,95 50,98 C55,95 60,85 58,65 C55,35 45,15 50,10 Z"
          fill="url(#petal-grad-2)"
        />
      </symbol>
      <symbol id="petal-3" viewBox="0 0 100 100">
        <path
          d="M50,8 C32,12 18,32 28,62 C34,80 46,93 52,96 C50,88 42,70 48,48 C54,26 68,14 50,8 Z"
          fill="url(#petal-grad-3)"
        />
      </symbol>
    </svg>
  )
}

/**
 * Cánh hoa đào rơi phủ lên ảnh hero, thuần SVG + CSS (không cần WebGL, JS chỉ dựng DOM một lần).
 * Mỗi cánh có ba lớp chuyển động độc lập nên không lặp máy móc: rơi, lắc ngang, và lật/xoay.
 * Chỉ animate transform nên trình duyệt đẩy lên GPU. Tự chạy ngay; tắt hẳn khi khách bật giảm chuyển động
 * (xem CSS) và tạm dừng khi hero ra khỏi màn hình để tiết kiệm pin.
 */
export function HeroPetals() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useNearViewport(ref, '0px')

  return (
    <div ref={ref} className={visible ? 'petal-field' : 'petal-field is-paused'} aria-hidden="true">
      <PetalDefs />
      {PETALS.map((petal, index) => (
        <span
          key={index}
          className="petal-fall"
          style={
            {
              '--x': `${petal.x}%`,
              '--top': `${petal.top}%`,
              '--fall': `${petal.fall}s`,
              '--delay': `${petal.delay}s`,
              '--sway': `${petal.sway}px`,
              '--sway-dur': `${petal.swayDur}s`,
              '--sway-delay': `${petal.swayDelay}s`,
              '--tumble-dur': `${petal.tumbleDur}s`,
              '--tumble-delay': `${petal.tumbleDelay}s`,
              '--spin': petal.spin,
              '--size': `${petal.size}px`,
              '--opacity': petal.opacity,
            } as React.CSSProperties
          }
        >
          <span className="petal-sway">
            <svg className="petal-tumble" viewBox="0 0 100 100">
              <use href={`#petal-${petal.variant}`} />
            </svg>
          </span>
        </span>
      ))}
    </div>
  )
}
