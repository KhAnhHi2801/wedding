---
title: "cong-vom-hoa-journey"
description: "Hành trình Three.js xuyên qua cổng vòm hoa: một cảnh 3D liền mạch từ ngày sang hoàng hôn, ảnh thật là nhân vật chính"
status: pending
priority: P1
effort: "~8d"
tags: [wedding, threejs, journey, arch, scroll, webgl]
created: 2026-10-15
blocks: [261015-0913-wedding-website-3d]
---

# cong-vom-hoa-journey

## Overview

Làm lại toàn bộ trải nghiệm thành **một cảnh Three.js duy nhất, camera bay dọc theo một đường cong khi khách cuộn**: cổng vòm hoa 3D mở ra → khu vườn → con đường ảnh khung vòm → hoàng hôn dây đèn → cổng khép lại. Một canvas cố định, nền trời và ánh sáng chuyển liền từ ngày sang hoàng hôn, nên không còn cảm giác "5 section rời rạc". Chữ thông tin (lịch trình, bản đồ, quà) là HTML phủ lên cảnh, luôn đọc được kể cả khi 3D không chạy.

Họa tiết vòm lấy từ chính ảnh cưới (cổng hoa, cửa sổ vòm). Không cần model nhân vật: cổng, hoa, lá, cỏ, bóng đèn đều dựng bằng hình học thủ tục (procedural) và instancing; ảnh thật là nhân vật.

Người dùng cho phép đập đi xây lại. Plan này **thay thế** phase 3, 5, 6 của `261015-0913-wedding-website-3d`; giữ backend lời chúc, config, thanh hành động, nhạc, `?nha=`/`?khach=`.

## Contract

- **Outcome:** khách mở link thấy cổng vòm hoa 3D mang tên mình, cổng mở, camera bước vào và đi hết hành trình trong cùng một thế giới 3D; thông tin quan trọng luôn tới được trong ≤1 chạm.
- **Constraints:** Three.js là công nghệ chủ đạo cho mọi cảnh; ảnh thật làm nhân vật, không model nhân vật; **một** WebGL context cho cả trang (in-app browser hay mất context khi có nhiều canvas); phân bậc chất lượng (quality tier) theo thiết bị; fallback HTML khi không có WebGL hoặc `prefers-reduced-motion`; ≥30fps máy tầm trung; in-app Zalo/Facebook, 4G; giữ API và Sheet lời chúc; chữ ≥16px (giờ/địa chỉ ≥18px), vùng chạm ≥44px, tương phản AA.
- **Non-goals:** backend mới, model 3D nhân vật, mini-game, WebGPU (WebGL2 để tương thích Zalo/Facebook), deploy, nội dung thật ngoài ảnh (QR, thông tin sự kiện).
- **Acceptance:** xem Success Criteria.

## Three.js làm gì ở từng cảnh

| Cảnh | Three.js dựng gì | Kỹ thuật chính |
|---|---|---|
| 1. Cổng | Cổng vòm hoa 3D: khung vòm + hàng trăm bông hoa/lá instanced; hai cánh hoa mở; ảnh hero là mặt phẳng phía sau; camera dolly xuyên qua | `InstancedMesh`, vertex shader nở hoa, animation camera |
| 2. Vườn | Cỏ, lá, hoa đung đưa theo gió, nắng xuyên lá, hạt phấn bay | Instancing + gió trong vertex shader, ánh sáng hướng, bloom nhẹ |
| 3. Con đường ảnh | Ảnh trong khung vòm (ShapeGeometry + texture) treo dọc đường, camera lướt qua, chạm để phóng to | Đường cong `CatmullRomCurve3`, raycast, texture KTX2/WebP |
| 4. Hoàng hôn | Bầu trời gradient đổi màu theo `--tod`; dây đèn võng, mỗi lời chúc là một bóng đèn phát sáng, chạm để đọc | Sky shader, instanced bulbs, `UnrealBloomPass`, raycast |
| 5. Cổng khép | Cổng kết cùng model cổng đầu, cánh hoa rơi | Tái dùng model, particles |

## Key decisions

| # | Quyết định | Lý do / điều kiện đổi |
|---|---|---|
| K1 | **Một canvas cố định, một scene, camera chạy theo đường cong** theo `scrollProgress`; HTML phủ lên (pointer-events chọn lọc) | Cảnh liền mạch, một WebGL context. Đổi chỉ khi đo thấy RAM quá nặng trên máy yếu |
| K2 | Tải theo giai đoạn: cảnh 1 (cổng + hero) dựng ngay, cảnh 2-5 nạp nền sau khi cổng mở (dynamic import + `compileAsync`) | LCP và tải ban đầu; khách không chờ cả thế giới |
| K3 | Quality tier (cao/trung/thấp) quyết định bởi `renderer.capabilities`, `navigator.hardwareConcurrency`, DPR, FPS đo 1s đầu: giới hạn DPR, số instance, bloom, bóng đổ | Giữ ≥30fps; tier thấp chỉ tắt hậu kỳ và giảm số lượng, không đổi cấu trúc cảnh |
| K4 | Cổng tự mở sau ~2.5s nếu khách không chạm/cuộn; luôn có nút "Bỏ qua" | Người lớn tuổi không cần biết cử chỉ nào |
| K5 | Nền HTML/CSS đầy đủ (bố cục tĩnh kem → hoàng hôn, ảnh trong khung vòm) là fallback cho no-WebGL, context bị mất, reduced-motion | Thông tin không bao giờ nằm sau 3D |
| K6 | Hậu kỳ (bloom) chỉ bật ở cảnh hoàng hôn và tier cao/trung; dùng `pmndrs/postprocessing` **hoặc** `EffectComposer` của Three.js, không trộn | Tránh lỗi thứ tự pass; chốt thư viện ở phase 1 |
| K7 | Ảnh nén WebP qua `npm run optimize:images`: hero vừa khung 1600×2400 (~200KB), gallery cạnh dài ≤1600px (65-265KB); ảnh gốc ở `assets-src/` | Hiện hero 7MB, gallery 3–9MB mỗi ảnh. Bản 683×1024 ban đầu bị phóng 2x+ trên màn rộng nên mờ (đã sửa ở phase 1) |
| K8 | `?nha=trai\|gai`, `?khach=` giữ nguyên; tên khách vẽ trên cổng bằng texture canvas (text thuần, ≤40 ký tự) | Không dùng font 3D nặng |

## Phases

| # | Phase | Status | Depends on |
|---|-------|--------|-----------|
| 1 | [Foundation: assets, journey engine, quality tiers](./phase-01-start.md) | Pending | - |
| 2 | [Scene 1 - Cổng vòm hoa 3D](./phase-02-hero-gate.md) | Pending | 1 |
| 3 | [Scene 2 - Khu vườn và lịch trình](./phase-03-garden-events.md) | Pending | 1 |
| 4 | [Scene 3 - Con đường ảnh khung vòm](./phase-04-arch-gallery.md) | Pending | 1 |
| 5 | [Scene 4 - Hoàng hôn, dây đèn lời chúc](./phase-05-dusk-wish-lights.md) | Pending | 1 |
| 6 | [Scene 5 - Cổng khép và Gửi yêu thương](./phase-06-finale-and-gift.md) | Pending | 2, 5 |
| 7 | [Performance, QA, handover](./phase-07-perf-qa-handover.md) | Pending | 1-6 |

Sau phase 1, các phase 2-5 khác file nên có thể làm song song, nhưng chúng cùng chèn vào một scene nên cần thống nhất giao diện `SceneModule` ở phase 1.

## Success Criteria

- [ ] Cổng 3D hiện kèm tên khách; mở bằng chạm, cuộn hoặc tự mở; camera đi xuyên cổng
- [ ] Toàn bộ hành trình ở **một** canvas, nền trời chuyển liên tục ngày → hoàng hôn, không điểm đổi cảnh đột ngột
- [ ] Phần ảnh ≤ ~25% chiều dài trang (hiện 61%)
- [ ] Mỗi lời chúc là một bóng đèn trên dây; gửi xong, đèn của khách sáng ngay trong tầm nhìn
- [ ] Giờ, địa điểm, chỉ đường ≤1 chạm từ màn hình đầu và từ thanh hành động
- [ ] Fallback: no-WebGL, context bị mất, reduced-motion đều ra trang HTML dùng được đầy đủ
- [ ] LCP < ~2.5s trên 4G giả lập; tải ban đầu (trước khi cổng mở) < ~1.5MB; không ảnh > ~250KB
- [ ] ≥30fps với CPU throttle 4x ở tier trung; context mất thì tự phục hồi hoặc chuyển fallback
- [ ] Ít nhất 2 người thật (có một người lớn tuổi) tìm được địa điểm và gửi lời chúc không cần hướng dẫn

Tiêu chí cần máy thật trong in-app Zalo/Facebook chỉ kiểm tra trọn vẹn sau khi người dùng deploy (HTTPS); phase 7 bàn giao checklist.

## Unresolved questions

None. Đã chốt: ảnh hero là `2 ẢNH` (cặp đôi trước cửa sổ vòm, đã đặt trong `public/assets/hero/`); nhạc giữ nguyên `music-toggle` hiện có (khách tự bấm, mặc định tắt; hiện ẩn vì `weddingConfig.music = null` đến khi người dùng thêm file vào `public/assets/music/`).
