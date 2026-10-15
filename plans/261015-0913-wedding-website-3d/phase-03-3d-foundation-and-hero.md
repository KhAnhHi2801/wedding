---
title: "Phase 3: Hero petals (CSS/SVG)"
status: in-progress
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 3: Hero petals (CSS/SVG)

## Overview

Hiệu ứng cánh hoa đào rơi ở hero, làm bằng SVG + CSS (quyết định D14).

Bản đầu dùng Three.js (hạt elip phẳng) bị người dùng nhận xét xấu và giả; một bản cánh hoa 3D thật bằng shader được viết rồi gỡ bỏ khi người dùng chọn hướng CSS/SVG vì nhẹ hơn khoảng 245KB gzip và chạy ổn hơn trong in-app browser.

## Requirements

- Functional: cánh hoa rơi chậm phủ lên ảnh hero, trông như cánh hoa thật (không phải hình elip phẳng); chữ, ảnh, nút hero vẫn là HTML.
- Non-functional: không chặn LCP, không cần WebGL, chỉ animate `transform` (GPU), tắt chuyển động khi `prefers-reduced-motion`, tạm dừng khi hero ra khỏi màn hình.

## Architecture

- `src/components/hero-petals.tsx` (`HeroPetals`): 30 cánh hoa đào, mỗi cánh có ba lớp chuyển động độc lập để không lặp máy móc: **rơi** (`translate3d`), **lắc ngang** (`translateX`, alternate), **nghiêng + xoay tròn** (`perspective + rotateX/Y/Z`). Chu kỳ, pha và chiều xoay lệch nhau theo từng cánh (bố cục sinh từ hạt giống cố định nên ổn định).
- Hình cánh: 3 dáng SVG `<symbol>` lấy từ ví dụ người dùng cung cấp (giọt thẳng mặt, thoi hẹp như đang nghiêng, cong như dấu phẩy), màu hồng tươi `#ffb7c5` đến `#ff758c`. Vẽ sẵn dáng nghiêng và cong nên cảm giác khối không phụ thuộc vào lật 3D mạnh. Ba bản đầu (hạt elip phẳng bằng Three.js, cánh hồng thon, cánh đào tròn khuyết) đều bị nhận xét là giả, giống lá hoặc giống trái tim.
- Chiều sâu: độ đậm và tốc độ rơi theo "độ sâu" (xa: nhạt và chậm), không dùng blur.
- Chữ trên ảnh: cánh hoa nằm trên scrim nhưng `mask-image` làm chúng mờ còn 30% khi rơi xuống vùng có chữ (từ khoảng 42% đến 66% chiều cao hero).
- Giảm chuyển động: `animation: none`, cánh đứng yên rải ở nửa trên (`--top`).
- Tự chạy ngay, **không có nút tạm dừng** (người dùng chốt). Chỉ tạm dừng tự động khi hero ra khỏi màn hình (`IntersectionObserver`) để tiết kiệm pin. Lưu ý: chuẩn WCAG 2.2.2 khuyến nghị có cách dừng cho hiệu ứng chạy quá 5 giây; đây là quyết định sản phẩm đã được ghi nhận, cài đặt "giảm chuyển động" của máy vẫn được tôn trọng.
- Hạ tầng 3D (Three.js/R3F) đã được viết rồi **gỡ bỏ** khi gallery chọn hướng sợi tơ hồng không cần WebGL (quyết định D14). Hook `useNearViewport` được giữ ở `src/hooks/use-near-viewport.ts`.

## Related Code Files

- Create: `src/components/hero-petals.tsx` (+ test), `src/hooks/use-near-viewport.ts`
- Modify: `src/sections/hero-section.tsx`, `src/styles/sections.css`, `scripts/generate-placeholders.mjs` (nhãn ảnh hero tạm không còn nằm dưới chữ lời mời)

## Implementation Steps

1. Dựng `HeroEffect` + CSS ba lớp chuyển động.
2. Chỉnh hình cánh, độ nhòe, góc lật, pha theo ảnh chụp thật trong Chrome (vòng lặp chụp, xem, chỉnh).
3. Kiểm tra chuyển động, tạm dừng khi cuộn đi, giảm chuyển động bằng Chrome thật.
4. (Đã gỡ hạ tầng 3D không dùng.)
5. Review và test độc lập: sửa thứ tự lớp (cánh hoa dưới scrim), `useNearViewport` đọc entry mới nhất, fallback `vh` cho trình duyệt chưa có `svh`, bỏ `will-change` và `blur(0)` thừa.


## Success Criteria

- [x] Cánh hoa trông như cánh hoa thật, có chiều sâu (đã xem ảnh chụp trong Chrome thật; cần người dùng xác nhận với ảnh cặp đôi thật)
- [x] Bundle ban đầu không chứa three/R3F (một file JS, 77KB gzip)
- [x] `prefers-reduced-motion` → cánh hoa đứng yên nhưng vẫn hiện (đã kiểm bằng Chrome thật)
- [x] Cuộn khỏi hero thì tạm dừng animation, quay lại thì chạy tiếp (đã kiểm bằng Chrome thật)
- [x] Không lỗi console; không tràn ngang (`scrollWidth` = 375 ở viewport 375px)
- [ ] Mượt trên điện thoại thật tầm trung (iOS Safari, Android, in-app Zalo/Facebook), đo ở phase 6
- [ ] Hiệu ứng nhìn rõ trên ảnh cặp đôi thật (hiện chỉ thấy trên ảnh tạm)

## Risk Assessment

- 30 phần tử, mỗi cái 3 lớp animate cùng lúc (chỉ transform): nhẹ với trình duyệt hiện đại, nhưng máy rất yếu có thể giật. Tín hiệu: fps thấp khi thử thiết bị thật → giảm `PETAL_COUNT` (vd. 18) hoặc bỏ lớp nghiêng 3 chiều ở máy yếu.
- Cánh hoa hồng tươi đi qua phía sau chữ trắng làm giảm tương phản: `mask-image` làm cánh hoa mờ còn 30% ở vùng có chữ, chữ có `text-shadow`, khi giảm chuyển động cánh hoa chỉ rải ở nửa trên. Cần xem lại với ảnh cặp đôi thật.
