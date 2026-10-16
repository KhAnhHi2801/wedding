---
title: Wedding 3D website — theo AI workflow threejsresources
status: pending
created: 2026-10-16
source: https://threejsresources.com/ai/workflows
---

# Wedding 3D website — AI workflow plan

Workflow nguồn: **Pick tool → Open with proven prompt (walking skeleton) → Iterate against render** (+ verify in browser).

## Outcome
Website cưới 3D (Vite + React + three) chạy mượt desktop + mobile, dựng từ walking skeleton rồi thêm từng lớp ý tưởng.

## Concept (user chốt 2026-10-16)
Trải nghiệm **cuộn trang điều khiển chuyển cảnh 3D**: một canvas cố định, scroll progress (0→1) lái camera + chuyển giữa các cảnh (cross-fade/morph, đổi ánh sáng, màu, particle). Mỗi cảnh = một chương nội dung (mở đầu, câu chuyện, sự kiện, ảnh, lời chúc, quà mừng). Mặc định: WebGL, scroll-driven, nhạc bật khi khách chạm.

Thiết kế chi tiết (palette mint, font, tách layer HTML vs 3D): [design-system.md](design-system.md).

## Constraints
- Pin `three@0.186.1` (đã có trong package.json) trong mọi prompt/skill.
- Ngân sách hiệu năng + checklist guideline: xem design-system.md (desktop 60fps, mobile 30fps, không shadow map, nạp texture theo chương).
- Không viết/chạy test (memory: feedback-no-tests). Verify bằng trình duyệt.
- Giữ config/wishes/gift/music hiện có (`src/config`, `src/lib/wishes-*`, `src/components`).
- 1 thay đổi / 1 lượt; commit mỗi bản chạy được; hỏng thì reset commit cuối, không nhờ model tự sửa.

## Non-goals
Không đổi backend wishes (Apps Script), không thêm framework mới.

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | [Tool & stack lock](phase-01-tool-stack-lock.md) | xong (three 0.186, zustand, WebGL, hậu kỳ tối thiểu) |
| 1b | [Storyboard](phase-01b-storyboard.md) | draft v2 (đã có chuyện thật), chờ user duyệt |
| 2 | [Walking skeleton](phase-02-walking-skeleton.md) | xong (cảnh mở đầu, camera rig, tier, FPS cap) |
| 3 | [Idea layers](phase-03-idea-layers.md) | đang làm: cần Stella, hành lang, mốc, gallery |
| 4 | [Iterate against render](phase-04-iterate-against-render.md) | pending |
| 5 | [Perf, polish, ship](phase-05-perf-polish-ship.md) | pending |

## Acceptance
- Storyboard được duyệt trước khi dựng cảnh; skeleton chạy trước khi thêm ý tưởng; mỗi layer có commit riêng.
- Khung hình render đúng ý (screenshot trình duyệt) ở desktop + mobile.
- `npm run lint` + production bundle sạch; 60fps desktop, tier thấp trên mobile.

## Decisions
- Code 3D cũ đã xoá; skeleton mới ở `src/world/`. WebGL (không WebGPU). Chỉ nền sáng. Palette mint + kem + 1 nhấn, concept giấy cắt dán đã duyệt.
- **Stella** (nhân vật hư cấu, hình giấy phẳng render từ model) dẫn đường: người xem nhìn từ **sau lưng**, camera bám sau đi sâu vào trang. Đã chọn Stella thay Nikki (có xương, dựng được chu kỳ đi bộ).
- Viền giấy trắng và bóng đổ **nướng sẵn vào texture** (`scripts/lib/paper-bake.mjs`), không dùng shader viền lúc chạy.
- Giới hạn FPS theo tier: high 60, mid 60, low 30; khách ngồi yên 8 giây thì hạ còn 30fps và hoa rơi chậm một nửa; trình duyệt trong ứng dụng (Zalo, Facebook, Instagram, Line) hạ một bậc tier.
- Giờ & địa điểm là HTML thường (`#thong-tin`), có nút ở màn hình đầu; không bắt khách đi hết cảnh 3D mới thấy.

## Unresolved
- Storyboard nháp v2 đã có chuyện thật (quen qua mạng, gặp lần đầu ở nhà thờ, công viên đi chơi và cầu hôn); còn 7 câu hỏi chi tiết cuối phase-01b-storyboard.md.
- Great Vibes có đủ dấu tiếng Việt không (kiểm tra trước khi dùng cho tên).
- Hậu kỳ (bloom) vẫn tắt; chỉ cân nhắc lại nếu storyboard cần ánh sáng đèn lồng thật.
- Giấy phép model Stella (nhân vật trong game): bạn cần kiểm tra trước khi đăng công khai. Repo chỉ đưa ảnh đã render lên web.
