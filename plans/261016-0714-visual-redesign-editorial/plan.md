# Visual redesign: Editorial thanh lịch + 3D có chiều sâu thật

Status: draft, chờ user duyệt phase 2-3 trước khi code.

## Outcome
Giao diện đẹp, nhất quán; cảnh 3D có chiều sâu và ánh sáng thật, các chặng (vườn, ảnh, lời chúc) cùng một ngôn ngữ thị giác.

## Quyết định đã chốt (user)
- Phong cách: Editorial thanh lịch. Kem #FBF6F0, ink #3B2A2D, hồng khô #9E5560, champagne #B8924A.
- Chữ: Cormorant Garamond (tiêu đề, italic tên) + Be Vietnam Pro (thân). Thay Playfair.
- Thẻ: kính mờ trắng ~70%, viền 1px champagne, bo 20px, bóng mềm.
- Bố cục: một cột giữa max 560px.
- Phạm vi: bố cục UI, cảnh 3D, màu/typography, phong cách tổng thể.

## Non-goals
- Không đổi nội dung, config, backend lời chúc, logic cổng/gate, fallback HTML.
- Không bỏ fallback reduced-motion/không WebGL.

## Chẩn đoán 3D (nguyên nhân "giả")
1. Mọi thứ là MeshBasicMaterial sprite phẳng: không đèn, không bóng, không shading.
2. Vòm lá = tấm lá phẳng chồng nhau -> khe hở, lặp, không có thể tích.
3. Backdrop là ảnh 2D (garden-far.webp) -> không parallax thật.
4. Hậu kỳ chỉ có cờ bloom cho thread; cảnh vườn không DOF/vignette/grain.
5. Fog màu kem đục -> "phủ trắng" làm mất tương phản chủ thể.

## Phases
1. UI tokens + typography + thẻ kính (CSS, rủi ro thấp). Files: styles/tokens.css, global.css, sections.css, main.tsx, package.json (font).
2. Bố cục cột giữa: events-section, photos-section, photo-wish-card, action bar; sửa thẻ sự kiện bị cắt đáy, gom "Xem tất cả"/lời chúc dưới ảnh. Files: sections/*, components/*, sections.css.
3. 3D depth pass (cần duyệt hướng kỹ thuật):
   - Vòm: thay lá sprite phẳng bằng InstancedMesh lá có normal/thickness nhẹ, nhận đèn (MeshStandard/Lambert), phủ kín khe.
   - Ánh sáng: Hemisphere + Directional (golden hour) theo time-of-day; bóng mềm/contact shadow giả bằng blob dưới hoa.
   - Hậu kỳ: EffectComposer gồm bokeh/DOF nhẹ, bloom nhẹ, vignette, grain; tắt ở tier low.
   - Parallax nhiều lớp backdrop + hạt bụi/cánh hoa 3D thật; giảm fog đục, dùng fog theo chiều cao.
   Files: journey/scenes/garden-scene.ts, flora-sprites.ts, journey-engine.ts, quality-tier.ts, time-of-day.ts.
4. Đồng nhất các chặng: photo-path-scene, thread-gate-scene dùng chung đèn/hậu kỳ/bảng màu.
5. QA: 375/768/1440, reduced-motion, tier low, contrast >= 4.5:1, test + build + lint.

## Acceptance
- Contrast chữ >= 4.5:1 trên 3 mốc cuộn; tap target >= 48px.
- 60fps tier high trên máy trung bình, tier low không hậu kỳ.
- Không còn khe hở vòm; chủ thể tách nền rõ.
- npm test, lint, build xanh.

## Rủi ro
- Phase 3 đổi chất liệu có thể tốn GPU: kiểm tra qua quality-tier.
- Sprite hoa hiện có là cutout 2D, dưới đèn thật có thể cần normal giả; chấp nhận billboard + đèn nhẹ.

## Câu hỏi mở
- Có chấp nhận thêm dependency postprocessing (three/examples đã đi kèm, không cần gói mới)?
- Có thể thay/thêm ảnh sprite hoa mới không, hay chỉ dùng 8 ảnh f1-f8 hiện có?
