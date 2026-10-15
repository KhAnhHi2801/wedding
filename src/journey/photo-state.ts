/**
 * Độ hiện thực tế (0..1) của ảnh hero 3D ở khung hình vừa vẽ. Cảnh cổng ghi, cảnh vườn đọc để nhường chỗ cho ảnh (mặt
 * đất mờ đi khi ảnh hiện, vườn ngừng vẽ khi ảnh che kín). Một nguồn duy nhất thay vì mỗi cảnh tự đoán lại từ trạng thái
 * cổng: ảnh chưa tải xong hoặc không có ảnh thì giá trị là 0, vườn không bị mất nền.
 */
export const photoState = { opacity: 0 }

/**
 * Cầu nối giữa lớp HTML và cảnh đường ảnh 3D (canvas không nhận chạm vì nằm sau nội dung). Cảnh ghi `focus` mỗi khung
 * hình và gán `pick` khi khởi tạo; HTML gọi `pick` với toạ độ chạm đã chuẩn hóa. Chưa có cảnh thì `pick` trả null.
 */
export const photoPicker = {
  /** Chỉ số ảnh gần camera nhất, dùng cho nút "xem ảnh lớn". */
  focus: 0,
  /** Chỉ số ảnh trúng tia từ điểm chạm (ndc -1..1, y hướng lên), hoặc null. */
  pick: (_x: number, _y: number): number | null => null,
}
