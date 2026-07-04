---
name: khuong-nhac
description: Chuẩn hoá bố cục & khắc nhạc (engraving) cho khuông nhạc trong màn "Đánh theo" (NotePractice) — vị trí/kích thước số chỉ nhịp, vạch nhịp, vạch kết, dàn đều dòng, không co giãn màn hình khi thao tác. Dùng khi thầy nói "sửa khuông nhạc", "chỉnh bản nhạc cho chuẩn", "bài đánh theo hiển thị chưa đúng", hoặc động tới `NoteSheet`/`NotePractice` trong `src/elearn/guitarRenderers.tsx`.
---

# Skill: Chuẩn hoá khuông nhạc (màn "Đánh theo" — NotePractice)

Component: `NotePractice` + `NoteSheet` trong `src/elearn/guitarRenderers.tsx` (dùng cho slide/lesson `type: 'note_practice'`, ví dụ "Đánh theo: nốt Mi", "Đánh theo: Sol# dây 6"...). `NoteSheet` CHỈ được dùng bên trong `NotePractice` — không nơi nào khác trong repo.

## Khi nào dùng skill này
Thầy muốn sửa/kiểm tra bố cục màn luyện đọc-đánh-theo: khuông nhạc, số chỉ nhịp, vạch nhịp, cách khuông co giãn theo màn hình, hoặc hành vi count-in/nút bấm của `NotePractice`.

## Bố cục 1 màn hình (thứ tự cố định, xem `NotePractice`)
1. Hàng trên: bên trái để TRỐNG bình thường, chỉ hiện **"COUNT IN N"** khi đang đếm lấy đà (thay đúng chỗ đó, KHÔNG đè/thay nút tốc độ); bên phải là 3 nút **Chậm/Vừa/Nhanh** — LUÔN hiện, không đổi vị trí dù bấm gì.
2. Khung khuông nhạc (nền trắng, bo góc) — TRỌNG TÂM màn hình, chứa `NoteSheet`.
3. Khung cần đàn mini (`MiniFretboard`, nền tối) — nốt đang phát sáng vàng cam, đồng bộ theo `cursor`.
4. 2 nút hành động: "▶ Nghe mẫu" / "🎤 Tự đàn" (hoặc "Chơi & chấm" nếu `cfg.scored`).
5. Ô kết quả cuối bài — LUÔN chừa sẵn `minHeight` (hiện tại 39px) dù trống, để không ăn vào phần khuông nhạc phía trên khi bài kết thúc.

## Nguyên tắc BẮT BUỘC — không co giãn màn hình khi thao tác
Bấm bất kỳ nút nào (Nghe mẫu, Tự đàn, đổi tốc độ, hoàn thành bài...) KHÔNG được làm khung khuông nhạc phía trên co lại hay phình ra — vì sẽ làm mất tập trung ánh nhìn học sinh. Cách đang áp dụng: mọi phần tử có thể xuất hiện/biến mất (count-in, ô kết quả) đều đặt trong slot có kích thước cố định từ đầu, không phải mount/unmount làm đổi tổng chiều cao cột flex.

## Chuẩn khắc nhạc (engraving) trong `NoteSheet`
1. **Lấp đầy chiều ngang khung** — SVG không vẽ ở kích thước cố định rồi bị `justifyContent:center` co nhỏ giữa khung. Tính `scale = availW / rowW` (đo qua `ResizeObserver`), giới hạn tối đa **1.6x** để không phóng quá to với bài ít nốt.
2. **Số chỉ nhịp** — dùng glyph Bravura (SMuFL `timeSig`, mã `0xE080 + digit`), KHÔNG dùng chữ số thường (Georgia/Times New Roman). Tử số căn giữa 2 khe trên (`y = bY - 3*gap`), mẫu số căn giữa 2 khe dưới (`y = bY - 1*gap`), cỡ chữ bằng khoá Sol (`fontSize = 4*gap`). Chỉ vẽ ở DÒNG ĐẦU.
3. **Lề phải mỗi dòng SÁT vạch nhịp cuối** — `rowEndX(row)` tính từ vị trí vạch nhịp cuối của CHÍNH dòng đó (`lastBarX + 4`, dòng cuối cùng `+9` để chừa chỗ vạch kết), KHÔNG tính riêng từ vị trí nốt (2 công thức độc lập từng lệch nhau ~9px gây khuông kéo dư ra ngoài vạch nhịp).
4. **Vạch kết (final barline)** — vạch nhịp CUỐI CÙNG của cả bài vẽ 2 nét (nét mảnh + nét đậm cách 4px), các vạch giữa bài vẫn là nét đơn.
5. **Dàn đều (justify) mỗi dòng** — dòng có ít nốt/ô hơn dòng dài nhất sẽ bị GIÃN ĐỀU khoảng cách nốt (nhân hệ số `k` cho mọi `NX` và vị trí vạch nhịp trong dòng đó) để vạch nhịp CUỐI của MỌI dòng thẳng hàng cùng một lề phải — không được để vạch nhịp "lửng lơ" giữa chừng ở dòng ngắn. Neo trái (`x0`) giữ nguyên, chỉ giãn về bên phải.
6. **Nhiều dòng dài → cuộn theo dòng**, tự `scrollTo` dòng có nốt đang chơi (không cuộn ngang từng nốt).

## Quy trình khi sửa bố cục/khắc nhạc
1. Xác định đúng hàm cần sửa trong `NoteSheet` (layout nốt/vạch nhịp) hay `NotePractice` (bố cục màn, nút, count-in).
2. Sửa xong PHẢI verify bằng preview thật (không suy đoán): mở `/flow-lab?bai=<key>` (xem `src/elearn/tiaNot1Lessons.json` để lấy `key` — vd `solthangtap` bài 2 dòng lệch nốt, `totNghiep` bài 4 dòng đều 8 nốt), bấm qua slide `note_practice`, chụp ảnh trước/sau.
3. Test cả bài NGẮN 1 dòng lẫn bài DÀI nhiều dòng lệch số nốt/dòng (dễ lộ lỗi dàn đều/lề phải nhất).
4. Đo layout không bị giật bằng cách bấm Nghe mẫu / để bài chạy hết, so `getBoundingClientRect().height` của khung khuông nhạc trước/trong/sau — chênh lệch phải dưới 1px.
5. `npm run build` (tsc -b) → sửa lỗi type → commit tiếng Việt → push `main`.

## Liên quan
Bộ nhớ: `project_tia_not_1_philosophy`. Font Bravura đã nhúng sẵn ở `index.html`. Component khác dùng chung font này: `NoteStaff` (minh hoạ 1 nốt tĩnh, không có vạch nhịp/nhiều dòng).
