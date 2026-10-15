---
title: "Phase 5: Scene 4 - Hoàng hôn, dây đèn lời chúc"
status: in-progress
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 5: Scene 4 - Hoàng hôn, dây đèn lời chúc

## Overview

Cảnh đỉnh điểm cảm xúc: bầu trời hoàng hôn bằng shader, dây đèn võng giăng ngang, mỗi lời chúc là một bóng đèn phát sáng trên dây. Chạm để đọc; gửi xong, đèn của khách bật sáng ngay trong tầm nhìn. Giữ backend và danh sách HTML hiện có.

## Requirements

- Functional: ~60-100 bóng đèn trên nhiều dây, vị trí ổn định theo `id`; chạm đọc; tự hiện một lời chúc mỗi ~5s khi khách không tương tác; form bottom sheet giữ nguyên; đèn mới thả/treo lên dây còn chỗ kèm thẻ tự hiện.
- Non-functional: bóng đèn là `InstancedMesh` (hoặc sprite) với phát sáng nhờ bloom (tier cao/trung) hoặc quầng sprite (tier thấp); vùng chạm ≥44px (raycast với bán kính chạm lớn hơn hình vẽ); dừng cập nhật khi cảnh ra khỏi tầm nhìn; reduced-motion → fallback danh sách HTML.

## Architecture

- `src/journey/scenes/dusk-scene.ts`: sky shader (gradient + vài sao nhạt) đọc `uTod`; dây = `TubeGeometry` theo đường võng (catenary); bóng đèn instanced, thuộc tính theo instance (dây, vị trí, pha nhấp nháy).
- `src/lib/wish-position.ts`: đổi ánh xạ `id` → (dây, vị trí dọc dây), giữ tính ổn định và có test.
- Bloom: chỉ ở cảnh này (K6).
- Giữ: `use-wishes.ts`, `wishes-api.ts`, `wishes-merge.ts`, `wishes-cache.ts`, `wish-validation.ts`, `profanity-list.ts`, `wish-list.tsx` (HTML phân trang), `wish-form-sheet.tsx` (đổi màu).

## Related Code Files

- Create: `src/journey/scenes/dusk-scene.ts`, `src/journey/shaders/sky.ts`
- Modify: `src/lib/wish-position.ts` (+ test), `src/sections/wishes-section.tsx`, `src/components/wish-form-sheet.tsx`, `src/components/wish-list.tsx`, `src/styles/sections.css`
- Delete sau khi thay: `src/components/wish-sky.tsx` (canvas 2D đèn lồng) khi cảnh mới thay thế hoàn toàn

## Implementation Steps

1. Sky shader + đổi theo `--tod`; dây đèn; thử 100 bóng ở 3 tier.
2. Ánh xạ vị trí mới + test; raycast chạm; thẻ lời chúc HTML.
3. Luồng gửi lời chúc: bóng mới bay lên/treo vào dây; tự hiện thẻ.
4. Đổi màu form/list theo palette hoàng hôn; kiểm AA.

## Success Criteria

- [ ] Gửi lời chúc → bóng đèn của khách xuất hiện và sáng ngay, không cần cuộn
- [ ] 100 bóng ≥30fps (throttle 4x) ở tier trung; vị trí ổn định khi tải lại
- [x] Chạm trúng bóng (đã thử chuột thật, màn 430px); fallback bầu trời đèn lồng 2D + danh sách đọc được

## Risk Assessment

- Bloom nặng trên máy yếu → tier thấp dùng quầng sprite thay bloom.
- Bóng đèn nhỏ khó chạm → vùng chạm lớn hơn hình, ưu tiên bóng gần điểm chạm nhất.
- Phase 5 cũ đang dở (`wish-sky.tsx` 501 dòng): đọc hiện trạng và giữ hành vi (id ổn định, không đưa đèn chưa có id lên trời) trước khi thay.

## Ghi chú thực hiện

- Không dùng bloom (K6): quầng sáng nằm trong shader điểm sáng, đủ cho mọi tier; bỏ `src/journey/shaders/sky.ts`, shader nằm ở `dusk-sky-shader.ts`, `light-bulb-shader.ts`.
- `wish-sky.tsx` được giữ làm bản dự phòng HTML (không WebGL / giảm chuyển động), không xóa.
- Vị trí bóng đèn: 5 dây, dây = hash(id) % 5, chỗ trên dây theo hash: ổn định khi tải lại. Lời chúc vừa gửi treo ở dây trước camera trong phiên đó; tải lại thì về chỗ theo id.
- Chưa làm: đổi màu form/list theo palette hoàng hôn (đang dùng palette cũ, đã đọc được); đo FPS 100 bóng.

## Đổi hướng (thay cho phần trên)

Dây đèn hoàng hôn tím và bầu trời đèn lồng bị bỏ vì lệch phong cách với khu vườn hoa. Lời chúc giờ gắn theo từng ảnh trong album: vòng hoa nở quanh vòm ảnh (dùng lại hình hoa/lá của vườn), thẻ nơ treo trên vòm, thẻ giấy kem phía dưới tự đổi lời chúc. Xem `src/journey/scenes/photo-wreath.ts`, `photo-wish-tags.ts`, `src/components/photo-wish-card.tsx`, `src/journey/wish-lights-state.ts`. Đã xóa: `dusk-scene.ts`, `journey/shaders/*`, `wish-sky.tsx`, `wish-light-card.tsx`.
