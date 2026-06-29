-- Thêm 3 bài luyện vòng hoà âm (strum) vào Chương 4 của khoá
-- "Khởi đầu đam mê - Đệm hát cơ bản".
--
-- Module Chương 4: 319654a9-f926-4b68-8adb-d5a1f566718d
-- Định dạng content bê y Bài 1/Bài 2: ballad, tempo 70, nốt đen (den), 4/4.
-- Chỉ dùng hợp âm đã dạy trong khoá: C, G, G7, Am, Dm, E7, Fmaj7.
--
-- Thứ tự sau khi chạy:
--   0 Bài 1 (C–Am–Dm–G7)   1 Bài 2 (Am–Dm–E7–Am)
--   2 Bài 3 (C–G–Am–Fmaj7) 3 Bài 4 (Am–Fmaj7–C–G) 4 Bài 5 (C–Am–Fmaj7–G7)
--   5 Gảy theo: Jingle Bells
--
-- Idempotent: id cố định + ON CONFLICT DO UPDATE; chạy lại nhiều lần không nhân đôi.

-- Bài 3 ----------------------------------------------------------------------
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, tools, order_index, is_published, tier)
VALUES (
  'a1b2c3d4-0004-4a00-9000-000000000003',
  '319654a9-f926-4b68-8adb-d5a1f566718d',
  'Bài 3: Tập vòng C – G – Am – Fmaj7',
  'strum',
  '<p>{"styleId":"ballad","tempo":70,"patternId":"den","timeSignature":4,"chords":["C","G","Am","Fmaj7"]}</p>',
  '[]'::jsonb, 2, false, 'free'
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, content = EXCLUDED.content, order_index = EXCLUDED.order_index;

-- Bài 4 ----------------------------------------------------------------------
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, tools, order_index, is_published, tier)
VALUES (
  'a1b2c3d4-0004-4a00-9000-000000000004',
  '319654a9-f926-4b68-8adb-d5a1f566718d',
  'Bài 4: Tập vòng Am – Fmaj7 – C – G',
  'strum',
  '<p>{"styleId":"ballad","tempo":70,"patternId":"den","timeSignature":4,"chords":["Am","Fmaj7","C","G"]}</p>',
  '[]'::jsonb, 3, false, 'free'
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, content = EXCLUDED.content, order_index = EXCLUDED.order_index;

-- Bài 5 ----------------------------------------------------------------------
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, tools, order_index, is_published, tier)
VALUES (
  'a1b2c3d4-0004-4a00-9000-000000000005',
  '319654a9-f926-4b68-8adb-d5a1f566718d',
  'Bài 5: Tập vòng C – Am – Fmaj7 – G7',
  'strum',
  '<p>{"styleId":"ballad","tempo":70,"patternId":"den","timeSignature":4,"chords":["C","Am","Fmaj7","G7"]}</p>',
  '[]'::jsonb, 4, false, 'free'
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, content = EXCLUDED.content, order_index = EXCLUDED.order_index;

-- Đẩy "Gảy theo: Jingle Bells" xuống cuối (order 5) ---------------------------
UPDATE edu_course_lessons
SET order_index = 5
WHERE id = '26f32c3f-8676-4679-a8d8-8cb82c4b387d';
