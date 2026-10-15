---
title: "Phase 4: Scene 3 - Con đường ảnh khung vòm"
status: in-progress
priority: P1
effort: "1.25d"
dependencies: [1]
---

# Phase 4: Scene 3 - Con đường ảnh khung vòm

## Overview

Gộp hành lang ảnh hiện có (`corridor-scene.ts`) vào journey chung: ảnh thật trong khung vòm treo dọc con đường, camera lướt qua. Rút chiều dài từ ~6.500px xuống ~2,5 màn hình.

## Requirements

- Functional: ≤8 ảnh, mỗi ảnh là mặt phẳng hình vòm có viền; chạm ảnh để phóng to (trình xem toàn màn hình đã có); "Xem tất cả ảnh" mở lưới.
- Non-functional: texture WebP ≤1024px, giải phóng khi rời cảnh; phần ảnh ≤ ~25% chiều dài trang; ảnh đứng và ngang đều thấy đủ mặt người.

## Architecture

- `src/journey/scenes/photo-path-scene.ts`: chuyển logic từ `src/gallery/corridor-scene.ts`; hình vòm bằng `ShapeGeometry` (hình chữ nhật đầu bán nguyệt) + texture; `object-position` theo ảnh để không cắt mặt.
- Raycast chỉ chạy khi chạm (không mỗi frame); focus camera lao tới ảnh đã có.
- Fallback HTML (K5): lưới/carousel khung vòm; thay `thread-gallery.tsx` (sợi tơ hồng).

## Related Code Files

- Create: `src/journey/scenes/photo-path-scene.ts`
- Modify: `src/sections/photos-section.tsx`, `src/components/photo-viewer.tsx`, `src/lib/gallery-layout.ts`
- Delete sau khi gộp: `src/gallery/corridor-scene.ts`, `src/components/photo-corridor.tsx`, `src/sections/thread-gallery.tsx`, `src/hooks/use-red-thread.ts`, `src/lib/thread-path.ts` (chỉ khi không còn dùng)

## Implementation Steps

1. Đo hiện trạng (chiều dài, FPS, chunk) làm số liệu gốc.
2. Chuyển sang scene module; đổi sang khung vòm; rút khoảng cách/độ dài.
3. Viết fallback carousel khung vòm; cập nhật test `photo-viewer.test.tsx`, layout.
4. So số liệu sau với số liệu gốc.

## Success Criteria

- [ ] Phần ảnh ≤ ~25% chiều dài trang; ≥30fps (throttle 4x)
- [x] Chạm ảnh phóng to hoạt động (đã thử bằng chuột thật trong trình duyệt headless); fallback lưới vòm dùng được
- [x] Không còn mã hành lang cũ không dùng

## Risk Assessment

- Texture chiếm bộ nhớ GPU → nạp theo gần/xa, `dispose()` khi rời cảnh.
- Ảnh đứng bị cắt đầu/chân trong khung vòm → tỉ lệ khung theo từng ảnh hoặc `uvOffset` theo vị trí mặt.
