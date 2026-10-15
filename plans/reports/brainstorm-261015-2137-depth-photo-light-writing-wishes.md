# Brainstorm: Ảnh có chiều sâu + lời chúc viết bằng ánh sáng

Date: 2026-10-15 | Status: chờ duyệt thiết kế

## Vấn đề

- Phần ảnh (420svh) + lời chúc (300svh) > 720svh cuộn, mỗi bước chỉ 1 ảnh mờ dần: mệt, nhàm.
- Lời chúc là chấm sáng nhỏ, khách phải đoán chạm: người lớn tuổi không biết.
- Ảnh (ban ngày) và lời chúc (hoàng hôn) là hai cảnh rời, không liên quan.
- User chê các ý tưởng đèn lồng / sách / sông / cây là cũ rích → cần ý tưởng riêng của Three.js.

## Yêu cầu chốt

- Output: một cảnh ghim duy nhất cho ảnh + lời chúc; mỗi ảnh tách lớp có chiều sâu; lời chúc là chữ phát sáng nằm trong không gian ảnh.
- Acceptance:
  - Cuộn tổng phần ảnh + lời chúc ≤ ~300svh (hiện >720svh).
  - Khách không cần chạm vẫn đọc được lời chúc; có nút "Lời chúc khác" ≥48px.
  - Chữ lời chúc ≥16px, tương phản AA; đọc được bằng trình đọc màn hình (chữ nằm ở HTML).
  - Gửi lời chúc xong: lời của khách được viết lên ảnh đang xem ngay.
  - ≥30fps tier trung; tier thấp tự giảm hiệu ứng.
- Ngoài phạm vi: backend/Sheet lời chúc, nhạc, deploy, cổng đầu + vườn + phase 6.
- Ràng buộc: một WebGL context; fallback HTML (lưới ảnh + danh sách) giữ nguyên; không viết/chạy test (quyết định trước đó); đạt `tsc`, lint, build.

## Thiết kế

### Ảnh 3 lớp
- Nền (ảnh gốc, hơi mờ + trôi chậm) → cặp đôi (cắt viền, có bóng đổ + viền sáng nhẹ) → cánh hoa/bụi sáng phía trước.
- Cuộn hoặc nghiêng điện thoại (tùy chọn): các lớp lệch nhau (parallax) tạo chiều sâu thật.
- Chuyển ảnh: lớp cặp đôi tan thành bụi sáng rồi tụ lại thành ảnh kế (shader dissolve + particles GPU). Tier thấp: crossfade.

### Lời chúc trong không gian ảnh (A+B)
- Chữ lơ lửng giữa lớp nền và lớp cặp đôi → bị cô dâu/váy che một phần (che khuất thật nhờ thứ tự lớp).
- Mỗi lời chúc được "viết" từng nét bằng ánh sáng (đầu nét là tia lửa, nét cũ ở lại phát sáng rồi tan thành bụi). Dự phòng nếu dựng nét theo outline khó (chữ có dấu): hiện chữ dần bằng mặt nạ nhiễu.
- Mỗi ảnh hiện tối đa 3 lời chúc xoay vòng ~5s; thẻ chữ HTML dưới ảnh luôn có bản đọc được, kèm nút ‹ Lời chúc khác ›.
- Ảnh chưa có lời chúc: "Hãy là người đầu tiên chúc ở khoảnh khắc này" + nút gửi.
- Gắn lời chúc → ảnh: `hash(id) % số ảnh` (ổn định khi tải lại). Lời chúc vừa gửi thì gắn vào ảnh đang xem trong phiên đó.

### Cuộn
- Một khung ghim ~300svh: 8 ảnh × ~30svh + đệm. Snap theo ảnh; nút ‹ › dự phòng cho ai không muốn cuộn.
- Trời đổi dần từ chiều → hoàng hôn theo chỉ số ảnh (ảnh 1 nắng chiều, ảnh 8 ánh đèn), thay cho hai cảnh riêng. Cảnh dây đèn `dusk-scene` bị gộp/bỏ.
- Sau ảnh cuối: danh sách lời chúc HTML phủ lên như tấm màn (giữ như hiện tại).

### Tài sản ảnh
- Tách nền bằng `rmbg` (cục bộ, ~3s/ảnh): `briaai` cho ảnh 02–08; `modnet` cho ảnh 01 (briaai giữ cả vòm hoa).
- Xuất WebP có alpha, ~60–160KB/ảnh, ~0.7MB tổng, để trong `public/assets/photos-cutout/` (ngoài `assets-src/` gốc). Nguồn gốc giữ nguyên.
- Spike đã làm: 7/8 sạch ngay; vài mảng lá nhỏ dính ở chân ảnh 05, 08 (cần lọc). Ảnh 01 modnet ổn ở cỡ xem nhanh, cần soi viền tóc/voan phóng to.

## Phương án đã cân nhắc

| Phương án | Kết luận |
|---|---|
| Sổ lưu bút pop-up 3D | Dễ dùng nhất nhưng là ý quen thuộc; 3 ngày |
| Dòng sông hoa đăng | Đẹp nhưng lời chúc vẫn nhỏ, phản chiếu tốn FPS |
| Cây ước nguyện | Đắt nhất, lời chúc vẫn nhỏ, user chê cũ |
| Cửa sổ vòm kính màu | Dự phòng nếu cắt viền không đạt; không cần cắt ảnh |
| Quả cầu pha lê, Polaroid vật lý | Loại: lặp / không mở rộng được với nhiều lời chúc |
| **A+B: ảnh chiều sâu + viết bằng ánh sáng** | **Chọn** |

## Chạm vào mã hiện có

- Thay/gộp: `src/journey/scenes/photo-path-scene.ts`, `dusk-scene.ts`, `src/journey/shaders/*`.
- Sửa: `src/sections/photos-section.tsx`, `wishes-section.tsx`, `src/hooks/use-time-of-day.ts` (mốc cuộn), `src/journey/wish-lights-state.ts`, `src/components/wish-light-card.tsx`, `src/styles/sections.css`, `start-journey.ts`.
- Giữ: `use-wishes`, `wishes-api`, bản dự phòng HTML (lưới ảnh, `wish-sky.tsx`, `wish-list.tsx`), gate/garden.
- Bỏ khi làm: thay đổi chưa commit "tự chọn bóng đèn trong tầm nhìn" (`nextVisible`), không còn dùng.

## Rủi ro

- Viền tóc/voan có quầng sáng khi ghép lên nền khác → phủ viền mềm + giảm đồ tương phản nền; kiểm từng ảnh.
- Dựng nét chữ có dấu tiếng Việt phức tạp → có dự phòng mặt nạ nhiễu.
- Particles + dissolve nặng máy yếu → tier thấp crossfade, giảm số hạt.
- Cuộn snap kèm cuộn trang có thể xung đột trên iOS → thử trên máy thật.
- Ảnh cắt tăng ~0.7MB: chỉ nạp theo gần/xa, không vào gói đầu.
- Cảnh viết lại lớn: ước ~2.5–3 ngày.

## Tiêu chí thành công

- Phần ảnh + lời chúc ≤ ~300svh; ≥30fps (throttle 4x, tier trung).
- Khách đọc được lời chúc mà không chạm; ≥2 người thật (có người lớn tuổi) gửi và tìm thấy lời của mình không cần hướng dẫn.
- Lời chúc vừa gửi hiện trên ảnh ngay trong ≤3s.
- Fallback: không WebGL / giảm chuyển động vẫn xem được toàn bộ ảnh + lời chúc.

## Câu hỏi còn mở

- Ảnh 01 modnet: viền tóc/voan phóng to đã đạt chưa? (soi trước khi làm)
- Nghiêng điện thoại (cảm biến) có đưa vào bản đầu không? (iOS cần xin quyền; mặc định chưa)
- Mỗi ảnh tối đa mấy lời chúc? (đề xuất 3 xoay vòng)
