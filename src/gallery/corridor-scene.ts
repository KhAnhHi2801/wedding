import * as THREE from 'three'
import { corridorLength, corridorSpread, fitPlane, focusDistance } from '../lib/gallery-layout'

export interface CorridorPhoto {
  src: string
  alt: string
  width: number
  height: number
}

export interface CorridorOptions {
  canvas: HTMLCanvasElement
  photos: CorridorPhoto[]
  /** Màn hình cảm ứng/nhỏ: giảm số cánh hoa và độ phân giải để nhẹ hơn. */
  coarse: boolean
  /** Giảm chuyển động: bỏ cánh hoa bay và nhấp nhô; camera bám thẳng theo cuộn, không trễ, không nghiêng theo chuột. */
  calm?: boolean
  onFocusChange: (index: number | null) => void
  /** Context WebGL bị trình duyệt thu hồi (hết RAM, quay lại tab...): bên ngoài nên chuyển sang phương án dự phòng. */
  onContextLost: () => void
}

export interface CorridorController {
  /** Tiến độ bay 0..1 do cuộn trang điều khiển. */
  setProgress: (progress: number) => void
  /** Vị trí con trỏ chuẩn hóa (-1..1) để nghiêng góc nhìn. */
  setPointer: (ndcX: number, ndcY: number) => void
  /** Chạm/bấm: trúng ảnh thì lao tới phóng to, trượt thì lùi lại. */
  tap: (ndcX: number, ndcY: number) => void
  unfocus: () => void
  resize: (width: number, height: number) => void
  /** Chỉ vẽ khi đang hiển thị trên màn hình (tiết kiệm pin). */
  setActive: (active: boolean) => void
  dispose: () => void
}

const BACKGROUND = '#2b1a24'
const FOG_DENSITY = 0.085
const SPACING = 4.4
const FOV = 58

const PETAL_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uFogDensity;
  attribute vec4 aSeed;
  varying float vAlpha;
  varying float vRot;
  varying float vMix;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * (0.22 + aSeed.x * 0.25) + 3.0, 6.0) - 3.0;
    p.x += sin(uTime * 0.6 + aSeed.y * 40.0) * 0.35;
    p.z += cos(uTime * 0.4 + aSeed.z * 30.0) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    // kích thước theo đơn vị thế giới, đổi ra pixel theo khoảng cách
    gl_PointSize = (0.09 + aSeed.w * 0.11) * uScale / max(depth, 0.1);
    vAlpha = exp(-uFogDensity * uFogDensity * depth * depth) * 0.9;
    vRot = aSeed.y * 6.2831 + uTime * (aSeed.x - 0.5);
    vMix = aSeed.w;
  }
`
const PETAL_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying float vRot;
  varying float vMix;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float d = length(vec2(p.x * 0.9, p.y * 1.9));
    float edge = smoothstep(0.5, 0.36, d);
    if (edge < 0.02) discard;
    vec3 col = mix(vec3(1.0, 0.72, 0.78), vec3(1.0, 0.55, 0.66), vMix);
    gl_FragColor = vec4(col, vAlpha * edge);
  }
`

interface Item {
  holder: THREE.Group
  picMaterial: THREE.MeshBasicMaterial
  side: number
  baseRotation: number
  basePosition: THREE.Vector3
  /** Kích thước khung ảnh trong không gian 3D (để tính khoảng cách phóng to). */
  planeWidth: number
  planeHeight: number
  /** Khoảng cách camera khi phóng to ảnh này; tính lại mỗi khi đổi tỉ lệ màn hình. */
  focusDistance: number
  /** 0..1: ảnh hiện dần sau khi tải xong. */
  reveal: number
  loaded: boolean
}

export function createCorridor(options: CorridorOptions): CorridorController {
  const { canvas, photos, coarse, calm = false, onFocusChange, onContextLost } = options

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2))
  const scene = new THREE.Scene()
  const background = new THREE.Color(BACKGROUND)
  scene.background = background
  scene.fog = new THREE.FogExp2(background, FOG_DENSITY)
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 90)

  const disposables: Array<{ dispose: () => void }> = []
  const items: Item[] = []
  const pics: THREE.Mesh[] = []
  const loader = new THREE.TextureLoader()
  const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  const total = corridorLength(photos.length, SPACING)

  photos.forEach((photo, index) => {
    const side = index % 2 === 0 ? -1 : 1
    const { width, height } = fitPlane(photo.width / photo.height)
    const holder = new THREE.Group()
    holder.position.set(side * 1.65, Math.sin(index * 1.7) * 0.2, -3 - index * SPACING)
    holder.rotation.y = -side * 0.42

    const frameGeometry = new THREE.PlaneGeometry(width + 0.14, height + 0.14)
    const frameMaterial = new THREE.MeshBasicMaterial({ color: '#fff7f4' })
    const picGeometry = new THREE.PlaneGeometry(width, height)
    // Ảnh chưa tải xong là một tấm mờ cùng màu nền khung; khi tải xong sẽ hiện dần.
    const picMaterial = new THREE.MeshBasicMaterial({ color: '#e9d5d8' })
    const frame = new THREE.Mesh(frameGeometry, frameMaterial)
    const pic = new THREE.Mesh(picGeometry, picMaterial)
    pic.position.z = 0.01
    pic.userData.index = index
    holder.add(frame, pic)
    scene.add(holder)
    pics.push(pic)
    disposables.push(frameGeometry, frameMaterial, picGeometry, picMaterial)

    const item: Item = {
      holder,
      picMaterial,
      side,
      baseRotation: holder.rotation.y,
      basePosition: holder.position.clone(),
      planeWidth: width,
      planeHeight: height,
      focusDistance: 2.6,
      reveal: 0,
      loaded: false,
    }
    items.push(item)

    loader.load(
      photo.src,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = maxAnisotropy
        picMaterial.map = texture
        picMaterial.color.set('#ffffff')
        picMaterial.needsUpdate = true
        item.loaded = true
        disposables.push(texture)
      },
      undefined,
      () => {
        // Ảnh lỗi: giữ tấm màu nền, không làm hỏng cả gallery.
      },
    )
  })

  // cánh hoa bay quanh hành lang
  const petalCount = calm ? 0 : coarse ? 140 : 300
  const positions = new Float32Array(petalCount * 3)
  const seeds = new Float32Array(petalCount * 4)
  for (let i = 0; i < petalCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 9
    positions[i * 3 + 1] = (Math.random() - 0.5) * 6
    positions[i * 3 + 2] = 3 - Math.random() * (total + 4)
    for (let k = 0; k < 4; k++) seeds[i * 4 + k] = Math.random()
  }
  const petalGeometry = new THREE.BufferGeometry()
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  petalGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
  const petalMaterial = new THREE.ShaderMaterial({
    vertexShader: PETAL_VERTEX,
    fragmentShader: PETAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uFogDensity: { value: FOG_DENSITY } },
  })
  const petals = new THREE.Points(petalGeometry, petalMaterial)
  petals.frustumCulled = false
  petals.visible = petalCount > 0
  scene.add(petals)
  disposables.push(petalGeometry, petalMaterial)

  const raycaster = new THREE.Raycaster()
  const look = new THREE.Vector3()
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
  let progress = 0
  let targetProgress = 0
  let focus: number | null = null
  let focusProgress = 0
  let focusBlend = 0

  function setFocus(next: number | null) {
    if (next === focus) return
    focus = next
    focusProgress = targetProgress
    onFocusChange(next)
  }

  function resize(width: number, height: number) {
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    const spread = corridorSpread(camera.aspect)
    items.forEach((item) => {
      item.basePosition.x = item.side * spread
      item.holder.position.x = item.basePosition.x
      item.focusDistance = focusDistance(item.planeWidth, item.planeHeight, camera.aspect, FOV)
    })
    petalMaterial.uniforms.uScale.value = height / (2 * Math.tan((FOV * Math.PI) / 360))
  }
  resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight)

  let last = performance.now()
  let elapsed = 0
  let frame = 0
  let active = false
  let disposed = false

  function render() {
    frame = 0
    if (!active || disposed) return
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    elapsed += dt
    petalMaterial.uniforms.uTime.value = elapsed

    // Làm mượt tiến độ để cuộn giật vẫn trôi êm. Bản yên tĩnh: bám thẳng theo ngón tay, không trễ, không nghiêng theo chuột.
    progress = calm ? targetProgress : progress + (targetProgress - progress) * (1 - Math.exp(-dt * 7))
    if (!calm) {
      pointer.x += (pointer.targetX - pointer.x) * (1 - Math.exp(-dt * 4))
      pointer.y += (pointer.targetY - pointer.y) * (1 - Math.exp(-dt * 4))
    }
    focusBlend += ((focus === null ? 0 : 1) - focusBlend) * (1 - Math.exp(-dt * (calm ? 12 : 5)))

    let camX = pointer.x * 0.55
    let camY = pointer.y * 0.3
    let camZ = 3 - progress * total
    if (focus !== null) {
      const item = items[focus]
      // Đứng thẳng chính giữa trước ảnh, đủ xa để ảnh nằm trọn trong màn hình (kể cả màn hình dọc hẹp).
      camX += (item.basePosition.x - camX) * focusBlend
      camY += (item.basePosition.y - camY) * focusBlend
      camZ += (item.basePosition.z + item.focusDistance - camZ) * focusBlend
    }
    camera.position.set(camX, camY, camZ)
    // Khi phóng to thì nhìn thẳng về phía trước để ảnh không bị lệch tâm.
    const lookScale = 0.4 * (1 - focusBlend)
    look.set(camX * lookScale + camX * focusBlend, camY * lookScale + camY * focusBlend, camZ - 3)
    camera.lookAt(look)

    items.forEach((item, index) => {
      const focused = focus === index ? focusBlend : 0
      item.holder.rotation.y = item.baseRotation * (1 - focused)
      item.holder.scale.set(1, 1, 1)
      item.holder.position.y = item.basePosition.y + (calm ? 0 : Math.sin(elapsed * 0.7 + index * 1.3) * 0.05)
      if (item.loaded && item.reveal < 1) {
        item.reveal = Math.min(1, item.reveal + dt * 2.2)
        item.picMaterial.opacity = item.reveal
        item.picMaterial.transparent = item.reveal < 1
      }
    })

    renderer.render(scene, camera)
    frame = requestAnimationFrame(render)
  }

  const onLost = (event: Event) => {
    event.preventDefault() // cho phép trình duyệt khôi phục; bên ngoài quyết định có chuyển sang dự phòng không
    onContextLost()
  }
  canvas.addEventListener('webglcontextlost', onLost)

  return {
    setProgress(next) {
      const clamped = Math.min(Math.max(next, 0), 1)
      // Cuộn đi khỏi ảnh đang phóng to thì thu về hành lang.
      if (focus !== null && Math.abs(clamped - focusProgress) > 0.006) setFocus(null)
      targetProgress = clamped
    },
    setPointer(ndcX, ndcY) {
      pointer.targetX = ndcX
      pointer.targetY = ndcY
    },
    tap(ndcX, ndcY) {
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
      const hit = raycaster.intersectObjects(pics)[0]
      const index = hit ? (hit.object.userData.index as number) : null
      setFocus(index !== null && index !== focus ? index : null)
    },
    unfocus() {
      setFocus(null)
    },
    resize,
    setActive(next) {
      if (next === active || disposed) return
      active = next
      if (active) {
        last = performance.now()
        if (!frame) frame = requestAnimationFrame(render)
      } else if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
    dispose() {
      disposed = true
      active = false
      if (frame) cancelAnimationFrame(frame)
      canvas.removeEventListener('webglcontextlost', onLost)
      disposables.forEach((item) => item.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
