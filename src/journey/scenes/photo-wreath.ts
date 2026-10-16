import {
  Group,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  type IUniform,
  type Texture,
} from 'three'
import { mulberry32 } from '../../lib/seeded-random'
import {
  createBlankTexture,
  FLORA,
  FLORA_DAISY,
  FLORA_DELPHINIUM,
  FLORA_FORGET_ME_NOT,
  FLORA_GRASS,
  FLORA_LEAF,
  FLORA_PETALS,
} from './flora-sprites'
import { ARCH_HEIGHT, ARCH_WIDTH } from './photo-arch-geometry'

/** Kích thước sprite tính theo bề rộng khung (ARCH_WIDTH) để vòng hoa co giãn cùng khung. */
const W = ARCH_WIDTH
const SHADOW_OFFSET: readonly [number, number] = [0.022 * W, -0.032 * W]

/** Hai lớp độ sâu: xa (sau ảnh, nhỏ, hơi nhòe, phủ sương) và giữa (ôm viền vòm, nét, có bóng đổ lên ảnh). */
interface Placement {
  kind: number
  x: number
  y: number
  z: number
  height: number
  rotation: number
  /** Độ nhòe (mip bias) và sương phủ: chỉ lớp xa dùng. */
  blur: number
  haze: number
  shadow: boolean
}

/** Hình học dùng chung và texture dùng chung của mọi vòng hoa; texture thật được gán khi tải xong. */
export interface WreathShared {
  geometry: PlaneGeometry
  setTextures: (textures: Texture[]) => void
  dispose: () => void
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uBloom;
uniform float uSway;
uniform vec2 uShadowOffset;
void main() {
  vUv = uv;
  vec3 p = position;
  // Gốc sprite ở đáy: lắc quanh gốc, mỗi bông lệch pha theo vị trí của nó.
  float phase = uTime * 1.2 + instanceMatrix[3].x * 5.0 + instanceMatrix[3].y * 3.0;
  float a = sin(phase) * uSway;
  float c = cos(a);
  float s = sin(a);
  p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p *= uBloom;
  vec4 world = instanceMatrix * vec4(p, 1.0);
  world.xy += uShadowOffset;
  gl_Position = projectionMatrix * modelViewMatrix * world;
}
`

const FRAGMENT = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform sampler2D map;
uniform float uAlpha;
uniform float uBlur;
uniform float uHaze;
uniform float uShadow;
void main() {
  vec4 t = texture2D(map, vUv, uBlur);
  if (uShadow > 0.5) {
    gl_FragColor = vec4(0.18, 0.1, 0.08, t.a * 0.3 * uAlpha);
    return;
  }
  // Làm dịu màu: giảm bão hòa, phủ kem ấm để hoa lá hòa với ảnh thay vì chói như hình dán.
  float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(vec3(lum), t.rgb, 0.62);
  col = mix(col, vec3(0.97, 0.93, 0.86), 0.26) * 1.04;
  col = mix(col, vec3(0.96, 0.88, 0.78), uHaze);
  gl_FragColor = vec4(col, t.a * uAlpha);
}
`

interface SharedInternal extends WreathShared {
  /** Vật liệu của mọi vòng hoa đang sống, để gán texture thật cho tất cả khi tải xong. */
  materials: ShaderMaterial[]
  blank: Texture
}

export function createWreathShared(): WreathShared {
  // Gốc ở đáy sprite (y từ 0 tới 1) để lắc và nở quanh chân.
  const geometry = new PlaneGeometry(1, 1)
  geometry.translate(0, 0.5, 0)
  const materials: ShaderMaterial[] = []
  const blank = createBlankTexture()
  const shared: SharedInternal = {
    geometry,
    materials,
    blank,
    setTextures(textures) {
      materials.forEach((material) => {
        material.uniforms.map.value = textures[material.userData.kind as number] ?? blank
      })
    },
    dispose() {
      geometry.dispose()
      blank.dispose()
    },
  }
  return shared
}

export interface Wreath {
  group: Group
  /** 0 = nụ khép (thu nhỏ hết), 1 = nở đủ. */
  setBloom: (value: number) => void
  setOpacity: (value: number) => void
  setTime: (seconds: number) => void
  dispose: () => void
}

/** Điểm trên chu vi khung vòm (cạnh trái lên, cung, cạnh phải xuống) tại t 0..1, kèm pháp tuyến hướng ra ngoài. */
function perimeterPoint(t: number) {
  const r = ARCH_WIDTH / 2
  const side = ARCH_HEIGHT - r
  const total = 2 * side + Math.PI * r
  const s = (((t % 1) + 1) % 1) * total
  if (s < side) return { x: -r, y: s, nx: -1, ny: 0 }
  if (s < side + Math.PI * r) {
    const angle = Math.PI - (s - side) / r
    return { x: Math.cos(angle) * r, y: side + Math.sin(angle) * r, nx: Math.cos(angle), ny: Math.sin(angle) }
  }
  return { x: r, y: side - (s - side - Math.PI * r), nx: 1, ny: 0 }
}

/** Mật độ vòng hoa: tăng số hoa so với bản đầu để vòng hoa đầy đặn. */
const COUNTS = { leaves: 30, flowers: 76, outer: 40, far: 40 }

function buildPlacements(seed: number): Placement[] {
  const random = mulberry32(seed)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)]
  const list: Placement[] = []
  const flowerKinds = [
    FLORA_DAISY, FLORA_DAISY, FLORA_DAISY, FLORA_FORGET_ME_NOT, FLORA_FORGET_ME_NOT,
    FLORA_DELPHINIUM, FLORA_DELPHINIUM, FLORA_PETALS, FLORA_PETALS, FLORA_PETALS, FLORA_PETALS, 6,
  ]
  const unit = W / 0.82

  // Lớp xa: nhỏ, nhòe nhẹ, phủ sương, nằm sau ảnh quanh khung.
  for (let i = 0; i < COUNTS.far; i += 1) {
    const angle = random() * Math.PI * 2
    const d = 0.6 + random() * 0.5
    list.push({
      kind: pick([FLORA_DAISY, FLORA_FORGET_ME_NOT, FLORA_DELPHINIUM, FLORA_PETALS, FLORA_PETALS, FLORA_DAISY]),
      x: Math.cos(angle) * d * 0.9 * unit * 0.82,
      y: ARCH_HEIGHT / 2 + Math.sin(angle) * d * 1.25 * unit * 0.82,
      z: -0.9 * unit * 0.4 + random() * 0.6 * unit * 0.4,
      height: (0.07 + random() * 0.07) * unit,
      rotation: random() * Math.PI * 2,
      blur: 0.9,
      haze: 0.4,
      shadow: false,
    })
  }
  // Lớp giữa: lá rồi hoa ôm viền, có bóng đổ lên ảnh.
  for (let k = 0; k < COUNTS.leaves; k += 1) {
    const p = perimeterPoint((k + 0.5 + (random() - 0.5) * 0.5) / COUNTS.leaves)
    const out = 0.012 + random() * 0.05
    list.push({
      kind: FLORA_LEAF,
      x: p.x + p.nx * out * unit,
      y: p.y + p.ny * out * unit,
      z: (0.03 + random() * 0.02) * unit,
      height: (0.085 + random() * 0.04) * unit,
      rotation: Math.atan2(p.ny, p.nx) + (k % 2 ? 0.55 : -0.55) + (random() - 0.5) * 0.3,
      blur: 0,
      haze: 0,
      shadow: true,
    })
  }
  for (let k = 0; k < COUNTS.flowers; k += 1) {
    const p = perimeterPoint((k + 0.5 + (random() - 0.5) * 0.8) / COUNTS.flowers)
    const out = -0.005 + random() * 0.05
    const kind = pick(flowerKinds)
    list.push({
      kind,
      x: p.x + p.nx * out * unit,
      y: p.y + p.ny * out * unit,
      z: (0.06 + random() * 0.04) * unit,
      height: (0.07 + random() * 0.06) * unit,
      rotation: kind === FLORA_PETALS || kind === 6 ? random() * Math.PI * 2 : Math.atan2(p.ny, p.nx) - Math.PI / 2 + (random() - 0.5) * 0.8,
      blur: 0,
      haze: 0,
      shadow: true,
    })
  }
  // Vòng ngoài thưa hơn cho bồng.
  for (let k = 0; k < COUNTS.outer; k += 1) {
    const p = perimeterPoint((k + 0.5 + (random() - 0.5) * 0.9) / COUNTS.outer)
    const out = 0.05 + random() * 0.07
    const kind = pick([FLORA_DAISY, FLORA_DAISY, FLORA_FORGET_ME_NOT, FLORA_DELPHINIUM, FLORA_PETALS, FLORA_PETALS])
    list.push({
      kind,
      x: p.x + p.nx * out * unit,
      y: p.y + p.ny * out * unit,
      z: (0.1 + random() * 0.04) * unit,
      height: (0.06 + random() * 0.045) * unit,
      rotation: kind === FLORA_PETALS ? random() * Math.PI * 2 : Math.atan2(p.ny, p.nx) - Math.PI / 2 + (random() - 0.5) * 0.9,
      blur: 0,
      haze: 0,
      shadow: true,
    })
  }
  // Cỏ dưới chân khung.
  for (let k = 0; k < 6; k += 1) {
    list.push({
      kind: FLORA_GRASS,
      x: (-0.5 + k * 0.2 + (random() - 0.5) * 0.1) * W,
      y: 0.01 * unit,
      z: 0.08 * unit,
      height: (0.12 + random() * 0.05) * unit,
      rotation: 0,
      blur: 0,
      haze: 0,
      shadow: true,
    })
  }
  return list
}

/**
 * Vòng hoa thật quanh một khung ảnh vòm: sprite ảnh hoa lá có nền trong suốt xếp ở hai lớp độ sâu (xa, giữa); lớp xa hơi nhòe
 * và phủ sương, lớp giữa đổ bóng lên ảnh. Không có lớp "gần": nhòe mạnh bằng mip làm sprite vỡ thành ô vuông. Gom theo loại sprite thành InstancedMesh nên mỗi vòng chỉ vài lượt
 * vẽ; đung đưa và nở/khép làm trong vertex shader. Tọa độ theo hệ của khung (gốc ở giữa đáy).
 */
export function createWreath(shared: WreathShared, seed: number, density = 1): Wreath {
  const internal = shared as SharedInternal
  const uniforms: Record<'uTime' | 'uBloom' | 'uAlpha', IUniform<number>> = {
    uTime: { value: 0 },
    uBloom: { value: 0 },
    uAlpha: { value: 0 },
  }
  const group = new Group()
  const dummy = new Object3D()
  const meshes: InstancedMesh[] = []
  const materials: ShaderMaterial[] = []
  const placements = buildPlacements(seed)

  // Gom theo (loại, blur, haze, bóng) để mỗi nhóm một InstancedMesh.
  const buckets = new Map<string, Placement[]>()
  placements.forEach((item) => {
    const key = `${item.kind}|${item.blur}|${item.haze}|${item.shadow ? 1 : 0}`
    const bucket = buckets.get(key) ?? []
    bucket.push(item)
    buckets.set(key, bucket)
  })

  const makeMaterial = (kind: number, blur: number, haze: number, shadow: boolean, sway: number) => {
    const material = new ShaderMaterial({
      uniforms: {
        map: { value: internal.blank },
        uTime: uniforms.uTime,
        uBloom: uniforms.uBloom,
        uAlpha: uniforms.uAlpha,
        uBlur: { value: blur },
        uHaze: { value: haze },
        uShadow: { value: shadow ? 1 : 0 },
        uSway: { value: sway },
        uShadowOffset: { value: shadow ? SHADOW_OFFSET : [0, 0] },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    material.userData.kind = kind
    internal.materials.push(material)
    materials.push(material)
    return material
  }

  buckets.forEach((items) => {
    const { kind, blur, haze, shadow } = items[0]
    const count = Math.max(1, Math.round(items.length * density))
    const aspect = FLORA[kind].aspect
    const build = (isShadow: boolean) => {
      const mesh = new InstancedMesh(shared.geometry, makeMaterial(kind, blur, haze, isShadow, blur > 0 ? 0.02 : 0.05), count)
      items.slice(0, count).forEach((item, i) => {
        dummy.position.set(item.x, item.y, item.z)
        dummy.rotation.set(0, 0, item.rotation)
        dummy.scale.set(item.height * aspect, item.height, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
      // Xa trước, bóng, rồi sprite.
      mesh.renderOrder = items[0].z < 0 ? 3 : isShadow ? 4 : 5
      group.add(mesh)
      meshes.push(mesh)
    }
    if (shadow) build(true)
    build(false)
  })

  return {
    group,
    setBloom: (value) => {
      uniforms.uBloom.value = value
    },
    setOpacity: (value) => {
      uniforms.uAlpha.value = value
    },
    setTime: (seconds) => {
      uniforms.uTime.value = seconds
    },
    dispose() {
      meshes.forEach((mesh) => mesh.dispose())
      materials.forEach((material) => {
        const at = internal.materials.indexOf(material)
        if (at >= 0) internal.materials.splice(at, 1)
        material.dispose()
      })
    },
  }
}
