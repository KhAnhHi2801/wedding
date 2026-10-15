type Listener = () => void

/**
 * Tiến độ hành trình dùng chung: hook cuộn ghi, engine 3D đọc mỗi khung hình. Là một đối tượng đơn giản chứ không
 * phải React state vì giá trị đổi mỗi khung hình khi cuộn và không được làm render lại cây React.
 */
export const journeyProgress = {
  /** Tiến độ cuộn đã làm mượt, 0..1. */
  value: 0,
  /** "Thời gian trong ngày" suy ra từ tiến độ, 0..1. */
  tod: 0,
  listeners: new Set<Listener>(),
  set(value: number, tod: number) {
    this.value = value
    this.tod = tod
    this.listeners.forEach((listener) => listener())
  },
  /** Đăng ký nhận thông báo mỗi lần giá trị đổi; trả về hàm hủy đăng ký. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  },
}
