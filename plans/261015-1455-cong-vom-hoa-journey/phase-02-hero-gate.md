---
title: "Phase 2: Scene 1 - Cổng vòm hoa 3D"
status: todo
priority: P1
effort: "1.25d"
dependencies: [1]
---

# Phase 2: Scene 1 - Cổng vòm hoa 3D

## Overview

Khoảnh khắc "wow" đầu tiên bằng Three.js: cổng vòm hoa 3D đóng kín kèm lời mời mang tên khách; mở ra thì hoa nở, ảnh cặp đôi hiện ở phía sau, camera bước xuyên cổng.

## Requirements

- Functional: cổng dựng thủ tục (khung vòm, hoa, lá instanced); tên khách và tên cô dâu chú rể trên cổng; mở bằng chạm/cuộn/tự mở ~2.5s; nút "Bỏ qua" và "Xem thời gian & địa điểm" luôn thấy; ảnh hero là mặt phẳng texture sau cổng.
- Non-functional: cảnh 1 dựng ngay, ≤ ~300KB mã + asset thêm; ảnh hero ưu tiên tải; HTML hero (ảnh + tên + nút) hiện trước khi 3D sẵn sàng; không dịch layout; reduced-motion → cổng đã mở, không animation.

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
- [ ] Trước khi 3D sẵn sàng, hero HTML hiện ngay; chuyển sang 3D không giật hình
- [ ] LCP < ~2.5s trên 4G giả lập, CLS ≈ 0
- [ ] Người dùng duyệt hình cổng

## Risk Assessment

- Hoa instanced nhìn "nhựa" hoặc rối → thêm biến thiên màu/kích cỡ, ánh sáng bán cầu, chỉ vài dạng cánh hoa; cho người dùng duyệt sớm trước khi tinh chỉnh.
- Nếu chất lượng hoa thủ tục không đạt: dùng texture cành hoa chụp từ ảnh (sprite) thay vì hình khối.
