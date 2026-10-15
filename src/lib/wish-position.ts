/** FNV-1a 32 bit: băm id lời chúc thành số ổn định giữa các lần tải trang (dùng để gắn lời chúc vào ảnh). */
export function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
