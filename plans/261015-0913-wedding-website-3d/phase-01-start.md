---
title: "Phase 1: Setup, config, static sections"
status: todo
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Setup, config, static sections

## Overview

Mockup nhanh rồi khởi tạo Vite + React + TS, design tokens theo palette, file config duy nhất, cá nhân hóa qua URL (`?nha`, `?khach`), pipeline tối ưu ảnh, và các section HTML thật: hero (ảnh cặp đôi + lời mời), thẻ sự kiện (lịch trình + chỉ đường), "Gửi yêu thương" (2 QR cô dâu/chú rể), thanh hành động cố định. Chưa có 3D.

## Requirements

- Functional:
  - Hero: ảnh cặp đôi, tên, ngày cưới, lời mời. `?khach=Anh Minh` → "Trân trọng kính mời Anh Minh"; thiếu → lời mời chung ("Trân trọng kính mời quý khách").
  - `?nha=trai` / `?nha=gai` → chỉ hiện sự kiện (thời gian, địa chỉ) của phía đó; thiếu/sai → hiện cả hai nhà, mỗi nhà một nhóm có tiêu đề rõ.
  - Thẻ sự kiện: tên sự kiện, giờ, ngày, địa chỉ, nút **Chỉ đường** (mở Google Maps); iframe bản đồ chỉ tải khi chạm "Xem bản đồ".
  - "Gửi yêu thương" (D9, D12, D13): đặt cuối trang; tiêu đề và lời dẫn nhẹ nhàng, khéo léo (nội dung do người dùng chốt: "Sự hiện diện của bạn đã là món quà quý giá nhất với chúng mình. Mọi lời chúc phúc và món quà gửi xa, chúng mình xin trân trọng đón nhận qua thông tin dưới đây."), không dùng "quét mã/chuyển khoản" làm tiêu đề; **2 thẻ: cô dâu và chú rể**, mỗi thẻ một ảnh QR + ngân hàng, chủ TK, số tài khoản; hiện giống nhau với mọi `?nha`. **Chép số tài khoản** là nút chính của từng thẻ (kiểu nhẹ/ghost, trạng thái "Đã chép"); gợi ý nhẹ "Bạn có thể nhấn giữ hình để lưu, rồi mở trong ứng dụng ngân hàng của mình"; lời kết "Cảm ơn bạn đã yêu thương và đồng hành cùng chúng mình ♡".
  - Thanh hành động cố định ở đáy (D10): Chỉ đường · Lời chúc · Yêu thương; cuộn tới section tương ứng (nhiều sự kiện → Chỉ đường cuộn tới nhóm sự kiện).
  - Nhạc nền chỉ khi có file: nút bật/tắt rõ ràng, mặc định tắt (trình duyệt chặn tự phát).
- Non-functional (khách gồm người lớn tuổi):
  - Chữ thân bài ≥16px, giờ/địa chỉ ≥18px, line-height ≥1.5 (dấu tiếng Việt không dính dòng), vùng chạm ≥44px, tương phản AA.
  - Không thông tin quan trọng nào nằm sau cử chỉ, animation hay 3D.
  - Chiều cao màn hình dùng `svh`/`dvh` (không `100vh`) vì in-app browser có thanh địa chỉ co giãn; tôn trọng `env(safe-area-inset-*)`.
  - Ảnh hero là phần tử LCP: ≤ ~150KB WebP, `preload`, có `width/height`.
  - `lang="vi"`, CLS thấp (font fallback có `size-adjust`).

## Architecture

- `src/config/wedding-config.ts` (mọi dữ liệu cá nhân chỉ ở đây):
  ```ts
  type Side = 'trai' | 'gai'
  interface WeddingEvent { side: Side; title: string; startsAt: string; venue: string; address: string; mapsUrl: string; mapsEmbedUrl?: string }
  interface BankAccount { bank: string; number: string; holder: string; qrSrc: string }
  // couple, date, heroPhoto, invitation copy, events: WeddingEvent[],
  // gift: { bride: BankAccount; groom: BankAccount }  (cả hai luôn hiện, không phụ thuộc ?nha),
  // photos, music?, wishesEndpoint = import.meta.env.VITE_WISHES_ENDPOINT
  ```
- **Asset placeholder (D11):** mọi đường dẫn asset trong config trỏ vào `public/assets/` (phục vụ ở `/assets/...`):
  ```
  public/assets/
    hero/couple.webp        # ảnh hero
    photos/photo-01.webp …  # ảnh gallery (8-12 file)
    qr/bride-qr.webp        # QR cô dâu
    qr/groom-qr.webp        # QR chú rể
    share/og-image.jpg      # ảnh xem trước khi chia sẻ link
    music/                  # để trống; có file thì khai báo trong config
  ```
  Placeholder là ảnh màu theo palette, có nhãn mô tả và đúng tỉ lệ khung của ảnh thật (để layout không đổi khi thay). QR placeholder ghi rõ "QR mẫu" để không ai chuyển nhầm. Người dùng thay file **cùng tên** là xong; muốn thêm/bớt ảnh gallery thì sửa danh sách trong config.
- Ảnh gốc của người dùng: bỏ vào `assets-src/` (không commit), chạy `npm run optimize:images` để xuất ra `public/assets/` đúng kích thước/định dạng.
- `src/lib/url-params.ts`: `parseInvite(search) → { side: Side | null; guestName: string | null }`; `nha` chỉ nhận `trai|gai` (không phân biệt hoa thường), khác → `null`; `khach` decode, trim, bỏ ký tự điều khiển, cắt ≤40 ký tự; render như text (không HTML). Có unit test.
- `src/styles/tokens.css`: `--bg:#FBF6F0; --surface:#EBCFCB; --surface-deep:#C98B8B; --accent:#B76E79; --accent-strong:#9E5560;` + type scale, spacing, radius.
- **Bản đồ màu 60-30-10 theo section** (chốt trong mockup, ghi vào `tokens.css` dạng comment):
  - 60% `--bg`: nền trang, nền thẻ sự kiện.
  - 30% `--surface`/`--surface-deep`: tiêu đề section, viền thẻ, nền vùng ảnh, vùng bầu trời lời chúc (bản tối, xem D7).
  - 10% `--accent`/`--accent-strong`: chỉ cho Chỉ đường, Gửi lời chúc và trạng thái active của thanh hành động. Phần "Gửi yêu thương" dùng nút phụ (ghost), không dùng màu nhấn mạnh hơn các nút khác.
- Font **tự host** qua `@fontsource` (subset latin + vietnamese): Playfair Display 500 (+italic) cho tiêu đề, Be Vietnam Pro 400/500/600 cho thân bài; không dùng font script vì hay vỡ dấu. Không gọi Google Fonts (chặn render, chậm trong in-app browser). Độ dịch layout khi font đổi đo bằng Lighthouse ở phase 6, chưa tinh chỉnh font dự phòng khi chưa có số đo.
- `scripts/optimize-images.mjs` (sharp): `assets-src/{hero,photos,qr,share}/` → `public/assets/...`. Hero vừa khung 683x1024 và cảnh báo khi > 150KB; ảnh gallery cạnh dài ≤1024px, chất lượng ~75; QR cạnh dài ≤1024px, lossless; ảnh chia sẻ rộng 1200px. Bắt lỗi từng file (không dừng cả lượt), từ chối HEIC (đổi sang JPG trước), báo lỗi khi hai file nguồn trùng tên đầu ra. Bản 768px cho tier thấp và blur placeholder chuyển sang phase 4 (chỉ gallery mới dùng).
- `scripts/generate-placeholders.mjs` (sharp): sinh các ảnh placeholder ở trên một lần; không ghi đè file đã tồn tại (tránh xóa ảnh thật).
- Hook `useCopyToClipboard`: dùng `navigator.clipboard.writeText` khi có HTTPS + API; nếu không, hoặc bị từ chối, gọi `execCommand('copy')` (đồng bộ trong cử chỉ chạm, textarea ≥16px để iOS không phóng to, trả focus về nút). Nếu vẫn lỗi: trạng thái 'failed' giữ đến lần bấm sau, hiện hướng dẫn nhấn giữ số tài khoản (`user-select: all`).
- **Chia sẻ link:** `wedding-config.ts` có khối `share` (title, description, image, siteUrl). Plugin trong `vite.config.ts` chèn title, og:*, preload ảnh hero vào HTML lúc build/dev từ config (trình xem trước link không chạy JS). `siteUrl` điền sau khi deploy để og:image thành URL tuyệt đối. Giá trị môi trường (`VITE_WISHES_ENDPOINT`) tách sang `src/config/env.ts` để `wedding-config.ts` là dữ liệu thuần.
- Ngoại lệ cỡ chữ: nhãn thanh hành động 14px (chrome điều hướng); mọi chữ thân bài ≥16px.
- Component tách file: `hero-section.tsx`, `events-section.tsx` (+ `event-card.tsx`), `gift-section.tsx`, `action-bar.tsx`, `music-toggle.tsx`; placeholder cho ảnh và lời chúc.

## Related Code Files

- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/app.tsx`, `src/config/wedding-config.ts`, `src/lib/url-params.ts`, `src/lib/url-params.test.ts`, `src/styles/tokens.css`, `src/styles/global.css`, `src/sections/*.tsx`, `src/components/event-card.tsx`, `src/components/action-bar.tsx`, `src/components/music-toggle.tsx`, `src/hooks/use-copy-to-clipboard.ts`, `src/config/env.ts`, `src/sections/sections.test.tsx`, `scripts/optimize-images.mjs`, `scripts/generate-placeholders.mjs`, `public/assets/**` (placeholder), `public/favicon.svg`, `.env.example`, `.gitignore`
- Modify: none (greenfield)

## Implementation Steps

1. **Mockup trước khi code:** 6 section + thanh hành động ở 375px, áp bản đồ 60-30-10; kiểm tra cỡ chữ, vùng chạm, thứ tự đọc. Người dùng duyệt mockup rồi mới code.
2. Khởi tạo Vite react-ts; `.gitignore` gồm `.env*` (trừ `.env.example`) và `assets-src/`.
3. Tokens + global CSS (`svh/dvh`, safe-area); chọn font và kiểm tra dấu tiếng Việt ở mọi cỡ.
4. `wedding-config.ts` với dữ liệu placeholder cho cả hai nhà; `url-params.ts` + test.
5. Script sinh placeholder + script tối ưu ảnh; sinh toàn bộ `public/assets/`; preload ảnh hero trong `index.html`.
6. Dựng hero, nhóm sự kiện theo `side`, thẻ sự kiện (Chỉ đường, bản đồ chạm-để-tải), "Gửi yêu thương" (D9, D12), thanh hành động, nút nhạc (nếu có file).
7. Kiểm tra tương phản các cặp chữ/nền; nút chữ trắng dùng `--accent-strong`.

## Success Criteria

- [x] Mockup được duyệt trước khi code section
- [x] `npm run build` thành công, không lỗi TS; unit test `url-params` pass
- [x] `?nha=trai`, `?nha=gai`, `?nha=xyz`, không tham số đều render đúng nhóm sự kiện
- [x] `?khach=Anh%20Minh` hiện tên; `?khach=<script>` hiện như chữ; tên dài bị cắt gọn
- [x] Từ màn hình đầu, ≤1 chạm tới giờ/địa điểm/chỉ đường (thanh hành động)
- [ ] Chép số tài khoản (cô dâu và chú rể) hoạt động trên Chrome, Safari iOS (chuyển sang kiểm tra trên thiết bị thật ở phase 6)
- [ ] Chữ ≥16px (giờ/địa chỉ ≥18px), vùng chạm ≥44px đã có trong CSS; Lighthouse accessibility ≥ 90 đo ở phase 6
- [x] Ảnh hero ≤ ~150KB; không có R3F trong bundle ban đầu
- [x] Mọi asset nằm trong `public/assets/`, khai báo trong config; thay một file cùng tên → trang hiển thị file mới, không sửa code
- [x] "Gửi yêu thương" hiện đủ 2 thẻ (cô dâu, chú rể) với mọi giá trị `?nha`; lời dẫn không dùng chữ "quét mã/chuyển khoản" làm tiêu đề
- [x] Không thông tin cá nhân nằm ngoài `wedding-config.ts` / `.env`

## Risk Assessment

- Clipboard bị chặn trong in-app browser → chuỗi fallback ở trên; tín hiệu: nút không đổi trạng thái khi test thật → giữ fallback chữ.
- Người gửi link gõ sai `nha` → hiện cả hai nhà (không bao giờ trang trống).
- `khach` là dữ liệu từ URL ai cũng sửa được → chỉ render text, giới hạn độ dài; không dùng cho logic nào khác.
- Thanh hành động che nội dung cuối trang → `padding-bottom` bằng chiều cao thanh + safe-area.
- Font tiếng Việt thiếu subset → kiểm tra render dấu trước khi chốt font.
