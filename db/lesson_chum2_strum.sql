-- =====================================================================
-- Gắn bài "Tập quạt chùm 2 (xuống–lên)" (bài tập native, có mic chấm)
-- vào khoá "Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2", NGAY SAU bài lý thuyết Chùm 2.
-- Module Tuần 1 = 067ae3bb-7812-4485-8fa2-077fccaea2bf
-- order_index = 2 (sau lý thuyết o1, trước video "ứng dụng 2/4" o3). Idempotent.
--
-- Bài DỰNG NATIVE trong code (src/elearn/chordLessons.ts → QUAT_CHUM2). KHÔNG cần media.
-- =====================================================================

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '067ae3bb-7812-4485-8fa2-077fccaea2bf',
  'Bài 2 (thực hành): Tập quạt chùm 2',
  'native',
  'chord-strum-chum2',
  2,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf'
    and content_url = 'chord-strum-chum2'
);

notify pgrst, 'reload schema';
