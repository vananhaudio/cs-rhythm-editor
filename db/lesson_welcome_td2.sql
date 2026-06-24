-- =====================================================================
-- Gắn bài "Chào mừng Trình độ 2" (slide + audio, ép nghe hết) làm BÀI ĐẦU
-- của khoá "Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2".
-- Chương đầu (Tuần 1) module = 067ae3bb-7812-4485-8fa2-077fccaea2bf
-- order_index = -1 để nằm TRƯỚC bài hiện tại (o0). Chạy 1 lần. Idempotent.
--
-- ⚠️ TRƯỚC KHI HỌC HIỆN ĐÚNG: upload 8 ảnh slide td2-1.png … td2-8.png
--    vào Supabase Storage → bucket "lessons" (cùng chỗ file audio .wav).
-- =====================================================================

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '067ae3bb-7812-4485-8fa2-077fccaea2bf',
  'Chào mừng đến Trình độ 2',
  'native',
  'welcome-td2',
  -1,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf'
    and content_url = 'welcome-td2'
);

notify pgrst, 'reload schema';
