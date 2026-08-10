-- ============================================================================
-- QR links — bổ sung/sửa sau tái cấu trúc Tỉa Nốt 1 (2026-08).
-- Chạy trên Supabase SQL editor. Idempotent.
--
-- Bối cảnh: app đã sửa để /course?id=<LESSON_id> mở ĐÚNG BÀI (LessonViewerPage
-- resolve lesson→course + auto mở bài). Các target hiện có (trỏ lesson id) nay
-- hoạt động đúng. File này chỉ vá slug 'tayphai' bị THIẾU: seed cũ resolve theo
-- tiêu đề "Cầm pick / dùng ngón phải" nhưng bài đã đổi tên thành "Bàn tay phải"
-- nên không insert được.
-- ============================================================================

-- tayphai → bài "Bàn tay phải" (num 9) của khoá Nhập môn "Khởi Đầu Đam Mê"
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT l.id INTO v_id
  FROM edu_course_lessons l
  JOIN edu_modules m ON m.id = l.module_id
  WHERE m.course_id = 'fd23a7a2-bfce-44c6-8bde-6d76289a3625'
    AND l.title = 'Bàn tay phải'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    INSERT INTO qr_links (slug, target, note)
    VALUES ('tayphai', '/course?id=' || v_id, 'Nhập môn — Bàn tay phải (video + bài tập)')
    ON CONFLICT (slug) DO UPDATE SET target = EXCLUDED.target, note = EXCLUDED.note;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
