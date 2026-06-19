-- Tạo Bài 1 "Nốt Mi — dây 1 buông" cho khoá "Tỉa nốt căn bản", Chương 1 (engine Flow).
-- Idempotent: chạy lại sẽ cập nhật, không tạo trùng.
DO $$
DECLARE
  v_course uuid;
  v_mod    uuid;
  v_lesson uuid;
BEGIN
  SELECT id INTO v_course FROM edu_courses WHERE name ILIKE '%Tỉa nốt căn bản%' LIMIT 1;
  IF v_course IS NULL THEN RAISE EXCEPTION 'Không tìm thấy khoá "Tỉa nốt căn bản"'; END IF;

  -- Chương 1 (lấy chương đầu, tạo nếu chưa có)
  SELECT id INTO v_mod FROM edu_modules WHERE course_id = v_course ORDER BY order_index LIMIT 1;
  IF v_mod IS NULL THEN
    INSERT INTO edu_modules (course_id, name, order_index)
      VALUES (v_course, 'Chương 1 — Làm quen nốt nhạc', 0) RETURNING id INTO v_mod;
  END IF;

  -- Bài 1 (tạo hoặc cập nhật theo tiêu đề)
  SELECT id INTO v_lesson FROM edu_course_lessons WHERE module_id = v_mod AND title ILIKE 'Nốt Mi%' LIMIT 1;
  IF v_lesson IS NULL THEN
    INSERT INTO edu_course_lessons (module_id, title, lesson_type, order_index, tools)
      VALUES (v_mod, 'Nốt Mi — dây 1 buông', 'flow', 0, '[]') RETURNING id INTO v_lesson;
  ELSE
    UPDATE edu_course_lessons SET lesson_type = 'flow' WHERE id = v_lesson;
  END IF;

  -- Flow (upsert theo lesson_id)
  DELETE FROM flows WHERE lesson_id = v_lesson;
  INSERT INTO flows (lesson_id, title, reward_xp, status, slides) VALUES (
    v_lesson, 'Nốt Mi — dây 1 buông', 10, 'published',
    $json$[
      {"id":"s1","order":1,"logic":"DAN","type":"callout","title":"Nốt Mi — dây 1 buông","interactive":{"variant":"teacher"},"content":"Hôm nay em làm quen nốt nhạc đầu tiên trên đàn guitar: <b>nốt Mi</b>. Cùng nhìn, chơi và luyện tập nhé!"},
      {"id":"s2","order":2,"logic":"NHAN","type":"note_show","title":"Nhìn trên khuông nhạc","interactive":{"label":"Mi","freq":329.63,"string":1,"fret":0,"staff":7,"showStaff":true,"showFretboard":false,"caption":"Đây là nốt <b>Mi</b>. Trên đàn guitar, Mi được viết ở <b>khe thứ 4</b> của khuông nhạc — khi thấy nốt ở đây, em nhớ tên nó là <b>Mi</b>."}},
      {"id":"s3","order":3,"logic":"NHAN","type":"note_show","title":"Chơi trên đàn & đọc TAB","interactive":{"label":"Mi","freq":329.63,"string":1,"fret":0,"showStaff":false,"showFretboard":true,"caption":"Nốt Mi chính là <b>dây 1 buông</b> — dây mỏng nhất của đàn. Bấm nghe thử rồi gảy đúng dây đó (tay trái không bấm phím nào)."}},
      {"id":"s4","order":4,"logic":"LAM","type":"note_practice","title":"Đánh theo: nốt Mi","interactive":{"notes":[{"label":"Mi","freq":329.63,"string":1,"fret":0,"staff":7},{"label":"Mi","freq":329.63,"string":1,"fret":0,"staff":7},{"label":"Mi","freq":329.63,"string":1,"fret":0,"staff":7},{"label":"Mi","freq":329.63,"string":1,"fret":0,"staff":7}]}},
      {"id":"s5","order":5,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình gảy đúng dây 1 (mỏng nhất)","Tiếng đều theo nhịp, không vội"]}},
      {"id":"s6","order":6,"logic":"DAN","type":"callout","title":"Lời thầy","interactive":{"variant":"teacher"},"content":"Tốt lắm! Mi là nốt đầu tiên — cứ gảy đều cho quen tay. Mai mình thêm nốt mới nhé."}
    ]$json$::jsonb
  );

  RAISE NOTICE 'Đã tạo/cập nhật Bài 1 (lesson %) trong chương %', v_lesson, v_mod;
END $$;
