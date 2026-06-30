-- Đánh số liền mạch (Bài 1–8, gồm cả Jingle Bells) + sắp lại trật tự sư phạm
-- cho Chương "Luyện tập vòng hoà âm trên nền trống - bass" (module 319654a9)
-- của khoá "Khởi đầu đam mê - Đệm hát cơ bản".
--
-- Triết lý: làm chủ 4/4 trước (dễ→khó) → Jingle Bells làm mốc thưởng → mở rộng
-- màu thứ + nhịp mới (3/4 Valse, 2/4 Polka) ở cuối; gom hợp âm khó (Fmaj7, E7, E)
-- và nhịp lạ về sau để không gánh 2 cái mới cùng lúc.
--
-- Chỉ đổi order_index + title. KHÔNG đụng content/hợp âm. Idempotent (lookup theo id).

-- Bài 1 — C–Am–Dm–G7 (4/4 ballad)
UPDATE edu_course_lessons SET order_index = 0, title = 'Bài 1: Tập vòng C – Am – Dm – G7'
WHERE id = 'd97089e6-ede6-42ea-9c84-50e3849e459d';

-- Bài 2 — C–G–Am–Fmaj7 (4/4 ballad)
UPDATE edu_course_lessons SET order_index = 1, title = 'Bài 2: Tập vòng C – G – Am – Fmaj7'
WHERE id = 'a1b2c3d4-0004-4a00-9000-000000000003';

-- Bài 3 — Am–Fmaj7–C–G (4/4 ballad)
UPDATE edu_course_lessons SET order_index = 2, title = 'Bài 3: Tập vòng Am – Fmaj7 – C – G'
WHERE id = 'a1b2c3d4-0004-4a00-9000-000000000004';

-- Bài 4 — C–Am–Fmaj7–G7 (4/4 ballad)
UPDATE edu_course_lessons SET order_index = 3, title = 'Bài 4: Tập vòng C – Am – Fmaj7 – G7'
WHERE id = 'a1b2c3d4-0004-4a00-9000-000000000005';

-- Bài 5 — Jingle Bells (bài hát thật, mốc thưởng)
UPDATE edu_course_lessons SET order_index = 4, title = 'Bài 5: Gảy theo Jingle Bells (quạt nốt đen)'
WHERE id = '26f32c3f-8676-4679-a8d8-8cb82c4b387d';

-- Bài 6 — Am–Dm–E7–Am (4/4 ballad, màu thứ)
UPDATE edu_course_lessons SET order_index = 5, title = 'Bài 6: Tập vòng Am – Dm – E7 – Am'
WHERE id = 'ae1fc9f5-670e-444c-9561-f501e78e835e';

-- Bài 7 — Am–Dm–E–Am (3/4 Valse)
UPDATE edu_course_lessons SET order_index = 6, title = 'Bài 7: Tập vòng Am – Dm – E – Am (nhịp 3/4 - Valse)'
WHERE id = 'a1b2c3d4-0004-4a00-9000-000000000007';

-- Bài 8 — Am–E–Am–E (2/4 Polka)
UPDATE edu_course_lessons SET order_index = 7, title = 'Bài 8: Tập đổi Am – E (nhịp 2/4 - Polka)'
WHERE id = 'a1b2c3d4-0004-4a00-9000-000000000006';
