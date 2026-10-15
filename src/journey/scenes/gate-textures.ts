import { CanvasTexture, SRGBColorSpace } from 'three'

/** Tạo texture từ một canvas 2D vẽ bằng code, để không phải tải thêm ảnh nào. */
function drawTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas 2D để vẽ texture')
  draw(ctx)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * Bông hoa năm cánh nhìn thẳng, màu trắng ngà có đổ bóng nhẹ về phía tâm; màu thật của từng bông do
 * màu theo instance nhân vào (trắng, kem, hồng nhạt, tím oải hương).
 */
export function createBloomTexture(): CanvasTexture {
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
export function createLeafTexture(): CanvasTexture {
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
