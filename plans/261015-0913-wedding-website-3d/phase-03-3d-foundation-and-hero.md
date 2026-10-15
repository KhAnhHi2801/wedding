---
title: "Phase 3: 3D foundation and hero"
status: todo
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 3: 3D foundation and hero

## Overview

Nền tảng 3D dùng chung (phát hiện năng lực thiết bị, lazy-load, vòng đời canvas, fallback) và hiệu ứng hạt/cánh hoa nhẹ ở hero.

## Requirements

- Functional: lớp hạt/cánh hoa trôi chậm phủ lên ảnh cặp đôi ở hero (ảnh và chữ hero từ phase 1 vẫn là HTML); hạt nhìn thấy rõ trên cả vùng ảnh lẫn vùng nền kem.
- Non-functional: canvas không chặn LCP (chữ hero hiển thị trước); tắt hoàn toàn khi không có WebGL, `prefers-reduced-motion`, hoặc thiết bị yếu; không giật khi cuộn.

## Architecture

- `src/3d/use-3d-capability.ts` trả về tier `none | low | high`: thử tạo WebGL context (`webgl2` rồi `webgl`), `matchMedia('(prefers-reduced-motion)')`, `navigator.deviceMemory` / `hardwareConcurrency` (có thể undefined trên iOS → mặc định `low`, không mặc định `high`), nhận diện in-app browser qua UA (Zalo, FBAN/FBAV, Messenger) chỉ để hạ tier/DPR, không để chặn.
- `src/3d/lazy-canvas.tsx`: `React.lazy` cho chunk R3F; mount khi section gần viewport (`IntersectionObserver` với `rootMargin`), unmount + `dispose` khi xa; `frameloop="demand"` hoặc dừng khi tab ẩn (`visibilitychange`); `dpr` giới hạn `[1, 1.5]` (tier low: 1); xử lý `webglcontextlost/restored`.
- `src/3d/hero-particles.tsx`: `Points` ~150 (low) / ~300 (high) với `ShaderMaterial` tự viết; vị trí/pha/kích thước là attribute; chuyển động tính trong vertex shader theo `uTime`; sprite cánh hoa tạo bằng `CanvasTexture` nhỏ (không tải ảnh).
- **Màu và blending (D7):** hạt dùng `--surface-deep #C98B8B` và `--accent #B76E79` với alpha 0.5-0.8, `NormalBlending` (không additive: additive gần như vô hình trên nền kem). Kích thước hạt đủ lớn để thấy trên màn 360px.
- Canvas trong suốt (`alpha`) đặt chồng lên ảnh hero, `pointer-events: none`, `aria-hidden="true"`.
- **Xuất hiện mượt:** canvas fade-in 400-600ms sau khi sẵn sàng (bỏ qua khi reduced-motion), không gây layout shift.
- Fallback: vài cánh hoa tĩnh bằng CSS/SVG cùng tông màu và vị trí tương tự bản 3D, để chuyển từ fallback sang 3D không bị giật; không mount R3F.

## Related Code Files

- Create: `src/3d/use-3d-capability.ts`, `src/3d/lazy-canvas.tsx`, `src/3d/hero-particles.tsx`, `src/3d/hero-scene.tsx`, `src/3d/hero-fallback.css`
- Modify: `src/sections/hero-section.tsx`, `package.json` (three, @react-three/fiber, @react-three/drei, @types/three), `vite.config.ts` (tách chunk 3D)

## Implementation Steps

1. Thêm dependency 3D; cấu hình `manualChunks` để R3F/three nằm ngoài bundle chính.
2. Viết `use-3d-capability` + test logic quyết định tier (mock).
3. Viết `lazy-canvas` (IO, dispose, tạm dừng, context-lost).
4. Viết shader hạt + `hero-scene`; dùng màu từ tokens (không hard-code rải rác).
5. Gắn vào hero, kiểm tra LCP với chữ hero không phụ thuộc canvas.
6. Đo thử fps bằng overlay debug (`?debug`) trên một điện thoại thật.

## Success Criteria

- [ ] Bundle ban đầu không chứa three/R3F; chunk 3D chỉ tải sau khi trang dùng được
- [ ] Hero hiển thị hạt trên iOS Safari và Android Chrome; tier `none` hiển thị fallback CSS
- [ ] `prefers-reduced-motion` → không animate
- [ ] Hạt nhìn thấy rõ trên ảnh chụp màn hình thật (cả vùng ảnh và nền kem) ở độ sáng trung bình
- [ ] Canvas fade-in, không nháy/giật, không layout shift; canvas có `aria-hidden`
- [ ] ≥30fps trên máy thật tầm trung; ẩn tab → ngừng render
- [ ] Không rò bộ nhớ khi cuộn lên/xuống nhiều lần (mount/unmount canvas)

## Risk Assessment

- iOS Safari/in-app có giới hạn WebGL context và RAM → một canvas sống tại một thời điểm cho phần lớn thời gian (D1); tín hiệu: context lost hoặc tab reload khi cuộn → chuyển sang một canvas + `View`.
- `deviceMemory` không có trên Safari → mặc định thận trọng (`low`) khi không đo được; đo fps thật rồi nâng tier, không giả định.
- Shader tự viết dễ lỗi trên GPU di động → dùng `precision mediump float`, kiểm tra trên máy thật.
