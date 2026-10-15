/**
 * Độ hiện thực tế (0..1) của ảnh hero 3D ở khung hình vừa vẽ. Cảnh cổng ghi, cảnh vườn đọc để nhường chỗ cho ảnh (mặt
 * đất mờ đi khi ảnh hiện, vườn ngừng vẽ khi ảnh che kín). Một nguồn duy nhất thay vì mỗi cảnh tự đoán lại từ trạng thái
 * cổng: ảnh chưa tải xong hoặc không có ảnh thì giá trị là 0, vườn không bị mất nền.
 */
export const photoState = { opacity: 0 }
