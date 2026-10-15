---
title: "Phase 4: Photo gallery 3D"
status: todo
priority: P2
effort: "1d"
dependencies: [3]
---

# Phase 4: Photo gallery 3D

## Overview

Gallery ảnh cưới xếp cong trong không gian 3D, vuốt ngang để xoay, kèm pipeline tối ưu ảnh và fallback carousel/lưới HTML.

## Requirements

- Functional: 8-12 ảnh xếp cung tròn/trụ; vuốt ngang xoay có quán tính; ảnh trung tâm rõ nhất; **chạm ảnh → trình xem toàn màn hình** (HTML) vuốt qua lại giữa các ảnh; gợi ý "Vuốt để xem" hiện ở lần đầu rồi ẩn sau tương tác đầu tiên.
- Non-functional: cuộn dọc trang không bị chặn (`touch-action: pan-y` trên canvas); ngân sách texture ~≤70MB GPU; mỗi ảnh ≤ ~120KB trên mạng.

## Architecture

- Dùng lại `scripts/optimize-images.mjs` từ phase 1 cho ảnh gallery (không viết script mới); ảnh đọc từ `public/assets/photos/` theo danh sách trong config.
- Mở rộng `scripts/optimize-images.mjs` cho gallery: xuất thêm bản 768px (tier thấp) và blur placeholder nhỏ cho fallback/lúc chờ tải (hai phần này được chuyển từ phase 1 vì chỉ gallery dùng).
- `photo-viewer.tsx`: trình xem toàn màn hình bằng HTML (`dialog`, `object-fit: contain`, vuốt trái/phải, nút đóng ≥44px, Esc, trả focus về ảnh đã chạm, khóa cuộn nền). Dùng chung cho cả gallery 3D và fallback. Phân biệt chạm với kéo xoay bằng ngưỡng di chuyển (chạm = di chuyển < ~8px).
- `src/3d/gallery-scene.tsx`: mặt phẳng ảnh đặt theo cung; `useTexture` chỉ khi section gần viewport; `anisotropy` thấp, bật mipmap; xoay bằng pointer events + damping (không dùng OrbitControls để tránh chiếm cuộn dọc).
- Danh sách ảnh và alt text trong `wedding-config.ts` (một nguồn dữ liệu cho cả 3D và fallback).
- Fallback `gallery-fallback.tsx`: carousel `scroll-snap` ngang với `<img loading="lazy">` cùng ảnh đã tối ưu; dùng khi tier `none`, reduced-motion hoặc lỗi tải texture.

## Related Code Files

- Create: `src/3d/gallery-scene.tsx`, `src/components/gallery-fallback.tsx`, `src/components/gallery-section.tsx`, `src/components/photo-viewer.tsx`
- Modify: `src/config/wedding-config.ts` (danh sách ảnh + alt)

## Implementation Steps

1. Chạy script tối ưu ảnh (phase 1) với ảnh gallery placeholder, ghi lại dung lượng.
2. Viết fallback carousel trước (luôn dùng được), rồi scene 3D.
3. Layout cung + xoay có quán tính; giới hạn tốc độ; snap về ảnh gần nhất khi thả.
4. Lazy-load texture theo khoảng cách tới viewport; dispose khi unmount.
5. Viết `photo-viewer` + gợi ý "Vuốt để xem"; nối chạm ảnh (raycast) mở viewer đúng ảnh.
6. Kiểm tra cuộn dọc khi chạm vào canvas trên iOS Safari và Android.

## Success Criteria

- [ ] Tổng dung lượng ảnh gallery ≤ ~1.2MB (12 ảnh); không tải khi chưa gần viewport
- [ ] Vuốt ngang xoay, vuốt dọc vẫn cuộn trang
- [ ] iOS Safari không mất context khi cuộn qua lại gallery
- [ ] Tier `none`/reduced-motion hiển thị carousel đủ ảnh, có alt text
- [ ] ≥30fps khi xoay trên máy thật
- [ ] Chạm ảnh mở trình xem toàn màn hình đúng ảnh (cả 3D và fallback); kéo xoay không mở nhầm
- [ ] Viewer đóng được bằng nút/Esc, trả focus đúng chỗ; gợi ý vuốt ẩn sau lần tương tác đầu

## Risk Assessment

- Texture lớn làm iOS mất WebGL context → cấp độ 768px cho tier low; tín hiệu: context lost → hạ kích thước hoặc giảm số ảnh cùng lúc trong cảnh (chỉ giữ ảnh gần trung tâm).
- Cử chỉ vuốt xung đột với cuộn dọc → `touch-action: pan-y` + ngưỡng nhận hướng; tín hiệu: người dùng test không cuộn qua được → bỏ xoay bằng kéo, chuyển sang xoay theo vị trí cuộn.
- Ảnh gốc riêng tư/nặng không nên vào repo.
