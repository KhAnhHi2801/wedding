/**
 * Nén ảnh gốc trong assets-src/ thành WebP nhẹ đặt vào public/assets/.
 *
 *   assets-src/hero/*   -> public/assets/hero/*.webp    (vừa khung 1600x2400, cảnh báo nếu > 350KB)
 *   assets-src/photos/* -> public/assets/photos/*.webp  (cạnh dài <= 1600px)
 *   assets-src/qr/*     -> public/assets/qr/*.webp      (cạnh dài <= 1024px, lossless để quét được)
 *   assets-src/share/*  -> public/assets/share/*.jpg    (rộng 1200px)
 *
 * Tên file đầu ra giữ tên file nguồn (đổi đuôi), nên đặt đúng tên như trong
 * src/config/wedding-config.ts: couple.*, photo-01.* ... photo-08.*, bride-qr.*, groom-qr.*,
 * og-image.*. Ảnh iPhone .HEIC cần đổi sang JPG trước (sharp bản dựng sẵn không đọc được HEVC).
 *
 * Chạy: npm run optimize:images
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { bakePaper, paperBakeSpec } from './lib/paper-bake.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(repo, 'assets-src')
const outRoot = join(repo, 'public', 'assets')
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const HEIC_EXT = new Set(['.heic', '.heif'])
const HERO_MAX_BYTES = 350 * 1024

const profiles = {
  hero: {
    ext: '.webp',
    maxBytes: HERO_MAX_BYTES,
    pipeline: (img) => img.resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }),
  },
  photos: {
    ext: '.webp',
    pipeline: (img) => img.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }),
  },
  // QR: lossless để các module vuông giữ nguyên; cạnh dài tối đa 1024px là đủ cho khung 200px.
  qr: {
    ext: '.webp',
    pipeline: (img) => img.resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ lossless: true }),
  },
  share: { ext: '.jpg', pipeline: (img) => img.resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }) },
  // Ảnh tách nền (giữ alpha) dùng làm hình giấy cắt trong cảnh 3D; tên file khớp với ảnh gốc: couple, photo-01 ... photo-08.
  // Viền giấy trắng và bóng đổ được nướng sẵn vào ảnh (xem scripts/lib/paper-bake.mjs), nên ảnh ra rộng hơn ảnh vào một lề.
  cutouts: {
    ext: '.webp',
    pipeline: async (img) => {
      const resized = await img.resize({ width: 1400, height: 2100, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
      const { height } = await sharp(resized).metadata()
      const baked = await bakePaper(resized, paperBakeSpec(height))
      return sharp(baked).webp({ quality: 82, alphaQuality: 90 })
    },
  },
  // Depth map thang xám: độ phân giải thấp là đủ vì chỉ dùng để đẩy lệch hình, và không cần alpha.
  depth: {
    ext: '.webp',
    pipeline: (img) => img.resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).removeAlpha().greyscale().webp({ quality: 88 }),
  },
}

if (!existsSync(srcRoot)) {
  console.error('Không thấy thư mục assets-src/. Tạo assets-src/{hero,photos,qr,share}/ và bỏ ảnh gốc vào.')
  process.exit(1)
}

let ok = 0
let failed = 0
// Có thể chỉ chạy một vài thư mục: `npm run optimize:images -- cutouts depth`
const only = process.argv.slice(2)
for (const [folder, profile] of Object.entries(profiles)) {
  if (only.length && !only.includes(folder)) continue
  const dir = join(srcRoot, folder)
  if (!existsSync(dir)) continue
  const outDir = join(outRoot, folder)
  await mkdir(outDir, { recursive: true })

  const seen = new Map() // tên đầu ra -> file nguồn, để bắt trường hợp couple.jpg và couple.png
  for (const name of (await readdir(dir)).sort()) {
    const ext = extname(name).toLowerCase()
    if (HEIC_EXT.has(ext)) {
      console.error(`BỎ QUA ${folder}/${name}: ảnh HEIC chưa hỗ trợ, hãy đổi sang JPG trước.`)
      failed++
      continue
    }
    if (!IMAGE_EXT.has(ext)) continue

    const outName = basename(name, extname(name)) + profile.ext
    if (seen.has(outName)) {
      console.error(`BỎ QUA ${folder}/${name}: trùng tên đầu ra ${outName} với ${seen.get(outName)}. Đổi tên một trong hai.`)
      failed++
      continue
    }
    seen.set(outName, name)

    try {
      const processed = await profile.pipeline(sharp(join(dir, name)).rotate())
      const info = await processed.toFile(join(outDir, outName))
      const kb = Math.round(info.size / 1024)
      const warn = profile.maxBytes && info.size > profile.maxBytes ? `  CẢNH BÁO: > ${profile.maxBytes / 1024}KB, ảnh LCP nên nhẹ hơn` : ''
      console.log(`${folder}/${name} -> ${outName} (${kb}KB, ${info.width}x${info.height})${warn}`)
      ok++
    } catch (error) {
      console.error(`LỖI ${folder}/${name}: ${error.message}`)
      failed++
    }
  }
}
console.log(ok || failed ? `Xong ${ok} ảnh, ${failed} lỗi/bỏ qua.` : 'Không có ảnh nào để xử lý.')
process.exitCode = failed ? 1 : 0
