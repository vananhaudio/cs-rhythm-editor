-- =====================================================================
-- Gắn bài "Luyện chuyển hợp âm cơ bản 1" vào Chương 2 (sau Am & E).
-- Khoá: Khởi đầu đam mê - Đệm hát cơ bản. Chạy 1 lần. Idempotent.
--   module Chương 2 = 2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e
--   Downstroke=0 · C↔G7=1 · Am&E=2 · bài này=3
-- =====================================================================

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e',
  'Bài 4: Chuyển hợp âm cơ bản 1 (C·G7·Am·E·Dm)',
  'native',
  'chord-basic-1',
  3,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e'
    and content_url = 'chord-basic-1'
);

notify pgrst, 'reload schema';
