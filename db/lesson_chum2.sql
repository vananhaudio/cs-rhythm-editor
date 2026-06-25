-- =====================================================================
-- Gắn bài "Chùm 2 Nốt Móc Đơn" (slide native + audio, ép nghe hết)
-- làm BÀI 2 của khoá "Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2".
-- Module Tuần 1 = 067ae3bb-7812-4485-8fa2-077fccaea2bf
-- order_index = 2 (nằm giữa Bài 1 welcome o-1 và Bài 3 o3). Idempotent.
--
-- Audio đã upload sẵn ở bucket "lessons":
--   Chum 2 not moc don.wav
-- Slide DỰNG NATIVE trong code (src/elearn/chum2Slides.tsx) — KHÔNG cần ảnh.
-- =====================================================================

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '067ae3bb-7812-4485-8fa2-077fccaea2bf',
  'Bài 2: Chùm 2 Nốt Móc Đơn',
  'native',
  'chum-2-moc-don',
  2,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf'
    and content_url = 'chum-2-moc-don'
);

notify pgrst, 'reload schema';
