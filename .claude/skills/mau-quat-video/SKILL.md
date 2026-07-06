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
- `big:1` = mũi tên to (cú nhấn/đầu phách); `ac:1` = tô sáng "nhấn" (phách mạnh, thường phách 1 & 3); `c` = nhãn đếm dưới mũi tên (`'1' '&' '2'` hoặc `'Bùm' 'chát'`).
- Barline tự vẽ ở ranh giới phách nguyên (code nhóm theo `cum` chạm số nguyên).

## Chữ ký từng điệu (theo thầy — xem [[project_dh2_course]])
- **Ballad**: chùm 2, ↓↑ đều, nhấn phách 1&3, ~72bpm (đều, không giật).
- **Bolero**: chùm 3 **lệch phải**, "Bùm(↓) — chát(↑) chát(↑)" = đơn·kép·kép (d = .5/.25/.25).
- **Slowrock**: chùm 3 (liên 3) rải đều, đong đưa; d = 1/3.
- **Valse**: nhịp 3/4, nốt đen "Bùm-chát-chát" (chắc, staccato); biến thể chùm 2 cho điệp khúc (nhún nhảy hơn).

## Tính năng trang (đã có sẵn trong template)
- **🎬 Chế độ quay**: ẩn nút + chữ, chỉ còn ô nhịp sạch (phím Esc thoát).
- **Nền xanh**: đổi nền chroma (#00b140) để key-out ghép overlay lên video.
- BPM slider, **🔊 Gõ nhịp** (WebAudio click), **Đếm vào** (đếm ngược 1 ô), phím **Space** chạy/dừng.
- `prefers-reduced-motion`: tắt sweep + transition.

## Lưu ý kỹ thuật
- Artifact CSP chặn tài nguyên ngoài → mọi thứ inline, dùng font hệ thống (không nhúng webfont). Mũi tên ↓↑ là Unicode.
- Giữ tông ấm gỗ (nâu walnut nền, mũi tên mật ong) — hợp thế giới guitar, tương phản tốt khi quay.
