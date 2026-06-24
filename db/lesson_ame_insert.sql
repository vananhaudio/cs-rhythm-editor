-- =====================================================================
-- Gắn bài "Hợp âm Am và E" vào Chương 2 (Quạt hợp âm) — NGAY SAU bài C↔G7.
-- Khoá: Khởi đầu đam mê - Đệm hát cơ bản.
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent.
--   module Chương 2 = 2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e
--   Downstroke = order 0 · C↔G7 = order 1 · bài này = order 2
-- =====================================================================

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e',
  'Bài 3: Hợp âm Am và E',
  'native',
  'chord-am-e',
  2,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e'
    and content_url = 'chord-am-e'
);

notify pgrst, 'reload schema';
