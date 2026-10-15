// Hướng 1: Hành lang ký ức. Cuộn/kéo/phím để bay xuyên không gian 3D, ảnh treo lơ lửng ở nhiều độ sâu,
// rê chuột (hoặc kéo) để nghiêng góc nhìn, chạm ảnh để lao tới và phóng to. Cánh hoa bay quanh.

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
    // kích thước theo đơn vị thế giới (0.09 - 0.2), đổi ra pixel theo khoảng cách
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

export function createCorridor({ THREE, photos, width, height, coarse }) {
  const scene = new THREE.Scene()
  const bg = new THREE.Color('#2b1a24')
  scene.background = bg
  const FOG = 0.085
  scene.fog = new THREE.FogExp2(bg, FOG)
  const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 90)

  const SPACING = 4.4
  const N = photos.length
  const total = (N - 1) * SPACING + 5
  const items = []
  const disposables = []

  photos.forEach((canvas, i) => {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const side = i % 2 === 0 ? -1 : 1
    const w = 1.7
    const h = 2.1
    const holder = new THREE.Group()
    holder.position.set(side * 1.65, Math.sin(i * 1.7) * 0.2, -3 - i * SPACING)
    holder.rotation.y = -side * 0.42
    const frameGeo = new THREE.PlaneGeometry(w + 0.14, h + 0.14)
    const frameMat = new THREE.MeshBasicMaterial({ color: '#fff7f4' })
    const picGeo = new THREE.PlaneGeometry(w, h)
    const picMat = new THREE.MeshBasicMaterial({ map: tex })
    const frame = new THREE.Mesh(frameGeo, frameMat)
    const pic = new THREE.Mesh(picGeo, picMat)
    pic.position.z = 0.01
    pic.userData.index = i
    holder.add(frame, pic)
    scene.add(holder)
    items.push({ holder, pic, side, baseRot: holder.rotation.y, basePos: holder.position.clone() })
    disposables.push(tex, frameGeo, frameMat, picGeo, picMat)
  })

  // cánh hoa bay quanh hành lang
  const petalCount = coarse ? 160 : 320
  const positions = new Float32Array(petalCount * 3)
  const seeds = new Float32Array(petalCount * 4)
  for (let i = 0; i < petalCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 9
    positions[i * 3 + 1] = (Math.random() - 0.5) * 6
    positions[i * 3 + 2] = 3 - Math.random() * (total + 4)
    for (let k = 0; k < 4; k++) seeds[i * 4 + k] = Math.random()
  }
  const petalGeo = new THREE.BufferGeometry()
  petalGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  petalGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
  const petalMat = new THREE.ShaderMaterial({
    vertexShader: PETAL_VERTEX,
    fragmentShader: PETAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uFogDensity: { value: FOG } },
  })
  const petals = new THREE.Points(petalGeo, petalMat)
  petals.frustumCulled = false
  scene.add(petals)
  disposables.push(petalGeo, petalMat)

  const raycaster = new THREE.Raycaster()
  let u = 0
  let targetU = 0
  let focus = null
  let focusBlend = 0
  const pointer = { x: 0, y: 0 }
  const look = new THREE.Vector3()

  function resize(w, h) {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // màn hình dọc hẹp: kéo các ảnh hai bên vào gần giữa để không bị cắt mép
    const spread = Math.min(1.65, Math.max(0.95, 1.9 * camera.aspect))
    items.forEach((it) => {
      it.basePos.x = it.side * spread
      it.holder.position.x = it.basePos.x
    })
    petalMat.uniforms.uScale.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360))
  }
  resize(width, height)

  const clampU = (v) => Math.min(Math.max(v, 0), 1)
  function nav(dir) {
    focus = null
    targetU = clampU(targetU + (dir * SPACING) / total)
  }

  function update(t, dt, input) {
    petalMat.uniforms.uTime.value = t
    // cuộn / kéo / bánh xe
    const drag = input.down ? -input.dragY * 0.0011 : 0
    targetU = clampU(targetU + drag + input.wheel * 0.00022)
    input.swipes.forEach((dir) => nav(-dir)) // vuốt trái = đi tiếp
    u += (targetU - u) * Math.min(1, dt * 5)

    // chạm ảnh để lao tới, chạm ra ngoài để lùi lại
    input.taps.forEach((tap) => {
      raycaster.setFromCamera({ x: tap.ndcX, y: tap.ndcY }, camera)
      const hit = raycaster.intersectObjects(items.map((it) => it.pic))[0]
      focus = hit && focus !== hit.object.userData.index ? hit.object.userData.index : null
    })
    focusBlend += ((focus === null ? 0 : 1) - focusBlend) * Math.min(1, dt * 4)

    pointer.x += (input.ndcX - pointer.x) * Math.min(1, dt * 3)
    pointer.y += (input.ndcY - pointer.y) * Math.min(1, dt * 3)

    const flyZ = 3 - u * total
    let camX = pointer.x * 0.55
    let camY = pointer.y * 0.3
    let camZ = flyZ
    if (focus !== null) {
      const it = items[focus]
      camX += (it.basePos.x * 0.45 - camX) * focusBlend
      camY += (it.basePos.y - camY) * focusBlend
      camZ += (it.basePos.z + 2.5 - camZ) * focusBlend
    }
    camera.position.set(camX, camY, camZ)
    look.set(camX * 0.4, camY * 0.4, camZ - 3)
    camera.lookAt(look)

    items.forEach((it, i) => {
      const focused = focus === i ? focusBlend : 0
      it.holder.rotation.y = it.baseRot * (1 - focused)
      const s = 1 + focused * 0.25
      it.holder.scale.set(s, s, s)
      // ảnh nhẹ nhàng nhấp nhô để không đứng im
      it.holder.position.y = it.basePos.y + Math.sin(t * 0.7 + i * 1.3) * 0.05
    })
  }

  function dispose() {
    disposables.forEach((d) => d.dispose())
  }

  return { scene, camera, update, resize, dispose, nav, hint: 'Cuộn / kéo dọc để bay, rê chuột để nghiêng, chạm ảnh để lao tới' }
}
