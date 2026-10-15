---
title: "Phase 6: Performance, QA and handover"
status: todo
priority: P1
effort: "1d"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Performance, QA and handover

## Overview

Đo và tối ưu theo tiêu chí chấp nhận, kiểm thử tự động và trên thiết bị thật qua mạng LAN, rồi bàn giao: hướng dẫn thay asset, cấu hình, và checklist kiểm tra sau khi người dùng tự deploy. **Không deploy** trong phase này (non-goal).

## Requirements

- Functional: đáp ứng các Success Criteria kiểm tra được trước deploy; có meta chia sẻ link (title, mô tả, ảnh xem trước `public/assets/share/og-image.jpg`) sẵn cho khi deploy.
- Non-functional: LCP < ~2.5s trên 4G giả lập; tải ban đầu < ~1.5MB; không lỗi console ở luồng chính.

## Architecture

- Đo: Lighthouse mobile (4G throttle) trên `vite preview`, `rollup-plugin-visualizer` kiểm tra chunk; overlay fps `?debug`.
- Kiểm thử tự động: Vitest (validation, profanity, wish-position, tier detection, cache, url-params); Playwright smoke ở viewport 375px: trang tải được, `?nha=trai|gai|<sai>|<không có>` render đúng nhóm sự kiện, phần "Gửi yêu thương" hiện đủ 2 thẻ ở mọi `?nha`, `?khach=` hiện đúng và an toàn, nút sao chép tồn tại, thanh hành động cuộn đúng section, fallback hiển thị khi WebGL bị tắt, form gửi bị chặn khi không hợp lệ.
- Thiết bị thật trước deploy: `vite preview --host` qua Wi-Fi LAN, mở trên iOS Safari và Android Chrome (đo fps, cuộn/vuốt, bottom sheet + bàn phím, hiển thị hạt/đèn lồng). Lưu ý: LAN là HTTP nên `navigator.clipboard` không chạy (cần HTTPS), sẽ chạy nhánh fallback; kiểm tra clipboard thật nằm trong checklist sau deploy.
- Kiểm thử khả dụng (trước deploy, qua LAN): ít nhất 2 người thật (có một người lớn tuổi), không hướng dẫn; nhiệm vụ: tìm giờ + chỉ đường, gửi lời chúc, chép số tài khoản. Ghi lại chỗ vướng.
- Bàn giao:
  - `README.md`: cách chạy, cấu hình `wedding-config.ts`, biến `VITE_WISHES_ENDPOINT`, cách thay asset trong `public/assets/` (thay file cùng tên hoặc dùng `npm run optimize:images` với `assets-src/`).
  - `docs/deploy-checklist.md`: build tĩnh (`npm run build` → `dist/`), đặt biến môi trường ở host, deploy Apps Script, và checklist kiểm tra sau deploy (mục dưới).

## Related Code Files

- Create: `playwright.config.ts`, `tests/smoke.spec.ts`, `docs/deploy-checklist.md`
- Modify: `index.html` (meta OG/Twitter, `theme-color`), `vite.config.ts` (tối ưu chunk nếu số liệu cho thấy cần), `README.md`

## Implementation Steps

1. Chạy build, phân tích chunk, xác nhận không có three/R3F trong bundle (đã gỡ khỏi dự án).
2. Lighthouse mobile trước/sau; xử lý LCP (preload font/ảnh hero, kích thước ảnh, hoãn script 3D).
3. Viết và chạy test đơn vị + smoke Playwright (kể cả kịch bản không WebGL, reduced-motion).
4. Thử trên điện thoại thật qua LAN; ghi fps, lỗi, hành vi cuộn/vuốt; sửa tier/DPR theo số đo.
5. Thêm meta chia sẻ trỏ tới asset placeholder.
6. Kiểm thử khả dụng với người thật qua LAN; sửa các chỗ vướng.
7. Viết `README.md` và `docs/deploy-checklist.md`.

## Success Criteria

Trước bàn giao (phase này):
- [ ] Lighthouse mobile: LCP < ~2.5s (4G giả lập), tải ban đầu < ~1.5MB
- [ ] ≥30fps ở hero, gallery, bầu trời trên iOS Safari và Android Chrome (qua LAN)
- [ ] Fallback đúng khi tắt WebGL và khi reduced-motion
- [ ] Vitest + Playwright smoke pass
- [ ] 2 người thật hoàn thành 3 nhiệm vụ không cần hướng dẫn
- [ ] README + deploy checklist đủ để người dùng tự thay asset và deploy

Checklist sau deploy (người dùng chạy, ghi trong `docs/deploy-checklist.md`):
- [ ] Mở link qua in-app Zalo và Facebook/Messenger: trang hiển thị, ≥30fps, cuộn/vuốt ổn
- [ ] Chép số tài khoản (HTTPS) và nhấn giữ lưu ảnh QR của cả cô dâu lẫn chú rể hoạt động; ảnh QR đã lưu quét được bằng "quét từ ảnh" trong app ngân hàng
- [ ] Gửi/đọc lời chúc end-to-end vào Sheet trên bản production
- [ ] Dán link (kèm `?nha` và `?khach`) vào Zalo/Facebook hiện thẻ xem trước đúng
- [ ] Mở trên 4G thật, trang dùng được trong vài giây

## Risk Assessment

- Không thử được in-app Zalo/Facebook trước deploy → rủi ro chuyển sang checklist sau deploy; fallback (clipboard chữ chọn được, tier thấp, danh sách lời chúc HTML) đảm bảo trang vẫn dùng được nếu in-app có vấn đề.
- Không đạt LCP/fps → thứ tự hạ: giảm DPR → giảm số hạt/lời chúc → tắt hiệu ứng ở tier low → cuối cùng đưa 3D sau tương tác (nút "Bật hiệu ứng").
- Quota Apps Script khi nhiều khách cùng mở → cache server/client; tín hiệu: lỗi 429/chậm → tăng TTL.
- Người dùng quên thay QR placeholder → placeholder ghi rõ "QR mẫu"; checklist sau deploy có mục kiểm tra.
