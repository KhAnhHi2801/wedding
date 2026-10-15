import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  TorusGeometry,
  type CatmullRomCurve3,
  type IUniform,
} from 'three'
import { mulberry32 } from '../../lib/seeded-random'
import { gate } from '../gate-state'
import { photoState } from '../photo-state'
import type { QualityTier, TierSettings } from '../quality-tier'
import type { JourneyFrame, SceneContext, SceneModule } from '../scene-module'
import { todRgb } from '../time-of-day'
import {
  BEE_HINGE,
  createBeeGeometry,
  createButterflyGeometry,
  createDaisyGeometry,
  createFlowerGeometry,
  createForgetMeNotGeometry,
  createLeafGeometry,
  createPoppyGeometry,
} from './foliage-geometry'

/** Khu vườn nằm sau mặt phẳng ảnh ở đầu trang (z = -3) và kéo dài theo đường camera. */
const Z_START = -4.5
const Z_END = -64
const GARDEN_LENGTH = Z_START - Z_END
/** Tường cây hai bên lối đi bắt đầu từ đây (xa hơn đầu vườn). */
const HEDGE_START = -12
/** Khoảng cách (từ camera) bắt đầu và kết thúc việc co nhỏ cỏ, hoa, lá; xa hơn nữa thì không vẽ gì. */
const FADE_START = 12
const FADE_END = 22
const ARCH_FADE = [15, 26] as const
/** Quá tiến độ này camera đã ra khỏi vườn: ẩn cả cảnh và ngừng vẽ liên tục. */
const GARDEN_VISIBLE_UNTIL = 0.62

/** Mặt đất kéo tới sát camera ở đầu hành trình (camera đứng ở z = 8). */
const GROUND_NEAR = 9

// Ít mà to: nhiều chi tiết li ti thu nhỏ ở xa sẽ thành những đốm lấm tấm ("hạt"), nhất là trên màn điện thoại.
const BASE_COUNTS = {
  grass: 4500,
  meadow: 220,
  daisy: 110,
  poppy: 60,
  forgetMeNot: 110,
  hedgeLeaves: 650,
  hedgeBlooms: 360,
  pollen: 120,
  butterflies: 14,
  bees: 8,
}

// Cổng vòm nối nhau mỗi ~8 đơn vị: luôn thấy cổng trước chưa khuất thì cổng sau đã hiện (cảm giác một lối đi liền mạch).
const ARCH_Z = [-10, -18, -26, -34, -42, -50]
const ARCH_RADIUS = 2.3
const ARCH_POST = 2.0
const ARCH_FLOWERS = 70
const ARCH_LEAVES = 46

const BLOOM_TINTS = ['#ffffff', '#ffffff', '#fbf3e4', '#f9dede', '#e3d9f4'].map((hex) => new Color(hex))
const LEAF_TINTS = ['#ffffff', '#e8f5e4', '#d6ebd2', '#f3fbe9'].map((hex) => new Color(hex))
const BUTTERFLY_TINTS = ['#ffc2d4', '#d8c8ff', '#ffe08a', '#bfe3ff', '#ffffff'].map((hex) => new Color(hex))
const GRASS_TINTS = ['#ffffff', '#eaf5df', '#d9eccc', '#f2f8d8'].map((hex) => new Color(hex))

const dummy = new Object3D()

/** Cọng cỏ: dải mảnh thon dần về ngọn, tô sẵn gradient từ gốc sẫm tới ngọn nhạt bằng màu đỉnh. */
function createBladeGeometry(): BufferGeometry {
  const segments = 4
  const positions: number[] = []
  const colors: number[] = []
  const base = new Color('#4f7a4a')
  const tip = new Color('#a9cc93')
  const mix = new Color()
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const half = 0.05 * (1 - t * 0.85)
    positions.push(-half, t, 0, half, t, 0)
    mix.copy(base).lerp(tip, t)
    colors.push(mix.r, mix.g, mix.b, mix.r, mix.g, mix.b)
  }
  const indices: number[] = []
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setIndex(indices)
  return geometry
}

/** Chấm tròn mềm cho phấn hoa. */
function createPollenTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas 2D để vẽ phấn hoa')
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 250, 225, 1)')
  gradient.addColorStop(0.4, 'rgba(255, 244, 205, 0.55)')
  gradient.addColorStop(1, 'rgba(255, 244, 205, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * Làm vật liệu đung đưa theo gió ngay trong vertex shader: mỗi instance lắc lệch pha theo vị trí của nó, ngọn lắc nhiều
 * hơn gốc. Không phải cập nhật ma trận từng instance trên CPU mỗi khung hình.
 */
function withSway(
  material: MeshBasicMaterial,
  uniform: IUniform<number>,
  mode: 'blade' | 'sprite' | 'static',
  fade: readonly [start: number, end: number] = [FADE_START, FADE_END],
): MeshBasicMaterial {
  const height = mode === 'blade' ? 'position.y' : '(position.y + 0.5)'
  // 'static': không đung đưa (hoa gắn trên khung cổng vòm), chỉ co nhỏ theo khoảng cách.
  const amount = mode === 'blade' ? '0.22' : mode === 'sprite' ? '0.1' : '0.0'
  // Hai kiểu (cọng cỏ, sprite) dùng chung đoạn mã chèn nên cần khóa chương trình riêng, đừng để three đoán từ nguồn hàm.
  material.customProgramCacheKey = () => `sway-${mode}-${fade[0]}-${fade[1]}`
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniform
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float swayPhase = uTime * 1.4 + instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.55;
      float swayHeight = ${height};
      transformed.x += sin(swayPhase) * ${amount} * swayHeight * swayHeight;
      transformed.z += cos(swayPhase * 0.8) * ${amount} * 0.45 * swayHeight * swayHeight;
      // Co nhỏ dần rồi biến mất khi ra xa: vật thể dưới ~1-2 pixel răng cưa và nhấp nháy thành các đốm li ti, nên cho
      // chúng tan hẳn trước khi tới mức đó (phần xa còn lại do sương mù và các cổng vòm hoa đảm nhiệm).
      vec4 swayCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      transformed *= 1.0 - smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, -swayCenter.z);`,
    )
  }
  return material
}

/**
 * Làm vật liệu cho các con vật bay (bướm, ong) chạy hoàn toàn trong vertex shader. Mỗi con bay THEO MỘT CHIỀU nhất định
 * (trái hoặc phải, tuỳ con) ngang qua lối đi, thân quay đúng chiều bay, nhấp nhô nhẹ; hết đoạn đường thì mờ dần (co nhỏ)
 * rồi xuất hiện lại từ đầu bên kia (không bao giờ bay lùi hay đảo chiều). Cánh (đỉnh có thuộc tính `wing`) xoay quanh khớp
 * ở thân để vỗ; cả con co nhỏ dần khi ra xa như cỏ và hoa.
 */
function withFlight(
  material: MeshBasicMaterial,
  uniform: IUniform<number>,
  kind: 'butterfly' | 'bee',
): MeshBasicMaterial {
  const butterfly = kind === 'butterfly'
  const [hingeX, hingeY] = BEE_HINGE
  // Bướm: lượn chậm, nhấp nhô rộng, khép mở cánh. Ong: bay nhanh, nhấp nhô ngắn, cánh rung rất nhanh quanh khớp.
  const travel = butterfly ? '12.0' : '14.0'
  const speed = butterfly ? '0.55' : '1.3'
  const flapRate = butterfly ? '10.0' : '55.0'
  const bobRate = butterfly ? '1.7' : '6.0'
  const bobAmp = butterfly ? '0.3' : '0.1'
  // Phần riêng của từng loài: bướm nhìn từ trên xuống nên xoay thân về hướng bay rồi khép/mở cánh; ong nhìn nghiêng nên
  // chỉ lật theo hướng bay và xoay các đỉnh cánh quanh khớp.
  const body = butterfly
    ? `transformed.x *= mix(0.4, 1.0, abs(cos(uTime * ${flapRate} + flyPhase)));
      // Thân (trục y) quay về hướng bay, nghiêng lên xuống theo nhịp nhấp nhô.
      float heading = -1.5708 * flyDir + cos(uTime * ${bobRate} + flyPhase) * 0.35 * flyDir;
      float hc = cos(heading);
      float hs = sin(heading);
      transformed.xy = vec2(hc * transformed.x - hs * transformed.y, hs * transformed.x + hc * transformed.y);`
    : `transformed.x *= flyDir;
      if (wing > 0.5) {
        float flapAngle = 0.6 * sin(uTime * ${flapRate} + flyPhase) * flyDir;
        vec2 hinge = vec2(${hingeX.toFixed(3)} * flyDir, ${hingeY.toFixed(3)});
        vec2 rel = transformed.xy - hinge;
        float fc = cos(flapAngle);
        float fs = sin(flapAngle);
        transformed.xy = hinge + vec2(fc * rel.x - fs * rel.y, fs * rel.x + fc * rel.y);
      }`
  material.customProgramCacheKey = () => `flight-${kind}`
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniform
    shader.vertexShader = `uniform float uTime;\n${butterfly ? '' : 'attribute float wing;\n'}${shader.vertexShader}`
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      float flyPhase = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
      // Mỗi con có một hướng bay cố định: +1 sang phải, -1 sang trái. Không bao giờ đảo chiều hay bay lùi.
      float flyDir = step(0.5, fract(flyPhase * 0.37)) * 2.0 - 1.0;
      float flyU = mod(uTime * ${speed} + flyPhase * 2.3, ${travel});
      float flyEnds = smoothstep(0.0, 1.5, flyU) * (1.0 - smoothstep(${travel} - 1.5, ${travel}, flyU));
      vec3 flyOffset = vec3(
        flyDir * (flyU - ${travel} * 0.5),
        sin(uTime * ${bobRate} + flyPhase) * ${bobAmp} + sin(uTime * ${flapRate} + flyPhase) * 0.02,
        sin(uTime * 0.6 + flyPhase) * 0.4
      );
      ${body}
      vec4 flyCenter = modelViewMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0) + vec4(flyOffset, 0.0));
      transformed *= flyEnds * (1.0 - smoothstep(${FADE_START}.0, ${FADE_END}.0, -flyCenter.z));`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = instanceMatrix * vec4( transformed, 1.0 );
      mvPosition.xyz += flyOffset;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`,
      )
  }
  return material
}

/** x của đường camera tại độ sâu z, để đặt vật thể đi theo lối đi uốn lượn. */
function createPathLookup(path: CatmullRomCurve3) {
  const samples = 240
  const xs = new Float32Array(samples + 1)
  const zs = new Float32Array(samples + 1)
  for (let i = 0; i <= samples; i += 1) {
    const point = path.getPointAt(i / samples)
    xs[i] = point.x
    zs[i] = point.z
  }
  return (z: number): number => {
    if (z >= zs[0]) return xs[0]
    for (let i = 1; i <= samples; i += 1) {
      if (zs[i] <= z) {
        const t = (z - zs[i - 1]) / (zs[i] - zs[i - 1])
        return xs[i - 1] + t * (xs[i] - xs[i - 1])
      }
    }
    return xs[samples]
  }
}

/**
 * Cảnh vườn buổi sáng sau cổng: đồng cỏ và hoa đồng nội đung đưa trong gió, hai bức tường cây hoa dọc lối đi, ba cổng
 * vòm hoa mà camera bay xuyên qua, phấn hoa bay lơ lửng, sương mù xa mờ dần về màu nền trang. Toàn bộ dựng bằng
 * instancing, dựng MỘT lần ở mật độ đầy đủ; đổi bậc chất lượng chỉ cắt bớt số lượng (không xáo bố cục, không cấp phát lại).
 *
 * Vườn chỉ hiện sau khi cổng đã mở xong (trước đó chỉ có cổng) và ngừng vẽ khi ảnh hero che kín màn hình, để không tốn
 * công vẽ hàng nghìn instance phía sau một tấm ảnh đặc.
 */
export function createGardenScene(): SceneModule {
  let ctx: SceneContext | null = null
  const root = new Group()
  const timeUniform: IUniform<number> = { value: 0 }
  let showing = false
  let pollen: Points | null = null
  let pollenData: { position: Float32Array; speed: Float32Array; origin: Float32Array } | null = null
  let fog: Fog | null = null
  let ground: Mesh | null = null
  let groundMaterial: MeshBasicMaterial | null = null
  let lastFogTod = -1
  let pathX: (z: number) => number = () => 0

  /** Tài nguyên dùng suốt vòng đời cảnh. */
  const shared: Array<{ dispose: () => void }> = []
  const track = <T extends { dispose: () => void }>(item: T): T => {
    shared.push(item)
    return item
  }
  /** Mỗi mesh instance kèm số lượng đầy đủ để cắt theo mật độ. */
  let instanced: Array<{ mesh: InstancedMesh; full: number }> = []

  const place = (mesh: InstancedMesh, group: Group) => {
    mesh.frustumCulled = false
    instanced.push({ mesh, full: mesh.count })
    group.add(mesh)
  }

  const fill = (mesh: InstancedMesh, random: () => number, tints: Color[], pose: (i: number) => void) => {
    for (let i = 0; i < mesh.count; i += 1) {
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      pose(i)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, tints[Math.floor(random() * tints.length)])
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  /** Dựng toàn bộ instance ở mật độ đầy đủ. */
  const buildInstances = (
    geometry: Record<'blade' | 'flower' | 'leaf' | 'daisy' | 'poppy' | 'forgetMeNot' | 'butterfly' | 'bee', BufferGeometry>,
    materials: Record<'grass' | 'meadow' | 'hedgeBloom' | 'hedgeLeaf' | 'archBloom' | 'archLeaf' | 'butterfly' | 'bee', MeshBasicMaterial>,
  ) => {
    const random = mulberry32(777)
    const zAt = () => Z_START - random() * GARDEN_LENGTH

    // Cỏ: đậm hơn ở gần lối đi, thưa dần ra hai bên.
    const grass = new InstancedMesh(geometry.blade, materials.grass, BASE_COUNTS.grass)
    fill(grass, random, GRASS_TINTS, () => {
      const z = zAt()
      const side = random() < 0.5 ? -1 : 1
      dummy.position.set(pathX(z) + side * (0.9 + random() ** 1.6 * 9), 0, z)
      dummy.rotation.y = random() * Math.PI
      const height = 0.35 + random() * 0.6
      dummy.scale.set(0.8 + random() * 0.8, height, 1)
    })
    place(grass, root)

    // Hoa đồng nội lẫn trong cỏ: nhiều loại (hoa năm cánh, cúc, anh túc đỏ, lưu ly xanh) để đồng cỏ không đơn điệu.
    const WHITE_TINTS = [new Color('#ffffff'), new Color('#fff8f0')]
    const meadowKinds: Array<{ geometry: BufferGeometry; count: number; tints: Color[]; size: number }> = [
      { geometry: geometry.flower, count: BASE_COUNTS.meadow, tints: BLOOM_TINTS, size: 0.24 },
      { geometry: geometry.daisy, count: BASE_COUNTS.daisy, tints: WHITE_TINTS, size: 0.26 },
      { geometry: geometry.poppy, count: BASE_COUNTS.poppy, tints: WHITE_TINTS, size: 0.3 },
      { geometry: geometry.forgetMeNot, count: BASE_COUNTS.forgetMeNot, tints: WHITE_TINTS, size: 0.2 },
    ]
    for (const kind of meadowKinds) {
      const mesh = new InstancedMesh(kind.geometry, materials.meadow, kind.count)
      fill(mesh, random, kind.tints, () => {
        const z = zAt()
        const side = random() < 0.5 ? -1 : 1
        dummy.position.set(pathX(z) + side * (0.8 + random() ** 1.5 * 8), 0.4 + random() * 0.55, z)
        dummy.rotation.set((random() - 0.5) * 0.5, (random() - 0.5) * 0.5, random() * Math.PI * 2)
        const size = kind.size + random() * 0.22
        dummy.scale.set(size, size, 1)
      })
      place(mesh, root)
    }

    // Bướm và ong bay lượn quanh lối đi, ở độ cao ngang tầm mắt tới thấp hơn một chút.
    const critters: Array<{ geometry: BufferGeometry; material: MeshBasicMaterial; count: number; tints: Color[]; size: number; low: number }> = [
      {
        geometry: geometry.butterfly,
        material: materials.butterfly,
        count: BASE_COUNTS.butterflies,
        tints: BUTTERFLY_TINTS,
        size: 0.4,
        low: 0.9,
      },
      { geometry: geometry.bee, material: materials.bee, count: BASE_COUNTS.bees, tints: [new Color('#ffffff')], size: 0.3, low: 0.6 },
    ]
    for (const critter of critters) {
      const mesh = new InstancedMesh(critter.geometry, critter.material, critter.count)
      fill(mesh, random, critter.tints, () => {
        const z = zAt()
        dummy.position.set(pathX(z) + (random() - 0.5) * 5, critter.low + random() * 1.4, z)
        const size = critter.size * (0.85 + random() * 0.4)
        dummy.scale.set(size, size, 1)
      })
      place(mesh, root)
    }

    // Hai bức tường cây hoa dọc lối đi, bắt đầu xa đầu vườn một đoạn để lá không to và sát camera ngay sau ảnh hero.
    const hedge = (material: MeshBasicMaterial, count: number, tints: Color[], leaf: boolean) => {
      const mesh = new InstancedMesh(leaf ? geometry.leaf : geometry.flower, material, count)
      fill(mesh, random, tints, () => {
        const z = HEDGE_START - random() * (HEDGE_START - Z_END)
        const side = random() < 0.5 ? -1 : 1
        // Gom thấp xuống gần mặt đất thành bụi cây (không rải lên cao thành lá bay lơ lửng).
        dummy.position.set(pathX(z) + side * (5 + random() * 2.6), random() ** 2.6 * 3.6, z + (random() - 0.5) * 1.5)
        dummy.rotation.set((random() - 0.5) * 0.4, (random() - 0.5) * 0.6, random() * Math.PI * 2)
        const size = leaf ? 0.7 + random() * 0.5 : 0.5 + random() * 0.4
        dummy.scale.set(leaf ? size * 0.5 : size, size, 1)
      })
      place(mesh, root)
    }
    hedge(materials.hedgeLeaf, BASE_COUNTS.hedgeLeaves, LEAF_TINTS, true)
    hedge(materials.hedgeBloom, BASE_COUNTS.hedgeBlooms, BLOOM_TINTS, false)

    // Cổng vòm hoa: instance xen kẽ giữa các cổng (i % số cổng) để cắt bớt theo mật độ vẫn giữ đủ cả ba cổng.
    const archPose = (leaf: boolean) => (i: number) => {
      const z = ARCH_Z[i % ARCH_Z.length]
      const cx = pathX(z)
      const ringShare = (Math.PI * ARCH_RADIUS) / (Math.PI * ARCH_RADIUS + 2 * ARCH_POST)
      const offset = -0.12 + random() * 0.4
      if (random() < ringShare) {
        const angle = random() * Math.PI
        const r = ARCH_RADIUS + offset
        dummy.position.set(cx + Math.cos(angle) * r, ARCH_POST + Math.sin(angle) * r, z + (random() - 0.5) * 0.5)
      } else {
        const side = random() < 0.5 ? -1 : 1
        dummy.position.set(cx + side * (ARCH_RADIUS + offset), random() * ARCH_POST, z + (random() - 0.5) * 0.5)
      }
      dummy.rotation.set((random() - 0.5) * 0.6, (random() - 0.5) * 0.6, random() * Math.PI * 2)
      const size = leaf ? 0.55 + random() * 0.3 : 0.4 + random() * 0.25
      dummy.scale.set(leaf ? size * 0.5 : size, size, 1)
    }
    const archLeaves = new InstancedMesh(geometry.leaf, materials.archLeaf, ARCH_Z.length * ARCH_LEAVES)
    const archFlowers = new InstancedMesh(geometry.flower, materials.archBloom, ARCH_Z.length * ARCH_FLOWERS)
    fill(archLeaves, random, LEAF_TINTS, archPose(true))
    fill(archFlowers, random, BLOOM_TINTS, archPose(false))
    place(archLeaves, root)
    place(archFlowers, root)
  }

  /** Phấn hoa: dựng đủ số điểm một lần, cắt bằng drawRange theo mật độ. */
  const buildPollen = (material: PointsMaterial) => {
    const random = mulberry32(4242)
    const count = BASE_COUNTS.pollen
    const position = new Float32Array(count * 3)
    const origin = new Float32Array(count * 3)
    const speed = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const z = Z_START - random() * GARDEN_LENGTH
      origin[i * 3] = pathX(z) + (random() - 0.5) * 12
      origin[i * 3 + 1] = 0.3 + random() * 3.2
      origin[i * 3 + 2] = z
      speed[i] = 0.05 + random() * 0.12
      position.set([origin[i * 3], origin[i * 3 + 1], origin[i * 3 + 2]], i * 3)
    }
    const geometry = track(new BufferGeometry())
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    pollen = new Points(geometry, material)
    pollen.frustumCulled = false
    root.add(pollen)
    pollenData = { position, speed, origin }
  }

  /** Cắt số lượng theo mật độ của bậc chất lượng (không cấp phát lại, không đổi vị trí). */
  const applyDensity = (density: number) => {
    instanced.forEach(({ mesh, full }) => {
      mesh.count = Math.max(1, Math.round(full * density))
    })
    pollen?.geometry.setDrawRange(0, Math.round(BASE_COUNTS.pollen * density))
  }

  return {
    id: 'garden',
    get continuous() {
      // Gió và phấn hoa chỉ cần chuyển động khi vườn đang thật sự hiện trên màn hình.
      return showing
    },
    init(context) {
      ctx = context
      pathX = createPathLookup(context.path)
      context.scene.add(root)

      const geometry = {
        blade: track(createBladeGeometry()),
        flower: track(createFlowerGeometry()),
        leaf: track(createLeafGeometry()),
        daisy: track(createDaisyGeometry()),
        poppy: track(createPoppyGeometry()),
        forgetMeNot: track(createForgetMeNotGeometry()),
        butterfly: track(createButterflyGeometry()),
        bee: track(createBeeGeometry()),
      }
      // Hoa lá là hình học tô màu theo đỉnh (không texture, không cắt alpha): mép khử răng cưa chuẩn, vẽ nhẹ trên điện thoại.
      const foliage = () => new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })
      const swayable = track(withSway(foliage(), timeUniform, 'sprite'))
      // Hoa/lá của cổng vòm co nhỏ ở khoảng xa hơn cỏ và tường cây để vẫn đọc được hình vòm mà không thành vòng chấm trắng.
      const arch = track(withSway(foliage(), timeUniform, 'static', ARCH_FADE))
      const materials = {
        grass: track(withSway(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), timeUniform, 'blade')),
        meadow: swayable,
        hedgeBloom: swayable,
        hedgeLeaf: swayable,
        archBloom: arch,
        archLeaf: arch,
        butterfly: track(withFlight(foliage(), timeUniform, 'butterfly')),
        bee: track(withFlight(foliage(), timeUniform, 'bee')),
      }
      const pollenMaterial = track(
        new PointsMaterial({ map: track(createPollenTexture()), size: 0.16, transparent: true, depthWrite: false, opacity: 0.55, color: '#fff6dc' }),
      )

      // Mặt đất trải từ sát camera tới cuối vườn. Không ghi độ sâu và vẽ trước mọi vật trong suốt khác: nó là nền, không
      // được che phấn hoa hay làm hỏng lúc ảnh hero hiện dần. Nó mờ đi đúng bằng độ hiện của ảnh (xem update).
      const groundDepth = GROUND_NEAR - (Z_END - 10)
      groundMaterial = track(new MeshBasicMaterial({ color: '#dbe8cf', transparent: true, depthWrite: false }))
      ground = new Mesh(track(new PlaneGeometry(80, groundDepth)), groundMaterial)
      ground.rotation.x = -Math.PI / 2
      ground.position.set(0, 0, GROUND_NEAR - groundDepth / 2)
      ground.renderOrder = -1
      root.add(ground)

      // Khung cổng vòm (cung + hai trụ) cho từng cổng; hoa/lá bám lên trên.
      const cream = track(new MeshBasicMaterial({ color: '#efe8da' }))
      const arcGeometry = track(new TorusGeometry(ARCH_RADIUS + 0.05, 0.07, 6, 32, Math.PI))
      const postGeometry = track(new CylinderGeometry(0.07, 0.09, ARCH_POST, 8))
      ARCH_Z.forEach((z) => {
        const cx = pathX(z)
        const arc = new Mesh(arcGeometry, cream)
        arc.position.set(cx, ARCH_POST, z)
        const left = new Mesh(postGeometry, cream)
        left.position.set(cx - (ARCH_RADIUS + 0.05), ARCH_POST / 2, z)
        const right = new Mesh(postGeometry, cream)
        right.position.set(cx + (ARCH_RADIUS + 0.05), ARCH_POST / 2, z)
        root.add(arc, left, right)
      })

      buildInstances(geometry, materials)
      buildPollen(pollenMaterial)
      applyDensity(context.settings.density)

      // Xa mờ dần về màu nền trang (đổi theo giờ trong ngày).
      // Gần hơn: chi tiết ở xa tan vào màu nền thay vì thành đốm lấm tấm.
      fog = new Fog(0xfbf6f0, 7, 32)
      context.scene.fog = fog

      // Biên dịch shader và tải buffer ngay bây giờ (cảnh còn hiện), thay vì ở khung hình đầu tiên sau khi cổng mở,
      // rồi ẩn đi cho tới khi cổng mở xong.
      context.renderer.compile(context.scene, context.camera)
      root.visible = false
    },
    update({ progress, tod, time }: JourneyFrame) {
      if (!ctx) return

      // Màu sương theo giờ trong ngày; chỉ tính lại khi giờ đổi đáng kể (tránh cấp phát mỗi khung hình).
      if (fog && Math.abs(tod - lastFogTod) > 0.004) {
        lastFogTod = tod
        const [r, g, b] = todRgb(tod)
        fog.color.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)
      }

      // Chỉ hiện khi cổng đã mở xong, camera còn trong vườn và ảnh hero chưa che kín màn hình.
      const photoOpacity = photoState.opacity
      showing = gate.getState() === 'open' && progress < GARDEN_VISIBLE_UNTIL && photoOpacity < 0.999
      root.visible = showing
      if (!showing) return

      timeUniform.value = time
      if (ground && groundMaterial) {
        // Mặt đất là phần bù của ảnh: ảnh hiện thì đất mờ, và ngược lại.
        groundMaterial.opacity = 1 - photoOpacity
      }

      if (pollen && pollenData) {
        const { position, speed, origin } = pollenData
        const attribute = pollen.geometry.getAttribute('position') as BufferAttribute
        for (let i = 0; i < speed.length; i += 1) {
          const rise = (origin[i * 3 + 1] - 0.3 + time * speed[i]) % 3.2
          position[i * 3] = origin[i * 3] + Math.sin(time * 0.4 + i) * 0.35
          position[i * 3 + 1] = 0.3 + rise
          position[i * 3 + 2] = origin[i * 3 + 2] + Math.cos(time * 0.3 + i * 1.7) * 0.25
        }
        attribute.needsUpdate = true
      }
    },
    setQuality(_tier: QualityTier, settings: TierSettings) {
      applyDensity(settings.density)
      ctx?.invalidate()
    },
    dispose() {
      instanced.forEach(({ mesh }) => mesh.dispose())
      instanced = []
      if (ctx) {
        ctx.scene.remove(root)
        ctx.scene.fog = null
      }
      shared.splice(0).forEach((item) => item.dispose())
      ctx = null
      pollen = null
      pollenData = null
      fog = null
      ground = null
      groundMaterial = null
      showing = false
    },
  } satisfies SceneModule
}
