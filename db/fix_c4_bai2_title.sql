-- Sửa tiêu đề Bài 2 (Chương 4 — Luyện vòng hoà âm trên nền trống-bass)
-- của khoá "Khởi đầu đam mê - Đệm hát cơ bản" cho KHỚP hợp âm thật.
--
-- Hợp âm thật trong content: ["Am","Dm","E7","Am"]
-- Tiêu đề cũ (sai):  "Bài 2: Tập vòng Am – G – Fmaj7 – E7"
-- Tiêu đề mới (đúng): "Bài 2: Tập vòng Am – Dm – E7 – Am"
--
-- Idempotent: lookup theo id cố định; chạy lại nhiều lần không gây hại.

UPDATE edu_course_lessons
SET title = 'Bài 2: Tập vòng Am – Dm – E7 – Am'
WHERE id = 'ae1fc9f5-670e-444c-9561-f501e78e835e';
