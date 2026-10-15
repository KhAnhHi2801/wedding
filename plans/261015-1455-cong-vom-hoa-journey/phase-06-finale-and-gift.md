---
title: "Phase 6: Scene 5 - Cổng khép và Gửi yêu thương"
status: todo
priority: P1
effort: "0.75d"
dependencies: [2, 5]
---

# Phase 6: Finale and gift

## Overview

Cổng vòm khép lại ở cuối trang, cánh hoa rơi chậm, rồi tới phần "Gửi yêu thương" trên nền hoàng hôn. Giữ nguyên chức năng chép số tài khoản và QR của cô dâu, chú rể.

## Requirements

- Functional: cổng kết (cùng hình với cổng mở) khép lại khi cuộn tới; cánh hoa rơi; hai khối tài khoản + QR (D12 plan cũ); nút Chép số tài khoản là hành động chính; ghi chú "nhấn giữ hình để lưu".
- Non-functional: lời dẫn nhẹ nhàng, không dùng "quét mã/chuyển khoản" làm tiêu đề (D12, D13 plan cũ); tương phản AA trên nền hoàng hôn.

## Architecture

- `src/journey/scenes/finale-scene.ts`: dùng lại model cổng của `gate-scene.ts` (cùng hàm dựng) ở trạng thái khép khi `scrollProgress` gần 1; cánh hoa rơi bằng particles trong shader với màu hoàng hôn.
- `gift-section.tsx` đổi sang khung vòm cho khối tài khoản (HTML phủ lên cảnh); logic sao chép giữ nguyên (`use-copy-to-clipboard`).

## Related Code Files

- Modify: `src/sections/gift-section.tsx`, `src/components/action-bar.tsx` (màu theo `--tod`), `src/styles/sections.css`
- Create: `src/journey/scenes/finale-scene.ts`

## Implementation Steps

1. Tách hàm dựng cổng khỏi `gate-scene.ts` để dùng chung, dựng cảnh kết.
2. Đổi giao diện khối quà sang khung vòm; kiểm nút chép và QR trong trình duyệt thật.
3. Cập nhật test `sections.test.tsx` cho phần quà.

## Success Criteria

- [ ] Chép số tài khoản hoạt động cho cả cô dâu và chú rể; QR lưu được bằng nhấn giữ
- [ ] Cổng kết khép mượt, không che nội dung; reduced-motion hiện tĩnh
- [ ] Thanh hành động đọc rõ ở mọi mốc nền

## Risk Assessment

- Clipboard API bị chặn trong in-app browser → giữ fallback `execCommand`/chọn văn bản đã có.
