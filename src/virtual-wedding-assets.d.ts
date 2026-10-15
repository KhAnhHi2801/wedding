declare module 'virtual:wedding-assets' {
  export interface AssetImage {
    src: string
    alt: string
    width: number
    height: number
  }
  /** Ảnh gallery, quét từ public/assets/photos theo thứ tự tên file. */
  export const photos: AssetImage[]
  /** Ảnh hero, ảnh đầu tiên trong public/assets/hero; null nếu thư mục trống. */
  export const heroPhoto: AssetImage | null
}
