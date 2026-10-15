/**
 * Nguồn dữ liệu duy nhất cho nội dung cá nhân của đám cưới.
 * Mọi giá trị dưới đây là placeholder: sửa ở đây, và thay file cùng tên
 * trong `public/assets/` bằng ảnh/QR thật.
 */
// Có đuôi .ts: file này cũng được vite.config.ts nạp trực tiếp bởi Node.
import type { Side } from "../lib/url-params.ts";

export interface WeddingEvent {
  id: string;
  side: Side;
  title: string;
  /** Hiển thị nguyên văn, vd. "09:00". */
  time: string;
  /** Hiển thị nguyên văn, vd. "20/12/2026". */
  date: string;
  venue: string;
  address: string;
  /** Tùy chọn: link chỉ đường riêng; mặc định tạo từ `address`. */
  mapsUrl?: string;
  /** Tùy chọn: URL nhúng bản đồ riêng; mặc định tạo từ `address`. */
  mapsEmbedUrl?: string;
}

export interface BankAccount {
  bank: string;
  holder: string;
  /** Số tài khoản, có thể có khoảng trắng để dễ đọc; khi sao chép sẽ bỏ khoảng trắng. */
  number: string;
  /** Đường dẫn ảnh QR trong `public/assets/qr/`. */
  qrSrc: string;
}

export const weddingConfig = {
  couple: { bride: "Ngọc Khánh", groom: "Quốc Tuân" },
  dateLabel: "Thứ Bảy, 20 tháng 12, 2026",
  groupTitles: { trai: "Nhà trai", gai: "Nhà gái" } satisfies Record<
    Side,
    string
  >,
  events: [
    {
      id: "trai-thanh-hon",
      side: "trai",
      title: "Lễ thành hôn",
      time: "09:00",
      date: "20/12/2026",
      venue: "Tư gia nhà trai",
      address: "Số 12, đường Hoa Sữa, Quận 1, TP. Hồ Chí Minh",
    },
    {
      id: "trai-tiec-mung",
      side: "trai",
      title: "Tiệc mừng",
      time: "18:00",
      date: "20/12/2026",
      venue: "Nhà hàng Hoa Hồng",
      address: "Nhà hàng Hoa Hồng, Quận 3, TP. Hồ Chí Minh",
    },
    {
      id: "gai-vu-quy",
      side: "gai",
      title: "Lễ vu quy",
      time: "08:00",
      date: "19/12/2026",
      venue: "Tư gia nhà gái",
      address: "Số 34, đường Lê Lợi, TP. Đà Lạt, Lâm Đồng",
    },
  ] satisfies WeddingEvent[],
  gift: {
    bride: {
      bank: "Vietcombank",
      holder: "NGUYEN THI KHANH",
      number: "0123 456 789",
      qrSrc: "/assets/qr/bride-qr.webp",
    },
    groom: {
      bank: "Techcombank",
      holder: "TA QUOC TUAN",
      number: "9876 543 210",
      qrSrc: "/assets/qr/groom-qr.webp",
    },
  } satisfies { bride: BankAccount; groom: BankAccount },
  /** Đường dẫn nhạc nền trong `public/assets/music/`; null = không có nhạc, ẩn nút bật/tắt. */
  music: null as string | null,
  /**
   * Thông tin chia sẻ link (Zalo/Facebook). Được chèn vào HTML lúc build vì trình xem trước
   * link không chạy JavaScript.
   */
  share: {
    /** Địa chỉ website sau khi deploy, vd. 'https://ten-mien.vn'. Bỏ trống đến khi deploy:
     *  ảnh xem trước (og:image) cần địa chỉ tuyệt đối nên chỉ hoạt động khi đã điền. */
    siteUrl: "",
    image: "/assets/share/og-image.jpg",
    title: "Ngọc Khánh & Quốc Tuân · Thiệp cưới",
    description: "Trân trọng kính mời bạn đến chung vui cùng chúng mình.",
  },
};
