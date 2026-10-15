---
title: "Phase 1: Foundation, assets, journey engine, quality tiers"
status: in-progress
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Foundation, assets, journey engine, quality tiers

## Overview

Dựng bộ khung chung để các cảnh 2-5 cắm vào: ảnh nén đúng cỡ, một canvas Three.js cố định, camera chạy theo đường cong theo cuộn, bậc chất lượng, và lớp HTML phủ lên.

## Requirements

- Functional: ảnh gốc ra khỏi `public/`, nén WebP (hero ≤1600×2400, gallery cạnh dài ≤1600px, để không mờ khi phóng trên màn rộng/retina); `JourneyCanvas` mount một renderer; `scrollProgress` (0→1) ánh xạ vào vị trí camera trên `CatmullRomCurve3`; `--tod` (ngày→hoàng hôn) suy ra từ cùng `scrollProgress`; giao diện `SceneModule` (`init`, `update(progress, dt)`, `dispose`, `setQuality`).
- Non-functional: một WebGL context; DPR giới hạn theo tier; render theo yêu cầu khi đứng yên (không vẽ khi không đổi); xử lý `webglcontextlost/restored`; reduced-motion → không mount canvas, dùng fallback HTML.

## Architecture

- `src/journey/journey-canvas.tsx`: React wrapper, lifecycle, chuyển fallback khi lỗi.
- `src/journey/journey-engine.ts`: renderer, camera, đường cong, vòng lặp `setAnimationLoop` chỉ chạy khi cần.
- `src/journey/quality-tier.ts`: chọn tier từ `renderer.capabilities`, `hardwareConcurrency`, FPS đo 1s đầu; hạ tier tự động khi FPS tụt (có trễ để không nhấp nháy).
- `src/journey/scroll-progress.ts`: nội suy mượt, hỗ trợ neo theo section.
- `src/journey/scene-module.ts`: kiểu `SceneModule`.
- `src/hooks/use-time-of-day.ts` (ghi `--tod` để HTML/CSS đổi màu cùng cảnh).
- Chốt hậu kỳ: `pmndrs/postprocessing` hay `EffectComposer` (K6), dựa trên kích thước bundle và tương thích.

## Related Code Files

- Create: `src/journey/*` (+ test cho `quality-tier`, `scroll-progress`), `src/hooks/use-time-of-day.ts`
- Modify: `src/app.tsx`, `src/styles/tokens.css`, `src/styles/global.css`, `package.json` (phụ thuộc hậu kỳ nếu chọn), `vite-plugins/wedding-assets.ts` nếu cần
- Move: `public/assets/hero/*`, `public/assets/photos/*` (WebP/JPG gốc đang nặng) → `assets-src/`; đặt tên `couple.*`, `photo-01..08.*`; chạy `npm run optimize:images`
- Delete: ảnh placeholder cũ đã xóa trong git (xác nhận với người dùng trước khi commit)
- Reuse/cleanup: `src/gallery/corridor-scene.ts`, `src/components/photo-corridor.tsx` sẽ được gộp vào journey ở phase 4

## Implementation Steps

1. Ảnh: chuyển ra `assets-src/`, đặt tên, nén, kiểm dung lượng; chốt thứ tự ảnh gallery (ảnh `20X30` là ảnh ngang).
2. Dựng engine + canvas cố định, một cảnh thử (hộp/đèn) để kiểm camera chạy theo cuộn.
3. Quality tier + render theo yêu cầu + xử lý mất context; test các hàm thuần.
4. `--tod` và nền HTML; kiểm tương phản ở 3 mốc.
5. Chốt thư viện hậu kỳ bằng đo bundle và thử bloom ở tier trung.

## Success Criteria

- [x] `public/assets/` không file > ~265KB (hero 201KB, gallery 65-264KB); ảnh gốc nằm ngoài `public/` (`assets-src/`)
- [ ] Camera đi theo cuộn mượt ≥30fps (throttle 4x) trên cảnh thử. Camera theo cuộn và đứng yên thì không vẽ đã kiểm (test engine + trình duyệt); **FPS chưa đo được** (GL phần mềm headless không đại diện, tab bị ẩn): đo trên máy thật ở phase 7
- [x] Mất context: tự phục hồi hoặc chuyển fallback HTML, không trang trắng (có test; thử thật trên điện thoại ở phase 7)
- [x] `npm test` (274/274), `npm run lint`, `npm run build` xanh

## Risk Assessment

- Một canvas cố định phủ toàn trang có thể xung đột cuộn/chạm trong in-app browser → canvas `pointer-events: none`, chỉ bật cho vùng tương tác (ảnh, đèn) qua lớp overlay hoặc raycast từ sự kiện trang.
- Tín hiệu hỏng: FPS < 25 ở tier thấp nhất → rút số lượng instance/tắt hậu kỳ trước; nếu vẫn tụt thì chuyển fallback HTML cho thiết bị đó.
- iOS Safari giới hạn bộ nhớ canvas → DPR tối đa 2 (tier cao), 1.5 (trung), 1 (thấp).

## Kết quả thực hiện

- Đã làm: ảnh nén (hero 1600x2400, gallery cạnh dài 1600px; bản 683x1024 đầu tiên bị mờ nên đã nâng), engine một canvas + camera theo cuộn + bậc chất lượng + xử lý lỗi/mất context + `--tod`, cảnh thử `probe-scene`.
- Quyết định K6 (hậu kỳ): dùng `EffectComposer` + `UnrealBloomPass` có sẵn trong Three.js, không thêm phụ thuộc; chốt lại ở phase 5 nếu gặp lỗi thứ tự pass.
- Việc còn lại của phase: đo FPS (phase 7). `probe-scene` bị thay ở phase 2.
- Ghi chú git: ảnh gốc 50MB đang nằm trong index git (trạng thái "thêm") và ảnh placeholder cũ ở trạng thái "xóa" — chưa commit; bỏ ảnh gốc khỏi index trước khi commit.
