---
title: "Phase 5: Wish sky 3D"
status: todo
priority: P1
effort: "1.5d"
dependencies: [2, 3]
---

# Phase 5: Wish sky 3D

## Overview

Bầu trời hoàng hôn pastel với cánh hoa/đèn lồng phát sáng bay lơ lửng, mỗi lời chúc là một đối tượng; chạm để đọc. Lời chúc mới bay lên ngay sau khi gửi. Ghép với form/list của phase 2.

## Requirements

- Functional:
  - Hiển thị ~60-100 lời chúc mới nhất trên màn hình cùng lúc (đủ thưa để chạm trúng trên màn 360px); danh sách HTML (phase 2) là nơi đọc đầy đủ và phân trang.
  - **Tự hiện lời chúc:** cứ ~5s một đèn lồng sáng lên và thẻ của nó tự hiện, để khách đọc thụ động không cần chạm; dừng khi khách đang tương tác, khi section ra khỏi viewport, hoặc khi reduced-motion.
  - Chạm một đèn lồng → thẻ HTML hiện tên + nội dung.
  - Gửi lời chúc qua bottom sheet (D8, phase 2) phủ lên bầu trời; sheet đóng → đèn lồng của khách bay lên trong tầm nhìn, được làm nổi bật và thẻ của nó tự hiện.
- Non-functional: một `InstancedMesh` duy nhất; vị trí ổn định theo `id` (không nhảy khi tải lại); ≥30fps; truy cập được qua bàn phím/screen reader nhờ danh sách HTML.

## Architecture

- `src/3d/wish-sky-scene.tsx`: `InstancedMesh` (mặt phẳng hoặc hình cầu thấp poly với shader phát sáng); thuộc tính theo instance: vị trí gốc (hash từ `id` → phân bố trong thể tích nhìn thấy), pha, tốc độ, màu (chọn từ palette theo hash); chuyển động trôi nhẹ trong vertex shader (`uTime`), không cập nhật ma trận trên CPU mỗi frame.
- Chọn đối tượng: raycaster trên instanced mesh (≤100, chi phí nhỏ) chỉ chạy khi chạm (không chạy mỗi frame); mở `wish-card.tsx` (HTML, định vị cố định ở đáy hoặc giữa, đóng bằng chạm ngoài/nút).
- Lời chúc mới: thêm vào đầu danh sách, đối tượng mới có `uBirth` để shader nội suy từ đáy màn hình (nơi sheet vừa đóng) lên bầu trời; trước khi animation chạy, section bầu trời phải nằm trong viewport (cuộn tới nếu cần); vượt trần thì bỏ lời chúc cũ nhất khỏi cảnh (vẫn còn trong danh sách HTML).
- **Nền (D7):** vùng tối hơn bằng CSS gradient hồng đất → tím hoàng hôn (thuộc phần 30% của palette), chuyển tiếp mềm từ/tới nền kem ở đầu và cuối section; canvas trong suốt, `aria-hidden`. Chỉ ở vùng này mới dùng hiệu ứng phát sáng (additive blending được phép vì nền đủ tối); chữ trong section đạt tương phản AA trên nền tối.
- Thẻ lời chúc (`wish-card.tsx`) là `dialog` không chặn: đóng bằng nút/chạm ngoài/Esc, trả focus về chỗ cũ; thẻ tự hiện không lấy focus (chỉ `aria-live="polite"`).
- Mật độ: buffer cấp phát theo trần ~100; vùng chạm tối thiểu ~44px quy đổi ra bán kính raycast.
- Fallback tier `none`/reduced-motion: chỉ hiển thị `wish-list` HTML (D4), không canvas.

## Related Code Files

- Create: `src/3d/wish-sky-scene.tsx`, `src/3d/wish-sky-shaders.ts`, `src/3d/wish-position.ts` (hash → vị trí, có test), `src/components/wish-card.tsx`, `src/components/wish-sky-section.tsx`
- Modify: `src/hooks/use-wishes.ts` (cung cấp lời chúc mới nhất cho cảnh + sự kiện "vừa gửi"), `src/sections/` (ghép sky + form + list)

## Implementation Steps

1. Viết `wish-position.ts` (hash ổn định, phân bố đều, tránh chồng chéo quá mức) + test tính xác định.
2. Viết shader + instanced mesh; thử với 100 dữ liệu giả để đo fps và thử chạm trên máy thật trước khi nối dữ liệu thật.
3. Nối `use-wishes`; xử lý tăng/giảm số lượng instance (cấp phát buffer cố định theo trần, `count` thay đổi).
4. Raycast khi chạm + `wish-card` + đóng; bảo đảm cuộn dọc không bị chặn.
5. Nối bottom sheet → animation bay lên trong tầm nhìn + tự hiện thẻ của khách; kiểm tra optimistic rollback không để lại "ma".
6. Chế độ tự hiện lời chúc (dừng khi tương tác/ra viewport/reduced-motion).
7. Ghép tier/fallback; kiểm tra a11y: danh sách HTML đọc được, thẻ là dialog đúng chuẩn, `aria-live` cho thẻ tự hiện.

## Success Criteria

- [ ] Đúng một draw call chính cho toàn bộ lời chúc
- [ ] 100 lời chúc: ≥30fps trên máy thật tầm trung (iOS Safari, Android, Zalo/FB in-app)
- [ ] Đèn lồng nhìn thấy rõ trên ảnh chụp màn hình thật; chữ trong section đạt AA
- [ ] Chạm trúng đèn lồng trên màn 360px không cần thử lại nhiều lần; vị trí ổn định khi tải lại
- [ ] Gửi lời chúc → sheet đóng, khách thấy đèn lồng của mình bay lên mà không phải cuộn; lỗi gửi → biến mất, báo lỗi
- [ ] Thẻ tự hiện xoay vòng, dừng khi tương tác hoặc reduced-motion
- [ ] Tier `none`: chỉ còn danh sách HTML, vẫn gửi/đọc được

## Risk Assessment

- Chồng chéo/khó chạm trên màn hình nhỏ → vùng chạm tối thiểu ~44px, tăng bán kính raycast ở tier low; tín hiệu: người test không chọn được đối tượng → giảm mật độ hoặc thêm bước phóng to khi chạm vùng gần.
- Hiệu năng xuống dưới ngưỡng khi có blending → giảm trần (vd. 60), tắt additive blending ở tier low.
- Thẻ tự hiện gây phiền hoặc che nội dung → nhỏ, ở vị trí cố định, dừng ngay khi khách chạm/cuộn; tín hiệu: người test phàn nàn → tăng chu kỳ hoặc tắt mặc định.
- Dữ liệu từ Sheet không đáng tin → chỉ hiển thị dưới dạng text; cắt độ dài khi vẽ thẻ.
