import { Color, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry } from 'three'
import { WORLD } from '../world-config'

interface HillSpec {
  z: number
  color: string
  baseY: number
  amplitude: number
  frequency: number
  phase: number
}

const HILL_WIDTH = 90
const HILL_BOTTOM = -8
const SAMPLES = 72

/**
 * Các dải đồi giấy xếp lớp ở hậu cảnh, mỗi lớp một sắc mint và một nhịp lượn riêng.
 * Sương mù (fog) làm lớp xa nhạt dần; mỗi lớp có bóng đổ cứng lệch xuống để thấy độ dày giấy.
 */
const HILLS: readonly HillSpec[] = [
  { z: -16, color: WORLD.colors.mint100, baseY: 1.6, amplitude: 1.1, frequency: 0.16, phase: 0.4 },
  { z: -11, color: WORLD.colors.mint200, baseY: 0.6, amplitude: 0.9, frequency: 0.22, phase: 2.1 },
  { z: -6, color: WORLD.colors.mint300, baseY: -0.5, amplitude: 0.7, frequency: 0.3, phase: 4.2 },
]

function hillShape({ baseY, amplitude, frequency, phase }: HillSpec): Shape {
  const shape = new Shape()
  shape.moveTo(-HILL_WIDTH / 2, HILL_BOTTOM)
  for (let i = 0; i <= SAMPLES; i += 1) {
    const x = -HILL_WIDTH / 2 + (HILL_WIDTH * i) / SAMPLES
    const y =
      baseY + amplitude * Math.sin(x * frequency + phase) + amplitude * 0.4 * Math.sin(x * frequency * 2.3 + phase * 1.7)
    shape.lineTo(x, y)
  }
  shape.lineTo(HILL_WIDTH / 2, HILL_BOTTOM)
  return shape
}

export function createPaperHills(): { object: Group; dispose: () => void } {
  const object = new Group()
  const disposables: { dispose: () => void }[] = []

  for (const spec of HILLS) {
    const geometry = new ShapeGeometry(hillShape(spec))
    const material = new MeshBasicMaterial({ color: new Color(spec.color) })
    const shadowMaterial = new MeshBasicMaterial({
      color: new Color(WORLD.colors.ink),
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    })
    const shadow = new Mesh(geometry, shadowMaterial)
    shadow.position.set(0, -0.3, spec.z - 0.05)
    const hill = new Mesh(geometry, material)
    hill.position.z = spec.z
    object.add(shadow, hill)
    disposables.push(geometry, material, shadowMaterial)
  }

  return { object, dispose: () => disposables.forEach((item) => item.dispose()) }
}
