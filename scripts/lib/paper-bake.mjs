/**
 * "Nướng" viền giấy trắng và bóng đổ cứng vào ảnh có alpha, để lúc chạy chỉ cần một mẫu texture mỗi pixel
 * (không cần shader viền hay mặt phẳng bóng riêng). Dùng cho ảnh cặp đôi (optimize-images.mjs) và sprite Stella
 * (pack-stella-walk.mjs). Ảnh ra rộng hơn ảnh vào một lề `pad` mỗi cạnh để chứa viền và bóng.
 */
import sharp from 'sharp'

/** Lề tính theo chiều cao ảnh gốc. Phải khớp `PAPER_PAD_RATIO` trong src/world/world-config.ts. */
export const PAPER_PAD_RATIO = 0.04

/** Thông số nướng theo chiều cao ảnh gốc (px): viền mảnh, bóng lệch xuống phải. */
export function paperBakeSpec(height) {
  return {
    pad: Math.round(height * PAPER_PAD_RATIO),
    rim: Math.max(2, Math.round(height * 0.0045)),
    shadowDx: Math.round(height * 0.018),
    shadowDy: Math.round(height * 0.025),
    shadowOpacity: 0.18,
    shadowColor: { r: 0x1f, g: 0x3d, b: 0x36 },
  }
}

/** Nở mặt nạ alpha ra `radius` px: làm mờ rồi cắt ngưỡng thấp (Gaussian đạt 3% ở khoảng 1,86σ). */
async function dilate(maskPng, radius) {
  return sharp(maskPng)
    .blur(Math.max(0.3, radius / 1.86))
    .threshold(8)
    .png()
    .toBuffer()
}

async function solid(color, maskPng, width, height, opacity = 1) {
  const mask = opacity === 1 ? maskPng : await sharp(maskPng).linear(opacity, 0).png().toBuffer()
  return sharp({ create: { width, height, channels: 3, background: color } })
    .joinChannel(mask)
    .png()
    .toBuffer()
}

/**
 * @param input Buffer ảnh RGBA đã đổi cỡ.
 * @param spec kết quả của `paperBakeSpec(chiều cao ảnh)`.
 * @returns Buffer PNG RGBA rộng hơn ảnh vào `pad` mỗi cạnh.
 */
export async function bakePaper(input, spec) {
  const { pad, rim, shadowDx, shadowDy, shadowOpacity, shadowColor } = spec
  const meta = await sharp(input).metadata()
  const width = meta.width + pad * 2
  const height = meta.height + pad * 2

  const alpha = await sharp(input).ensureAlpha().extractChannel('alpha').png().toBuffer()
  const padded = await sharp(alpha).extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#000000' }).png().toBuffer()
  const rimMask = await dilate(padded, rim)

  const shadow = await solid(shadowColor, rimMask, width, height, shadowOpacity)
  const rimLayer = await solid({ r: 255, g: 255, b: 255 }, rimMask, width, height)
  const original = await sharp(input).ensureAlpha().extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()

  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: shadow, left: shadowDx, top: shadowDy, blend: 'over' },
      { input: rimLayer, left: 0, top: 0 },
      { input: original, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}
