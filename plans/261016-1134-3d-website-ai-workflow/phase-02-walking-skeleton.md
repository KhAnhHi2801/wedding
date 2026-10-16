# Phase 2 — Walking skeleton (Step 2: proven prompt) — XONG
Kết quả: `src/world/` (store, bảng chương, camera rig, input, tier, governor, engine), `src/world/scene/` (đồi giấy, hình giấy, hoa rơi, cảnh mở đầu), `src/ui/`. Viền giấy và bóng được nướng sẵn vào texture; lúc chạy chỉ một mẫu texture mỗi pixel.
- Prompt mở đầu (pin three@0.186.1): renderer, camera, 1 object có đèn, animation loop, resize handler, dispose khi unmount.
- Files: `src/world/world-canvas.tsx`, `src/world/world-engine.ts` (mới); mount trong `src/app.tsx`.
- Gồm: DPR cap (1.5 mobile / 2 desktop), `prefers-reduced-motion`, fallback no-WebGL (`src/lib/webgl-support.ts`), `webglcontextlost/restored`.
- Vòng render theo nhu cầu: chỉ vẽ khi progress/con trỏ/animation đổi, dừng khi tab ẩn. Canvas cố định theo `lvh`, chỉ resize khi chiều rộng đổi (ResizeObserver + debounce); scroll đọc 1 lần/khung trong rAF.
- Bổ sung độ sâu tối thiểu (mỗi mục 1 commit, sau khi skeleton chạy), theo [design-system.md](design-system.md):
  1. 3 plane giấy ở Z khác nhau (hậu/trung/tiền) với texture alpha, viền giấy trắng 2–3px từ alpha, bóng tiếp xúc giả.
  2. Camera lệch theo chuột/gyro (damping), tắt khi reduced-motion.
  3. `scene.fog` nhẹ + hemisphere light + tối đa 1 point light; **không shadow map**.
  4. Hậu kỳ chỉ khi storyboard cần (bloom 1 pass nửa độ phân giải, tier cao). Mặc định tắt.
- **Asset ảnh tách nền + depth** (đã xong, user cung cấp): gốc PNG ở `assets-src/cutouts/` và `assets-src/depth/`; bản nén (`npm run optimize:images -- cutouts depth`) ở `public/assets/cutouts/*.webp` (RGBA, 1400px cạnh dài, ~1.4MB tổng) và `public/assets/depth/*.webp` (thang xám, 768px). Tên: `couple`, `photo-01` … `photo-08` (9 ảnh). `photo-07` nằm ngang, còn lại dọc.
- **(Không còn cần cho storyboard hiện tại.) Dùng depth để cắt lớp giấy, không đẩy lưới.** Từ depth tách ảnh thành 2–3 lớp (đầu/thân, váy, hoa cầm tay) bằng ngưỡng + làm mịn, xuất mỗi lớp thành WebP alpha (script offline mới `scripts/split-depth-layers.mjs`). Mỗi lớp dịch phẳng, biên độ tối đa 1–2% chiều cao ảnh. Kiểm tra bằng mắt trên mặt người ở màn hình lớn.
- Lưu ý depth: phủ cả khung (không alpha), nền sáng, phần gần camera (tà váy) tối, tức **trắng = xa, đen = gần**; ngưỡng cắt lớp phải theo chiều này. `photo-03` depth gốc chỉ 1067x1600 (mờ hơn), chấp nhận được vì đã hạ về 768px.
- Texture residency: không nạp cả 9 ảnh cùng lúc (xem Phase 3 mục nạp theo chương).
- Validation: `npm run dev`, xem khung hình, di chuột/nghiêng máy thấy chênh lệch lớp, resize, đổi tab; commit "skeleton".
