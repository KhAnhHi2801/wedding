/**
 * Đóng gói các khung đi bộ của Stella (render bởi scripts/render-stella-walk.py) thành một sprite sheet WebP:
 *   node scripts/pack-stella-walk.mjs <thư mục khung> <thư mục ra>
 * Mỗi khung được nướng viền giấy trắng và bóng đổ (scripts/lib/paper-bake.mjs), cắt chung một hộp bao để chân luôn cùng mức,
 * thu nhỏ rồi xếp lưới 4x3. Xuất stella-walk.webp, stella-idle.webp và stella-walk.json (kích thước khung, bước chân).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { bakePaper } from './lib/paper-bake.mjs'

const [dir, out] = process.argv.slice(2)
const FRAMES = 12
const COLS = 4
const ROWS = 3
const SCALE = 0.7
const BAKE = { pad: 28, rim: 5, shadowDx: 10, shadowDy: 14, shadowOpacity: 0.18, shadowColor: { r: 0x1f, g: 0x3d, b: 0x36 } }
const names = [...Array.from({ length: FRAMES }, (_, i) => `walk-${String(i).padStart(2, '0')}`), 'idle']

const baked = new Map()
for (const name of names) baked.set(name, await bakePaper(readFileSync(`${dir}/${name}.png`), BAKE))

// Hộp bao chung của mọi khung (alpha > 8).
const box = { l: 1e9, t: 1e9, r: -1, b: -1 }
let sheetW = 0
let sheetH = 0
for (const png of baked.values()) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  sheetW = info.width
  sheetH = info.height
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        box.l = Math.min(box.l, x)
        box.r = Math.max(box.r, x)
        box.t = Math.min(box.t, y)
        box.b = Math.max(box.b, y)
      }
    }
  }
}
const crop = { left: Math.max(box.l - 4, 0), top: Math.max(box.t - 4, 0) }
crop.width = Math.min(box.r + 4, sheetW - 1) - crop.left + 1
crop.height = Math.min(box.b + 4, sheetH - 1) - crop.top + 1
const fw = Math.round(crop.width * SCALE)
const fh = Math.round(crop.height * SCALE)

const tiles = []
for (let i = 0; i < FRAMES; i++) {
  const input = await sharp(baked.get(names[i])).extract(crop).resize(fw, fh).png().toBuffer()
  tiles.push({ input, left: (i % COLS) * fw, top: Math.floor(i / COLS) * fh })
}
const walk = await sharp({
  create: { width: COLS * fw, height: ROWS * fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(tiles)
  .webp({ quality: 84, alphaQuality: 90 })
  .toBuffer()
const idle = await sharp(baked.get('idle')).extract(crop).resize(fw, fh).webp({ quality: 84, alphaQuality: 90 }).toBuffer()
writeFileSync(`${out}/stella-walk.webp`, walk)
writeFileSync(`${out}/stella-idle.webp`, idle)

const meta = Object.fromEntries(
  readFileSync(`${dir}/walk-meta.txt`, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('='))
)
const frameWorldHeight = Number(meta.world_height_m)
const frameHeightPx = Number(meta.frame_px.split('x')[1])
const json = {
  frames: FRAMES,
  cols: COLS,
  rows: ROWS,
  frameWidth: fw,
  frameHeight: fh,
  fps: 12,
  pxPerMeter: Math.round((frameHeightPx / frameWorldHeight) * SCALE * 100) / 100,
  characterHeightM: Number(meta.character_height_m),
  // Ước lượng từ biên độ đùi 28° và chiều dài chân ~0,57 m; khớp tốc độ camera với số này để chân không trượt.
  strideMetersPerCycle: 1.08,
  facing: 'away',
}
writeFileSync(`${out}/stella-walk.json`, JSON.stringify(json, null, 2))
console.log(json, 'walk KB', Math.round(walk.length / 1024), 'idle KB', Math.round(idle.length / 1024))
