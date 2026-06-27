-- =====================================================================
-- Nới ràng buộc lesson_type để chấp nhận loại 'strum' (Strum Score).
-- Giữ đủ các loại cũ + 'flow' + 'native' + thêm 'strum'. Chạy 1 lần. Idempotent.
-- =====================================================================
alter table public.edu_course_lessons drop constraint if exists edu_course_lessons_lesson_type_check;
alter table public.edu_course_lessons add constraint edu_course_lessons_lesson_type_check
  check (lesson_type in (
    'video','text','slide','quiz','game','tap','metronome',
    'backing_track','submit_video','discussion','link','flow','native','strum'
  ));

notify pgrst, 'reload schema';
