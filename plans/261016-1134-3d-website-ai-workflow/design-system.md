# Design system — Papercraft Mint Journey

Nguồn: `ak:ui-ux-pro-max` (typography Wedding/Romance, UX motion rules) + concept user. Palette mặc định của tool (hồng/xanh dương) đã bị thay bằng mint; tương phản tính lại bằng số.

## Concept
**Giấy cắt dán nhiều lớp (papercraft diorama) + đi bộ xuyên không gian.** Mỗi chương là một "hộp tranh giấy" nhiều lớp (xa → gần); cuộn trang = camera bước qua từng lớp. Chất liệu: giấy mờ, mép cắt, bóng đổ mềm giữa các lớp, vân giấy nhẹ. Không bóng loáng, không viền neon.

## Color tokens (nền sáng)
| Token | Hex | Dùng |
|---|---|---|
| `--paper` | #F7FBF8 | nền trang, nền thẻ giấy |
| `--mint-100` | #DDF1E8 | lớp giấy xa, panel nền |
| `--mint-300` | #A9DCC6 | lớp giấy giữa, mảng lớn |
| `--mint-deep` | #2F7A63 | nút chính, icon, link (chữ trắng trên nền này 5.14:1) |
| `--ink` | #1F3D36 | chữ chính (11.3:1 trên paper) |
| `--ink-soft` | #4A6860 | chữ phụ (5.85:1) |
| `--blush` | #F4C9D2 | pastel nhấn: hoa, lớp giấy gần |
| `--rose-deep` | #A5476B | nhấn chữ nhỏ (5.42:1) |
| `--butter` | #F6E3A8 | pastel nhấn: đèn, ánh sáng |
| `--lilac` | #D9CCF0 | pastel phụ: bầu trời hoàng hôn |
| `--gold-deep` | #8A6A1F | viền/nhấn chữ (4.83:1) |
Quy tắc: 60% paper/mint, 30% mint-deep/ink, 10% pastel nhấn. Màu pastel (blush, butter, lilac) chỉ dùng cho mảng lớn/3D, **không dùng làm màu chữ**. Không dùng màu làm tín hiệu duy nhất (kèm icon/chữ). Mỗi chương đổi bảng màu 3D nhưng giữ cùng token UI.

## Typography
- Heading: **Cormorant Garamond** (đã cài, hỗ trợ tiếng Việt), 500–600.
- Body/UI: **Be Vietnam Pro** (đã cài), 400/500, 16px, line-height 1.6.
- Script nhấn (tên cô dâu chú rể, 1–2 dòng/trang): Great Vibes theo gợi ý tool **nhưng phải kiểm tra dấu tiếng Việt** (ă ơ ư, ạ ệ…). Nếu thiếu glyph, dùng Dancing Script hoặc bỏ script, chỉ dùng Cormorant italic.
- Thang cỡ: 14 / 16 / 20 / 28 / 40 / 64 (clamp cho hero). Body tối thiểu 16px. Dòng tối đa 60–70 ký tự.

## Phân rã layer (không nhồi chữ vào 3D)
```
z-0  <canvas> Three.js, position: fixed, inset 0, pointer-events: none
z-1  Lớp vân giấy/grain (CSS overlay, rất nhẹ, tuỳ chọn)
z-2  Lớp nội dung HTML cuộn (React), mỗi chương = <section> cao ~120–180vh
z-3  UI cố định: thanh tiến trình chương, nút nhạc, nút gửi lời chúc
z-4  Sheet/modal (form lời chúc, xem ảnh, QR quà)
z-5  Loading / fallback no-WebGL
```
| Thuộc về **HTML/CSS (phẳng)** | Thuộc về **Canvas 3D** |
|---|---|
| Mọi chữ: tên, ngày, địa điểm, lịch, lời chúc | Cảnh giấy nhiều lớp, camera đi xuyên |
| Nút, form, sheet, QR, link bản đồ, nhạc | Hoa/lá/đèn/hạt bằng giấy, bóng đổ giữa lớp |
| Danh sách lời chúc (để đọc được, a11y) | Lời chúc dạng **ánh sáng/hạt trang trí** (bản sao đọc được nằm ở HTML) |
| Ảnh cưới khi xem chi tiết (viewer) | Ảnh cưới làm **tấm giấy treo** trong cảnh (texture) |
| Điều hướng chương, tiến trình, skip | Chuyển cảnh, ánh sáng, đổi màu theo progress |
Quy tắc cứng: (1) không render chữ bằng `TextGeometry`/canvas-texture cho nội dung thật; (2) 3D chỉ nhận một số `progress` 0–1 và chương hiện tại từ HTML; (3) thông tin quan trọng luôn đọc được khi 3D tắt (no-WebGL, reduced-motion, tiết kiệm pin); (4) canvas `aria-hidden`.

## Kỹ thuật chống "giả" cho 3D (bắt buộc; đã chỉnh sau phản biện)
Nguyên tắc: **giấy thật, không phải 3D bóng bẩy.** Giấy có cạnh cắt, độ dày, bóng gần và sắc, vân sợi; không bloom/glow mặc định.
1. **Parallax theo lớp giấy, không đẩy lưới theo depth.** Mỗi chương tách tối thiểu 3 nhóm: hậu cảnh (xa, mint-100), trung cảnh (cặp đôi), tiền cảnh (hoa/lá giấy gần, hơi mờ bằng texture làm mờ sẵn). Ảnh cặp đôi dùng depth map **chỉ để cắt thành 2–3 lớp giấy** (đầu/thân, váy, hoa cầm tay), mỗi lớp là plane phẳng dịch riêng; biên độ dịch tối đa 1–2% chiều cao ảnh. **Cấm displacement lưới lên mặt/người** (méo mặt, kéo giãn rìa = "con rối bìa cứng"). Viền giấy trắng 2–3px dựng từ alpha ảnh tách nền (dilate), bóng tiếp xúc cứng dưới mỗi lớp, vân giấy normal map nhẹ.
2. **Camera phản ứng con trỏ / con quay.** Lệch nhẹ `position.x/y` theo chuột (desktop) hoặc `deviceorientation` (mobile) với damping, luôn `lookAt` đích của chương; lớp gần dịch nhiều hơn lớp xa. iOS cần xin quyền bằng cử chỉ chạm. Từ chối hoặc reduced-motion thì tắt.
3. **Ánh sáng đơn giản, hậu kỳ tối thiểu.** Không shadow map; bóng giả (blob mềm hoặc vẽ sẵn vào texture), 1 `HemisphereLight` + tối đa 1 point light ấm. `scene.fog` nhẹ theo chương. **Bỏ DoF thật, bloom tắt mặc định** (chỉ bật 1 pass nửa độ phân giải ở tier cao nếu storyboard cần, ví dụ đèn). Dùng `postprocessing` (pmndrs) hoặc `EffectComposer` của three, không dùng `@react-three/postprocessing`.
4. **Palette tiết chế.** Mint + kem + 1 màu nhấn; blush/butter/lilac chỉ là biến thể theo chương khi storyboard yêu cầu, không dùng đồng thời. Lấy màu nhấn từ ảnh thật (váy ngà, vest đen/be) để UI và ảnh ăn khớp.

## Ngân sách hiệu năng (ràng buộc cứng)
- Desktop 60fps; điện thoại 30fps. DPR tối đa 1.5 (mobile), 2 (desktop).
- Tối đa 4 plane toàn màn hình chồng nhau; không shadow map.
- Texture: chỉ giữ cảnh hiện tại + cảnh kế trong GPU, `dispose()` khi rời vùng; ước tính 9 ảnh 1400×2100 RGBA + mipmap ≈ 135MB nên **không nạp cùng lúc**. Mobile dùng bản 1024px hoặc KTX2.
- Render theo nhu cầu (chỉ khi progress/con trỏ/animation đổi), dừng khi tab ẩn; xử lý `webglcontextlost/restored` và rơi về trang tĩnh.
- Canvas cố định theo `lvh`, chỉ resize khi chiều rộng đổi (ResizeObserver + debounce); đọc scroll 1 lần/khung trong rAF, listener `passive`.
- Tier tự hạ khi FPS trung bình < 45 trong 2 giây.

## Storyboard & nhịp (xem [phase-01b-storyboard.md](phase-01b-storyboard.md))
Mỗi chương một ý tưởng riêng gắn với câu chuyện thật; mỗi cảnh chuyển theo cách khác nhau theo chất liệu giấy (gấp, xé, lật trang, kéo màn); mỗi màn hình chỉ 1–2 phần tử chuyển động nổi bật; có khoảnh khắc đứng yên giữa các chương.

## Checklist Web Interface Guidelines (áp dụng khi code)
- Deep link theo chương (`#su-kien`, `#loi-chuc`); điều hướng chương là `<a>`, hỗ trợ Cmd/Ctrl-click; `scroll-margin-top` cho anchor; skip link.
- Hoa/lá rơi tự chạy > 5 giây cần nút Tạm dừng, ngoài reduced-motion. Animation phải ngắt được bằng thao tác người dùng.
- Mọi thao tác cử chỉ (lật, xoay gallery) có nút trước/sau thấy được và phím mũi tên.
- `touch-action: manipulation`; `overscroll-behavior: contain` cho sheet; `env(safe-area-inset-*)` cho nút cố định; không khoá zoom.
- Form lời chúc: `label`, `autocomplete`, `name`, lỗi tại ô + focus ô lỗi đầu, nút Gửi có trạng thái đang gửi, placeholder kết bằng `…`.
- Ngày giờ dùng `Intl.DateTimeFormat('vi-VN')`; tên người `translate="no"`; số đếm `tabular-nums`; tiêu đề `text-wrap: balance`; ký tự `…` và nháy cong.
- `<meta name="theme-color">` khớp màu nền mint/paper; `color-scheme: light`; ảnh HTML có `width`/`height`, `alt`, lazy nếu dưới màn hình đầu.

## Chương (scroll chapters)
1 Mở đầu (tên, ngày) → 2 Câu chuyện → 3 Sự kiện (giờ, địa điểm) → 4 Ảnh → 5 Lời chúc → 6 Quà mừng/kết. Mỗi chương: 1 cảnh giấy, 1 bảng màu pastel, 1 khối chữ ≤ 3 dòng chính.

## Motion
- Chuyển cảnh: ease-out khi vào, ngắn hơn khi ra; progress làm mượt (damping), không scroll-hijack.
- Mỗi view chỉ 1–2 phần tử chuyển động nổi bật; parallax nhẹ.
- `prefers-reduced-motion`: tắt camera bay/parallax, chuyển chương bằng cross-fade tĩnh; vẫn đọc đủ nội dung.
- Chỉ animate `transform`/`opacity` ở lớp HTML; tránh layout shift (CLS).

## Mobile-first & a11y
- Breakpoint 375 / 768 / 1024. Dùng `dvh`, safe-area inset cho nút cố định.
- Touch target ≥ 44px, khoảng cách ≥ 8px; focus ring rõ; skip link "Bỏ qua hiệu ứng, xem nội dung".
- Tier chất lượng 3D: DPR cap, ít lớp giấy/hạt hơn trên điện thoại; có fallback tĩnh.
- Mọi ảnh có alt; nhạc không tự phát, cần chạm.

## Cần xác nhận
- Great Vibes có đủ dấu tiếng Việt không (kiểm tra bằng chuỗi mẫu trước khi chốt).
- Có muốn chế độ tối (cảnh đêm) không, hay chỉ nền sáng.
