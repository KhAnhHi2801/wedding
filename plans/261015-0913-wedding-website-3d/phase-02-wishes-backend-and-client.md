---
title: "Phase 2: Wishes backend and client"
status: todo
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Wishes backend and client

## Overview

Google Apps Script web app làm endpoint ghi/đọc lời chúc trên Google Sheet, cộng lớp client (gửi, đọc, cache, optimistic UI, phân trang) và form + danh sách lời chúc bằng HTML. Chưa có 3D.

## Requirements

- Functional: gửi `{name, message}`; đọc N lời chúc mới nhất + phân trang cũ hơn; lời chúc vừa gửi hiện ngay; lọc từ ngữ xấu; chống spam.
- Non-functional: không lộ Sheet ID hay quyền ghi; chỉ endpoint Apps Script (công khai) nằm trong bundle; chịu được độ trễ 1-3s của Apps Script.

## Architecture

- **Sheet** (riêng tư, chủ sở hữu bạn): cột `id | createdAt | name | message | status` (`visible` / `hidden`). Kiểm duyệt = đổi `status` trực tiếp trên Sheet (không cần trang admin).
- **Apps Script** (`apps-script/wishes.gs`, người dùng tự dán + deploy "Execute as me / Anyone"):
  - `doPost(e)`: parse `text/plain` JSON; validate (name ≤40, message ≤300, trim, bỏ ký tự điều khiển); honeypot rỗng; thời gian điền form tối thiểu ~3s; token client + `CacheService` giới hạn vài lời chúc/10 phút/token; trần toàn cục/ngày; `LockService` khi append; chống formula injection (định dạng ô `@` và, với giá trị bắt đầu bằng `= + - @`, thêm một dấu cách đứng đầu; gỡ khi đọc: dấu cách đầu ô đảm bảo không bao giờ là công thức, còn `'` có thể hiện thành ký tự thật tùy cách ghi); lọc từ cấm → ghi `status=hidden`; trả `{ok, id}`.
  - `doGet(e)`: tham số `limit` (≤200), `before` (con trỏ là số dòng trong Sheet); chỉ trả `status=visible`; cache `CacheService` ~60s theo tham số và theo "thế hệ" (mỗi lời chúc mới tăng thế hệ để mọi trang cache bị vô hiệu); trả `{items, nextCursor}`. `requestId` giúp gửi lại sau khi hết giờ chờ mà không ghi trùng.
- **Client** (`src/lib/wishes-api.ts`): `fetch` POST với `Content-Type: text/plain`; GET có `AbortController` + timeout; kiểm tra phản hồi bằng schema nhỏ (không tin dữ liệu từ Sheet); lọc từ cấm phía client (UX), server là nguồn tin cậy.
- **Cache client** (`src/lib/wishes-cache.ts`): stale-while-revalidate bằng `localStorage` bọc try/catch (in-app/private mode có thể ném lỗi).
- **UI**:
  - `wish-form-sheet.tsx`: form trong **bottom sheet** (D8) mở từ nút "Gửi lời chúc" (thanh hành động chỉ cuộn tới phần lời chúc); cao theo `dvh`, giữ ô nhập trong vùng nhìn thấy khi bàn phím mở; đếm ký tự, nút chờ, lỗi bằng lời thân thiện; gửi xong đóng sheet. Là `dialog` có quản lý focus (mở → focus ô tên; đóng → trả focus về nút mở; Esc/chạm nền để đóng).
  - `wish-list.tsx`: HTML, "Xem thêm" phân trang; **skeleton** khi đang tải, trạng thái rỗng "Hãy là người đầu tiên gửi lời chúc", lỗi tải có nút "Thử lại".
  - React render dưới dạng text (không `dangerouslySetInnerHTML`).
- Danh sách từ cấm tiếng Việt/Anh ở `src/lib/profanity-list.ts`, có bản sao trong `wishes.gs`; test đối chiếu để hai bản luôn giống nhau.
- Chống ghi trùng: `requestId` do form tạo, giữ nguyên khi gửi lại sau lỗi; thời gian chờ ghi 25s (đọc 10s).
- Bàn phím ảo: sheet nâng lên theo `visualViewport` và giới hạn chiều cao theo vùng nhìn thấy; bỏ qua khi đang phóng to.

## Related Code Files

- Create: `apps-script/wishes.gs`, `apps-script/wishes.test.ts` (chạy `.gs` thật trong sandbox), `docs/wishes-setup.md` (hướng dẫn deploy, thay cho `apps-script/README.md`), `src/hooks/use-visual-viewport-inset.ts`, `src/hooks/use-wishes.test.tsx`, `src/config/env.ts`, `src/lib/wishes-merge.ts`, `src/sections/wishes-section.tsx`, `src/lib/wishes-api.ts`, `src/lib/wishes-cache.ts`, `src/lib/wish-validation.ts`, `src/lib/profanity-list.ts`, `src/components/wish-form-sheet.tsx`, `src/components/wish-list.tsx`, `src/hooks/use-wishes.ts`, `src/lib/*.test.ts`
- Modify: `src/sections/` (thay placeholder lời chúc bằng form + list), `.env.example` (`VITE_WISHES_ENDPOINT`)

## Implementation Steps

1. Viết schema/validation dùng chung (độ dài, trim, ký tự) + test.
2. Viết `wishes.gs` + README hướng dẫn tạo Sheet, dán script, deploy, lấy URL; test bằng `curl` GET/POST.
3. Viết `wishes-api.ts` + cache + `use-wishes` (optimistic append, rollback khi lỗi, dedupe theo `id`).
4. Dựng bottom sheet form + list; skeleton/rỗng/lỗi; "Xem thêm" dùng `nextCursor`; kiểm tra sheet khi bàn phím mở trên iOS Safari và Android.
5. Thêm bộ lọc từ cấm client + test; kiểm tra honeypot và thời gian tối thiểu.
6. Kiểm tra: gửi 3-5 lời chúc thật, xem ở Sheet; thử `=SUM(1,1)` làm tên để chắc chắn bị vô hiệu hóa.

## Success Criteria

- [ ] POST hợp lệ ghi đúng một dòng; payload sai/quá dài/honeypot bị từ chối (đã kiểm bằng sandbox giả lập Sheets; cần xác nhận trên Sheet thật sau khi deploy)
- [ ] Lời chúc có từ cấm vào Sheet với `status=hidden` và không xuất hiện ở GET (đã kiểm bằng sandbox; cần xác nhận trên Sheet thật)
- [x] Lời chúc vừa gửi hiện ngay; lỗi mạng thì rollback và báo lỗi
- [ ] Bottom sheet: ô nhập không bị bàn phím che; focus vào/ra đúng; đóng được bằng Esc/chạm nền (cần thử trên iOS Safari/Android thật, phase 6)
- [ ] Có skeleton khi tải, trạng thái rỗng và lỗi có "Thử lại" (skeleton đã có test render; trạng thái rỗng/lỗi/Thử lại cần xem trên trình duyệt)
- [x] Mở lại trang: danh sách hiện từ cache rồi cập nhật
- [x] Bundle không chứa Sheet ID hay khóa nào ngoài URL endpoint
- [x] Unit test (validation, profanity, cache, merge/dedupe) pass

## Risk Assessment

- **Spam/script gọi thẳng endpoint:** URL endpoint là công khai. Giá trị bảo vệ thấp (chỉ lời chúc), nên chấp nhận rủi ro dư; giảm bằng validation, rate limit theo token, trần ngày, lọc, `hidden`. Tín hiệu: Sheet tăng bất thường → hạ trần ngày hoặc thêm Turnstile (chỉ khi thật sự cần).
- **Apps Script chậm/quota:** cache server 60s + cache client + optimistic UI. Tín hiệu: GET > 3s thường xuyên → tăng TTL cache.
- **Bộ lọc từ cấm sót/sai:** coi là lớp đầu, kiểm duyệt cuối bằng `status` trên Sheet.
- **Ghi nhận token client dễ giả:** chấp nhận; không dùng cho bảo mật, chỉ giảm spam ngẫu nhiên.
