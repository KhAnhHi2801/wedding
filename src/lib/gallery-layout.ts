export type GalleryMode = 'corridor' | 'thread'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export interface GalleryChoice {
  mode: GalleryMode
  /** Giảm chuyển động: vẫn dùng hành lang nhưng bỏ chuyển động tự động (cánh hoa bay, nhấp nhô). */
  calm: boolean
  /** Lý do chọn, hiện khi mở ?debug để biết vì sao một máy lại rơi vào phương án dự phòng. */
  reason: string
}

/**
 * Chọn kiểu gallery: hành lang 3D (WebGL) hoặc sợi tơ hồng (SVG, không cần WebGL).
 * Chỉ không có WebGL mới buộc dùng sợi tơ hồng. Khách bật giảm chuyển động vẫn có hành lang, ở bản yên tĩnh
 * (chuyển động chỉ do chính ngón tay cuộn điều khiển). Ép bằng ?gallery=thread|corridor khi thử.
 */
export function chooseGallery(env: { webgl: boolean; reducedMotion: boolean; search: string }): GalleryChoice {
  const forced = new URLSearchParams(env.search).get('gallery')
  const calm = env.reducedMotion
  if (forced === 'thread') return { mode: 'thread', calm, reason: 'ép bằng ?gallery=thread' }
  if (!env.webgl) return { mode: 'thread', calm, reason: 'trình duyệt không có WebGL' }
  return {
    mode: 'corridor',
    calm,
    reason: calm ? 'hành lang, bản yên tĩnh (đang bật giảm chuyển động)' : forced === 'corridor' ? 'ép bằng ?gallery=corridor' : 'hành lang',
  }
}

/** Kích thước khung ảnh trong không gian 3D: giữ đúng tỉ lệ ảnh và vừa trong hộp tối đa. */
export function fitPlane(aspect: number, maxWidth = 1.9, maxHeight = 2.4): { width: number; height: number } {
  if (!(aspect > 0)) return { width: maxWidth, height: maxHeight }
  let width = maxWidth
  let height = width / aspect
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspect
  }
  return { width, height }
}

/**
 * Khoảng cách camera để một ảnh phóng to vừa trọn màn hình: không rộng quá 92% bề ngang và không cao quá 74% bề dọc
 * (chừa chỗ cho nút ở trên và thanh lối tắt ở dưới). Màn hình dọc hẹp cần lùi xa hơn màn hình ngang.
 */
export function focusDistance(planeWidth: number, planeHeight: number, aspect: number, fovDeg: number, frame = 0.14): number {
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360)
  const byWidth = (planeWidth + frame) / (0.92 * 2 * tanHalf * aspect)
  const byHeight = (planeHeight + frame) / (0.74 * 2 * tanHalf)
  return Math.max(byWidth, byHeight, 1.4)
}

/** Độ lệch ngang của hai dãy ảnh so với trục hành lang: màn hình dọc hẹp thì kéo vào gần giữa để ảnh không bị cắt mép. */
export function corridorSpread(aspect: number): number {
  return clamp(1.9 * aspect, 0.95, 1.65)
}

/** Tổng chiều dài hành lang (đơn vị 3D) cho `count` ảnh cách nhau `spacing`, cộng đoạn đầu và đoạn cuối. */
export function corridorLength(count: number, spacing = 4.4): number {
  return Math.max(count - 1, 0) * spacing + 5
}

/** Chiều cao phần cuộn của khu gallery (đơn vị svh): mỗi ảnh được một đoạn cuộn, cộng một màn hình cho khung dính. */
export function corridorScrollHeightSvh(count: number): number {
  return Math.max(count, 1) * 75 + 100
}

/**
 * Tiến độ bay (0..1) theo vị trí cuộn: 0 khi khung dính vừa chạm đỉnh màn hình, 1 khi hết đoạn cuộn.
 * `top` là toạ độ đỉnh của vùng cuộn so với đỉnh viewport (getBoundingClientRect().top).
 */
export function flightProgress(top: number, sectionHeight: number, viewportHeight: number): number {
  const range = sectionHeight - viewportHeight
  if (range <= 0) return 0
  return clamp(-top / range, 0, 1)
}
