import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
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
  acquireFlora,
  createBlankTexture,
  FLORA,
  FLORA_DAISY,
  FLORA_DELPHINIUM,
  FLORA_FORGET_ME_NOT,
  FLORA_GRASS,
  FLORA_LEAF,
  releaseFlora,
} from './flora-sprites'

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
const GARDEN_VISIBLE_UNTIL = 0.78

/** Mặt đất kéo tới sát camera ở đầu hành trình (camera đứng ở z = 8). */
const GROUND_NEAR = 9

// Ít mà to: nhiều chi tiết li ti thu nhỏ ở xa sẽ thành những đốm lấm tấm ("hạt"), nhất là trên màn điện thoại.
const BASE_COUNTS = {
  grass: 460,
  daisy: 110,
  forgetMeNot: 110,
  delphinium: 70,
  cosmos: 26,
  poppy: 10,
  hedgeLeaves: 300,
  hedgeBlooms: 300,
  pollen: 120,
}

// Cổng vòm nối nhau mỗi ~8 đơn vị: luôn thấy cổng trước chưa khuất thì cổng sau đã hiện (cảm giác một lối đi liền mạch).
const ARCH_Z = [-10, -18, -26, -34, -42, -50]
const ARCH_RADIUS = 2.3
const ARCH_POST = 2.0
const ARCH_FLOWERS = 120
const ARCH_LEAVES = 70


const dummy = new Object3D()

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
 * Làm dịu màu sprite ảnh thật ngay trong fragment shader: giảm bão hòa và phủ kem ấm để hoa lá hòa vào khu vườn pastel
 * thay vì chói như hình dán. Chạy sau `withSway` (bọc `onBeforeCompile` sẵn có).
 */
function withSoftColor(material: MeshBasicMaterial): MeshBasicMaterial {
  const previous = material.onBeforeCompile
  const previousKey = material.customProgramCacheKey
  material.customProgramCacheKey = () => `${previousKey.call(material)}-soft`
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float spriteLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(spriteLum), diffuseColor.rgb, 0.82);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.93, 0.86), 0.12) * 1.06;`,
    )
  }
  return material
}

/** Mặt phẳng 1x1 gốc ở đáy (y từ 0 tới 1): sprite mọc từ mặt đất và lắc quanh chân. */
function spritePlane(): PlaneGeometry {
  const plane = new PlaneGeometry(1, 1)
  plane.translate(0, 0.5, 0)
  return plane
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
  let floraRefHeld = false
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
    geometry: Record<'sprite', BufferGeometry>,
    materials: {
      sprite: (kind: number, mode: 'upright' | 'arch') => MeshBasicMaterial
    },
  ) => {
    const random = mulberry32(777)
    const zAt = () => Z_START - random() * GARDEN_LENGTH
    const WHITE = [new Color('#ffffff')]
    /** Sprite ảnh thật đứng thẳng, gốc ở đáy: dựng một nhóm instance cùng loại. */
    const sprites = (
      kind: number,
      count: number,
      mode: 'upright' | 'arch',
      group: Group,
      pose: (i: number) => { height: number },
    ) => {
      const mesh = new InstancedMesh(geometry.sprite, materials.sprite(kind, mode), count)
      fill(mesh, random, WHITE, (i) => {
        const { height } = pose(i)
        dummy.scale.set(height * FLORA[kind].aspect, height, 1)
      })
      place(mesh, group)
    }

    // Cỏ: những cụm cỏ thật, dày hơn ở gần lối đi, thưa dần ra hai bên.
    sprites(FLORA_GRASS, BASE_COUNTS.grass, 'upright', root, () => {
      const z = zAt()
      const side = random() < 0.5 ? -1 : 1
      dummy.position.set(pathX(z) + side * (0.9 + random() ** 1.6 * 9), 0, z)
      dummy.rotation.set(0, (random() - 0.5) * 0.9, 0)
      return { height: 0.4 + random() * 0.45 }
    })

    // Hoa đồng nội lẫn trong cỏ: nhiều loại ảnh thật để đồng cỏ không đơn điệu; anh túc đỏ và cosmos hồng rất ít.
    const meadow: Array<{ kind: number; count: number; min: number; spread: number }> = [
      { kind: FLORA_DAISY, count: BASE_COUNTS.daisy, min: 0.5, spread: 0.35 },
      { kind: FLORA_FORGET_ME_NOT, count: BASE_COUNTS.forgetMeNot, min: 0.5, spread: 0.35 },
      { kind: FLORA_DELPHINIUM, count: BASE_COUNTS.delphinium, min: 0.7, spread: 0.45 },
      { kind: 6, count: BASE_COUNTS.cosmos, min: 0.5, spread: 0.3 },
      
    ]
    for (const item of meadow) {
      sprites(item.kind, item.count, 'upright', root, () => {
        const z = zAt()
        const side = random() < 0.5 ? -1 : 1
        dummy.position.set(pathX(z) + side * (0.8 + random() ** 1.5 * 8), 0, z)
        dummy.rotation.set(0, (random() - 0.5) * 0.9, (random() - 0.5) * 0.25)
        return { height: item.min + random() * item.spread }
      })
    }

    // Hai bức tường cây hoa dọc lối đi: cành lá và bụi hoa thật, bắt đầu xa đầu vườn một đoạn để lá không to và sát
    // camera ngay sau ảnh hero.
    const hedge = (kind: number, count: number, leaf: boolean) => {
      sprites(kind, count, 'upright', root, () => {
        const z = HEDGE_START - random() * (HEDGE_START - Z_END)
        const side = random() < 0.5 ? -1 : 1
        // Gom thấp xuống gần mặt đất thành bụi cây (không rải lên cao thành lá bay lơ lửng).
        dummy.position.set(pathX(z) + side * (5 + random() * 2.6), random() ** 2.6 * 2.4, z + (random() - 0.5) * 1.5)
        dummy.rotation.set(0, (random() - 0.5) * 0.7, (random() - 0.5) * 0.8)
        return { height: leaf ? 0.32 + random() * 0.25 : 0.6 + random() * 0.45 }
      })
    }
    hedge(FLORA_LEAF, BASE_COUNTS.hedgeLeaves, true)
    hedge(FLORA_DAISY, Math.round(BASE_COUNTS.hedgeBlooms * 0.4), false)
    hedge(FLORA_DELPHINIUM, Math.round(BASE_COUNTS.hedgeBlooms * 0.3), false)
    hedge(FLORA_FORGET_ME_NOT, Math.round(BASE_COUNTS.hedgeBlooms * 0.3), false)

    // Cổng vòm hoa: instance xen kẽ giữa các cổng (i % số cổng) để cắt bớt theo mật độ vẫn giữ đủ cả ba cổng.
    // Sprite mọc từ khung cổng ra ngoài: gốc ở điểm trên khung, trục dọc của sprite hướng ra ngoài theo pháp tuyến.
    const archGroup = (kinds: number[], count: number, leaf: boolean) => {
      kinds.forEach((kind, ki) => {
        const share = Math.round((count * ARCH_Z.length) / kinds.length)
        sprites(kind, share, 'arch', root, (i) => {
          const z = ARCH_Z[i % ARCH_Z.length]
          const cx = pathX(z)
          const ringShare = (Math.PI * ARCH_RADIUS) / (Math.PI * ARCH_RADIUS + 2 * ARCH_POST)
          const offset = -0.05 + random() * 0.25
          let x: number
          let y: number
          let outward: number
          if (random() < ringShare) {
            const angle = random() * Math.PI
            const r = ARCH_RADIUS + offset
            x = cx + Math.cos(angle) * r
            y = ARCH_POST + Math.sin(angle) * r
            outward = angle
          } else {
            const side = random() < 0.5 ? -1 : 1
            x = cx + side * (ARCH_RADIUS + offset)
            y = random() * ARCH_POST
            outward = side > 0 ? 0 : Math.PI
          }
          dummy.position.set(x, y, z + (random() - 0.5) * 0.4)
          // Sprite mọc theo pháp tuyến hướng ra; lá nghiêng xen kẽ hai phía, hoa lệch nhẹ.
          dummy.rotation.set(0, 0, outward - Math.PI / 2 + (leaf ? (ki + i) % 2 ? 0.7 : -0.7 : 0) + (random() - 0.5) * 0.5)
          return { height: leaf ? 0.55 + random() * 0.3 : 0.4 + random() * 0.3 }
        })
      })
    }
    archGroup([FLORA_LEAF], ARCH_LEAVES, true)
    archGroup([FLORA_DAISY, FLORA_FORGET_ME_NOT, FLORA_DELPHINIUM], ARCH_FLOWERS, false)
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
        sprite: track(spritePlane()),
      }
      // Hoa lá là sprite ảnh thật có nền trong suốt (xem flora-sprites.ts). Mỗi loại một vật liệu; texture thật được gán khi
      // tải xong (trước đó sprite trong suốt). Hoa lá tô màu theo đỉnh của bướm, ong thì giữ nguyên hình học tự dựng.
      const blank = track(createBlankTexture())
      const spriteMaterials = new Map<string, MeshBasicMaterial>()
      const spriteMaterial = (kind: number, mode: 'upright' | 'arch') => {
        const key = `${kind}-${mode}`
        let material = spriteMaterials.get(key)
        if (!material) {
          const base = new MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: DoubleSide })
          material = track(
            withSoftColor(
              mode === 'arch' ? withSway(base, timeUniform, 'static', ARCH_FADE) : withSway(base, timeUniform, 'blade'),
            ),
          )
          material.userData.kind = kind
          spriteMaterials.set(key, material)
        }
        return material
      }
      floraRefHeld = true
      acquireFlora(context.renderer.capabilities.getMaxAnisotropy()).then((list) => {
        if (!ctx) return
        spriteMaterials.forEach((material) => {
          material.map = list[material.userData.kind as number] ?? blank
          material.needsUpdate = true
        })
        ctx.invalidate()
      })
      const materials = {
        sprite: spriteMaterial,
      }
      const pollenMaterial = track(
        new PointsMaterial({ map: track(createPollenTexture()), size: 0.16, transparent: true, depthWrite: false, opacity: 0.55, color: '#fff6dc' }),
      )

      // Mặt đất trải từ sát camera tới cuối vườn. Không ghi độ sâu và vẽ trước mọi vật trong suốt khác: nó là nền, không
      // được che phấn hoa hay làm hỏng lúc ảnh hero hiện dần. Nó mờ đi đúng bằng độ hiện của ảnh (xem update).
      // Mặt đất kéo xa quá tầm sương mù: chân trời tan vào màu nền thay vì một đường cắt cứng.
      const groundDepth = GROUND_NEAR - (Z_END - 90)
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
      fog = new Fog(0xfbf6f0, 9, 36)
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
      if (floraRefHeld) {
        floraRefHeld = false
        releaseFlora()
      }
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
