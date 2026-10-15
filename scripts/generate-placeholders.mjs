/**
 * Sinh ảnh placeholder cho public/assets/. Chỉ tạo file chưa tồn tại, nên không bao giờ
 * ghi đè ảnh thật mà người dùng đã thay vào.
 *
 * Chạy: npm run generate:placeholders
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets')

const PHOTO_COUNT = 8

function svg(width, height, label, { from = '#EBCFCB', to = '#C98B8B', fg = '#6B5458', note = '', labelY = 48 } = {}) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="${labelY}%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(width / 16)}" fill="${fg}">${label}</text>
  <text x="50%" y="${labelY + 8}%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(width / 28)}" fill="${fg}">${note}</text>
</svg>`)
}

function qrSvg(size, label) {
  // Mẫu giả hình QR, không quét được: chủ ý để không ai chuyển nhầm vào đây.
  const cell = size / 25
  let cells = ''
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < 25; x++) {
      if ((x * 7 + y * 13 + x * y) % 3 === 0) {
        cells += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#3B2A2D"/>`
      }
    }
  }
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${cells}
  <rect x="${size * 0.22}" y="${size * 0.42}" width="${size * 0.56}" height="${size * 0.16}" fill="#fff"/>
  <text x="50%" y="53%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${Math.round(size / 14)}" fill="#9E5560">QR MAU - ${label}</text>
</svg>`)
}

const jobs = [
  {
    file: 'hero/couple.webp',
    svg: svg(800, 1200, 'ANH CAP DOI', { note: 'assets/hero/couple.webp (800x1200)', labelY: 30 }),
  },
  ...Array.from({ length: PHOTO_COUNT }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    return {
      file: `photos/photo-${n}.webp`,
      svg: svg(800, 1000, `ANH CUOI ${n}`, { note: `assets/photos/photo-${n}.webp (800x1000)` }),
    }
  }),
  { file: 'qr/bride-qr.webp', svg: qrSvg(600, 'CO DAU') },
  { file: 'qr/groom-qr.webp', svg: qrSvg(600, 'CHU RE') },
  {
    file: 'share/og-image.jpg',
    svg: svg(1200, 630, 'THIEP CUOI', { note: 'assets/share/og-image.jpg (1200x630)' }),
  },
]

for (const job of jobs) {
  const target = join(root, job.file)
  if (existsSync(target)) {
    console.log(`skip   ${job.file} (đã tồn tại)`)
    continue
  }
  await mkdir(dirname(target), { recursive: true })
  const image = sharp(job.svg)
  await (job.file.endsWith('.jpg') ? image.jpeg({ quality: 82 }) : image.webp({ quality: 85 })).toFile(target)
  console.log(`create ${job.file}`)
}

await mkdir(join(root, 'music'), { recursive: true })
