/**
 * Ảnh gallery và ảnh hero được quét từ thư mục (xem vite-plugins/wedding-assets.ts), không liệt kê trong config:
 *   public/assets/photos/   thả ảnh vào đây, tên file tùy ý, hiện theo thứ tự tên
 *   public/assets/hero/     ảnh đầu tiên trong thư mục là ảnh hero
 */
export { heroPhoto, photos } from 'virtual:wedding-assets'
export type { AssetImage } from 'virtual:wedding-assets'
