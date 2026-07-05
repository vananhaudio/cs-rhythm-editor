-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — Bài hát "Quả Táo Trường Độ" (thầy sáng tác) vào Chương 3
-- Video YouTube Shorts, đặt trước bài tập: B5(0) B8(1) Bài hát(2) Bài tập(3)
-- Idempotent. is_published=false (khoá chưa publish).
-- ============================================================================

INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content_url, order_index, is_published, tier)
VALUES ('a2100021-0000-4000-8000-000000000021', 'b1000003-0000-4000-8000-000000000003',
        'Bài hát: Quả Táo Trường Độ', 'video', 'https://www.youtube.com/watch?v=HwVfVy7P9gM', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title,
  lesson_type = 'video', content_url = EXCLUDED.content_url, order_index = EXCLUDED.order_index;

NOTIFY pgrst, 'reload schema';
