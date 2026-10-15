---
title: "Phase 4: Photo gallery - sợi tơ hồng"
status: completed
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 4: Photo gallery - sợi tơ hồng

## Overview

Gallery "sợi tơ hồng": một sợi chỉ đỏ luồn qua từng bức ảnh, được vẽ dần theo ngón tay cuộn; mỗi ảnh hiện ra khi sợi chỉ chạm tới và được buộc bằng một nút thắt ở góc ảnh; cuối cùng sợi chỉ buộc thành nơ ("Duyên lành đã định"). Chạm ảnh để xem toàn màn hình.

Hướng này được chọn sau khi brainstorm các kiểu gallery (polaroid rải bàn, vòng xoay 3D, tấm vải vô hạn, lau sương, đèn lồng soi, cánh hoa nở thành ảnh...). Lý do: độc, gắn với chủ đề tơ hồng se duyên (cùng mạch với câu báo lỗi "Tơ hồng đã se..."), khách chỉ cần cuộn nên xem hết ảnh, không tranh cuộn dọc, chạy chắc trong in-app browser, **không cần Three.js** (đã gỡ gói `three`, `@react-three/fiber` và hạ tầng 3D chưa dùng).

## Requirements

- Functional: ảnh xếp so le trái/phải, hơi nghiêng; sợi chỉ đỏ được vẽ dần theo cuộn; ảnh và nút thắt hiện khi sợi chỉ tới; nơ ở cuối; chạm ảnh mở trình xem toàn màn hình (vuốt, nút, phím mũi tên, Esc, trả focus).
- Non-functional: không tranh cuộn dọc (không có cử chỉ kéo riêng); không nhảy layout khi ảnh tải (`width/height` + `loading="lazy"`); bật giảm chuyển động thì sợi chỉ và mọi ảnh hiện đủ ngay; nếu JS lỗi sau khi trang đã dựng thì ảnh vẫn xem được (trạng thái ban đầu là hiện đủ, chỉ ẩn sau khi đo thành công).

## Architecture

- `src/lib/thread-path.ts` (thuần, có test): `buildThreadPath` (Catmull-Rom sang Bézier bậc ba đi đúng qua các điểm), `findLengthAtY` (chiều dài đã vẽ khi "đầu bút" ở toạ độ dọc Y), `countReached`, `lengthNearPoint`.
- `src/hooks/use-red-thread.ts`: đo vị trí thật của các `[data-pin]` (mỗi ảnh, `data-side=left|right`) và `[data-thread-end]` (nơ), thêm điểm chùng giữa hai ảnh cho sợi chỉ võng tự nhiên, dựng đường cong, lấy mẫu độ dài, rồi cập nhật `stroke-dashoffset` mỗi frame cuộn (rAF, listener passive). "Đầu bút" bám theo điểm ở 72% chiều cao màn hình. Đo theo bố cục (`offsetLeft/Top/Width/Height`), không dùng `getBoundingClientRect`, vì ảnh chưa hiện đang bị transform (dịch xuống, thu nhỏ) nên đo theo hộp hiển thị sẽ lệch; phép nghiêng của ảnh được tính lại bằng toán. Đo lại khi container đổi kích thước (`ResizeObserver`) hoặc xoay màn hình. Trạng thái ban đầu là mọi thứ hiện đủ; chỉ khi đo xong và được phép chuyển động mới ẩn các ảnh chưa được chỉ chạm tới (tránh mất ảnh nếu JS lỗi).
- `src/sections/photos-section.tsx`: hai SVG phủ container: sợi chỉ nằm **dưới** các ảnh (chỉ lộ ở khoảng trống, tránh vệt cắt ngang ảnh), nút thắt nằm **trên** ảnh ở góc trong phía trên. Cả đường chính lẫn vệt glow đều được vẽ dần.
- `src/components/photo-viewer.tsx`: `<dialog>` toàn màn hình; vuốt ngang ≥50px, nút trước/sau, phím mũi tên, Esc, đếm "n / tổng", khóa cuộn nền; `touch-action: pan-y pinch-zoom`.
- Dữ liệu: `weddingConfig.photos` (`src`, `alt`, `width`, `height`); ảnh tạm 4:5, đổi `width/height` nếu ảnh thật khác tỉ lệ.
- Màu sợi chỉ: token `--thread` (#c2283f).

## Related Code Files

- Create: `src/lib/thread-path.ts` (+ test), `src/hooks/use-red-thread.ts` (+ test), `src/components/photo-viewer.tsx` (+ test), `src/sections/photos-section.tsx`
- Move: `src/hooks/use-near-viewport.ts` (từ `src/3d/scene-hooks.ts`), `src/components/hero-petals.tsx` (từ `src/3d/hero-effect.tsx`)
- Modify: `src/config/wedding-config.ts` (kích thước ảnh), `src/app.tsx`, `src/styles/sections.css`, `src/styles/tokens.css`
- Delete: `src/3d/*` (hạ tầng 3D chưa dùng), `src/sections/placeholder-sections.tsx`

## Success Criteria

- [x] Sợi chỉ vẽ dần theo cuộn, ảnh và nút thắt hiện khi chỉ chạm tới (đã kiểm bằng Chrome thật: offset 2904 → 0 qua các mốc cuộn, ẩn/hiện đúng cặp)
- [x] Sợi chỉ chui dưới ảnh, không cắt ngang ảnh; glow không chạy trước đầu sợi chỉ
- [x] Chạm ảnh mở trình xem; vuốt/phím/nút đổi ảnh; Esc đóng và trả focus về ảnh (đã kiểm bằng Chrome thật + test)
- [x] Giảm chuyển động: mọi ảnh, nút thắt, nơ hiện đủ ngay (đã kiểm bằng Chrome thật)
- [x] Đổi kích thước (375 → 360px) thì sợi chỉ được đo lại, không tràn ngang
- [ ] Mượt trên điện thoại thật (iOS Safari, Android, in-app Zalo/Facebook), đo ở phase 6; kiểm tra thêm độ dài đường của Safari (getTotalLength xấp xỉ) không để lại chấm ở đầu sợi chỉ
- [ ] Hiển thị đẹp với ảnh cưới thật (tỉ lệ ngang/dọc khác nhau), kiểm khi người dùng thay ảnh

## Risk Assessment

- Sợi chỉ lệch khỏi ảnh nếu layout đổi sau khi đo (đã xử lý: đo theo bố cục, `ResizeObserver` đo lại) (ảnh tải làm đổi chiều cao, font tải xong): ảnh có `width/height` nên chiều cao biết trước; `ResizeObserver` đo lại khi container đổi. Tín hiệu: nút thắt không nằm ở góc ảnh khi thử máy thật → đo lại sau sự kiện `load` của ảnh và font.
- Ảnh thật có tỉ lệ rất khác (ngang hẹp): khung `width: 64%` vẫn đúng nhưng chiều cao thay đổi, sợi chỉ tự thích ứng vì đo theo DOM thật.
- Cuộn nhanh: `requestAnimationFrame` gộp sự kiện; nếu giật trên máy yếu thì giảm `SAMPLE_COUNT` hoặc bỏ glow.
- Số ảnh nhiều (hơn khoảng 20): trang rất dài; cân nhắc giới hạn hoặc gom nhóm.
