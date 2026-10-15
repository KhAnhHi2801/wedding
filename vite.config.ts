import react from '@vitejs/plugin-react'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
// Có đuôi .ts vì file cấu hình Vite được nạp trực tiếp bởi Node, không qua bundler.
import { weddingConfig } from './src/config/wedding-config.ts'
import { readImages, weddingAssetsPlugin } from './vite-plugins/wedding-assets.ts'

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Chèn title, meta chia sẻ và preload ảnh hero vào index.html từ `wedding-config.ts`,
 * để không phải sửa dữ liệu cá nhân ở hai nơi. Trình xem trước link không chạy JS,
 * nên các thẻ này phải nằm trong HTML tĩnh.
 */
function weddingHtmlPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'wedding-html-from-config',
    configResolved(config) {
      root = config.root
    },
    async transformIndexHtml(html) {
      const { share } = weddingConfig
      // Ảnh hero là ảnh đầu tiên trong public/assets/hero (tên file tùy ý).
      const [heroPhoto] = await readImages(join(root, 'public'), 'hero', '')
      const absolute = (path: string) => (share.siteUrl ? new URL(path, share.siteUrl).href : path)
      const title = escapeAttr(share.title)
      const description = escapeAttr(share.description)
      const tags = [
        `<title>${title}</title>`,
        `<meta name="description" content="${description}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:locale" content="vi_VN" />`,
        `<meta property="og:title" content="${title}" />`,
        `<meta property="og:description" content="${description}" />`,
        `<meta property="og:image" content="${escapeAttr(absolute(share.image))}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
      ]
      // Ảnh hero là phần tử LCP.
      if (heroPhoto) {
        tags.push(`<link rel="preload" as="image" href="${escapeAttr(heroPhoto.src)}" fetchpriority="high" />`)
      }
      if (share.siteUrl) tags.push(`<meta property="og:url" content="${escapeAttr(share.siteUrl)}" />`)
      return html.replace('<!--site-meta-->', tags.join('\n    '))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), weddingAssetsPlugin(), weddingHtmlPlugin()],
  // Cổng cố định cho dự án này; báo lỗi thay vì tự nhảy sang cổng khác.
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  test: { include: ['src/**/*.test.{ts,tsx}', 'apps-script/**/*.test.ts', 'vite-plugins/**/*.test.ts'] },
})
