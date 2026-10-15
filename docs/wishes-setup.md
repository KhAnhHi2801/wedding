# Cài đặt lời chúc (Google Sheet + Apps Script)

Lời chúc lưu trong một Google Sheet của bạn. Một đoạn Apps Script (`apps-script/wishes.gs`) làm cổng ghi/đọc.
Website chỉ biết URL của cổng này, không có quyền gì khác với Sheet.

## 1. Tạo Sheet và dán script

1. Tạo một Google Sheet mới (tên tùy ý). Giữ riêng tư, không cần chia sẻ.
2. Menu **Extensions > Apps Script**.
3. Xóa nội dung mặc định, dán toàn bộ nội dung `apps-script/wishes.gs`, bấm **Save**.
4. Lần đầu có lời chúc, script tự tạo tab `Wishes` với các cột `id | createdAt | name | message | status`.
5. Script cần runtime **V8** (mặc định của project mới). Nếu project cũ, bật ở **Project Settings > Enable Chrome V8 runtime**.

## 2. Deploy thành web app

1. **Deploy > New deployment > chọn loại Web app**.
2. **Execute as: Me** (chủ Sheet). **Who has access: Anyone**.
3. Bấm **Deploy**, cấp quyền khi Google hỏi (script cần truy cập Sheet này).
4. Sao chép **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`).

Khi sửa `wishes.gs`: **Deploy > Manage deployments > Edit > New version > Deploy** (URL giữ nguyên).

## 3. Nối vào website

Tạo file `.env.local` ở thư mục gốc dự án (file này không được commit):

```
VITE_WISHES_ENDPOINT=https://script.google.com/macros/s/.../exec
```

Chạy lại `npm run dev` (hoặc build lại khi deploy; đặt biến này trong cài đặt biến môi trường của host).

## 4. Kiểm tra bằng curl

```
# Đọc (kết quả ban đầu: {"ok":true,"items":[],"nextCursor":null})
curl -sL "$URL?limit=5"

# Ghi (elapsedMs phải >= 3000, token tùy ý; requestId tùy ý, gửi lại cùng mã thì không bị ghi trùng)
curl -sL "$URL" -H "Content-Type: text/plain" \
  -d '{"name":"Thử nghiệm","message":"Chúc hai bạn hạnh phúc","token":"curl-test","elapsedMs":5000,"website":"","requestId":"curl-1"}'
```

Dùng `-L` vì Apps Script chuyển hướng (302) sang địa chỉ trả kết quả. **Không thêm `-X POST`**: với `-d`, curl đã gửi POST và tự đổi sang GET khi theo chuyển hướng; ép `-X POST` làm lần theo chuyển hướng cũng là POST và trả về trang lỗi dù lời chúc đã được ghi (dễ gửi trùng khi thử lại).

### Kiểm tra chống công thức

Gửi thử tên `=SUM(1,1)`. Trong Sheet, ô tên phải hiện chữ `=SUM(1,1)` (có một dấu cách đứng trước, không phải số 2), và `GET` trả về đúng `=SUM(1,1)`. Đây là bước bắt buộc sau khi deploy vì không thể kiểm tra hành vi thật của Sheets ở máy phát triển.

## Kiểm duyệt

- Đổi cột `status` của dòng thành `hidden` để ẩn lời chúc khỏi website. Đổi lại `visible` để hiện.
- Website chặn lời chúc có từ chưa phù hợp ngay từ form (khách được nhắc chỉnh lại, chưa gửi gì). Chỉ khi ai đó gọi thẳng endpoint, lời chúc mới được ghi với `status = hidden`.
- **Đừng xóa hoặc sắp xếp lại dòng** trong tab `Wishes`: phân trang dùng số dòng làm con trỏ. Muốn ẩn thì đổi `status`.
- Cache phía Apps Script giữ danh sách tối đa 60 giây, nên thay đổi trên Sheet có thể mất tối đa 1 phút để hiện.

## Giới hạn chống spam (sửa trong `wishes.gs`)

| Hằng số | Mặc định | Ý nghĩa |
|---|---|---|
| `RATE_LIMIT` / `RATE_WINDOW_S` | 3 / 600 | Tối đa 3 lời chúc mỗi 10 phút cho mỗi trình duyệt |
| `DAILY_CAP` | 500 | Trần số lời chúc nhận mỗi ngày cho cả trang |
| `MIN_FILL_MS` | 3000 | Điền form nhanh hơn 3 giây bị từ chối |

URL của web app là công khai nên ai biết URL cũng gửi được lời chúc. Các giới hạn trên chỉ làm khó spam ngẫu nhiên,
không phải bảo mật; nội dung xấu lọt qua vẫn xử lý bằng cột `status`.
