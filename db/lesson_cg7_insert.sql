-- =====================================================================
-- Gắn bài "Đổi hợp âm C ↔ G7" vào Chương 2 (Quạt hợp âm) của khoá
-- "Khởi đầu đam mê - Đệm hát cơ bản", ngay SAU bài Downstroke.
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent (chạy lại không tạo trùng).
--   module Chương 2 = 2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e
--   Bài 1 (Downstroke) order_index = 0  →  bài này order_index = 1
-- =====================================================================

-- 0) Nới ràng buộc lesson_type để chấp nhận loại 'native' (giữ đủ loại cũ + 'flow')
alter table public.edu_course_lessons drop constraint if exists edu_course_lessons_lesson_type_check;
alter table public.edu_course_lessons add constraint edu_course_lessons_lesson_type_check
  check (lesson_type in (
    'video','text','slide','quiz','game','tap','metronome',
    'backing_track','submit_video','discussion','link','flow','native'
  ));

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e',
  'Bài 2: Đổi hợp âm C ↔ G7',
  'native',
  'chord-cg7',
  1,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e'
    and content_url = 'chord-cg7'
);

notify pgrst, 'reload schema';
