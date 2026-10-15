/**
 * Danh sách từ chưa phù hợp, so khớp theo TỪ NGUYÊN (không phải chuỗi con) sau khi hạ chữ thường.
 *
 * Giữ ở dạng một mảng chuỗi đơn giản vì apps-script/wishes.gs có bản sao
 * (`var PROFANITY = [...]`); `apps-script/wishes.test.ts` kiểm tra hai bản giống nhau.
 * Khi sửa danh sách, sửa cả hai nơi.
 *
 * Đây chỉ là lớp lọc đầu. Lời chúc vẫn có thể lọt, nên kiểm duyệt cuối cùng là đổi cột
 * `status` thành `hidden` ngay trên Google Sheet.
 */
export const PROFANITY_WORDS: readonly string[] = [
  "đm",
  "đmm",
  "đcm",
  "đcmm",
  "dm",
  "dmm",
  "dcm",
  "dcmm",
  "vcl",
  "vkl",
  "lồn",
  "cặc",
  "địt",
  "đụ",
  "đéo",
  "đĩ",
  "fuck",
  "shit",
  "bitch",
  "buồi",
];
