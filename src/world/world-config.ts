/**
 * Hằng số điều chỉnh cảm giác chuyển động và màu cảnh. Đổi ở đây, không rải số trong vòng render.
 * Màu theo design-system (plans/261016-1134-3d-website-ai-workflow/design-system.md).
 */
export const WORLD = {
  /** Độ "trôi" của camera theo cuộn: số nhỏ thì chậm và mượt hơn (đơn vị 1/giây). */
  progressDamping: 3,
  /** Độ trễ khi camera lệch theo chuột/con quay. */
  pointerDamping: 4,
  /** Biên độ lệch camera theo con trỏ (đơn vị thế giới). Giữ nhỏ để không gây chóng mặt. */
  pointerAmplitude: { x: 0.5, y: 0.28 },
  /** Chênh lệch tiến độ/con trỏ nhỏ hơn mức này thì coi như đứng yên (không cần vẽ lại). */
  restEpsilon: 0.0002,
  /** Khung hình dọc (điện thoại) co giãn dần theo tỉ lệ màn hình trong khoảng này. */
  aspectRange: { portrait: 0.5, landscape: 1.2 },
  /** FOV dọc: màn ngang, màn dọc. Màn dọc kéo camera lùi thêm để cặp đôi không bị cắt. */
  fov: { landscape: 38, portrait: 46 },
  distanceScale: { landscape: 1, portrait: 1 },
  /** Đẩy điểm nhìn lên ở màn dọc để cảnh dịch xuống dưới, chừa chỗ cho chữ phía trên. */
  portraitLookLift: 1.6,
  camera: { near: 0.1, far: 80 },
  colors: {
    paper: '#f7fbf8',
    mint100: '#ddf1e8',
    mint200: '#bfe6d3',
    mint300: '#a9dcc6',
    ink: '#1f3d36',
    blush: '#f4c9d2',
    cream: '#fff6e5',
  },
} as const

/** Ảnh tách nền đã nén và nướng viền giấy bởi `npm run optimize:images -- cutouts`. */
export const COUPLE_CUTOUT_URL = '/assets/cutouts/couple.webp'

/** Lề quanh hình giấy đã nướng, tính theo chiều cao hình gốc. Phải khớp `PAPER_PAD_RATIO` trong scripts/lib/paper-bake.mjs. */
export const PAPER_PAD_RATIO = 0.04
