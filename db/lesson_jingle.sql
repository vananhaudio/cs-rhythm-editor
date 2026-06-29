-- =====================================================================
-- Gắn bài "Gảy theo: Jingle Bells" (native, nền trống-bass + giai điệu + GHI ÂM) vào 2 khoá.
-- Bài DỰNG NATIVE trong code (ChordStrumPlayer + strumSongs.ts → STRUM_JINGLE / STRUM_JINGLE_DEN).
-- KHÔNG cần media (nền synth tự sinh). Idempotent — chạy lại không nhân đôi.
--
--  ■ CƠ BẢN (dem-hat-td1) → Chương 4: Luyện tập vòng hoà âm trên nền trống-bass
--      module = 319654a9-f926-4b68-8adb-d5a1f566718d · quạt NỐT ĐEN
--  ■ TRÌNH ĐỘ 2 (dem-hat-td2) → Tuần 1: Chùm 2
--      module = 067ae3bb-7812-4485-8fa2-077fccaea2bf · quạt CHÙM 2 (sau HBD chùm 2)
-- =====================================================================

-- Cơ bản — Jingle nốt đen
insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '319654a9-f926-4b68-8adb-d5a1f566718d',
  'Gảy theo: Jingle Bells — quạt nốt đen',
  'native', 'song-jingle-den', 2, 'free', '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '319654a9-f926-4b68-8adb-d5a1f566718d' and content_url = 'song-jingle-den'
);

-- Trình độ 2 — Jingle chùm 2
insert into public.edu_course_lessons
  (module_id, title, lesson_type, content_url, order_index, tier, tools)
select
  '067ae3bb-7812-4485-8fa2-077fccaea2bf',
  'Gảy theo: Jingle Bells — quạt chùm 2',
  'native', 'song-jingle-chum2', 4, 'free', '[]'::jsonb
where not exists (
  select 1 from public.edu_course_lessons
  where module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf' and content_url = 'song-jingle-chum2'
);

notify pgrst, 'reload schema';
