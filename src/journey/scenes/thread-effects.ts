import {
  AdditiveBlending,
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  Points,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three'
import { mulberry32 } from '../../lib/seeded-random'

/** Hiệu ứng phụ của cảnh sợi chỉ: bụi sáng trôi nền, và cánh hoa bung ra khi hai sợi chỉ thắt nút. */

export interface Dust {
  points: Points
  setTime: (seconds: number) => void
  /** Kích thước điểm theo chiều cao màn hình (px) và độ đục chung. */
  setView: (pixelsPerUnit: number, opacity: number) => void
  dispose: () => void
}

/** Bụi sáng li ti trôi lên chậm trong không gian, cho cảnh có chiều sâu và hơi thở. */
export function createDust(count: number): Dust {
  const random = mulberry32(412)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    positions.set([(random() - 0.5) * 12, (random() - 0.5) * 8, (random() - 0.5) * 7 - 1], i * 3)
    seeds[i] = random()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1))
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPx;
      varying float vTwinkle;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + 4.0 + uTime * (0.03 + aSeed * 0.05), 8.0) - 4.0;
        p.x += sin(uTime * 0.3 + aSeed * 30.0) * 0.2;
        vTwinkle = 0.5 + 0.5 * sin(uTime * (0.8 + aSeed) + aSeed * 50.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (0.05 + aSeed * 0.09) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * 0.55 * vTwinkle * uOpacity;
        gl_FragColor = vec4(1.0, 0.86, 0.72, a);
      }
    `,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  return {
    points,
    setTime: (seconds) => {
      material.uniforms.uTime.value = seconds
    },
    setView: (pixelsPerUnit, opacity) => {
      material.uniforms.uPx.value = pixelsPerUnit
      material.uniforms.uOpacity.value = opacity
    },
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}

export interface PetalBurst {
  points: Points
  /** Giây kể từ lúc bung; âm hoặc 0 thì chưa hiện. */
  setTime: (seconds: number) => void
  setView: (pixelsPerUnit: number) => void
  /** Hệ số độ đục chung 0..1 (mờ hết khi cổng mở để không còn cánh hoa nào trên trang). */
  setFade: (value: number) => void
  dispose: () => void
}

/** Atlas ảnh thật 3x2 ô: năm cánh hoa và một đầu hoa cosmos (tạo từ bộ sprite hoa thật, xem public/assets/thread). */
const ATLAS_URL = `${import.meta.env.BASE_URL}assets/thread/petals.webp`

/**
 * Cánh hoa thật bung ra từ nút thắt: mỗi điểm là một ảnh cánh hoa (có gân, màu hồng thật) lấy từ atlas, bay tỏa, lật nghiêng
 * quanh trục như cánh hoa rơi, rồi lả tả rơi chậm và mờ dần. (Bản đầu vẽ cánh hoa bằng shader nên nhìn như tia pháo hoa.)
 */
export function createPetalBurst(count: number): PetalBurst {
  const random = mulberry32(9091)
  const directions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    const speed = 0.5 + random() * 1.1
    directions.set([Math.sin(phi) * Math.cos(theta) * speed, Math.sin(phi) * Math.sin(theta) * speed * 0.75, Math.cos(phi) * speed], i * 3)
    seeds[i] = random()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aDir', new Float32BufferAttribute(directions, 3))
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1))

  const blank = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat)
  blank.needsUpdate = true
  let atlas: Texture | null = null
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: -1 }, uPx: { value: 1 }, uFade: { value: 1 }, uAtlas: { value: blank } },
    vertexShader: /* glsl */ `
      attribute vec3 aDir;
      attribute float aSeed;
      uniform float uTime;
      uniform float uPx;
      varying float vAlpha;
      varying float vAngle;
      varying float vSeed;
      varying float vFlip;
      varying float vScale;
      void main() {
        float t = max(uTime, 0.0);
        // Bung ra rồi chậm dần (lực cản), sau đó rơi lả tả và đung đưa như cánh hoa thật.
        float spread = 1.0 - exp(-t * 1.2);
        vec3 p = aDir * spread * 2.6;
        p.y -= t * (0.04 + aSeed * 0.07) + t * t * 0.025;
        p.x += sin(t * 1.3 + aSeed * 20.0) * 0.16 * spread;
        p.z += cos(t * 1.1 + aSeed * 13.0) * 0.12 * spread;
        vAlpha = (1.0 - smoothstep(3.8, 6.6, t)) * step(0.001, uTime) * smoothstep(0.0, 0.12, t);
        vAngle = aSeed * 6.2831 + t * (0.4 + aSeed * 0.8);
        // Lật quanh trục dọc: cánh hoa lúc dẹt lúc xòe khi rơi.
        vFlip = cos(t * (1.4 + aSeed * 1.6) + aSeed * 30.0);
        vSeed = aSeed;
        // Đầu hoa cosmos (ô cuối) to hơn cánh hoa một chút.
        vScale = aSeed > 0.9 ? 1.25 : 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (0.15 + aSeed * 0.12) * vScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uFade;
      varying float vAlpha;
      varying float vAngle;
      varying float vSeed;
      varying float vFlip;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float ca = cos(vAngle);
        float sa = sin(vAngle);
        c = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y);
        // Lật nghiêng: ép bề ngang theo |cos|, nhưng không dẹt hẳn thành vạch.
        c.x /= max(0.22, abs(vFlip));
        if (abs(c.x) > 0.5 || abs(c.y) > 0.5) discard;
        // Chọn ô trong atlas 3x2: phần lớn là cánh hoa, một ít là đầu hoa cosmos.
        float idx = vSeed > 0.9 ? 5.0 : floor(vSeed / 0.9 * 5.0);
        float col = mod(idx, 3.0);
        float row = floor(idx / 3.0);
        vec4 tex = texture2D(uAtlas, vec2((col + c.x + 0.5) / 3.0, ((1.0 - row) + (0.5 - c.y)) / 2.0));
        if (tex.a < 0.05 || vAlpha < 0.01) discard;
        // Mặt sau cánh hoa (đang lật) hơi tối hơn một chút.
        float shade = vFlip < 0.0 ? 0.92 : 1.0;
        // Texture đã giải mã sRGB về tuyến tính: phải mã hóa lại khi xuất, nếu không màu bị đậm và tím hơn ảnh gốc.
        gl_FragColor = linearToOutputTexel(vec4(tex.rgb * shade, tex.a * vAlpha * uFade * 0.95));
      }
    `,
  })
  new TextureLoader().load(
    ATLAS_URL,
    (texture) => {
      texture.colorSpace = SRGBColorSpace
      atlas = texture
      material.uniforms.uAtlas.value = texture
    },
    undefined,
    // Thiếu ảnh: không có cánh hoa (texture trong suốt), cảnh vẫn chạy bình thường.
    () => undefined,
  )
  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.visible = false
  return {
    points,
    setTime(seconds) {
      material.uniforms.uTime.value = seconds
      points.visible = seconds > 0
    },
    setView(pixelsPerUnit) {
      material.uniforms.uPx.value = pixelsPerUnit
    },
    setFade(value) {
      material.uniforms.uFade.value = value
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      blank.dispose()
      atlas?.dispose()
    },
  }
}
