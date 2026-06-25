-- =====================================================================
-- Gắn bài "Gảy theo: Happy Birthday — quạt chùm 2" (native, gảy theo bản thu + xanh hóa)
-- vào khoá "Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2", ngay sau bài "Tập quạt chùm 2".
-- Module Tuần 1 = 067ae3bb-7812-4485-8fa2-077fccaea2bf · order_index = 2 (cụm quạt chùm 2).
-- (Thầy có thể kéo-sắp lại thứ tự trong /admin nếu muốn.) Idempotent.
--
-- Bài DỰNG NATIVE trong code (ChordStrumPlayer + strumSongs.ts → HBD_CHUM2).
-- Audio đã up: lessons/Happy Birthday to You metronome.mp3
-- =====================================================================

insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '067ae3bb-7812-4485-8fa2-077fccaea2bf',
  'Bài 2 (gảy theo): Happy Birthday — quạt chùm 2',
  'native',
  'song-hbd-chum2',
  2,
  'free',
  '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf'
    and content_url = 'song-hbd-chum2'
);

notify pgrst, 'reload schema';
