---
title: "Phase 2: Scene 1 - Cổng vòm hoa 3D"
status: in-progress
priority: P1
effort: "1.25d"
dependencies: [1]
---

# Phase 2: Scene 1 - Cổng vòm hoa 3D

## Overview

Khoảnh khắc "wow" đầu tiên bằng Three.js: cổng vòm hoa 3D đóng kín kèm lời mời mang tên khách; mở ra thì hoa nở, ảnh cặp đôi hiện ở phía sau, camera bước xuyên cổng.

## Requirements

- Functional: cổng dựng thủ tục (khung vòm, hoa, lá instanced); tên khách và tên cô dâu chú rể trên cổng; mở bằng chạm/cuộn/tự mở ~2.5s; nút "Bỏ qua" và "Xem thời gian & địa điểm" luôn thấy; ảnh hero là mặt phẳng texture sau cổng.
- Non-functional: cảnh 1 dựng ngay, ≤ ~300KB mã + asset thêm; **cổng là thứ đầu tiên khách thấy và nội dung website chỉ hiện sau khi cổng mở xong** (trong lúc chờ/đóng/đang mở: chỉ có cổng + tấm lời mời, các section, thanh lối tắt, nút nhạc ẩn và trang không cuộn); không có 3D (không WebGL, reduced-motion, lỗi, quá 12s chưa có khung đầu) → hero HTML đầy đủ như cũ; không dịch layout.

## Architecture

- `src/journey/scenes/gate-scene.ts` (implements `SceneModule`): khung vòm bằng `TubeGeometry`/`ExtrudeGeometry`; hoa = `InstancedMesh` cánh hoa đơn giản, thuộc tính theo instance (pha nở, kích thước); vertex shader nội suy `uOpen` để nở và hé cổng.
- Tên khách: `CanvasTexture` vẽ chữ, gắn lên bảng nhỏ trên cổng.
- Camera dolly: đoạn đầu của đường cong, easing theo `uOpen`.
- Cánh hoa rơi: `Points`/`InstancedMesh` với chuyển động trong shader (không cập nhật CPU).
- HTML hero giữ ảnh LCP (`fetchPriority="high"`) và là fallback.

## Related Code Files

- Create: `src/journey/scenes/gate-scene.ts`, `src/journey/shaders/petal.ts` (+ test cho logic mở cổng/tự mở)
- Modify: `src/sections/hero-section.tsx`, `src/components/hero-petals.tsx` (có thể gỡ nếu cảnh thay thế), `src/styles/sections.css`

## Implementation Steps

1. Dựng khung vòm và bố cục hoa theo ảnh cổng trong bộ ảnh; duyệt hình với người dùng (ảnh chụp màn hình).
2. Shader nở hoa + hé cổng; máy trạng thái `closed | opening | open`; tự mở và bỏ qua.
3. Tên khách (texture), camera dolly, ghép ảnh hero phía sau.
4. Kiểm LCP/CLS, reduced-motion, mất context.

## Success Criteria

- [ ] Cổng mở được bằng cả 3 cách, không bao giờ kẹt ở trạng thái đóng
- [x] Khi sẽ chạy 3D: cổng hiện trước, ảnh và nội dung chỉ lộ sau khi cổng mở xong (đã thay tiêu chí cũ "hero HTML hiện ngay trước khi 3D sẵn sàng" theo yêu cầu của người dùng); 3D lỗi/quá 12s (chỉ tính lúc tab hiển thị) → bản HTML đầy đủ
- [ ] LCP < ~2.5s trên 4G giả lập, CLS ≈ 0
- [ ] Người dùng duyệt hình cổng

## Risk Assessment

- Hoa instanced nhìn "nhựa" hoặc rối → thêm biến thiên màu/kích cỡ, ánh sáng bán cầu, chỉ vài dạng cánh hoa; cho người dùng duyệt sớm trước khi tinh chỉnh.
- Nếu chất lượng hoa thủ tục không đạt: dùng texture cành hoa chụp từ ảnh (sprite) thay vì hình khối.

## Kết quả thực hiện

- Đã làm: cổng vòm hoa 3D (khung, hai cánh, hoa/lá instanced, ảnh phủ kín màn hình mờ dần khi cuộn), máy trạng thái `loading → closed → opening → open` (`gate-state.ts`, ghi `data-gate` lên `<html>` để CSS ẩn cả trang), tấm lời mời hình vòm, nút "Mở thiệp", mở bằng chạm/lăn chuột/vuốt/phím xuống/tự mở sau 2,5s, khóa cuộn trước khi mở xong, nội dung hiện dần sau khi mở.
- Đã sửa theo review: hạn chờ 3D chỉ tính lúc tab hiển thị; ảnh ẩn tới khi texture tải xong; ảnh lùi ra sau để đầu cánh cổng không cắm vào; tải texture lên GPU sớm; nhả bộ nhớ cổng ngay khi gỡ; nút bị khóa khi đang mở; bố cục điện thoại nằm ngang.
- Còn lại: đo FPS và cảm nhận hiệu ứng trên điện thoại thật (phase 7); kiểm tra Zalo/Facebook in-app sau khi deploy; chưa thử màn rất rộng (>1600px).
- Chỉnh theo phản hồi của người dùng: (1) nội dung website chỉ hiện sau khi cổng mở hẳn; (2) ảnh cặp đôi hoàn toàn ẩn cho tới khi cổng gỡ xong, rồi hiện dần (trước đó để mờ 10% và sáng dần ngay khi cánh xoay nên lộ sớm); (3) cổng lấp đầy chiều cao màn hình, kích thước (bán kính vòm, chiều cao trụ, số hoa) tính theo tỉ lệ màn hình qua `gateDims`; (4) thêm khoảng đệm cho tấm lời mời để chữ không chạm đường bo.
- Người dùng yêu cầu bỏ qua việc viết/chạy test từ giữa phase này: các test đã có không được chạy lại sau lần viết lại `gate-scene.ts`/`gateDims`; `tsc`, `lint`, `build` vẫn xanh. Cần chạy lại bộ test trước khi commit/đóng phase.
- Trạng thái: chờ người dùng xem và duyệt hình cổng.
