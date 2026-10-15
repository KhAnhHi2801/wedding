---
title: "wedding-website-3d"
description: "Web đám cưới mobile-first (Vite + React + TS), cánh hoa hero bằng CSS/SVG, gallery và bầu trời lời chúc (công nghệ chốt ở phase 4), lời chúc lưu Google Sheet"
status: in-progress
priority: P1
effort: "~7d"
tags: [wedding, react, svg, css-animation, google-sheets, mobile-first]
blockedBy: [261015-1455-cong-vom-hoa-journey]
created: 2026-10-15
---

# wedding-website-3d

## Overview

Một trang cuộn dọc, xem chủ yếu trên điện thoại (link Zalo/Facebook). Thông tin thật (lịch trình, bản đồ, QR/số tài khoản) là HTML, dùng được khi không có WebGL. Hiệu ứng ở 3 chỗ: hero (ảnh cặp đôi + cánh hoa rơi bằng SVG/CSS), gallery "sợi tơ hồng" (chạm ảnh để xem toàn màn hình), bầu trời lời chúc (mỗi lời chúc = một cánh hoa/đèn lồng phát sáng). Gallery là "sợi tơ hồng" (SVG + cuộn trang); bầu trời lời chúc chốt công nghệ ở đầu phase 5 (CSS/canvas 2D, xem D14). Lời chúc công khai, lưu Google Sheet qua Google Apps Script web app.

Cá nhân hóa qua URL: `?nha=trai|gai` chọn thông tin (thời gian, địa chỉ) của nhà trai hoặc nhà gái; `?khach=<tên>` hiện lời mời đích danh, thiếu thì dùng lời mời chung.

Greenfield: thư mục dự án đang trống, chưa có plan nào khác.

## Contract

- **Outcome:** web đám cưới 6 phần (hero, lịch trình, bản đồ, ảnh cưới, lời chúc, gửi yêu thương) với 3D lazy-load và fallback đầy đủ; nội dung khớp nhà trai/nhà gái và tên khách theo URL.
- **Người xem:** khách mọi lứa tuổi, kể cả người lớn tuổi → thông tin quan trọng không bao giờ nằm sau cử chỉ hay 3D.
- **Constraints:** mở từ in-app browser Zalo/Facebook, máy tầm trung, 4G; không lộ quyền ghi Sheet; thông tin cá nhân nằm trong một file config; lời chúc công khai nên cần lọc từ ngữ xấu + chống spam.
- **Non-goals:** backend riêng, trang admin, đăng nhập, mini-game, model 3D phức tạp, **deploy** (người dùng tự deploy sau khi hoàn thiện), nội dung thật (ảnh, QR, thông tin sự kiện do người dùng thay sau).
- **Palette 60-30-10 (Romantic & Soft):** nền `#FBF6F0` (60%), phụ `#EBCFCB` / `#C98B8B` (30%), nhấn rose gold `#B76E79` (10%).

## Key decisions

| # | Quyết định | Lý do / điều kiện đổi |
|---|---|---|
| D1 | Mỗi section 3D có `Canvas` riêng, chỉ mount khi gần viewport, unmount + dispose khi xa | Đơn giản hơn drei `View`. Nếu đo thấy tốn RAM khi 2 canvas cùng sống → chuyển sang một canvas + `View` |
| D2 | Chuyển động hạt/đèn lồng chạy trong vertex shader (thuộc tính theo instance), không cập nhật CPU mỗi frame | Giữ ≥30fps trên máy yếu |
| D3 | Apps Script dùng POST `text/plain` (không preflight), đọc bằng GET có cache 60s | Tránh CORS preflight, Apps Script không hỗ trợ OPTIONS |
| D4 | Danh sách lời chúc HTML (phân trang) luôn tồn tại cạnh bầu trời 3D | Là fallback no-WebGL, a11y, và là phần phân trang cho lời chúc ngoài ~100 mục hiển thị trong cảnh |
| D5 | Token màu phái sinh `--accent-strong:#9E5560` cho nền nút có chữ trắng; `#B76E79` dùng cho trang trí, 3D, viền, chữ lớn (**đã duyệt**) | `#B76E79` với chữ trắng chỉ ~3.8:1 (<4.5:1 AA) |
| D6 | `?nha=trai\|gai` chọn bộ sự kiện; `?khach=` là text thuần (trim, ≤40 ký tự, render như text). Giá trị `nha` sai/thiếu → hiện cả hai nhà | Một link cho mỗi phía, không cần build riêng. Tham số do người gửi link đặt, không phải dữ liệu tin cậy |
| D7 | Hero và hạt dùng màu `#C98B8B`/`#B76E79` có alpha, blending thường. Bầu trời lời chúc là vùng nền tối hơn (gradient hồng đất → tím hoàng hôn), chỉ ở đây mới dùng hiệu ứng phát sáng | Additive blending và hạt pastel gần như vô hình trên nền kem `#FBF6F0` |
| D8 | Form lời chúc mở dạng bottom sheet phủ lên bầu trời; gửi xong sheet đóng, khách thấy đèn lồng của mình bay lên | Bàn phím che form; nếu form nằm dưới bầu trời, khách bỏ lỡ animation |
| D9 | Ở phần "Gửi yêu thương", **Chép số tài khoản** là hành động chính; ảnh QR kèm gợi ý nhẹ "nhấn giữ hình để lưu, rồi mở trong ứng dụng ngân hàng" | Khách xem trên điện thoại không quét được QR trên chính màn hình đó; nút tải ảnh không ổn định trong in-app browser |
| D10 | Thanh hành động cố định ở đáy: Chỉ đường · Lời chúc · Yêu thương (có `safe-area-inset-bottom`) | Khách chủ yếu cần giờ/địa điểm; trang cuộn dài không có lối tắt |
| D11 | Mọi asset (ảnh hero, ảnh gallery, QR, ảnh chia sẻ, nhạc) là placeholder nằm trong `public/assets/`, đường dẫn khai báo trong `wedding-config.ts`. Người dùng thay file cùng tên (hoặc sửa config) là xong, không sửa code | Nội dung thật có sau khi web hoàn thiện |
| D12 | Phần "Gửi yêu thương" có **2 tài khoản + 2 QR: cô dâu và chú rể**, hiện giống nhau với mọi giá trị `?nha` (không tách theo nhà). Lời dẫn khéo léo, nhẹ nhàng; không dùng "quét mã/chuyển khoản" làm tiêu đề (**người dùng chốt, thay quyết định một QR chung trước đó**) | Config có `gift: { bride, groom }` |
| D13 | Tên mục hiển thị: "Gửi yêu thương" (thay "Mừng cưới"); nút thanh hành động: "Yêu thương" | Tế nhị hơn, đúng ý người dùng |
| D14 (cập nhật) | Gallery đã chuyển sang **hành lang Three.js** (lazy chunk, fallback sợi tơ hồng SVG khi không có WebGL; ảnh quét tự động từ `public/assets/photos`); bầu trời lời chúc dùng **canvas 2D** (không cần Three.js). Nội dung gốc: hiệu ứng làm bằng **SVG + CSS/JS nhẹ, không dùng Three.js**: cánh hoa hero (CSS), gallery sợi tơ hồng (SVG vẽ theo cuộn). Đã gỡ gói `three`, `@react-three/fiber` và hạ tầng 3D chưa dùng. Phase 5 (bầu trời lời chúc) chọn CSS hoặc canvas 2D | CSS/SVG nhẹ hơn khoảng 245KB gzip, chạy ổn trong in-app browser; Three.js chỉ đáng khi có vài trăm vật thể hoặc hình khối 3D thật |

## Phases

| # | Phase | Status | Depends on |
|---|-------|--------|-----------|
| 1 | [Mockup, setup, config, URL params, static sections](./phase-01-start.md) | Pending | - |
| 2 | [Wishes backend and client](./phase-02-wishes-backend-and-client.md) | Pending | 1 |
| 3 | [Hero petals (CSS/SVG) and 3D foundation](./phase-03-3d-foundation-and-hero.md) | Awaiting approval | 1 |
| 4 | [Photo gallery - hành lang 3D](./phase-04-photo-gallery-3d.md) | Completed (user-approved) | 1 |
| 5 | [Wish sky - đèn lồng](./phase-05-wish-sky-3d.md) | In progress | 2, 3 |
| 6 | [Performance, QA and handover](./phase-06-performance-qa-and-deploy.md) | Pending | 1-5 |

Phase 2 và 3 độc lập, có thể làm song song sau phase 1 (khác file, khác thư mục).

## Success Criteria

- [ ] LCP < ~2.5s trên 4G giả lập; tải ban đầu < ~1.5MB; 3D lazy-load
- [ ] ≥30fps trên điện thoại thật: iOS Safari, Android Chrome, in-app Zalo, in-app Facebook/Messenger
- [ ] Fallback khi không có WebGL và khi `prefers-reduced-motion`: gallery thành carousel/lưới, lời chúc thành danh sách
- [ ] Gửi lời chúc → hiện ngay; danh sách đọc từ Sheet có cache; bầu trời hiển thị ~60-100 mục, danh sách HTML phân trang phần còn lại
- [ ] Nút chép số tài khoản hoạt động cho cả cô dâu và chú rể (kể cả in-app browser); ảnh QR mỗi người lưu được bằng nhấn giữ và quét được từ ảnh
- [ ] Không có secret hay quyền ghi Sheet trong bundle; thông tin cá nhân chỉ ở file config

### UX
- [ ] `?nha=trai`, `?nha=gai`, không có/sai `nha` đều render đúng thời gian và địa chỉ; `?khach=` hiện lời mời đích danh, thiếu thì lời mời chung
- [ ] Từ màn hình đầu, khách tới giờ, địa điểm hoặc chỉ đường trong ≤1 lần chạm
- [ ] Chép số tài khoản và lưu ảnh QR (nhấn giữ) của cả cô dâu lẫn chú rể hoạt động trong in-app Zalo/Facebook
- [ ] Hạt hero và đèn lồng nhìn thấy rõ trên ảnh chụp màn hình thật ở độ sáng trung bình
- [ ] Gửi lời chúc xong, khách thấy lời chúc của mình xuất hiện mà không phải cuộn
- [ ] Chữ thân bài ≥16px, giờ/địa chỉ ≥18px, vùng chạm ≥44px, tương phản AA; không thông tin nào chỉ có trong 3D
- [ ] Ít nhất 2 người thật (có một người lớn tuổi) tìm được địa điểm và gửi lời chúc mà không cần hướng dẫn

Tiêu chí cần thiết bị thật trong in-app Zalo/Facebook và 4G thật chỉ kiểm tra trọn vẹn được sau khi người dùng deploy (HTTPS). Phase 6 kiểm tra trước qua mạng LAN và bàn giao checklist cho bước sau deploy.

## Open questions

None. Đã chốt: người dùng tự deploy sau khi hoàn thiện; asset là placeholder trong `public/assets/`; "Gửi yêu thương" có 2 tài khoản/QR (cô dâu, chú rể) hiện chung cho mọi `?nha`.
