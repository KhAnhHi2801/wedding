---
title: "Phase 7: Performance, QA, handover"
status: todo
priority: P1
effort: "0.75d"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Performance, QA, handover

## Overview

Đo, sửa, kiểm tra theo thiết bị giả lập và bàn giao checklist cho bước sau deploy. Cập nhật plan cũ để không ai thực hiện nhầm các phase đã bị thay thế.

## Requirements

- Functional: kiểm hết tiêu chí thành công ở `plan.md`; chạy được ở chế độ no-WebGL và reduced-motion.
- Non-functional: LCP, tải ban đầu, FPS, độ tương phản theo ngưỡng ở `plan.md`.

## Related Code Files

- Modify: `plans/261015-0913-wedding-website-3d/plan.md` (đánh dấu phase 3, 5, 6 bị thay thế bởi plan này), `README`/docs nếu có hướng dẫn thay ảnh
- Create: checklist máy thật sau deploy (trong thư mục plan)

## Implementation Steps

1. `npm run build` và đo kích thước chunk; kiểm không file ảnh > ~250KB.
2. Lighthouse mobile + throttle CPU 4x; ghi LCP, CLS, FPS cuộn.
3. Kiểm các chế độ: bình thường (3 tier chất lượng), no-WebGL, mất context WebGL, reduced-motion, JS tải chậm.
4. Duyệt tay: `?nha=trai`, `?nha=gai`, `?khach=<tên dài>`, không tham số.
5. Test với ít nhất 2 người thật (một người lớn tuổi) qua mạng LAN.
6. Cập nhật plan cũ; bàn giao checklist in-app Zalo/Facebook + 4G thật cho bước sau deploy.

## Success Criteria

- [ ] Mọi tiêu chí ở `plan.md` đạt hoặc ghi rõ lý do hoãn
- [ ] `npm run lint`, `npm run build` xanh (không chạy test: người dùng đã quyết định bỏ test)
- [ ] Plan cũ cập nhật; không còn mâu thuẫn giữa hai plan

## Risk Assessment

- Số đo trên máy dev không đại diện máy tầm trung → dùng throttle và ghi rõ giới hạn; kiểm máy thật sau deploy.
