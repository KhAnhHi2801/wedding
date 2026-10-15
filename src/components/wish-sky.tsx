import { useEffect, useMemo, useRef, useState } from 'react'
import { useNearViewport } from '../hooks/use-near-viewport'
import type { Wish } from '../lib/wishes-api'
import { hashId, lanternCap, lanternSpot, pickLantern, type LanternSpot } from '../lib/wish-position'

interface WishSkyProps {
  wishes: Wish[]
  /** Lời chúc vừa gửi: bay lên từ đáy bầu trời và được làm nổi bật. */
  highlightId: string | null
}

interface Lantern {
  wish: Wish
  spot: LanternSpot
}

const TONES = [
  { light: '#fff0c8', mid: '#ffb15c', edge: '#d9622f', glow: '255,170,90' },
  { light: '#ffe6ec', mid: '#ff9fb4', edge: '#c9496f', glow: '255,140,170' },
  { light: '#fff6cf', mid: '#ffcf6a', edge: '#d98a2c', glow: '255,205,100' },
]
const SPRITE_SIDE = 160
const SPRITE_SIZE_PX = SPRITE_SIDE
const BODY_SCALE = 0.9
const RISE_MS = 2800
const AUTO_EVERY_MS = 5000
const IDLE_BEFORE_AUTO_MS = 12000
const TAP_RADIUS = 34
const STAR_COUNT = 40
const RISE_PX_PER_S = 7
const PUSH_RADIUS = 110
const MAX_EMBERS = 140
const WATER_AT = 0.84

/** Vẽ sẵn mỗi màu một sprite (thân đèn + quầng sáng) để mỗi khung hình chỉ còn drawImage. */
function buildSprites(dpr: number): HTMLCanvasElement[] {
  return TONES.map((tone) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.round(SPRITE_SIDE * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas
    ctx.scale(dpr, dpr)
    ctx.translate(SPRITE_SIDE / 2, SPRITE_SIDE / 2)

    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 74)
    glow.addColorStop(0, `rgba(${tone.glow},0.55)`)
    glow.addColorStop(0.45, `rgba(${tone.glow},0.16)`)
    glow.addColorStop(1, `rgba(${tone.glow},0)`)
    ctx.fillStyle = glow
    ctx.fillRect(-80, -80, 160, 160)

    // Thân đèn: phình ở giữa, thu lại ở hai đầu.
    ctx.beginPath()
    ctx.moveTo(-9, -15)
    ctx.bezierCurveTo(-18, -8, -18, 8, -8, 15)
    ctx.lineTo(8, 15)
    ctx.bezierCurveTo(18, 8, 18, -8, 9, -15)
    ctx.closePath()
    const body = ctx.createLinearGradient(-15, 0, 15, 0)
    body.addColorStop(0, tone.edge)
    body.addColorStop(0.5, tone.mid)
    body.addColorStop(1, tone.edge)
    ctx.fillStyle = body
    ctx.fill()

    const core = ctx.createRadialGradient(0, 1, 1, 0, 1, 15)
    core.addColorStop(0, `${tone.light}ff`)
    core.addColorStop(0.6, `${tone.light}99`)
    core.addColorStop(1, `${tone.light}00`)
    ctx.fillStyle = core
    ctx.fill()

    // Khung nan đèn.
    ctx.strokeStyle = 'rgba(120,50,30,0.28)'
    ctx.lineWidth = 0.8
    for (const k of [-0.5, 0.5]) {
      ctx.beginPath()
      ctx.moveTo(k * 16, -15)
      ctx.quadraticCurveTo(k * 30, 0, k * 14, 15)
      ctx.stroke()
    }
    ctx.fillStyle = '#7a3b2a'
    ctx.fillRect(-9, -18.5, 18, 4)
    ctx.fillRect(-8, 15, 16, 3.5)
    // Tua rua.
    ctx.strokeStyle = '#e8b86a'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(0, 18.5)
    ctx.lineTo(0, 28)
    ctx.stroke()
    ctx.fillStyle = '#e8b86a'
    ctx.beginPath()
    ctx.arc(0, 29, 1.8, 0, Math.PI * 2)
    ctx.fill()
    return canvas
  })
}

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

interface Motion {
  ox: number
  oy: number
  vx: number
  vy: number
}
interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  r: number
  glow: string
}

/**
 * Bầu trời đèn lồng: mỗi lời chúc là một chiếc đèn thả từ mặt hồ, bay lên chậm; vị trí xuất phát cố định theo id.
 * Ngón tay lướt qua thì đèn trôi dạt, chạm trúng thì tóe tia lửa và hiện lời chúc.
 * Canvas 2D thuần: chỉ chạy khi nằm gần vùng nhìn, tĩnh khi khách chọn giảm chuyển động.
 * Danh sách HTML bên dưới vẫn là nơi đọc đầy đủ nên canvas chỉ để trang trí (aria-hidden).
 */
export function WishSky({ wishes, highlightId }: WishSkyProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const near = useNearViewport(wrapRef, '200px')
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [reduced, setReduced] = useState(false)
  const lastTouchRef = useRef(0)
  const bornRef = useRef<{ id: string; at: number } | null>(null)
  const centersRef = useRef<Array<{ x: number; y: number }>>([])
  const motionRef = useRef(new Map<string, Motion>())
  const embersRef = useRef<Ember[]>([])
  const burstsRef = useRef<Array<{ x: number; y: number; glow: string }>>([])
  const pointerRef = useRef({ x: 0, y: 0, active: false })
  const parallaxRef = useRef(0)
  const clockRef = useRef({ start: 0, last: 0 })
  const spritesRef = useRef<{ dpr: number; list: HTMLCanvasElement[] } | null>(null)
  const drawRef = useRef<(nowMs: number) => void>(() => {})

  const lanterns = useMemo<Lantern[]>(
    () => wishes.slice(0, lanternCap(size.w || 360)).map((wish) => ({ wish, spot: lanternSpot(wish.id) })),
    [wishes, size.w],
  )
  // Vẽ đèn xa trước, đèn gần sau; chỉ số trỏ về `lanterns` để kiểm tra chạm dùng chung.
  const drawOrder = useMemo(
    () => lanterns.map((_, i) => i).sort((a, b) => lanterns[a].spot.size - lanterns[b].spot.size),
    [lanterns],
  )
  const active = lanterns.find((l) => l.wish.id === activeId)?.wish ?? null

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Lời chúc vừa gửi: bắt đầu bay lên và hiện thẻ của nó.
  useEffect(() => {
    if (!highlightId) return
    bornRef.current = { id: highlightId, at: performance.now() }
    lastTouchRef.current = Date.now()
    // Phản ứng với sự kiện "vừa gửi" từ bên ngoài: chọn đèn mới để thẻ của nó hiện ra.
    // oxlint-disable-next-line react/set-state-in-effect
    setActiveId(highlightId)
  }, [highlightId])

  // Tự chuyển qua từng lời chúc để khách đọc thụ động; dừng khi khách vừa chạm, ra khỏi vùng nhìn hoặc giảm chuyển động.
  useEffect(() => {
    if (!near || reduced || lanterns.length === 0) return
    const timer = window.setInterval(() => {
      if (Date.now() - lastTouchRef.current < IDLE_BEFORE_AUTO_MS) return
      setActiveId((current) => {
        const index = lanterns.findIndex((l) => l.wish.id === current)
        return lanterns[(index + 1) % lanterns.length].wish.id
      })
    }, AUTO_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [near, reduced, lanterns])

  // Đổi kích thước canvas riêng để không xóa nội dung mỗi khi đổi đèn đang chọn.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    if (spritesRef.current?.dpr !== dpr) spritesRef.current = { dpr, list: buildSprites(dpr) }
  }, [size])

  // Hàm vẽ mới nhất (đọc state qua closure), vòng lặp gọi qua ref nên không phải dựng lại mỗi lần đổi đèn.
  useEffect(() => {
    drawRef.current = (nowMs: number) => {
      const canvas = canvasRef.current
      const sprites = spritesRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || !sprites || size.w === 0) return
      const { w, h } = size
      const dpr = sprites.dpr
      const clock = clockRef.current
      if (!clock.start) clock.start = nowMs
      const dt = reduced ? 0 : Math.min(0.05, Math.max(0, (nowMs - (clock.last || nowMs)) / 1000))
      clock.last = nowMs
      const t = reduced ? 0 : (nowMs - clock.start) / 1000
      const waterY = h * WATER_AT
      const ptr = pointerRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Sao.
      for (let i = 0; i < STAR_COUNT; i++) {
        const hs = hashId(`star-${i}`)
        const twinkle = reduced ? 0.55 : 0.4 + 0.35 * Math.sin(t * 1.3 + (hs % 7))
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`
        ctx.beginPath()
        ctx.arc(((hs % 1000) / 1000) * w, (((hs >>> 10) % 1000) / 1000) * waterY * 0.8, 0.6 + ((hs >>> 20) % 10) / 12, 0, Math.PI * 2)
        ctx.fill()
      }

      // Trăng.
      const mx = w * 0.82
      const my = h * 0.15
      const moonGlow = ctx.createRadialGradient(mx, my, 6, mx, my, 110)
      moonGlow.addColorStop(0, 'rgba(255,240,215,0.38)')
      moonGlow.addColorStop(1, 'rgba(255,240,215,0)')
      ctx.fillStyle = moonGlow
      ctx.fillRect(mx - 120, my - 120, 240, 240)
      const moon = ctx.createRadialGradient(mx - 5, my - 5, 2, mx, my, 22)
      moon.addColorStop(0, '#fffaf0')
      moon.addColorStop(1, '#f6dcb8')
      ctx.fillStyle = moon
      ctx.beginPath()
      ctx.arc(mx, my, 20, 0, Math.PI * 2)
      ctx.fill()

      // Mặt hồ: nền tối dần xuống đáy, vệt sáng ở chân trời.
      const water = ctx.createLinearGradient(0, waterY, 0, h)
      water.addColorStop(0, 'rgba(255,170,120,0.22)')
      water.addColorStop(0.25, 'rgba(60,28,60,0.55)')
      water.addColorStop(1, 'rgba(25,12,32,0.85)')
      ctx.fillStyle = water
      ctx.fillRect(0, waterY, w, h - waterY)
      ctx.fillStyle = 'rgba(255,200,150,0.35)'
      ctx.fillRect(0, waterY, w, 1)

      // Con trỏ/ngón tay đẩy đèn, và dịch nền theo hướng chạm để có chiều sâu.
      const targetParallax = ptr.active ? ptr.x / w - 0.5 : 0
      parallaxRef.current += (targetParallax - parallaxRef.current) * Math.min(1, dt * 4)

      const born = bornRef.current
      const wrapLength = waterY + 70
      const centers: Array<{ x: number; y: number }> = new Array(lanterns.length)
      const frame: Array<{ cx: number; cy: number; side: number; alpha: number; spot: LanternSpot; id: string; active: boolean }> = []

      for (const i of drawOrder) {
        const { wish, spot } = lanterns[i]
        let motion = motionRef.current.get(wish.id)
        if (!motion) {
          motion = { ox: 0, oy: 0, vx: 0, vy: 0 }
          motionRef.current.set(wish.id, motion)
        }
        const baseX = (spot.x + (reduced ? 0 : Math.sin(t * 0.5 * spot.speed + spot.phase) * 0.012)) * w + parallaxRef.current * (spot.size - 1) * -60
        let baseY = spot.y * waterY
        if (!reduced) baseY = ((((baseY + 60 - t * RISE_PX_PER_S * spot.size) % wrapLength) + wrapLength) % wrapLength) - 60

        if (!reduced) {
          if (ptr.active) {
            const dx = baseX + motion.ox - ptr.x
            const dy = baseY + motion.oy - ptr.y
            const dist = Math.hypot(dx, dy)
            if (dist < PUSH_RADIUS && dist > 0.1) {
              const push = (1 - dist / PUSH_RADIUS) * 1100 * dt
              motion.vx += (dx / dist) * push
              motion.vy += (dy / dist) * push
            }
          }
          // Lò xo kéo về chỗ cũ, ma sát làm tắt dao động.
          motion.vx += -motion.ox * 6 * dt
          motion.vy += -motion.oy * 6 * dt
          const damping = Math.exp(-3 * dt)
          motion.vx *= damping
          motion.vy *= damping
          motion.ox += motion.vx * dt
          motion.oy += motion.vy * dt
        }

        let cx = baseX + motion.ox
        let cy = baseY + motion.oy
        let edgeFade = clamp01((baseY + 50) / 70) * clamp01((waterY + 60 - baseY) / 60)
        if (born && born.id === wish.id && !reduced) {
          const p = Math.min(1, (nowMs - born.at) / RISE_MS)
          if (p < 1) {
            cy += (1 - easeOutCubic(p)) * (h + 60 - cy)
            cx += Math.sin(p * 6) * (1 - p) * 10
            edgeFade = 1
          }
        }
        const isActive = wish.id === activeId
        const flicker = reduced ? 1 : 0.88 + 0.12 * Math.sin(t * 3 * spot.speed + spot.phase * 2)
        // Đèn xa mờ hơn đèn gần.
        const depthAlpha = 0.55 + 0.45 * clamp01((spot.size - 0.6) / 0.8)
        const scale = spot.size * BODY_SCALE * (isActive ? 1.35 : 1)
        centers[i] = { x: cx, y: cy }
        frame.push({
          cx,
          cy,
          side: SPRITE_SIZE_PX * scale,
          alpha: clamp01((0.8 + 0.2 * flicker + (isActive ? 0.2 : 0)) * depthAlpha) * edgeFade,
          spot,
          id: wish.id,
          active: isActive,
        })

        // Tàn lửa bay lên từ đèn.
        if (!reduced && embersRef.current.length < MAX_EMBERS && Math.random() < dt * (isActive ? 3 : 0.45) * edgeFade) {
          embersRef.current.push({
            x: cx + (Math.random() - 0.5) * 8,
            y: cy + 8 * scale,
            vx: (Math.random() - 0.5) * 10,
            vy: -(14 + Math.random() * 20),
            life: 0,
            max: 1.6 + Math.random() * 1.4,
            r: 0.7 + Math.random() * 1.1,
            glow: TONES[spot.tone].glow,
          })
        }
      }
      centersRef.current = centers

      // Phản chiếu dưới mặt nước (lật, mờ, gợn sóng).
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, waterY, w, h - waterY)
      ctx.clip()
      for (const f of frame) {
        if (f.cy > waterY) continue
        const depthBelow = waterY - f.cy
        const reflectionAlpha = f.alpha * 0.28 * clamp01(1 - depthBelow / (waterY * 0.9))
        if (reflectionAlpha < 0.01) continue
        ctx.globalAlpha = reflectionAlpha
        const ripple = reduced ? 0 : Math.sin(t * 2 + f.spot.phase * 3) * 2.5
        ctx.save()
        ctx.translate(f.cx + ripple, waterY + depthBelow * 0.85)
        ctx.scale(1, -0.7)
        ctx.drawImage(sprites.list[f.spot.tone], -f.side / 2, -f.side / 2, f.side, f.side)
        ctx.restore()
      }
      ctx.restore()

      for (const f of frame) {
        ctx.globalAlpha = f.alpha
        ctx.drawImage(sprites.list[f.spot.tone], f.cx - f.side / 2, f.cy - f.side / 2, f.side, f.side)
        if (f.active) {
          // Vòng sáng quanh đèn đang chọn.
          ctx.globalAlpha = 0.5 * f.alpha
          ctx.strokeStyle = 'rgba(255,232,190,0.8)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(f.cx, f.cy, f.side * 0.3 + (reduced ? 0 : Math.sin(t * 2.4) * 2), 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      // Tia lửa khi chạm trúng đèn.
      if (!reduced) {
        for (const burst of burstsRef.current.splice(0)) {
          for (let k = 0; k < 18 && embersRef.current.length < MAX_EMBERS + 40; k++) {
            const angle = (k / 18) * Math.PI * 2 + Math.random() * 0.4
            const speed = 40 + Math.random() * 90
            embersRef.current.push({
              x: burst.x,
              y: burst.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 20,
              life: 0,
              max: 0.7 + Math.random() * 0.6,
              r: 1 + Math.random() * 1.4,
              glow: burst.glow,
            })
          }
        }
        ctx.globalCompositeOperation = 'lighter'
        embersRef.current = embersRef.current.filter((e) => {
          e.life += dt
          if (e.life >= e.max) return false
          e.vx *= Math.exp(-1.2 * dt)
          e.x += e.vx * dt
          e.y += e.vy * dt
          const a = 1 - e.life / e.max
          ctx.fillStyle = `rgba(${e.glow},${(a * 0.9).toFixed(3)})`
          ctx.beginPath()
          ctx.arc(e.x, e.y, e.r * (0.5 + a * 0.5), 0, Math.PI * 2)
          ctx.fill()
          return true
        })
        ctx.globalCompositeOperation = 'source-over'
      }
    }
  })

  // Chạy vòng lặp khi nằm gần vùng nhìn; còn lại chỉ vẽ lại khi dữ liệu đổi.
  useEffect(() => {
    if (reduced || !near) {
      drawRef.current(performance.now())
      return
    }
    let frame = 0
    const loop = (now: number) => {
      drawRef.current(now)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [near, reduced, size, lanterns, activeId])

  const pointerFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  // Chạm = chọn đèn gần nhất (hoặc bỏ chọn khi chạm khoảng trống). Cuộn dọc vẫn đi qua canvas nhờ touch-action: pan-y.
  const downRef = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    downRef.current = { x: event.clientX, y: event.clientY }
    pointerRef.current = { ...pointerFrom(event), active: true }
  }
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Chuột: đèn né theo con trỏ khi rê qua; cảm ứng: chỉ khi đang chạm.
    if (event.pointerType === 'mouse' || downRef.current) pointerRef.current = { ...pointerFrom(event), active: true }
  }
  const releasePointer = () => {
    pointerRef.current = { ...pointerRef.current, active: false }
  }
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const down = downRef.current
    downRef.current = null
    if (event.pointerType !== 'mouse') releasePointer()
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10) return
    const point = pointerFrom(event)
    const index = pickLantern(centersRef.current, point.x, point.y, TAP_RADIUS)
    lastTouchRef.current = Date.now()
    if (index >= 0) {
      const { wish, spot } = lanterns[index]
      burstsRef.current.push({ ...centersRef.current[index], glow: TONES[spot.tone].glow })
      setActiveId(wish.id)
    } else {
      setActiveId(null)
    }
  }

  return (
    <div className="wish-sky">
      <div className="wish-sky-stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="wish-sky-canvas"
          aria-hidden="true"
          style={{ width: size.w, height: size.h }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            downRef.current = null
            releasePointer()
          }}
          onPointerLeave={releasePointer}
        />
      </div>
      <div className="wish-sky-card" aria-live="polite">
        {active ? (
          <>
            <p className="wish-name">{active.name}</p>
            <p className="wish-message">{active.message}</p>
          </>
        ) : (
          <p className="wish-sky-hint">
            {lanterns.length > 0 ? 'Chạm vào một chiếc đèn để đọc lời chúc' : 'Những chiếc đèn lời chúc sẽ thắp sáng ở đây'}
          </p>
        )}
      </div>
    </div>
  )
}
