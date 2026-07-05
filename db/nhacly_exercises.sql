-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — 3 bài tập tương tác STAFF-ONLY (noFretboard)
-- SINH TỰ ĐỘNG từ db/gen_nhacly_exercises.cjs (đừng sửa tay).
-- lesson_type='flow' + bảng flows. is_published=false (khoá chưa publish).
-- Idempotent: id cố định + ON CONFLICT DO UPDATE.
-- ============================================================================

-- Bài tập: Đọc nốt trên khuông
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100002-0000-4000-8000-000000000002', 'b1000002-0000-4000-8000-000000000002', 'Bài tập: Đọc nốt trên khuông', 'flow', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200002-0000-4000-8000-000000000002', 'a2100002-0000-4000-8000-000000000002', 'Bài tập: Đọc nốt trên khuông', 'published', 10, '[{"id":"n1","order":1,"logic":"DAN","type":"callout","title":"Đọc nốt trên khuông","interactive":{"variant":"tip"},"content":"Nhìn <b>vị trí</b> từng nốt trên khuông rồi đọc tên. Bấm <b>Nghe mẫu</b> để nghe từng nốt sáng lên, hoặc <b>Xướng âm</b> (hát tên nốt) để tự kiểm."},{"id":"n2","order":2,"logic":"LAM","type":"note_practice","title":"Gam Đô trưởng — đọc lên dần","interactive":{"noFretboard":true,"hint":"Từ Đô (dưới khuông) đi lên tới Đô cao: Đô – Rê – Mi – Fa – Sol – La – Si – Đô. Đọc to tên nốt theo từng bước.","notes":[{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2},{"label":"Rê","freq":146.83,"string":4,"fret":0,"staff":-1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0},{"label":"Fa","freq":174.61,"string":4,"fret":3,"staff":1},{"label":"Sol","freq":196,"string":3,"fret":0,"staff":2},{"label":"La","freq":220,"string":3,"fret":2,"staff":3},{"label":"Si","freq":246.94,"string":2,"fret":0,"staff":4},{"label":"Đô","freq":261.63,"string":2,"fret":1,"staff":5}]}},{"id":"n3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình đọc đúng tên nốt theo vị trí trên khuông","Mình phân biệt được nốt trên dòng và nốt trong khe"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Bài tập: Nghe & nhìn trường độ
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100003-0000-4000-8000-000000000003', 'b1000003-0000-4000-8000-000000000003', 'Bài tập: Nghe & nhìn trường độ', 'flow', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200003-0000-4000-8000-000000000003', 'a2100003-0000-4000-8000-000000000003', 'Bài tập: Nghe & nhìn trường độ', 'published', 10, '[{"id":"d1","order":1,"logic":"DAN","type":"callout","title":"Trường độ — dài ngắn của nốt","interactive":{"variant":"tip"},"content":"Cùng một cao độ nhưng <b>hình nốt khác nhau</b> thì ngân <b>dài ngắn khác nhau</b>. Nghe mẫu để cảm nhận rõ."},{"id":"d2","order":2,"logic":"LAM","type":"note_practice","title":"Đen (1) → Trắng (2) → Tròn (4)","interactive":{"noFretboard":true,"showDur":true,"hint":"Nghe metronome đếm phách đều. Bốn nốt đen (mỗi nốt 1 phách) → hai nốt trắng (mỗi nốt 2 phách) → một nốt tròn (ngân 4 phách). Nghe kỹ độ dài khác nhau.","notes":[{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":2},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":2},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":4}]}},{"id":"d3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình nghe rõ nốt tròn ngân dài gấp 4 lần nốt đen","Mình nhận ra đầu nốt rỗng = trắng/tròn, đầu đặc = đen"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Bài tập: Đếm phách trong ô nhịp
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100004-0000-4000-8000-000000000004', 'b1000004-0000-4000-8000-000000000004', 'Bài tập: Đếm phách trong ô nhịp', 'flow', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200004-0000-4000-8000-000000000004', 'a2100004-0000-4000-8000-000000000004', 'Bài tập: Đếm phách trong ô nhịp', 'published', 10, '[{"id":"b1","order":1,"logic":"DAN","type":"callout","title":"Nhịp 3/4 — mỗi ô ba phách","interactive":{"variant":"tip"},"content":"Số chỉ nhịp <b>3/4</b> nghĩa là mỗi ô nhịp có <b>3 phách</b>: mạnh – nhẹ – nhẹ. Cùng đọc và đếm 1‑2‑3, 1‑2‑3."},{"id":"b2","order":2,"logic":"LAM","type":"note_practice","title":"Đọc câu nhịp 3/4","interactive":{"noFretboard":true,"showDur":true,"beatsPerBar":3,"hint":"Để ý số chỉ nhịp 3/4 đầu khuông và vạch nhịp. Ô 1: ba nốt đen. Ô 2: một đen + một trắng (1 + 2 = đủ 3 phách).","notes":[{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Sol","freq":196,"string":3,"fret":0,"staff":2,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":2}]}},{"id":"b3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình đếm đúng 3 phách mỗi ô","Mình cảm được phách mạnh rơi vào đầu ô nhịp"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Bài tập: Đọc một câu nhạc
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100005-0000-4000-8000-000000000005', 'b1000005-0000-4000-8000-000000000005', 'Bài tập: Đọc một câu nhạc', 'flow', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200005-0000-4000-8000-000000000005', 'a2100005-0000-4000-8000-000000000005', 'Bài tập: Đọc một câu nhạc', 'published', 12, '[{"id":"r1","order":1,"logic":"DAN","type":"callout","title":"Đọc trọn một câu nhạc","interactive":{"variant":"tip"},"content":"Ghép mọi thứ đã học: <b>tên nốt + trường độ + ô nhịp</b>. Nghe mẫu một lượt cho quen, rồi <b>Xướng âm</b> theo nhịp."},{"id":"r2","order":2,"logic":"LAM","type":"note_practice","title":"Câu nhạc ngắn — nhịp 4/4","interactive":{"noFretboard":true,"showDur":true,"beatsPerBar":4,"hint":"Đọc lần lượt: tên nốt kèm trường độ. Câu kết bằng nốt trắng (Đô, ngân 2 phách).","notes":[{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":1},{"label":"Rê","freq":146.83,"string":4,"fret":0,"staff":-1,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Fa","freq":174.61,"string":4,"fret":3,"staff":1,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Rê","freq":146.83,"string":4,"fret":0,"staff":-1,"dur":1},{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":2}]}},{"id":"r3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình đọc trôi cả câu, không dừng giữa chừng","Mình giữ phách đều từ đầu đến cuối"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Chương 5: B9(0) → Bài tập đọc(1) → Game nốt(2) → Giải trí bài hát(3)
UPDATE edu_course_lessons SET order_index = 2 WHERE id = '2c083246-48b1-4d20-894b-ce3ee6f23311'; -- Bài 10 Game nốt
UPDATE edu_course_lessons SET order_index = 3 WHERE id = '853bc817-2ee6-434b-946c-4a33acf39d01'; -- Giải trí: Bài hát

NOTIFY pgrst, 'reload schema';
