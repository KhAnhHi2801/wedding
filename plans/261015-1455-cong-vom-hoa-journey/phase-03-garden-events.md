---
title: "Phase 3: Scene 2 - Khu vườn và lịch trình"
status: todo
priority: P1
effort: "1.25d"
dependencies: [1]
---

# Phase 3: Scene 2 - Khu vườn và lịch trình

## Overview

Sau cổng là khu vườn buổi sáng dựng bằng Three.js: cỏ, hoa, lá đung đưa trong gió, nắng xuyên lá, hạt phấn bay. Lịch trình và bản đồ là HTML phủ lên, thẻ hình vòm.

## Requirements

- Functional: camera đi vào vườn theo đường cong; thẻ sự kiện theo `side` (`?nha=`); nút Chỉ đường và Xem bản đồ giữ nguyên.
- Non-functional: gió chạy trong vertex shader; số instance theo tier; giờ/địa chỉ ≥18px, vùng chạm ≥44px; thẻ HTML luôn đọc được kể cả khi 3D tắt.

## Architecture

- `src/journey/scenes/garden-scene.ts`: `InstancedMesh` cỏ/lá/hoa với `uTime` cho gió; ánh sáng hướng ấm + bán cầu; bụi phấn (`Points`); sương nhẹ (`Fog`) cho chiều sâu.
- `event-card.tsx` dùng `arch-frame` (CSS) làm đầu thẻ; nền thẻ mờ nhẹ để cảnh 3D thấy qua nhưng chữ vẫn tương phản AA.

## Related Code Files

- Create: `src/journey/scenes/garden-scene.ts`, `src/components/arch-frame.tsx`
- Modify: `src/components/event-card.tsx`, `src/sections/events-section.tsx`, `src/sections/sections.test.tsx`, `src/styles/sections.css`

## Implementation Steps

1. Dựng đồng cỏ/hoa instanced + gió; chỉnh theo tier.
2. Ánh sáng, sương, hạt phấn; khớp màu với `--tod` ban ngày.
3. Làm lại thẻ sự kiện hình vòm; giữ logic `?nha=`; cập nhật test.

## Success Criteria

- [ ] `?nha=trai|gai|sai|thiếu` đều hiện đúng sự kiện
- [ ] Từ màn hình đầu tới Chỉ đường ≤1 chạm
- [ ] Vườn ≥30fps ở tier trung (throttle 4x); tier thấp giảm mật độ nhưng vẫn đẹp
- [ ] Thẻ đạt tương phản AA trên nền cảnh

## Risk Assessment

- Cỏ/hoa nhiều làm tụt FPS → mật độ theo tier, cắt tỉa theo khoảng cách camera.
- Chữ khó đọc trên nền cảnh động → thẻ có nền đặc/mờ đủ dày, kiểm ở nhiều vị trí camera.
