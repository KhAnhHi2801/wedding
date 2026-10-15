// Hướng 2: Ảnh tan thành cánh hoa. Mỗi ảnh là hàng chục nghìn hạt; chạm hoặc rê thì hạt bị đẩy tản ra rồi tự tụ lại,
// vuốt/bấm mũi tên thì ảnh cũ tan thành bão hạt rồi xoáy lại thành ảnh mới.

const MAX_TRAIL = 10

const VERTEX = /* glsl */ `
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uPointer[${MAX_TRAIL}];
  attribute vec3 aSeed;
  attribute vec3 aColorA;
  attribute vec3 aColorB;
  varying vec3 vColor;
  varying float vScatter;

  const float PI = 3.14159265;

  void main() {
    float lumA = dot(aColorA, vec3(0.3, 0.59, 0.11));
    float lumB = dot(aColorB, vec3(0.3, 0.59, 0.11));
    float lum = mix(lumA, lumB, smoothstep(0.35, 0.65, uMix));
    vec3 pos = vec3(position.xy, (lum - 0.5) * 0.28);

    // chuyển ảnh: tan thành cơn lốc rồi tụ lại
    float scatter = sin(PI * uMix);
    float angle = scatter * (aSeed.x - 0.5) * 7.0;
    float c = cos(angle), s = sin(angle);
    pos.xy = vec2(c * pos.x - s * pos.y, s * pos.x + c * pos.y);
    pos += (aSeed - 0.5) * vec3(3.2, 3.2, 3.6) * scatter;

    // chạm/rê: các điểm chạm gần đây đẩy hạt ra, càng cũ càng yếu nên hạt tụ lại từ từ
    for (int i = 0; i < ${MAX_TRAIL}; i++) {
      vec3 ptr = uPointer[i];
      vec2 d = pos.xy - ptr.xy;
      float dist = length(d);
      float f = ptr.z * exp(-dist * dist * 16.0);
      pos.xy += normalize(d + vec2(1e-4)) * f * 0.42;
      pos.z += f * (0.25 + aSeed.z * 0.5);
    }
    pos.z += sin(uTime * 0.9 + aSeed.x * 40.0) * 0.012;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 + scatter * 0.6) * (3.0 / -mv.z);
    vColor = mix(aColorA, aColorB, smoothstep(0.35, 0.65, uMix));
    vScatter = scatter;
  }
`
const FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vScatter;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.18, d);
    if (a < 0.02) discard;
    // khi tan ra pha thêm chút hồng như cánh hoa
    vec3 col = mix(vColor, vec3(1.0, 0.72, 0.8), vScatter * 0.35);
    gl_FragColor = vec4(col, a);
  }
`

export function createParticles({ THREE, photos, renderer, width, height, coarse }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#1c1219')
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 30)
  const CAM_Z = 3.6
  camera.position.set(0, 0, CAM_Z)

  const COLS = coarse ? 130 : 200
  const ROWS = Math.round(COLS * 1.25)
  const W = 1.6
  const H = 2.0
  const count = COLS * ROWS

  // lấy mẫu màu của từng ảnh thành lưới COLS x ROWS
  const sampler = document.createElement('canvas')
  sampler.width = COLS
  sampler.height = ROWS
  const sctx = sampler.getContext('2d', { willReadFrequently: true })
  const colorSets = photos.map((canvas) => {
    sctx.clearRect(0, 0, COLS, ROWS)
    sctx.drawImage(canvas, 0, 0, COLS, ROWS)
    const data = sctx.getImageData(0, 0, COLS, ROWS).data
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colors[i * 3] = data[i * 4] / 255
      colors[i * 3 + 1] = data[i * 4 + 1] / 255
      colors[i * 3 + 2] = data[i * 4 + 2] / 255
    }
    return colors
  })

  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count * 3)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      // xê dịch ngẫu nhiên trong ô để không còn lộ lưới đều (nhìn như bụi cánh hoa chứ không phải màn hình chấm)
      const jx = (Math.random() - 0.5) * 0.9
      const jy = (Math.random() - 0.5) * 0.9
      positions[i * 3] = ((c + jx) / (COLS - 1) - 0.5) * W
      positions[i * 3 + 1] = (0.5 - (r + jy) / (ROWS - 1)) * H
      seeds[i * 3] = Math.random()
      seeds[i * 3 + 1] = Math.random()
      seeds[i * 3 + 2] = Math.random()
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
  const attrA = new THREE.BufferAttribute(new Float32Array(colorSets[0]), 3)
  const attrB = new THREE.BufferAttribute(new Float32Array(colorSets[1 % colorSets.length]), 3)
  geometry.setAttribute('aColorA', attrA)
  geometry.setAttribute('aColorB', attrB)

  const trail = Array.from({ length: MAX_TRAIL }, () => new THREE.Vector3(0, 0, 0))
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 6 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uPointer: { value: trail },
    },
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  const group = new THREE.Group()
  group.add(points)
  scene.add(group)

  let index = 0
  let transition = null // { from, to, t }
  let trailHead = 0
  let lastX = 0
  let lastY = 0
  let moveBudget = 0

  function resize(w, h) {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // kích thước hạt (px) để các hạt liền kề chạm nhau, dựa trên chiều cao khung hình ở khoảng cách camera
    const pxPerUnit = h / (2 * Math.tan((camera.fov * Math.PI) / 360) * CAM_Z)
    material.uniforms.uSize.value = (W / COLS) * pxPerUnit * 1.9
    material.uniforms.uPixelRatio.value = renderer.getPixelRatio()
    // ảnh vừa khung (không bị cắt) ở màn hình dọc lẫn ngang
    const fit = Math.min((h / pxPerUnit) / H, (w / pxPerUnit) / W) * 0.78
    group.scale.setScalar(Math.min(fit, 1.1))
    group.position.y = -0.06 * H * group.scale.x // nhích xuống để khỏi bị thanh nút che
  }
  resize(width, height)

  const halfH = Math.tan((camera.fov * Math.PI) / 360) * CAM_Z
  function toWorld(ndcX, ndcY) {
    const s = group.scale.x
    return { x: (ndcX * halfH * camera.aspect) / s, y: (ndcY * halfH) / s }
  }
  function push(ndcX, ndcY, strength) {
    const p = toWorld(ndcX, ndcY)
    trail[trailHead].set(p.x, p.y, strength)
    trailHead = (trailHead + 1) % MAX_TRAIL
  }

  function go(dir) {
    if (transition) return
    const to = (index + dir + photos.length) % photos.length
    attrA.array.set(colorSets[index])
    attrB.array.set(colorSets[to])
    attrA.needsUpdate = true
    attrB.needsUpdate = true
    transition = { from: index, to, t: 0 }
  }

  function update(t, dt, input) {
    material.uniforms.uTime.value = t
    input.swipes.forEach((dir) => go(-dir))

    // rê chuột hoặc kéo ngón tay: để lại vệt đẩy hạt
    if (input.moved) {
      moveBudget += Math.hypot(input.ndcX - lastX, input.ndcY - lastY)
      if (moveBudget > 0.04) {
        push(input.ndcX, input.ndcY, input.down ? 1.0 : 0.55)
        moveBudget = 0
      }
    }
    lastX = input.ndcX
    lastY = input.ndcY
    input.taps.forEach((tap) => push(tap.ndcX, tap.ndcY, 2.2)) // chạm: bùng mạnh

    for (const v of trail) v.z *= Math.pow(0.12, dt) // vệt yếu dần, hạt tụ lại từ từ

    if (transition) {
      transition.t += dt / 1.8
      const k = Math.min(transition.t, 1)
      material.uniforms.uMix.value = k * k * (3 - 2 * k)
      if (k >= 1) {
        index = transition.to
        transition = null
        material.uniforms.uMix.value = 0
        attrA.array.set(colorSets[index])
        attrA.needsUpdate = true
      }
    }

    group.rotation.y += (input.ndcX * 0.35 - group.rotation.y) * Math.min(1, dt * 3)
    group.rotation.x += (-input.ndcY * 0.2 - group.rotation.x) * Math.min(1, dt * 3)
  }

  function dispose() {
    geometry.dispose()
    material.dispose()
  }

  return {
    scene,
    camera,
    update,
    resize,
    dispose,
    nav: (dir) => go(dir),
    hint: 'Chạm / rê để làm tan ảnh, vuốt ngang hoặc bấm mũi tên để đổi ảnh',
  }
}
