-- ============================================================================
-- DH2 Chương 1 — chuốt lại (2026-07-12). Idempotent.
-- 1) BỎ Bài 'Thực hành gõ chùm 2' (d2c00106) — thầy chốt: thừa, slide 1.3 +
--    bài quạt có mic (1.5) đã ôm phần cảm nhịp. Generator cũng đã gỡ.
-- 2) Bài 'Nền tập Ballad' (d2c00303) = Strum Score tự sinh (như Nền tập Valse):
--    nền Ballad + quạt CHÙM 2, vòng C–Am–F–G, 4/4, tempo 70, loop.
-- 3) Dọn content '⏳' còn sót trên các bài đã gắn Strum Score (native).
-- Chạy SAU db/dh2_ALL.sql. Chạy lại dh2_full.sql sau đó sẽ đánh lại số bài 1.x.
-- ============================================================================

-- (1) Xoá bài gõ chùm 2
DELETE FROM edu_course_lessons WHERE id = 'd2c00106-0000-4000-8000-000000000000';

-- (2) Nền tập Ballad = strum config
UPDATE edu_course_lessons
   SET lesson_type = 'strum',
       content_url = NULL,
       content     = '{"styleId":"ballad","tempo":70,"patternId":"chum2","timeSignature":4,"chords":["C","Am","F","G"]}',
       description = 'Bật nền trống–bass Ballad rồi quạt chùm 2 (xuống–lên) theo khuông, đều và êm như video mẫu. Vững rồi thì tự tăng tempo dần lên 80–90.'
 WHERE id = 'd2c00303-0000-4000-8000-000000000000';

-- (3) Dọn placeholder '⏳' trên bài native đã hoạt động
UPDATE edu_course_lessons SET content = NULL
 WHERE id IN ('d2c00304-0000-4000-8000-000000000000',   -- 1.11 Ode to Joy
              'd2c00606-0000-4000-8000-000000000000',   -- 2.4 Amazing Grace
              'd2c00607-0000-4000-8000-000000000000')   -- 2.7 Scarborough Fair
   AND lesson_type = 'native' AND content LIKE '%⏳%';

NOTIFY pgrst, 'reload schema';
