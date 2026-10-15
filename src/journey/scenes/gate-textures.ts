import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'

/**
 * Texture hoa/lá được vẽ ở độ phân giải gấp `RESOLUTION` lần kích thước "thiết kế" (toạ độ vẽ giữ nguyên nhờ ctx.scale).
 * Gradient trong canvas 2D bị trình duyệt thêm nhiễu dither theo từng pixel; ở độ phân giải thấp, khi camera lại gần và
 * texture bị phóng to, những hạt nhiễu đó thành các chấm li ti thấy rõ trên mặt lá và cánh hoa. Vẽ ở độ phân giải cao thì
 * hạt nhỏ hơn nhiều và bị mipmap làm mịn.
 */
const RESOLUTION = 4

/**
 * Canvas lưu phần trong suốt là (0,0,0,0), nên ở mép hình, khi GPU trộn mượt giữa màu của hình và "đen trong suốt", màu mép
 * bị tối xỉn và lấm tấm; sau đó cắt alpha cứng thì mép thành các hạt. "Tràn màu": lan màu của phần đặc (alpha >= 50%) ra các
 * pixel lân cận còn lại (giữ nguyên alpha) để mép luôn có đúng màu của hoa/lá, kể cả khi bị trộn.
 */
function bleedColor(data: Uint8ClampedArray, width: number, height: number, passes: number) {
  const solid = new Uint8Array(width * height)
  for (let i = 0; i < solid.length; i += 1) solid[i] = data[i * 4 + 3] >= 128 ? 1 : 0
  for (let pass = 0; pass < passes; pass += 1) {
    const grown = solid.slice()
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        if (solid[index]) continue
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx
            if (nx < 0 || nx >= width) continue
            const n = ny * width + nx
            if (!solid[n]) continue
            r += data[n * 4]
            g += data[n * 4 + 1]
            b += data[n * 4 + 2]
            count += 1
          }
        }
        if (count === 0) continue
        data[index * 4] = r / count
        data[index * 4 + 1] = g / count
        data[index * 4 + 2] = b / count
        grown[index] = 1
      }
    }
    solid.set(grown)
  }
}

/**
 * Tạo texture từ một canvas 2D vẽ bằng code (không phải tải ảnh nào), rồi tràn màu ra mép (xem bleedColor). Kích thước
 * tính theo toạ độ thiết kế. Trả về DataTexture đã lật dọc sẵn cho đúng chiều khi lên GPU.
 */
function drawTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): DataTexture {
  const w = width * RESOLUTION
  const h = height * RESOLUTION
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas 2D để vẽ texture')
  ctx.scale(RESOLUTION, RESOLUTION)
  draw(ctx)
  const source = ctx.getImageData(0, 0, w, h).data
  bleedColor(source, w, h, 3)
  // WebGL đọc dòng đầu tiên là phía dưới của ảnh: lật dòng để hình không bị ngược.
  const flipped = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y += 1) flipped.set(source.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4)
  const texture = new DataTexture(flipped, w, h, RGBAFormat, UnsignedByteType)
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

/**
 * Bông hoa năm cánh nhìn thẳng, màu trắng ngà có đổ bóng nhẹ về phía tâm; màu thật của từng bông do
 * màu theo instance nhân vào (trắng, kem, hồng nhạt, tím oải hương).
 */
export function createBloomTexture(): DataTexture {
  return drawTexture(128, 128, (ctx) => {
    ctx.translate(64, 64)
    for (let petal = 0; petal < 5; petal += 1) {
      ctx.save()
      ctx.rotate((petal * Math.PI * 2) / 5)
      const gradient = ctx.createRadialGradient(0, -8, 2, 0, -30, 34)
      gradient.addColorStop(0, '#e9e2dc')
      gradient.addColorStop(0.45, '#ffffff')
      gradient.addColorStop(1, '#f6f1ee')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.ellipse(0, -30, 18, 31, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(160, 140, 130, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = '#f0d68a'
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d9b45a'
    ctx.beginPath()
    ctx.arc(0, 0, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

/** Chiếc lá thon dài, đầu nhọn, có gân giữa; xanh lá dịu hợp tông hoa trắng. */
export function createLeafTexture(): DataTexture {
  return drawTexture(64, 128, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 64, 0)
    gradient.addColorStop(0, '#5f8f63')
    gradient.addColorStop(0.5, '#86b38a')
    gradient.addColorStop(1, '#5a8a5f')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(32, 2)
    ctx.bezierCurveTo(70, 34, 62, 100, 32, 126)
    ctx.bezierCurveTo(2, 100, -6, 34, 32, 2)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(230, 245, 225, 0.65)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(32, 8)
    ctx.lineTo(32, 120)
    ctx.stroke()
  })
}
