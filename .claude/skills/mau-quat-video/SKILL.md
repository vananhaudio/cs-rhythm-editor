---
name: mau-quat-video
description: Tạo trang "Mẫu Quạt" (strum pattern overlay) — ô nhịp với mũi tên ↓↑ chạy sáng theo BPM, làm NGUYÊN LIỆU chèn/overlay vào video dạy đệm hát của thầy. Dùng khi thầy nói "tạo mẫu quạt", "pattern quạt cho video", "nguyên liệu strum score cho video", "làm hình quạt điệu X để quay".
---

# Skill: Mẫu Quạt cho video (strum pattern overlay)

Tạo một **Artifact HTML fullscreen** hiển thị một ô nhịp đệm hát: mũi tên **↓ / ↑** cho từng cú quạt, sáng chạy theo nhịp theo BPM, có tiếng gõ + đếm vào. Thầy mở fullscreen → **quay màn hình** → ghép/overlay vào video mẫu đang đàn.

**Đây KHÁC skill [[strum-score]]:** `strum-score` nhúng `ChordStrumPlayer` (bài quạt-theo-bản-thu) vào *bài học trong LMS*; còn skill này tạo *trang overlay độc lập* làm **nguyên liệu quay video**, không đụng DB.

## Quy trình
1. Lấy file mẫu `strum_pattern_template.html` (cùng thư mục skill này) làm gốc — ĐỪNG viết lại từ đầu.
2. Sửa/điền mảng `PATTERNS` cho đúng điệu thầy cần (xem định dạng dưới). Nếu chỉ cần 1 điệu, vẫn giữ vài preset cho tiện.
3. Ghi ra file trong scratchpad rồi gọi tool **Artifact** (favicon 🎸) để publish. Gửi link cho thầy.
4. KHÔNG cần chạy server/preview — Artifact tự host, thầy mở là dùng.

## Định dạng một mẫu quạt (PATTERNS)
```
{ id:'chum2', name:'Chùm 2 — Ballad', meter:'4/4', bpb:4, bpm:72, cells:[
  {s:'↓', big:1, ac:1, c:'1', d:.5}, {s:'↑', c:'&', d:.5}, ... ] }
```
- `bpb` = số phách/ô; `bpm` = nhịp độ mặc định (Ballad ~72 = gần nhịp tim; Slowrock ~64; Valse ~100).
- Mỗi `cell`: `s` = mũi tên `'↓'`/`'↑'` (hoặc chữ); `d` = độ dài tính bằng PHÁCH (0.5 = móc đơn/chùm 2, 1/3 = liên 3/chùm 3, .25 = kép). **Tổng `d` mỗi ô phải = `bpb`.**
- `str` = **độ mạnh phách → kích thước mũi tên** (xem QUY TẮC dưới); `c` = nhãn đếm dưới mũi tên (`'1' '&' '2'` hoặc `'Bùm' 'chát'`).
- Barline tự vẽ ở ranh giới phách nguyên (code nhóm theo `cum` chạm số nguyên).

## ⭐ QUY TẮC HỆ THỐNG — kích thước mũi tên = độ mạnh phách
Áp cho MỌI hiển thị quạt trong hệ skill (mau-quat-video, và tinh thần chung cho [[strum-score]]):
- `str:3` = **mạnh** → mũi tên **to & DÀI nhất** (phách 1).
- `str:2` = **vừa** → to vừa (phách 3 trong 4/4).
- `str:1` = **nhẹ** → nhỏ (phách 2 & 4).
- `str:0` = **siêu nhỏ** → các phách phụ "và"/nốt kép/nốt lấp.

Với **nhịp 4/4**, luật mạnh-nhẹ chuẩn là: **1 mạnh · 2 nhẹ · 3 vừa · 4 nhẹ**, các "và" siêu nhỏ. (Nhịp 3/4: 1 mạnh · 2,3 nhẹ.) Kích thước do class CSS `.cell.s0…s3` (font-size + scaleY) — bậc phải TÁCH BẠCH rõ, phách 3 (vừa) phải nhìn rõ lớn hơn phách 2/4 (nhẹ).

## Chữ ký từng điệu (theo thầy — xem [[project_dh2_course]])
- **Ballad**: chùm 2, ↓↑ đều, nhấn phách 1&3, ~72bpm (đều, không giật).
- **Bolero**: chùm 3 **lệch phải**, "Bùm(↓) — chát(↑) chát(↑)" = đơn·kép·kép (d = .5/.25/.25).
- **Slowrock**: chùm 3 (liên 3) rải đều, đong đưa; d = 1/3.
- **Valse**: nhịp 3/4, nốt đen "Bùm-chát-chát" (chắc, staccato); biến thể chùm 2 cho điệp khúc (nhún nhảy hơn).

## Tính năng trang (đã có sẵn trong template)
- **⬇ Lưu video 16 nhịp**: xuất file `.webm` (MediaRecorder + `canvas.captureStream(30)`, 16 ô nhịp, không đếm vào) để thầy chèn/overlay vào video. Nền theo trạng thái hiện tại (trắng, hoặc **Nền xanh** để chroma key). Tên file `mauquat-<id>-16nhip.webm`.
- **🎬 Chế độ quay**: ẩn nút + chữ, chỉ còn ô nhịp sạch (Esc thoát) — dùng khi screen-record.
- **Nền xanh**: đổi nền chroma `#00b140` để key-out.
- BPM slider, **🔊 Gõ nhịp** (WebAudio click — KHÔNG lọt vào file video vì captureStream chỉ lấy canvas), **Đếm vào**, phím **Space** chạy/dừng.

## Lưu ý kỹ thuật
- **Vẽ bằng CANVAS 2D** (không phải DOM) — nguồn CHUNG cho cả hiển thị lẫn xuất video. Mũi tên vẽ vector (shaft + head), độ dài theo `SCALE={3:1,2:.66,1:.46,0:.19}`.
- Artifact CSP chặn tài nguyên ngoài → mọi thứ inline, font hệ thống.
- Palette theo **màu app TVA (bản trắng)**: nền **trắng** `#ffffff`, accent **tím** `#4f46e5` (UI + vạch quét + count-in), mũi tên **đen** `#1a1a1a` tĩnh → **đỏ** `#dc2626` khi đang chơi. Nền xanh chroma `#00b140` khi bật.
- Xuất `.webm` (vp9/vp8): nếu trình biên tập của thầy không nhận webm → chuyển sang mov/mp4, hoặc dùng bản Nền xanh rồi chroma key.
