-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — Bài hát "5 dòng kẻ nho nhỏ" (thầy sáng tác) vào Chương 2
-- Video YouTube Shorts, đặt SAU Bài 4 (Khuông & khoá): B3(0) B4(1) Bài hát(2) Bài tập(3)
-- Idempotent. is_published=false (khoá chưa publish).
-- ============================================================================

INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content_url, order_index, is_published, tier)
VALUES ('a2100020-0000-4000-8000-000000000020', 'b1000002-0000-4000-8000-000000000002',
        'Bài hát: Năm dòng kẻ nhỏ nhỏ', 'video', 'https://www.youtube.com/watch?v=QEsg_ass3dE', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title,
  lesson_type = 'video', content_url = EXCLUDED.content_url, order_index = EXCLUDED.order_index;

NOTIFY pgrst, 'reload schema';
