# Phase 3 — Idea layers: Stella đi sâu vào trang, camera bám sau
Mỗi layer = 1 module + 1 commit, xem trình duyệt trước khi sang layer sau. Theo [storyboard](phase-01b-storyboard.md).

## Hướng đã chốt
Người xem nhìn theo **lưng Stella**, camera bám sau (người thứ ba) và đi **sâu vào trong** (trục -Z), không đi ngang. Cuộn trang = Stella đi; dừng cuộn = Stella đứng yên. Bản xem trước: https://claude.ai/artifact/V9otj1npndguhkgrtG4uDw

## Đã có (khung sườn `src/world`, `src/ui`)
Scroll reader theo vùng chương, store Zustand vanilla, bảng chương, camera rig (nội suy + parallax con trỏ/con quay), quality tier + governor, giới hạn FPS theo tier, cảnh mở đầu (đồi giấy, hình cặp đôi nướng viền, hoa rơi), điều hướng chương, nút tạm dừng hoa rơi, phần **Giờ & địa điểm** HTML thường (`#thong-tin`) và nút dẫn tới đó ở màn hình đầu.

## Việc còn lại
1. **Stella trong cảnh:** mặt phẳng billboard dùng `public/assets/stella/stella-walk.webp` (lưới 4x3, 12 khung, đã nướng viền và bóng; `stella-walk.json` cho kích thước khung và bước chân). Khung hình theo **quãng đường đã làm mượt**, giới hạn nhịp tối đa ~12 chu kỳ/giây để tránh hiệu ứng bánh xe quay ngược; dừng thì chuyển sang `stella-idle.webp`. Một chu kỳ = 1,08 m, đặt tốc độ camera khớp để chân không trượt.
2. **Hành lang truyền phát (streaming):** vật cùng loại gộp vào atlas + `InstancedMesh`, vòng đệm (sinh phía trước camera, thu hồi phía sau), tối đa ~60 vật nhìn thấy. Hình giấy mép cứng nên dùng `alphaTest` + `alphaToCoverage` thay cho trộn alpha: bật `depthWrite`, bỏ sắp xếp, giảm overdraw. Mờ dần theo khoảng cách làm trong shader.
3. **Bố cục hành lang không đối xứng:** rải cây có jitter theo hạt giống, 5–6 họ hình dáng, có cụm và có khoảng trống, mỗi chương một vế khác nhau; đường uốn chữ S nhẹ. Mỗi mốc hiện ở chân trời từ xa trước khi tới (tháp nhà thờ, đèn lồng sáng lên); khi Stella dừng, camera đẩy nhẹ vào.
4. **Mốc dừng:** Stella đứng yên ở mỗi mốc, vật của mốc nằm phía trước một bên đường. Cuộn có `scroll-snap` mức gần ở các mốc để chữ đứng yên đủ lâu để đọc.
5. **Rút ngắn đường đi:** tổng ~45–60 giây cuộn, khoảng cách giữa các mốc ~4 m. Cho phép chạm để đi tiếp. Nút "Bỏ qua, xem thông tin" luôn có (đã làm ở màn hình đầu).
6. **Thống nhất hình ảnh:** cùng cách nướng viền/bóng cho Stella, ảnh cặp đôi và đồ vật (đã làm); thêm lớp hạt giấy mịn chung; giảm bão hòa Stella khoảng 10%; phủ hạt in lên ảnh thật của cặp đôi.
7. **Vai trò của Stella ở mỗi mốc:** cầm điện thoại phát sáng (làm quen), ngẩng nhìn tháp (nhà thờ), ngồi ghế nhìn từ sau (công viên), nhặt và mở thiệp (lời mời), quay lại vẫy ở mốc cuối (lần duy nhất thấy mặt). Cần render thêm tư thế bằng `scripts/render-stella-walk.py`.
8. **Chuyển cảnh theo chất liệu giấy:** mỗi chương một kiểu khác nhau (lật trang, gấp, kéo màn, xé), không dùng một kiểu chung.
9. **Gallery ảnh 3D tương tác:** thẻ giấy treo thành vòng xoay, raycaster cho hover, chạm để lật và vuốt ngang để xoay; nút trước/sau thấy được và phím mũi tên; ảnh lớn ở viewer HTML (`photo-viewer`). Thẻ trong canvas dùng thumbnail 512px.
10. **Wishes:** mỗi lời chúc là một đèn giấy (instance có phát sáng giả, không dùng bloom) + form sheet; gift, music toggle giữ component hiện có.

## Quy tắc
- Mọi chữ là HTML phẳng; canvas không chứa chữ. Thông tin quan trọng luôn đọc được khi 3D tắt.
- Hoa rơi và Stella đi ngắt được bằng thao tác người dùng; hoa rơi có nút Tạm dừng (đã làm), ẩn khi hệ điều hành bật giảm chuyển động.
- Điều hướng chương là liên kết `#id` thật (đã làm); đã thêm `scroll-margin-top`, skip link.

## Validation
Cuộn qua lại, cuộn nhanh/chậm, mobile viewport thật (iOS Safari + trình duyệt trong Zalo/Facebook); không giật, không nhấp nháy khi đổi cảnh, chân không trượt, không bánh xe quay ngược.
