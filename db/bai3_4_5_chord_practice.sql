-- Bài 3: Thực hành hợp âm Am
-- Bài 4: Thực hành hợp âm C
-- Bài 5: Thực hành 6 hợp âm cơ bản
-- Idempotent — chạy lại sẽ cập nhật (xóa flow cũ rồi insert lại)

DO $$
DECLARE
  v_course uuid; v_mod uuid;
  v_l3 uuid; v_l4 uuid; v_l5 uuid;
BEGIN
  SELECT id INTO v_course FROM edu_courses WHERE name ILIKE '%Đệm hát cơ bản%' LIMIT 1;
  IF v_course IS NULL THEN RAISE EXCEPTION 'Không tìm thấy khoá Đệm hát cơ bản'; END IF;

  SELECT id INTO v_mod FROM edu_modules WHERE course_id = v_course AND name ILIKE 'Chương 1%' LIMIT 1;
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Không tìm thấy Chương 1'; END IF;

  -- ── Bài 3 ───────────────────────────────────────────────────────────────────
  SELECT id INTO v_l3 FROM edu_course_lessons WHERE module_id = v_mod AND title ILIKE '%Am%' AND title ILIKE '%Thực hành%' LIMIT 1;
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
        "content": "🎸 Bài này bạn sẽ tập gảy hợp âm **Am (La thứ)** và được chấm điểm ngay bằng mic điện thoại.\n\nHãy cầm đàn lên và bắt đầu!"
      },
      {
        "id": "am-diagram",
        "type": "guitar_chord",
        "logic": "NHAN",
        "content": "Sơ đồ hợp âm Am",
        "interactive": {
          "name": "Am",
          "frets": [-1, 0, 2, 2, 1, 0],
          "freqs": [110.0, 164.81, 220.0, 261.63, 329.63],
          "caption": "Dây 6 câm · Ngón 2 &amp; 3 đặt phím 2 dây 4–3 · Ngón 1 đặt phím 1 dây 2 · Dây 5 &amp; 1 buông"
        }
      },
      {
        "id": "am-practice-1",
        "type": "chord_practice",
        "logic": "LAM",
        "content": "Gảy hợp âm Am và để mic nghe",
        "interactive": { "chord": "Am" }
      },
      {
        "id": "am-practice-2",
        "type": "chord_practice",
        "logic": "LAM",
        "content": "Thêm 1 lần nữa — gảy đều 6 dây",
        "interactive": { "chord": "Am" }
      },
      {
        "id": "am-done",
        "type": "checklist",
        "logic": "LAM",
        "content": "Bạn đã hoàn thành bài Am!",
        "interactive": {
          "items": [
            "Tôi đã đặt đúng ngón tay theo sơ đồ",
            "Tôi đã gảy và nghe thấy 5 dây kêu rõ",
            "Tôi sẽ luyện thêm 5 phút mỗi ngày"
          ]
        }
      }
    ]'::jsonb
  );

  -- ── Bài 4 ───────────────────────────────────────────────────────────────────
  SELECT id INTO v_l4 FROM edu_course_lessons WHERE module_id = v_mod AND title ILIKE '%hợp âm C%' AND title ILIKE '%Thực hành%' LIMIT 1;
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
        "content": "🎸 Bài này bạn tập hợp âm **C (Đô trưởng)**.\n\nHợp âm C cần 3 ngón tay — hơi khó hơn Am một chút, luyện từ từ nhé!"
      },
      {
        "id": "c-diagram",
        "type": "guitar_chord",
        "logic": "NHAN",
        "content": "Sơ đồ hợp âm C",
        "interactive": {
          "name": "C",
          "frets": [-1, 3, 2, 0, 1, 0],
          "freqs": [130.81, 164.81, 196.0, 261.63, 329.63],
          "caption": "Dây 6 câm · Ngón 3 phím 3 dây 5 · Ngón 2 phím 2 dây 4 · Ngón 1 phím 1 dây 2 · Dây 3 &amp; 1 buông"
        }
      },
      {
        "id": "c-practice-1",
        "type": "chord_practice",
        "logic": "LAM",
        "content": "Gảy hợp âm C và để mic nghe",
        "interactive": { "chord": "C" }
      },
      {
        "id": "c-practice-2",
        "type": "chord_practice",
        "logic": "LAM",
        "content": "Thêm 1 lần nữa — chú ý dây 3 phải kêu trong",
        "interactive": { "chord": "C" }
      },
      {
        "id": "c-done",
        "type": "checklist",
        "logic": "LAM",
        "content": "Bạn đã hoàn thành bài C!",
        "interactive": {
          "items": [
            "Tôi đã đặt được 3 ngón đúng vị trí",
            "Tôi đã gảy và 5 dây kêu rõ (không bị tắt)",
            "Tôi sẽ chuyển qua lại Am ↔ C để luyện"
          ]
        }
      }
    ]'::jsonb
  );

  -- ── Bài 5 ───────────────────────────────────────────────────────────────────
  SELECT id INTO v_l5 FROM edu_course_lessons WHERE module_id = v_mod AND title ILIKE '%6 hợp âm%' LIMIT 1;
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
        "content": "🎸 Thử thách cuối chương: gảy đủ **6 hợp âm cơ bản** — Am, Dm, Em, E, C, G.\n\nMỗi hợp âm mic sẽ chấm ngay. Sẵn sàng chưa?"
      },
      {
        "id": "6c-practice",
        "type": "chord_practice",
        "logic": "LAM",
        "content": "Luyện lần lượt 6 hợp âm",
        "interactive": {
          "chords": ["Am", "Dm", "Em", "E", "C", "G"]
        }
      },
      {
        "id": "6c-done",
        "type": "checklist",
        "logic": "LAM",
        "content": "Xuất sắc! Bạn đã hoàn thành 6 hợp âm cơ bản!",
        "interactive": {
          "items": [
            "Tôi đã gảy được cả 6 hợp âm",
            "Tôi sẽ luyện đổi hợp âm mượt mà hơn",
            "Tôi đã sẵn sàng học đệm hát bài đầu tiên"
          ]
        }
      }
    ]'::jsonb
  );

END $$;
