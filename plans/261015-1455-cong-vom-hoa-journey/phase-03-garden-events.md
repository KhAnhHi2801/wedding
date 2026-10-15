---
title: "Phase 3: Scene 2 - Khu vườn và lịch trình"
status: in-progress
priority: P1
effort: "1.25d"
dependencies: [1]
---

# Phase 3: Scene 2 - Khu vườn và lịch trình

## Overview

Sau cổng là khu vườn buổi sáng dựng bằng Three.js: cỏ, hoa, lá đung đưa trong gió, nắng xuyên lá, hạt phấn bay. Lịch trình và bản đồ là HTML phủ lên, thẻ hình vòm.

## Requirements

- Functional: camera đi vào vườn theo đường cong; thẻ sự kiện theo `side` (`?nha=`); nút Chỉ đường và Xem bản đồ giữ nguyên.
- Non-functional: gió chạy trong vertex shader; số instance theo tier; giờ/địa chỉ ≥18px, vùng chạm ≥44px; thẻ HTML luôn đọc được kể cả khi 3D tắt.

## Architecture

- `src/journey/scenes/garden-scene.ts`: `InstancedMesh` cỏ/lá/hoa với `uTime` cho gió; ánh sáng hướng ấm + bán cầu; bụi phấn (`Points`); sương nhẹ (`Fog`) cho chiều sâu.
- `event-card.tsx` dùng `arch-frame` (CSS) làm đầu thẻ; nền thẻ mờ nhẹ để cảnh 3D thấy qua nhưng chữ vẫn tương phản AA.

## Related Code Files

- Create: `src/journey/scenes/garden-scene.ts`, `src/components/arch-frame.tsx`
- Modify: `src/components/event-card.tsx`, `src/sections/events-section.tsx`, `src/sections/sections.test.tsx`, `src/styles/sections.css`

## Implementation Steps

1. Dựng đồng cỏ/hoa instanced + gió; chỉnh theo tier.
2. Ánh sáng, sương, hạt phấn; khớp màu với `--tod` ban ngày.
3. Làm lại thẻ sự kiện hình vòm; giữ logic `?nha=`; cập nhật test.

## Success Criteria

- [ ] `?nha=trai|gai|sai|thiếu` đều hiện đúng sự kiện
- [ ] Từ màn hình đầu tới Chỉ đường ≤1 chạm
- [ ] Vườn ≥30fps ở tier trung (throttle 4x); tier thấp giảm mật độ nhưng vẫn đẹp
- [ ] Thẻ đạt tương phản AA trên nền cảnh

## Risk Assessment

- Cỏ/hoa nhiều làm tụt FPS → mật độ theo tier, cắt tỉa theo khoảng cách camera.
- Chữ khó đọc trên nền cảnh động → thẻ có nền đặc/mờ đủ dày, kiểm ở nhiều vị trí camera.

## Kết quả thực hiện

- Đã làm: `src/journey/scenes/garden-scene.ts` — đồng cỏ (~7000 cọng) và hoa đồng nội đung đưa trong gió bằng vertex shader, hai tường cây hoa dọc lối đi (từ z = -12), ba cổng vòm hoa camera bay xuyên qua, phấn hoa bay, sương mù nền trang đổi theo giờ trong ngày, mặt đất trải tới sát camera (không ghi độ sâu, vẽ trước, mờ theo độ hiện của ảnh hero). Dựng một lần ở mật độ đầy đủ, đổi bậc chất lượng chỉ cắt `mesh.count`/`drawRange`.
- Vườn chỉ hiện SAU khi cổng mở xong (`gate.getState() === 'open'`), ngừng vẽ khi ảnh hero che kín (`photoState.opacity ≥ 0.999`) hoặc camera đã ra khỏi vườn (progress ≥ 0.62); biên dịch shader sớm ở `init`.
- Người dùng báo "không thấy vườn đâu": nguyên nhân là vườn chỉ lộ ra trong ~700px cuộn phía sau thẻ lịch trình, camera chưa tới cổng vòm đầu. Sửa: (1) thêm đoạn cuộn `GardenWalk` (khoảng trống không chữ cao 80svh, chỉ có khi 3D chạy; ban đầu có câu "Mời bạn bước vào khu vườn..." nhưng người dùng thấy gượng nên đã bỏ); (2) tiến độ camera neo theo nội dung (`anchoredProgress`): cuộn hết phần lịch trình thì camera vừa đi hết 3 cổng vòm (`GARDEN_END_PROGRESS = 0.52`), phần còn lại chia đều; (3) ảnh hero mờ dần trong khoảng progress 0.02–0.10.
- Đã sửa theo review: vườn không còn đè lên cổng/ảnh, không vẽ liên tục sau ảnh, mặt đất không làm hỏng crossfade và phấn hoa, sương mù không cấp phát mỗi khung, khóa chương trình shader riêng cho từng kiểu đung đưa, màu tiêu đề nhóm theo token.
- Thẻ sự kiện hình vòm, nền trắng gần đặc, chữ căn giữa. Logic `?nha=` không đổi.
- Đã xem trên Chrome: nhìn thấy đồng cỏ có lối đi, tường cây, các cổng vòm xa dần, câu chào và tiêu đề lịch trình.
- Còn lại: đo FPS trên máy thật (phase 7); phần dưới lịch trình vẫn là phần ảnh tối cũ (phase 4 thay).

### Quy tắc trình bày chữ trên cảnh 3D (từ phản hồi người dùng, áp dụng cho mọi phase sau)

- Chữ nằm trên cảnh 3D luôn nằm trên tấm nền kem hình vòm (`rgba(251,246,240,.95)`, bo đỉnh lớn, đổ bóng nhẹ), chữ tối (`--ink`) trên nền sáng; không đặt chữ trực tiếp lên hoa lá hay cỏ.
- Chỉ hai font: serif (Playfair) cho tiêu đề và lời mời, sans (Be Vietnam Pro) cho thông tin; không dùng chữ nghiêng/màu lạ.
- Nút hành động là khối nút rõ ràng (đã có `.btn`); phần hướng dẫn nằm cùng tấm nền với tiêu đề.
- Cảnh 3D phải thoáng ở vùng giữa: cây/bụi gom thấp sát mặt đất, không rải lá lơ lửng.
- Đã áp dụng: `.events-head` (tiêu đề + hướng dẫn), `.group-title` (nhãn nhà trai/nhà gái dạng viên thuốc).
- Giảm "hạt" trên điện thoại (phản hồi người dùng): nhiều hoa/lá nhỏ ở xa thu thành đốm lấm tấm. Đã giảm số lượng (cỏ 7000→4500, hoa đồng nội 500→240, lá/hoa tường cây 1400/800→650/360, phấn hoa 500→120, hoa/lá cổng vòm 130/90→90/60), tăng kích thước phần tử còn lại, phấn hoa to hơn nhưng mờ hơn, sương mù kéo gần (8→44) để chi tiết ở xa tan vào nền. Kiểm bằng khung 390x780 trong Chrome thật. Nếu vẫn còn "hạt" thì hướng tiếp theo: bỏ phấn hoa ở bậc thấp, hạn chế sway ở phần tử xa.
- Sửa lỗi "chấm li ti/nhiễu" thật trên điện thoại (phản hồi người dùng, 2 nguyên nhân): (1) texture hoa/lá vẽ ở độ phân giải thấp nên nhiễu dither của gradient canvas bị phóng to thành chấm — đã vẽ ở độ phân giải gấp 4; (2) `alphaToCoverage` bật cố định, không có MSAA thì mép bị rải thành chấm trắng — nay chỉ bật khi `hasMsaa(renderer)`; (3) iPhone bị xếp vào bậc thấp (DPR 1, không khử răng cưa, mật độ 30%) vì Safari luôn báo ~4 nhân CPU — nay điện thoại mặc định bậc trung (DPR tối đa 2, có khử răng cưa, mật độ 75%), chỉ máy báo RAM ≤ 2GB mới vào bậc thấp, còn lại do bộ đo FPS tự hạ. Chưa kiểm trên điện thoại thật.
- Mép hoa/lá còn hơi vỡ hạt (phản hồi người dùng, sau khi đã đỡ hẳn): texture canvas có phần trong suốt là (0,0,0,0) nên màu mép bị tối xỉn khi GPU trộn mượt; đã thêm bước "tràn màu" (`bleedColor` trong `gate-textures.ts`: lan màu của phần đặc ra pixel trong suốt lân cận, giữ alpha) và đổi sang `DataTexture` có mipmap. Nếu vẫn thấy hạt: thử thu hẹp dải alpha ở mép trong texture, hoặc tắt viền xám nhạt quanh cánh hoa.
- Hoa/lá ở xa vẫn lấm tấm (phản hồi người dùng): gốc là vật thể nhỏ dưới 1-2 pixel răng cưa/nhấp nháy. Đã cho cỏ, hoa đồng nội, tường cây co nhỏ dần rồi biến mất trong shader (từ 12 tới 22 đơn vị khỏi camera, `FADE_START`/`FADE_END`), hoa lá cổng vòm co ở 15-26 (`ARCH_FADE`), sương mù kéo gần (7-32). Đổi lại: không còn thấy "đường hầm" nhiều cổng vòm ở rất xa, chỉ thấy cổng vòm gần. Chỉnh độ xa bằng các hằng số trên.
- Đổi hướng hẳn (người dùng gửi ảnh iPhone thật trên Vercel, mép hoa lá vẫn lởm khởm): bỏ ảnh texture cắt alpha cho hoa/lá, thay bằng hình học vector (`src/journey/scenes/foliage-geometry.ts`: bông hoa 5 cánh elip + nhụy, chiếc lá thon có gân, tô gradient theo đỉnh, màu theo instance nhân vào). Mép đa giác được GPU khử răng cưa chuẩn, không dither/viền alpha/rìa đen, không `discard` nên vẽ nhẹ hơn trên điện thoại. Đã xóa `gate-textures.ts` (texture canvas + bleedColor) và `msaa.ts` (alphaToCoverage). Cả cổng mở đầu và khu vườn dùng chung hình học này. Vẫn giữ co nhỏ theo khoảng cách (`FADE_*`) và sương mù. Kiểm trong khung 390px ở Chrome thật: mép sạch, phần xa không còn đốm.
- Rủi ro còn lại trên iPhone: bộ đo FPS có thể hạ bậc (giảm độ phân giải) nếu cảnh nặng; chưa đo FPS thật (phase 7).
- Làm vườn liền mạch và sinh động hơn (yêu cầu của người dùng): cổng vòm đặt mỗi ~8 đơn vị (6 cổng: z = -10, -18, -26, -34, -42, -50) nên cổng trước chưa khuất cổng sau đã hiện. Thêm hoa cúc, hoa anh túc đỏ, hoa lưu ly xanh xen vào đồng cỏ (`createRadialFlower` dùng chung cho mọi hoa tròn trong `foliage-geometry.ts`), cùng bướm (cánh vỗ, bay lượn rộng và chậm, 5 màu pastel) và ong (sọc vàng đen, cánh rung nhanh, lượn hẹp): vỗ cánh và quỹ đạo bay chạy trong vertex shader (`withFlight`), co nhỏ dần khi ra xa như cỏ/hoa. Số lượng trong `BASE_COUNTS`, cắt theo bậc chất lượng cùng các instance khác.
- Sửa chuyển động bướm/ong (phản hồi người dùng: bướm "lật như đồng xu", ong "bay tiến lùi"): quỹ đạo cũ là dao động sin quanh một điểm và thân luôn quay một hướng. Nay mỗi con có một HƯỚNG BAY cố định (trái/phải, theo pha của instance), bay hết đoạn đường (12 đơn vị bướm, 14 ong) rồi mờ dần/co nhỏ và xuất hiện lại ở đầu kia (không đảo chiều, không bay lùi); bướm nhìn từ trên xuống, thân xoay về hướng bay, nghiêng theo nhịp nhấp nhô, khép/mở cánh nhẹ (mix 0.4-1); ong nhìn nghiêng, lật theo hướng bay, cánh (thuộc tính `wing`) xoay quanh khớp `BEE_HINGE` rung nhanh. Thử nghiệm bỏ qua: bướm nhìn nghiêng với cánh xoay quanh khớp (trông như quả bóng hồng có que đen, bỏ). Đã xem bướm trên Chrome; ong chưa xem rõ.
- Cân lại độ dày hoa lá cổng mở đầu và cổng vườn (phản hồi người dùng: cổng vào quá dày, ngợp trên điện thoại; cổng vườn thưa): cổng mở đầu giảm số lượng gốc (hoa khung 380→230, lá khung 200→130, hoa cánh 250→140, lá cánh 120→70), trần nhân theo diện tích cổng 2.4→1.6 và trần nhân kích thước 1.3 (điện thoại dọc trước đây bị nhân gần 2.4 lần cả số lượng lẫn kích thước); cổng vườn tăng hoa 70→120, lá 46→80 mỗi cổng. Chưa kiểm trên điện thoại thật.
- Cổng mở đầu vẫn "chi chít" dù đã giảm số lượng (xem ảnh thật ở khung 390px): gốc là bố cục chứ không phải số lượng, vì hoa lá rải đều khắp hai cánh nên thành một tấm thảm, không phân biệt cánh cổng với vòm. Sửa: hoa lá trên hai cánh chỉ dồn thành dải dọc đường giữa hai cánh (70%) và cụm thấp sát đất (30%), phần còn lại để trống nền xanh nhạt; dải hoa quanh khung hẹp lại (độ lệch -0.1..0.3 thay -0.2..0.45); từng bông nhỏ hơn. Cổng vườn: hoa 170, lá 100 mỗi cổng, thêm cụm hoa ở đỉnh vòm như cổng mở đầu, bông to hơn chút. Chưa xem cổng vườn trên máy thật.
- Bỏ tấm nền kem trên cổng mở đầu (đề xuất của người dùng: chữ viết thẳng lên cánh cổng): lời mời + tên cô dâu chú rể nằm trực tiếp trên nền xanh nhạt của hai cánh, chữ ink, không bo/đổ bóng. Để chữ đọc được, dải hoa giữa hai cánh chỉ còn ở chân và đỉnh cánh (26% chiều cao mỗi đầu), đoạn giữa trống. Quy tắc "chữ trên cảnh 3D nằm trên tấm kem" chỉ còn áp dụng cho cảnh vườn. Chưa tách tên theo từng cánh.
- Sửa sau ảnh iPhone thật ("ẩu"): (1) các lần xem trước trên Chrome sai vì tab bị ẩn nên hoa chưa nở hết, hoa/lá nhỏ hơn thật nhiều. Cách xem đúng: tạm đặt `INTRO_SECONDS` rất nhỏ khi chụp rồi trả lại. (2) cánh hoa HTML rơi đè lên chữ → ẩn `.petal-field` khi cổng chưa mở; (3) dải hoa giữa hai cánh ở đỉnh đè lên dòng lời mời → chỉ còn 13% chiều cao mỗi đầu; (4) bông hoa/lá nhỏ lại (hoa 0.25-0.47, lá 0.34-0.54 nhân kích thước, trần nhân 1.15).
- Bỏ dòng "Trân trọng kính mời" trên cổng (đã có ở hero sau khi mở): cổng chỉ còn tên cô dâu chú rể, chữ to hơn.
- Làm lại cổng mở đầu theo hướng "cổng có chiều sâu" (người dùng chọn, từ góp ý bố cục): khung vòm + hai trụ dày màu kem có lớp viền tối lùi ra sau và đế trụ; hai cánh sắt mảnh (thanh đứng theo đường vòm, hai thanh ngang, cung vòm trên, thanh giữa, hai núm vàng) trên nền sương mờ thay cho tấm xanh đặc; hoa chỉ dồn ở đỉnh vòm và hai chân trụ (thân cổng để trống); cả cổng lắc nhẹ quanh trục đứng lúc chờ (±9°) để các lớp lệch nhau, tắt dần khi mở. HTML: tên + ngày cưới trên cánh, nút "Mở thiệp" viền mảnh nhỏ (vùng chạm 44px). Chưa làm: vòm kiểu đá/đổi sang vàng, chạm kéo để nghiêng cổng, ổ khóa 3D.
- Thêm ánh sáng cho cổng mở đầu (góp ý: cảnh nhìn phẳng vì vật liệu không ăn sáng): khung/đế dùng `MeshLambertMaterial`, thanh sắt và núm vàng dùng `MeshPhongMaterial` (có điểm sáng), một đèn môi trường + một đèn hướng ấm đặt ngoài `root` để bóng đổi theo khi cổng lắc, gỡ cùng cổng. Hoa/lá vẫn là `MeshBasicMaterial` tô màu theo đỉnh (phẳng, nhẹ). Nút "Mở thiệp" thêm `backdrop-filter: blur(6px)`. Không dùng file GLB: toàn bộ dựng bằng code để nhẹ cho 4G và tránh texture gây vỡ hạt.
- Cổng mở đầu theo phản hồi người dùng (ảnh iPhone): bỏ song sắt, thanh ngang, cung trên và núm vàng (chỉ còn nền sương mờ và thanh giữa dày); tăng hoa lá (khung 460/240, cánh 110/60, bông lớn hơn); chữ: tên cô dâu ở cánh trái, tên chú rể ở cánh phải, "&" là huy hiệu tròn viền vàng ở đường giữa như khoá cổng; mỗi tên xuống dòng theo từng chữ (`width: min-content`) để vừa một cánh; bỏ ngày tháng trên cổng. `.hero-names` có thêm hai `span.hero-name` (bản HTML cổ điển vẫn xếp dọc như cũ).
