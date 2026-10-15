import * as THREE from 'three'
import { makeDemoPhotos } from './demo-photos.js'
import { createCorridor } from './effect-corridor.js'
import { createParticles } from './effect-particles.js'
import { createWater } from './effect-water.js'

const EFFECTS = [
  { name: '1 Hành lang', create: createCorridor },
  { name: '2 Cánh hoa', create: createParticles },
  { name: '3 Mặt nước', create: createWater },
]

const canvas = document.getElementById('c')
const bar = document.getElementById('bar')
const hint = document.getElementById('hint')
const fpsEl = document.getElementById('fps')

let renderer
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
} catch {
  document.getElementById('error').style.display = 'flex'
  throw new Error('WebGL không khả dụng')
}
const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 700
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 2 : 2))
renderer.setSize(innerWidth, innerHeight, false)

const photos = makeDemoPhotos(8)

// Đầu vào dùng chung cho mọi hiệu ứng; các trường "một lần" được xóa sau mỗi frame.
const input = { ndcX: 0, ndcY: 0, down: false, dragX: 0, dragY: 0, wheel: 0, taps: [], swipes: [], moved: false }
let startX = 0
let startY = 0
let travelled = 0
const toNdc = (e) => ({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 })

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId)
  input.down = true
  startX = e.clientX
  startY = e.clientY
  travelled = 0
  const p = toNdc(e)
  input.ndcX = p.x
  input.ndcY = p.y
})
canvas.addEventListener('pointermove', (e) => {
  const p = toNdc(e)
  if (input.down) {
    const dx = e.movementX ?? 0
    const dy = e.movementY ?? 0
    input.dragX += dx
    input.dragY += dy
    travelled += Math.abs(dx) + Math.abs(dy)
  }
  input.ndcX = p.x
  input.ndcY = p.y
  input.moved = true
})
const release = (e) => {
  if (!input.down) return
  input.down = false
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (travelled < 10) input.taps.push({ ndcX: input.ndcX, ndcY: input.ndcY })
  else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) input.swipes.push(Math.sign(dx))
}
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', () => (input.down = false))
canvas.addEventListener('wheel', (e) => { e.preventDefault(); input.wheel += e.deltaY }, { passive: false })
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') current?.nav?.(1)
  if (e.key === 'ArrowLeft') current?.nav?.(-1)
  if (e.key === 'ArrowDown') current?.nav?.(1)
  if (e.key === 'ArrowUp') current?.nav?.(-1)
})
document.getElementById('prev').addEventListener('click', () => current?.nav?.(-1))
document.getElementById('next').addEventListener('click', () => current?.nav?.(1))

let current = null
let currentIndex = -1
const buttons = EFFECTS.map((fx, i) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = fx.name
  b.addEventListener('click', () => select(i))
  bar.append(b)
  return b
})

function select(i) {
  if (i === currentIndex) return
  current?.dispose()
  currentIndex = i
  current = EFFECTS[i].create({ THREE, renderer, photos, width: innerWidth, height: innerHeight, coarse })
  hint.textContent = current.hint
  buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
  history.replaceState(null, '', `?fx=${i + 1}`)
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false)
  current?.resize(innerWidth, innerHeight)
})

let last = performance.now()
let elapsed = 0
let frames = 0
let fpsStart = performance.now()
function frame() {
  const nowMs = performance.now()
  const dt = Math.min((nowMs - last) / 1000, 0.05)
  last = nowMs
  elapsed += dt
  current.update(elapsed, dt, input)
  renderer.render(current.scene, current.camera)
  input.dragX = input.dragY = input.wheel = 0
  input.taps.length = 0
  input.swipes.length = 0
  input.moved = false

  frames++
  const now = performance.now()
  if (now - fpsStart >= 500) {
    fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsStart))} fps · ${renderer.info.render.calls} draw calls`
    frames = 0
    fpsStart = now
  }
  requestAnimationFrame(frame)
}

const wanted = Number(new URLSearchParams(location.search).get('fx')) || 1
select(Math.min(Math.max(wanted, 1), EFFECTS.length) - 1)
requestAnimationFrame(frame)
