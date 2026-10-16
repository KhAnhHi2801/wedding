# Phase 1b — Storyboard (BẢN NHÁP v2, đã có chuyện thật, chờ user duyệt)
Mục tiêu: có "đạo diễn" cho trang, tránh 6 chương giống nhau. Phase 3 chỉ cài đặt theo bảng này.
Nguồn: 9 ảnh tách nền thật (`public/assets/cutouts/`), sự kiện trong `src/config/wedding-config.ts`, và chuyện thật do user kể.

## Chuyện thật (user cung cấp)
1. **Làm quen trên mạng.**
2. **Buổi gặp đầu tiên:** anh đón em đi lễ ở **nhà thờ**.
3. **Chốn quen thuộc:** hai người hay đi chơi ở **công viên**.
4. **Cầu hôn:** cũng ở **công viên** (nơi chốn đó vòng lại thành điểm kết của câu chuyện).

Mạch kể: *màn hình → nhà thờ → công viên → lời cầu hôn → lời mời cưới.* Công viên xuất hiện hai lần (đi chơi, cầu hôn): dùng làm "vòng lặp" có chủ đích, cùng một cảnh nhưng đổi ánh sáng và có thêm chiếc nhẫn.

## Những gì ảnh cho thấy
- Hai bộ trang phục: **váy trắng ngà + vest đen** (couple, 03, 04, 05, 08) và **váy kem + vest be/champagne** (01, 02, 07). Màu nhấn gợi ý: champagne (lấy từ vest be, đo lại bằng pixel khi code), cùng blush và xanh nhạt từ bó hoa.
- Có ảnh **riêng từng người**: chú rể ngồi (05), cô dâu quay lưng (06). Có ảnh **chạm trán/chạm mũi** (02, 04). Có ảnh **cầm thiệp** (07, ngang).
- Từ đó có sẵn một cung bậc không cần bịa chuyện: *mỗi người một nơi → gặp nhau → bên nhau → gửi lời mời*.

## Bảng storyboard
| # | Chương | Ý tưởng riêng | Khoảnh khắc ký hiệu | Chuyển sang chương sau | Ảnh | Chữ chính (≤3 dòng, nháp) | Nhịp |
|---|---|---|---|---|---|---|---|
| 1 | Mở đầu | Hai người đứng khoác tay giữa khu đồi giấy mint, hoa giấy rơi (đã dựng) | Camera bước chậm vào cảnh | **Lật trang**: hình cặp đôi cuộn lên như tờ giấy, lộ ra đồi giấy kế | `couple` | Tên cô dâu & chú rể; ngày cưới | Chậm, đứng yên ở cuối |
| 2 | Câu chuyện | **Một hành trình ba điểm dừng, chạy theo thanh cuộn.** (a) *Làm quen:* hai tấm giấy ở hai đầu màn hình, giữa hai bên bay những khung tin nhắn bằng giấy. (b) *Gặp lần đầu:* nền đổi sang nhà thờ giấy (chóp tháp, cửa vòm), hai tấm giấy lại gần nhau. (c) *Công viên:* nền đổi sang công viên giấy (cây tròn, ghế đá, đồi mint), hai người đứng cạnh nhau, rồi chiếc nhẫn giấy xuất hiện | **Gặp nhau và cầu hôn (khoảnh khắc ký hiệu):** hai ảnh riêng trượt lại gần, dừng ở ảnh chạm trán, nhẫn lấp lánh một lần ở công viên | **Gấp đôi**: tờ giấy gấp lại, mép gấp thành đường chân trời của chương sau | `photo-05` (anh) + `photo-06` (em) → `photo-02`; nền là hình giấy dựng bằng code | "Chúng mình quen nhau qua màn hình." → "Lần đầu gặp, anh đón em đi lễ ở nhà thờ." → "Công viên là nơi chúng mình hay đi chơi, và cũng là nơi anh ngỏ lời." *(nháp, câu chữ bạn sửa)* | Cuộn dài ~300svh, ba điểm dừng đều nhau |
| 3 | Sự kiện | Hai người cầm tấm thiệp; tấm thiệp trong ảnh **mở ra thành thiệp giấy 3D**, hiện giờ và địa điểm | Thiệp bung ra | **Kéo màn**: các dải giấy dọc trượt qua màn hình | `photo-07` | Lễ vu quy, lễ thành hôn, tiệc mừng (giờ, nơi, nút chỉ đường là HTML) | Vừa phải |
| 4 | Ảnh | Gallery: ảnh là **thẻ giấy treo** thành vòng xoay; rê chuột nghiêng, bấm thì lật mặt sau | Thẻ lật; mặt sau có thể ghi "Công viên" hoặc "Nhà thờ" nếu ảnh chụp ở đó | **Xé nhẹ**: mép giấy rách, lộ nền dịu hơn | `photo-01`…`08` | "Những khoảnh khắc nhỏ" | Chậm, cho người xem nán lại |
| 5 | Lời chúc | Mỗi lời chúc là một **đèn giấy** nhỏ bay lên, phát sáng nhẹ (nền vẫn sáng, chuyển sang lilac/bơ dịu, không tối) | Đèn mới bay lên khi có người gửi | Cuộn tiếp, đèn mờ dần | (không dùng ảnh) | "Gửi lời chúc cho hai bạn" + form | Chậm |
| 6 | Quà mừng & kết | Ảnh gần gũi nhất làm cảnh cuối; thẻ QR là **tấm giấy** đặt trước ảnh; hoa giấy rơi chậm rồi đậu lại | Hoa giấy ngừng rơi, trang đứng yên | (hết trang) | `photo-04` | "Cảm ơn bạn đã đến" + thông tin quà mừng | Đứng yên |

## Nhân vật dẫn đường: Stella (đã chốt)
- Stella (cáo tai to, đeo kính bay) là **nhân vật hư cấu, khách mời đi qua các mốc**. Người xem nhìn theo **lưng** cô, camera bám theo sau (góc nhìn người thứ ba) và đi **sâu vào trong trang**, không phải đi ngang từ trái sang phải.
- Hình giấy phẳng, render sẵn từ model 3D: `public/assets/stella/stella-walk.webp` (12 khung, lưới 4x3), `stella-idle.webp`, `stella-walk.json`. Model gốc ở `assets-src/stella/` (không vào git). Dựng lại bằng `scripts/render-stella-walk.py` (Blender) và `scripts/pack-stella-walk.mjs`.
- Chọn Stella thay vì Nikki: có bộ xương nên dựng được chu kỳ đi bộ thật; màu kem/nâu/vàng nghệ hợp với mint và champagne; hình dáng (tai, đuôi) dễ nhận ra khi nhỏ và có chuyển động phụ.
- Mốc dừng: Stella đứng yên ở mỗi mốc (ảnh idle), vật của mốc nằm phía trước một bên đường. Quãng đường mỗi chu kỳ 1,08 m để tốc độ camera khớp bước chân.
- Còn thiếu: tư thế riêng ở từng mốc và cảnh Stella quay đầu nhìn lại.
- Bản xem trước: https://claude.ai/artifact/V9otj1npndguhkgrtG4uDw (riêng tư).

## Quy tắc nhịp
- Mỗi màn hình chỉ 1–2 phần tử chuyển động nổi bật; còn lại tĩnh.
- Mỗi cảnh chuyển theo một cách giấy khác nhau (lật, gấp, kéo màn, xé), không dùng một kiểu dolly chung.
- Chỉ một khoảnh khắc ký hiệu cho cả trang: **chương 2 (gặp nhau)**, chạy theo thanh cuộn. Các chương khác tiết chế hơn.
- Có đoạn cuộn "đứng yên" (chỉ chữ và ảnh) ở cuối chương 1 và 6.

## Việc kỹ thuật suy ra (để Phase 3 biết)
- Ch1→2: cần shader/hình học cuộn trang cho một lớp giấy (curl). Ch2: hai lớp giấy chạy theo `progress`, cross-fade sang `photo-02`. Ch3: thiệp mở = plane gập quanh trục (hai nửa xoay).
- Ch4: 8 thẻ trong canvas dùng thumbnail 512px; ảnh lớn ở viewer HTML.
- Ch5: đèn giấy là instance có phát sáng giả (sprite), không dùng bloom.
- Chương 2 cao ~300svh, các chương còn lại ~140svh; `chapters.ts` hiện chia đều, cần thêm trọng số chiều cao. Chương 2 có 3 điểm dừng phụ (làm quen, nhà thờ, công viên) nên cần bảng "beat" con theo `progress` cục bộ của chương.
- Nhà thờ, cây, ghế đá, khung tin nhắn, nhẫn: **hình giấy dựng bằng code** (Shape + màu mint/kem), không cần model 3D hay ảnh nào thêm; ghi nhớ giữ phong cách phẳng có độ dày như các đồi giấy.
- Cảnh hiện tại (`opening-scene.ts`) là chương 1; các chương 2–3 trong `chapters.ts` đang là tư thế camera giữ chỗ.

## Còn cần bạn trả lời
1. **Giọng văn:** trang trọng, thân mật, hay hài hước nhẹ? Và xưng "chúng mình", hay "anh"/"em"?
2. **Khoảnh khắc ký hiệu** là chương 2 (hành trình gặp nhau và cầu hôn) như nháp, hay muốn chương thiệp bung ra (3)?
3. **Nhà thờ:** có tên hoặc nét riêng (tháp chuông, mái, cửa kính màu) để vẽ gần giống không? Công viên: có cây, hồ, ghế đá hay vật gì đặc trưng?
4. **Chi tiết cầu hôn** (nếu muốn kể): có nhẫn, hoa, hay lời nói nào đáng nhớ?
5. **Mặt sau thẻ ảnh:** chú thích ngắn, địa điểm chụp, hay để trống?
6. **Thứ tự tên:** hiện cô dâu trước, giữ nguyên chứ?
7. Ảnh riêng từng người (`photo-05`, `photo-06`) xuất hiện ở chương 2: có ổn không?

## Validation
User duyệt bảng này; mỗi chương có ý tưởng riêng, cách chuyển khác nhau, chữ thật thay cho chữ nháp.
