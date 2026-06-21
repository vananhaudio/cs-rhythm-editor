-- Bài 3: Thực hành hợp âm Am
-- Bài 4: Thực hành hợp âm C
-- Bài 5: Thực hành 6 hợp âm cơ bản
-- Dùng embedded_tool nhúng chords-vananhaudio.netlify.app?chord=X
-- Idempotent — chạy lại sẽ cập nhật

DO $$
DECLARE
  v_course uuid; v_mod uuid;
  v_l3 uuid; v_l4 uuid; v_l5 uuid;
BEGIN
  SELECT id INTO v_course FROM edu_courses WHERE name ILIKE '%Đệm hát cơ bản%' LIMIT 1;
  IF v_course IS NULL THEN RAISE EXCEPTION 'Không tìm thấy khoá Đệm hát cơ bản'; END IF;

  SELECT id INTO v_mod FROM edu_modules WHERE course_id = v_course AND name ILIKE 'Chương 1%' LIMIT 1;
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Không tìm thấy Chương 1'; END IF;

  -- ── Bài 3: Am ──────────────────────────────────────────────────────────────
  SELECT id INTO v_l3 FROM edu_course_lessons
    WHERE module_id = v_mod AND title ILIKE '%Am%' AND title ILIKE '%Thực hành%' LIMIT 1;
  IF v_l3 IS NULL THEN
    INSERT INTO edu_course_lessons (module_id, title, lesson_type, order_index, tools)
      VALUES (v_mod, 'Thực hành hợp âm Am (La thứ)', 'flow', 2, '[]') RETURNING id INTO v_l3;
  ELSE
    UPDATE edu_course_lessons SET lesson_type = 'flow' WHERE id = v_l3;
  END IF;
  DELETE FROM flows WHERE lesson_id = v_l3;
  INSERT INTO flows (lesson_id, title, reward_xp, status, slides) VALUES (
    v_l3, 'Thực hành hợp âm Am', 20, 'published', '[
      {
        "id": "am-intro",
        "type": "callout",
        "logic": "NHAN",
        "content": "🎸 Bài này bạn tập hợp âm **Am (La thứ)**.\n\nApp bên dưới sẽ nghe và chấm bạn gảy đúng chưa — bao gồm cả rải từng dây và quạt cả chord!"
      },
      {
        "id": "am-tool",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "Luyện hợp âm Am",
        "interactive": {
          "url": "https://chords-vananhaudio.netlify.app?chord=Am"
        }
      },
      {
        "id": "am-done",
        "type": "checklist",
        "logic": "LAM",
        "content": "Bạn đã hoàn thành bài Am!",
        "interactive": {
          "items": [
            "Tôi đã rải đúng từng dây hợp âm Am",
            "Tôi đã quạt hợp âm Am và được chấm đúng",
            "Tôi sẽ luyện thêm 5 phút mỗi ngày"
          ]
        }
      }
    ]'::jsonb
  );

  -- ── Bài 4: C ───────────────────────────────────────────────────────────────
  SELECT id INTO v_l4 FROM edu_course_lessons
    WHERE module_id = v_mod AND title ILIKE '%hợp âm C%' AND title ILIKE '%Thực hành%' LIMIT 1;
  IF v_l4 IS NULL THEN
    INSERT INTO edu_course_lessons (module_id, title, lesson_type, order_index, tools)
      VALUES (v_mod, 'Thực hành hợp âm C (Đô trưởng)', 'flow', 3, '[]') RETURNING id INTO v_l4;
  ELSE
    UPDATE edu_course_lessons SET lesson_type = 'flow' WHERE id = v_l4;
  END IF;
  DELETE FROM flows WHERE lesson_id = v_l4;
  INSERT INTO flows (lesson_id, title, reward_xp, status, slides) VALUES (
    v_l4, 'Thực hành hợp âm C', 20, 'published', '[
      {
        "id": "c-intro",
        "type": "callout",
        "logic": "NHAN",
        "content": "🎸 Bài này bạn tập hợp âm **C (Đô trưởng)**.\n\nC cần 3 ngón tay — hơi khó hơn Am, nhưng app sẽ chỉ rõ từng dây cần bấm!"
      },
      {
        "id": "c-tool",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "Luyện hợp âm C",
        "interactive": {
          "url": "https://chords-vananhaudio.netlify.app?chord=C"
        }
      },
      {
        "id": "c-done",
        "type": "checklist",
        "logic": "LAM",
        "content": "Bạn đã hoàn thành bài C!",
        "interactive": {
          "items": [
            "Tôi đã rải đúng từng dây hợp âm C",
            "Tôi đã quạt hợp âm C và được chấm đúng",
            "Tôi sẽ luyện chuyển Am ↔ C cho mượt"
          ]
        }
      }
    ]'::jsonb
  );

  -- ── Bài 5: 6 hợp âm ────────────────────────────────────────────────────────
  SELECT id INTO v_l5 FROM edu_course_lessons
    WHERE module_id = v_mod AND title ILIKE '%6 hợp âm%' LIMIT 1;
  IF v_l5 IS NULL THEN
    INSERT INTO edu_course_lessons (module_id, title, lesson_type, order_index, tools)
      VALUES (v_mod, 'Thực hành 6 hợp âm cơ bản', 'flow', 4, '[]') RETURNING id INTO v_l5;
  ELSE
    UPDATE edu_course_lessons SET lesson_type = 'flow' WHERE id = v_l5;
  END IF;
  DELETE FROM flows WHERE lesson_id = v_l5;
  INSERT INTO flows (lesson_id, title, reward_xp, status, slides) VALUES (
    v_l5, 'Thực hành 6 hợp âm cơ bản', 50, 'published', '[
      {
        "id": "6c-intro",
        "type": "callout",
        "logic": "NHAN",
        "content": "🎸 Thử thách cuối chương: luyện **6 hợp âm cơ bản** — Am, Dm, Em, E, C, G.\n\nMỗi hợp âm bạn mở app rồi luyện đến khi được chấm đúng nhé!"
      },
      {
        "id": "6c-am",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "Am — La thứ",
        "interactive": { "url": "https://chords-vananhaudio.netlify.app?chord=Am" }
      },
      {
        "id": "6c-dm",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "Dm — Rê thứ",
        "interactive": { "url": "https://chords-vananhaudio.netlify.app?chord=Dm" }
      },
      {
        "id": "6c-em",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "Em — Mi thứ",
        "interactive": { "url": "https://chords-vananhaudio.netlify.app?chord=Em" }
      },
      {
        "id": "6c-e",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "E — Mi trưởng",
        "interactive": { "url": "https://chords-vananhaudio.netlify.app?chord=E" }
      },
      {
        "id": "6c-c",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "C — Đô trưởng",
        "interactive": { "url": "https://chords-vananhaudio.netlify.app?chord=C" }
      },
      {
        "id": "6c-g",
        "type": "embedded_tool",
        "logic": "LAM",
        "content": "G — Sol trưởng",
        "interactive": { "url": "https://chords-vananhaudio.netlify.app?chord=G" }
      },
      {
        "id": "6c-done",
        "type": "checklist",
        "logic": "LAM",
        "content": "Xuất sắc! Bạn đã luyện đủ 6 hợp âm cơ bản!",
        "interactive": {
          "items": [
            "Tôi đã rải và quạt được cả 6 hợp âm",
            "Tôi sẽ luyện chuyển hợp âm mượt mà hơn",
            "Tôi đã sẵn sàng học đệm hát bài đầu tiên"
          ]
        }
      }
    ]'::jsonb
  );

END $$;
