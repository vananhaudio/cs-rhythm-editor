-- =====================================================================
-- Gắn bài "Gảy theo: Happy Birthday — quạt NỐT ĐEN" (TĐ1) vào khoá
-- "Khởi đầu đam mê - Đệm hát cơ bản" → Chương 2: Quạt hợp âm.
-- Module = 2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e · order_index = 4 (sau 4 bài quạt cơ bản).
-- (Thầy có thể kéo-sắp lại trong /admin nếu muốn.) Idempotent.
--
-- Bài DỰNG NATIVE (ChordStrumPlayer + strumSongs.ts → HBD_TD1, eighths=false → 1 cú ↓/phách).
-- Cùng audio metronome với bản TĐ2, chỉ khác cách quạt (nốt đen thay chùm 2).
-- =====================================================================

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e',
  'Bài 5 (gảy theo): Happy Birthday — quạt nốt đen',
  'native',
  'song-hbd-td1',
  4,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e'
    and content_url = 'song-hbd-td1'
);

notify pgrst, 'reload schema';
