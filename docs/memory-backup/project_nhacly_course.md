---
name: project_nhacly_course
description: "Khoá \"Chìa Khoá Nhạc Lý Cơ Bản\" — tái cấu trúc 5 chương + điền Bài 8/9 + 3 bài tập tương tác staff-only; 3 file SQL chờ thầy chạy"
metadata: 
  node_type: memory
  type: project
  originSessionId: 16a41bfe-24d3-487b-9a51-91d2caf8df3c
---

Khoá **Chìa Khoá Nhạc Lý Cơ Bản** (course_id `79706056-ddf5-4741-8811-1f33f4ee0d48`, slug `nhac-ly-co-ban`). Nhạc lý CHUNG (không dính guitar) → bài tập dùng `noFretboard: true` (ẩn cần đàn, chỉ hiện khuông). Xưng "bạn". Chưa publish (13+3 bài is_published=false).

**Đợt cải tiến (2026-07-05), 3 việc thầy duyệt — code xong, chờ thầy chạy SQL (anon key SELECT-only):**
- `db/nhacly_restructure.sql` — gom 13 bài → 5 chương: Ch1 Âm thanh&Nhạc · Ch2 Nốt&Khuông · Ch3 Trường độ · Ch4 Nhịp&Ô nhịp · Ch5 Thực hành đọc nhạc. Tái dùng module cũ `b64ad7f3` làm Ch1; 4 module mới `b100000{2..5}-...`.
- `db/nhacly_bai89.sql` — điền Bài 8 (dấu nối/chấm dôi/luyến, HTML rich-content) + Bài 9 (quy trình 5 bước đọc nhạc). Trước trống.
- **Bài hát thầy sáng tác** (video Shorts, mỗi bài 1 file SQL, đặt trước bài tập của chương): `db/nhacly_bai_5dongke.sql` "Năm dòng kẻ nhỏ nhỏ" (QEsg_ass3dE) → Ch2; `db/nhacly_bai_quatao.sql` "Quả Táo Trường Độ" (HwVfVy7P9gM) → Ch3. Mạch mỗi chương: lý thuyết → bài hát → bài tập. (Thầy còn sáng tác tiếp cho các chương sau.)
- `db/nhacly_exercises.sql` (sinh từ `db/gen_nhacly_exercises.cjs`) — 4 bài tập `flow` staff-only: Ch2 gam Đô trưởng đọc lên (no beatsPerBar), Ch3 đen/trắng/tròn (showDur, KHÔNG số chỉ nhịp — chưa học nhịp), Ch4 nhịp 3/4, Ch5 câu nhạc 4/4. Số chỉ nhịp chỉ xuất hiện từ Ch4 (sau khi học nhịp). Slides trùng sample trong `src/FlowLabPage.tsx` (preview `?bai=nl2/nl3/nl4/nl5`).

**noFretboard** thêm ở `NotePracticeCfg` (guitarRenderers.tsx) — dùng chung engine [[project_tia_not_1_philosophy]], chuẩn khắc nhạc theo skill [[project_khuong_nhac_skill]] (SKILL.md đã ghi biến thể noFretboard). Bài tập dùng lại đúng staff/freq/dây-ngăn của TN1.

**Xướng âm (2026-07-05):** khi `noFretboard`, nút "Tự đàn"→"Xướng âm" (hát tên nốt thay vì đàn). Logic chấm KHÔNG đổi — vốn đã so `pitchClass` (bỏ octave) nên hát octave nào cũng đúng. Nghe mẫu giữ nguyên để hát theo.

Còn có thể làm sau: publish khoá (chưa duyệt) + viết mô tả khoá.
