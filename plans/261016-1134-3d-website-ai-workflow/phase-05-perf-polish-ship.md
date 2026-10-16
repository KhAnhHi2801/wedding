# Phase 5 — Perf, polish, ship
Ngân sách (xem [design-system.md](design-system.md)): desktop 60fps, mobile 30fps; DPR ≤ 1.5 mobile; ≤ 4 plane toàn màn hình; không shadow map.
- `quality-tier` (đã làm): high (DPR 2, 60fps, 90 hoa), mid (DPR 1.5, 60fps, 48 hoa), low (DPR 1, 30fps, 20 hoa); tự hạ tier khi FPS trung bình < 45 trong 2 giây khi khách đang tương tác; trình duyệt trong ứng dụng hạ một bậc ngay từ đầu; khách ngồi yên 8 giây thì còn 30fps. Chỉ dùng 60 hoặc 30 để nhịp khung đều trên màn 60Hz/120Hz.
- Đo thật: FPS và thời gian GPU trên iPhone cũ và Android tầm trung, không chỉ trên máy bàn.
- Bộ nhớ GPU: chỉ giữ cảnh hiện tại + kế, `dispose()` texture/geometry khi rời; nạp trước chương sau khi cuộn tới ~60% chương trước; gallery dùng thumbnail 512px trong canvas, ảnh lớn chỉ nạp ở viewer HTML.
- Thử trên điện thoại thật (iOS Safari + Android Chrome): không bị kill tab, không mất context; kiểm `webglcontextlost` rơi về trang tĩnh.
- Checklist Web Interface Guidelines trong `design-system.md`: deep link chương, nút Tạm dừng hạt rơi, form lời chúc, safe-area, theme-color, `Intl` vi-VN.
- `npm run lint` + production bundle; xem `vite preview`; nén ảnh bằng `npm run optimize:images`.
- Deploy theo `ak:deploy` khi user yêu cầu.
