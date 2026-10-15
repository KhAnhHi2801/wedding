/**
 * Đoạn cuộn "bước vào vườn": khoảng trống trong suốt, không có chữ, để khách có thời gian nhìn khu vườn 3D phía sau
 * khi camera đi qua cổng vòm hoa đầu tiên, trước khi tới thẻ lịch trình. Chỉ có chiều cao khi cảnh 3D chạy (CSS).
 */
export function GardenWalk() {
  return <div className="garden-walk" aria-hidden="true" />
}
