import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three'

/**
 * Một sợi chỉ hồng: ống mảnh vặn xoắn chạy theo đường cong ba chiều, từ ngoài mép màn hình xoắn vòng và thu hẹp dần
 * về điểm hẹn ở tâm. `setProgress` lộ dần ống theo tiến độ (vẽ một phần chỉ số), đầu chỉ có hạt vàng phát sáng.
 */
export const STRAND = { tubular: 260, radial: 8 }

/** Texture sọc chéo hai tông hồng: khi lặp dọc ống, nhìn như sợi chỉ se (nhiều tao xoắn). */
export function createTwistTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#c9425f'
    ctx.fillRect(0, 0, 32, 32)
    ctx.strokeStyle = '#e88aa0'
    ctx.lineWidth = 9
    for (let i = -32; i < 64; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i, 32)
      ctx.lineTo(i + 32, 0)
      ctx.stroke()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(170, 1)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Đường đi: hai sợi xoắn đôi quanh trục ngang, bán kính thu nhỏ dần tới tâm; `side` -1 vào từ trái, +1 vào từ phải. */
function createPath(side: -1 | 1, reach: number, spiralRadius: number): CatmullRomCurve3 {
  const points: Vector3[] = []
  const steps = 48
  const phase = side < 0 ? 0 : Math.PI
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const radius = spiralRadius * (1 - t) ** 0.85
    const angle = Math.PI * 3.1 * t + phase
    const wobble = Math.sin(t * 9 + phase) * spiralRadius * 0.1 * (1 - t)
    points.push(new Vector3(side * reach * (1 - t) ** 1.1, Math.sin(angle) * radius + wobble, Math.cos(angle) * radius))
  }
  return new CatmullRomCurve3(points, false, 'centripetal')
}

function haloTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255, 236, 190, 1)')
    g.addColorStop(0.35, 'rgba(255, 214, 150, 0.5)')
    g.addColorStop(1, 'rgba(255, 214, 150, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  return new CanvasTexture(canvas)
}

export interface StrandOptions {
  side: -1 | 1
  /** Chiều dài phần chạy ra ngoài tâm theo trục ngang (đơn vị thế giới). */
  reach: number
  /** Nửa bề rộng nhìn thấy: đầu chỉ chạm mép màn hình khi tiến độ 0. */
  halfWidth: number
  spiralRadius: number
  tubeRadius: number
}

export interface Strand {
  group: Group
  /** Lộ sợi chỉ tới tiến độ 0..1 và đặt hạt sáng ở đầu chỉ. */
  setProgress: (progress: number) => void
  /** Độ đục chung của sợi chỉ, hạt và quầng sáng (vật liệu chỉ do bên ngoài giữ nên chỉ đổi hạt và quầng). */
  setGlow: (opacity: number) => void
  dispose: () => void
}

export function createStrand(options: StrandOptions, material: MeshStandardMaterial): Strand {
  const { side, reach, halfWidth, spiralRadius, tubeRadius } = options
  const curve = createPath(side, reach, spiralRadius)
  // Phần đầu đường nằm ngoài mép màn hình: tiến độ 0 là đầu chỉ vừa chạm mép, nên khách kéo là thấy chỉ chạy vào ngay.
  let entry = 0
  const probe = new Vector3()
  for (let i = 0; i <= 200; i += 1) {
    curve.getPointAt(i / 200, probe)
    if (Math.abs(probe.x) < halfWidth * 0.92) {
      entry = i / 200
      break
    }
  }
  const geometry = new TubeGeometry(curve, STRAND.tubular, tubeRadius, STRAND.radial, false)
  const tube = new Mesh(geometry, material)
  tube.frustumCulled = false

  const beadMaterial = new MeshStandardMaterial({
    color: new Color('#f3d391'),
    emissive: new Color('#f3c46a'),
    emissiveIntensity: 1.1,
    roughness: 0.3,
    transparent: true,
  })
  const bead = new Mesh(new SphereGeometry(tubeRadius * 1.7, 20, 14), beadMaterial)
  const haloMap = haloTexture()
  const halo = new Sprite(new SpriteMaterial({ map: haloMap, blending: AdditiveBlending, depthWrite: false, transparent: true }))
  halo.scale.setScalar(tubeRadius * 22)
  const group = new Group()
  group.add(tube, bead, halo)

  const indicesPerSegment = STRAND.radial * 6
  const tip = new Vector3()
  let visible = false
  let glow = 1
  const apply = () => {
    bead.visible = halo.visible = visible && glow > 0.01
    ;(bead.material as Material).opacity = glow
    halo.material.opacity = glow
  }
  return {
    group,
    setProgress(progress) {
      const clamped = progress <= 0 ? 0 : entry + (1 - entry) * Math.min(1, progress)
      geometry.setDrawRange(0, Math.floor(clamped * STRAND.tubular) * indicesPerSegment)
      curve.getPointAt(Math.max(1e-4, clamped), tip)
      bead.position.copy(tip)
      halo.position.copy(tip)
      // Đầu chỉ ẩn khi hai sợi đã gặp nhau (nút thắt thế chỗ).
      visible = progress > 0.002 && progress < 0.985
      apply()
    },
    setGlow(opacity) {
      glow = opacity
      apply()
    },
    dispose() {
      geometry.dispose()
      bead.geometry.dispose()
      beadMaterial.dispose()
      halo.material.dispose()
      haloMap.dispose()
    },
  }
}
