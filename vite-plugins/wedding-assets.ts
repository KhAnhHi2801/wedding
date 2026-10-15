import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import type { Plugin } from 'vite'

export interface AssetImage {
  src: string
  alt: string
  width: number
  height: number
}

const IMAGE_FILE = /\.(webp|jpe?g|png|avif)$/i
const WARN_BYTES = 800 * 1024
// Hero nén ra 1600x2400 (xem scripts/optimize-images.mjs): chỉ cạnh dài vượt mức này mới là ảnh chưa nén.
const WARN_SIDE = 2500

// So sánh theo số tự nhiên: photo-2 đứng trước photo-10; "ảnh 2 (1)" đúng thứ tự người dùng mong đợi.
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })

/** Tên các file ảnh trong một thư mục, theo thứ tự tên. Thư mục không tồn tại thì trả về mảng rỗng. */
export function listImageFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((file) => IMAGE_FILE.test(file) && !file.startsWith('.'))
    .sort(collator.compare)
}

/** Đọc tất cả ảnh trong `public/assets/<folder>`: đường dẫn URL, kích thước thật, và cảnh báo nếu ảnh quá nặng. */
export async function readImages(
  publicDir: string,
  folder: string,
  altPrefix: string,
  warn: (message: string) => void = () => undefined,
): Promise<AssetImage[]> {
  const dir = join(publicDir, 'assets', folder)
  const files = listImageFiles(dir)
  return Promise.all(
    files.map(async (file, index) => {
      const path = join(dir, file)
      const meta = await sharp(path).metadata()
      const width = meta.width ?? 0
      const height = meta.height ?? 0
      const bytes = statSync(path).size
      if (bytes > WARN_BYTES || Math.max(width, height) > WARN_SIDE) {
        warn(
          `Ảnh assets/${folder}/${file} nặng ${Math.round(bytes / 1024)}KB, ${width}x${height}px. ` +
            'Nên nén nhỏ hơn (chạy `npm run optimize:images` với ảnh gốc trong assets-src/) để trang tải nhanh trên 4G.',
        )
      }
      return { src: `/assets/${folder}/${encodeURIComponent(file)}`, alt: `${altPrefix} ${index + 1}`, width, height }
    }),
  )
}

const VIRTUAL_ID = 'virtual:wedding-assets'
const RESOLVED_ID = `\0${VIRTUAL_ID}`
const WATCHED_FOLDERS = ['photos', 'hero']

/**
 * Cung cấp module ảo `virtual:wedding-assets` gồm danh sách ảnh gallery và ảnh hero, quét từ thư mục:
 *   public/assets/photos/*  -> `photos` (theo thứ tự tên file)
 *   public/assets/hero/*    -> `heroPhoto` (ảnh đầu tiên, hoặc null nếu thư mục trống)
 * Tên file tùy ý; thêm hoặc xóa file thì trang tự tải lại khi đang chạy dev.
 */
export function weddingAssetsPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'wedding-assets',
    configResolved(config) {
      root = config.root
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null
      const publicDir = join(root, 'public')
      const warn = (message: string) => this.warn(message)
      const photos = await readImages(publicDir, 'photos', 'Ảnh cưới', warn)
      const [heroPhoto = null] = await readImages(publicDir, 'hero', 'Ảnh cô dâu và chú rể', warn)
      return `export const photos = ${JSON.stringify(photos)}\nexport const heroPhoto = ${JSON.stringify(heroPhoto)}\n`
    },
    configureServer(server) {
      const dirs = WATCHED_FOLDERS.map((folder) => join(root, 'public', 'assets', folder))
      server.watcher.add(dirs)
      const onChange = (file: string) => {
        if (!dirs.some((dir) => file.startsWith(dir))) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onChange).on('unlink', onChange).on('change', onChange)
    },
  }
}
