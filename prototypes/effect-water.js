// Hướng 3: Mặt nước gợn sóng. Ảnh xếp thành cột dọc, kéo/cuộn để trôi qua (ảnh uốn cong theo đà), rê hoặc chạm thì
// sóng lan ra làm ảnh méo gợn, chạm ảnh để phóng to.

const RIPPLES = 8

const VERTEX = /* glsl */ `
  uniform float uCamY;
  uniform float uVel;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    float rel = w.y - uCamY;
    w.z -= rel * rel * 0.05;       // ảnh ở xa tâm màn hình cong ra sau như cuộn giấy
    w.x += rel * uVel * 0.18;      // trôi nhanh thì nghiêng theo đà
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform vec4 uRip[${RIPPLES}];   // x, y (thế giới), thời điểm bắt đầu, cường độ
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vec2 disp = vec2(0.0);
    float height = 0.0;
    for (int i = 0; i < ${RIPPLES}; i++) {
      vec4 r = uRip[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 4.5) continue;
      vec2 d = vWorld.xy - r.xy;
      float dist = length(d);
      float front = age * 1.15;
      float env = exp(-abs(dist - front) * 5.0) * exp(-age * 0.85) * r.w;
      float wave = sin((dist - front) * 34.0) * env;
      disp += normalize(d + vec2(1e-5)) * wave;
      height += wave;
    }
    vec2 uv = vUv + disp * 0.018;
    vec2 split = disp * 0.006;
    vec3 col = vec3(
      texture2D(uMap, uv + split).r,
      texture2D(uMap, uv).g,
      texture2D(uMap, uv - split).b
    );
    col += height * 0.07;           // sóng sáng lên ở đỉnh
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export function createWater({ THREE, photos, width, height }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#1a1118')
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50)
  const Z_FAR = 5.4
  const Z_NEAR = 3.1
  camera.position.set(0, 0, Z_FAR)

  const GAP = 2.75
  const N = photos.length
  const ripples = Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0))
  let rippleHead = 0
  const sharedUniforms = {
    uTime: { value: 0 },
    uCamY: { value: 0 },
    uVel: { value: 0 },
    uRip: { value: ripples },
  }

  const disposables = []
  const planes = photos.map((canvas, i) => {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const geo = new THREE.PlaneGeometry(1.85, 2.3, 24, 30)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { ...sharedUniforms, uMap: { value: tex } },
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(Math.sin(i * 1.9) * 0.18, -i * GAP, 0)
    mesh.userData.index = i
    scene.add(mesh)
    disposables.push(tex, geo, mat)
    return mesh
  })

  const raycaster = new THREE.Raycaster()
  let scroll = 0
  let target = 0
  let vel = 0
  let idle = 0
  let focus = null
  let zoom = 0
  let lastRipple = 0
  let lastX = 0
  let lastY = 0
  const unitsPerPixel = () => (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / window.innerHeight
  const maxScroll = (N - 1) * GAP

  function resize(w, h) {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize(width, height)

  function worldAt(ndcX, ndcY) {
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)
    const hit = raycaster.intersectObjects(planes)[0]
    if (hit) return { x: hit.point.x, y: hit.point.y, plane: hit.object.userData.index }
    // ngoài ảnh: chiếu lên mặt phẳng z = 0
    const dir = raycaster.ray.direction
    const k = -raycaster.ray.origin.z / dir.z
    return { x: raycaster.ray.origin.x + dir.x * k, y: raycaster.ray.origin.y + dir.y * k, plane: null }
  }
  function ripple(x, y, t, strength) {
    ripples[rippleHead].set(x, y, t, strength)
    rippleHead = (rippleHead + 1) % RIPPLES
  }
  function nav(dir) {
    focus = null
    target = Math.min(Math.max(target + dir * GAP, 0), maxScroll)
  }

  function update(t, dt, input) {
    sharedUniforms.uTime.value = t
    const upp = unitsPerPixel()
    if (input.down) {
      target = Math.min(Math.max(target + input.dragY * upp, 0), maxScroll)
      idle = 0
    }
    if (input.wheel) {
      target = Math.min(Math.max(target + input.wheel * upp * 1.2, 0), maxScroll)
      idle = 0
    }
    input.swipes.forEach(() => {}) // vuốt dọc đã xử lý bằng kéo; vuốt ngang không dùng ở hướng này

    // nghỉ một lúc thì tự chốt vào ảnh gần nhất
    idle += dt
    if (idle > 0.7 && !input.down) target += (Math.round(target / GAP) * GAP - target) * Math.min(1, dt * 3)

    const prev = scroll
    scroll += (target - scroll) * Math.min(1, dt * 7)
    vel += ((scroll - prev) / Math.max(dt, 1e-3) * 0.05 - vel) * Math.min(1, dt * 8)
    sharedUniforms.uVel.value = Math.max(Math.min(vel, 1.5), -1.5)

    // sóng từ chạm và rê
    input.taps.forEach((tap) => {
      const w = worldAt(tap.ndcX, tap.ndcY)
      ripple(w.x, w.y, t, 1.4)
      if (w.plane !== null) focus = focus === w.plane ? null : w.plane
      else focus = null
    })
    if (input.moved && t - lastRipple > 0.09 && Math.hypot(input.ndcX - lastX, input.ndcY - lastY) > 0.02) {
      const w = worldAt(input.ndcX, input.ndcY)
      ripple(w.x, w.y, t, input.down ? 0.9 : 0.55)
      lastRipple = t
    }
    lastX = input.ndcX
    lastY = input.ndcY

    zoom += ((focus === null ? 0 : 1) - zoom) * Math.min(1, dt * 4)
    const camY = focus === null ? -scroll : -scroll + (planes[focus].position.y - -scroll) * zoom
    camera.position.y = camY
    camera.position.z = Z_FAR + (Z_NEAR - Z_FAR) * zoom
    sharedUniforms.uCamY.value = camY
    camera.lookAt(0, camY, 0)
  }

  function dispose() {
    disposables.forEach((d) => d.dispose())
  }

  return { scene, camera, update, resize, dispose, nav, hint: 'Kéo dọc để trôi, rê / chạm để gợn sóng, chạm ảnh để phóng to' }
}
