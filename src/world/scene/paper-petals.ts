import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'
import { mulberry32 } from '../../lib/seeded-random'
import { WORLD } from '../world-config'

/** Thể tích cánh hoa rơi: tâm (x, y, z) và kích thước. Cố định trong thế giới nên camera đi qua sẽ lướt ngang chúng. */
const VOLUME = { center: [0, 2.5, 2], size: [26, 10, 22] } as const
const PETAL_SIZE = 0.32
const SEED = 20261220

/**
 * Toàn bộ chuyển động (rơi, đung đưa, xoay) tính trong vertex shader từ `uTime` và hạt giống từng cánh,
 * nên JS không phải cập nhật từng cánh mỗi khung hình. `aSeed`: x = nhanh/chậm, y = pha rơi, z = vị trí ngang, w = chiều sâu.
 */
const VERTEX = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uSize;
  uniform float uScale;
  varying float vShade;
  varying float vTint;

  void main() {
    float fall = fract(aSeed.y - uTime * mix(0.03, 0.07, aSeed.x));
    float sway = sin(uTime * 0.9 + aSeed.y * 20.0) * (0.3 + aSeed.x) * 0.8;
    vec3 origin = uCenter + vec3(
      (aSeed.z - 0.5) * uSize.x + sway,
      (0.5 - fall) * uSize.y,
      (aSeed.w - 0.5) * uSize.z
    );

    float spin = uTime * (0.6 + aSeed.x) + aSeed.y * 6.2831853;
    float c = cos(spin);
    float s = sin(spin);
    float tilt = sin(spin * 0.5) * 0.6;
    vec3 local = position * uScale * mix(0.7, 1.4, aSeed.w);
    local = vec3(local.x * c, local.y, local.x * s);
    local.xy = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * local.xy;

    vShade = 0.8 + 0.2 * abs(c);
    vTint = aSeed.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(origin + local, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vShade;
  varying float vTint;

  void main() {
    gl_FragColor = vec4(mix(uColorA, uColorB, step(0.5, vTint)) * vShade, uOpacity);
    #include <colorspace_fragment>
  }
`

/** Cánh hoa hình giọt nước. */
function petalShape(): Shape {
  const shape = new Shape()
  shape.moveTo(0, -1)
  shape.bezierCurveTo(0.9, -0.5, 0.7, 0.7, 0, 1)
  shape.bezierCurveTo(-0.7, 0.7, -0.9, -0.5, 0, -1)
  return shape
}

export interface PaperPetals {
  object: Mesh
  setCount: (count: number) => void
  setTime: (seconds: number) => void
  dispose: () => void
}

export function createPaperPetals(maxCount: number): PaperPetals {
  const base = new ShapeGeometry(petalShape())
  const geometry = new InstancedBufferGeometry()
  geometry.index = base.index
  geometry.setAttribute('position', base.getAttribute('position'))

  const random = mulberry32(SEED)
  const seeds = new Float32Array(maxCount * 4)
  for (let i = 0; i < seeds.length; i += 1) seeds[i] = random()
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4))
  geometry.instanceCount = maxCount

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new Vector3(...VOLUME.center) },
      uSize: { value: new Vector3(...VOLUME.size) },
      uScale: { value: PETAL_SIZE },
      uColorA: { value: new Color(WORLD.colors.blush) },
      uColorB: { value: new Color(WORLD.colors.cream) },
      uOpacity: { value: 0.95 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })

  const object = new Mesh(geometry, material)
  // Vị trí thật tính trong shader nên hộp bao của hình học gốc không dùng để cắt.
  object.frustumCulled = false

  return {
    object,
    setCount: (count) => {
      geometry.instanceCount = Math.min(count, maxCount)
    },
    setTime: (seconds) => {
      material.uniforms.uTime.value = seconds
    },
    dispose() {
      base.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}
