-- Thêm 2 bài luyện vòng hoà âm (strum) vào CUỐI Chương "Luyện tập vòng hoà âm
-- trên nền trống - bass" (module 319654a9), ĐẶT SAU bài "Gảy theo: Jingle Bells".
--
-- Mục tiêu: tập hợp âm còn SÓT = E (Mi trưởng) — đã dạy ở Chương 2 nhưng chưa
-- xuất hiện trong bài tập vòng nào.
--
--   Bài 6 — nhịp 2/4 (điệu Polka):  Am – E – Am – E   (luyện đổi cặp Am ↔ E)
--   Bài 7 — nhịp 3/4 (điệu Valse):  Am – Dm – E – Am  (vòng La thứ, E dẫn về Am)
--
-- LƯU Ý: nhịp 2/4 (styleId 'polka', patternId 'den2') cần BẢN WEB ĐÃ DEPLOY
-- code engine mới (backingStyles.ts + strumPatterns.ts). Bài 7 (valse 3/4) chạy
-- được trên bản hiện tại.
--
-- Idempotent: id cố định + ON CONFLICT DO UPDATE; chạy lại nhiều lần không nhân đôi.

-- Bài 6 — 2/4 Polka ----------------------------------------------------------
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, tools, order_index, is_published, tier)
VALUES (
  'a1b2c3d4-0004-4a00-9000-000000000006',
  '319654a9-f926-4b68-8adb-d5a1f566718d',
  'Bài 6: Tập đổi Am – E (nhịp 2/4 - Polka)',
  'strum',
  '<p>{"styleId":"polka","tempo":90,"patternId":"den2","timeSignature":2,"chords":["Am","E","Am","E"]}</p>',
  '[]'::jsonb, 6, false, 'free'
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, content = EXCLUDED.content, order_index = EXCLUDED.order_index;

-- Bài 7 — 3/4 Valse ----------------------------------------------------------
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, tools, order_index, is_published, tier)
VALUES (
  'a1b2c3d4-0004-4a00-9000-000000000007',
  '319654a9-f926-4b68-8adb-d5a1f566718d',
  'Bài 7: Tập vòng Am – Dm – E – Am (nhịp 3/4 - Valse)',
  'strum',
  '<p>{"styleId":"valse","tempo":110,"patternId":"den3","timeSignature":3,"chords":["Am","Dm","E","Am"]}</p>',
  '[]'::jsonb, 7, false, 'free'
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, content = EXCLUDED.content, order_index = EXCLUDED.order_index;
