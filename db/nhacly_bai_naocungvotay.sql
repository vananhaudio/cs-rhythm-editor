-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — Bài hát "Nào cùng vỗ tay" (thầy sáng tác) vào Chương 4
-- Học Phách & Nhịp. Đặt trước bài tập: B6(0) B7(1) Bài hát(2) Bài tập(3)
-- Idempotent. is_published=false (khoá chưa publish).
-- ============================================================================

INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content_url, order_index, is_published, tier)
VALUES ('a2100022-0000-4000-8000-000000000022', 'b1000004-0000-4000-8000-000000000004',
        'Bài hát: Nào cùng vỗ tay', 'video', 'https://www.youtube.com/watch?v=jLaucGS_1Ds', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title,
  lesson_type = 'video', content_url = EXCLUDED.content_url, order_index = EXCLUDED.order_index;

NOTIFY pgrst, 'reload schema';
