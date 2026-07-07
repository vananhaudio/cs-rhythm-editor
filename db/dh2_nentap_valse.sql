-- ============================================================================
-- DH2 Chương 2 (Valse) — Bài "Nền tập Valse" (n:5 → id d2c00605)
-- Strum Score tự sinh (lesson_type='strum', config JSON ở cột content):
--   nền synth Valse + vòng C–F–G–C, kiểu quạt NỐT ĐEN, nhịp 3/4, tempo 96, loop.
-- Idempotent. LƯU Ý: cần chạy db/dh2_ALL.sql (khung 7 chương) trước nếu chưa chạy.
-- ============================================================================

UPDATE edu_course_lessons
   SET lesson_type = 'strum',
       content_url = NULL,
       content     = '{"styleId":"valse","tempo":96,"patternId":"den","timeSignature":3,"chords":["C","F","G","C"]}',
       description = 'Bật nền trống–bass Valse rồi quạt mẫu nốt đen theo khuông: Bùm – chát – chát. Vững rồi thì tự tăng tempo dần lên 110–120, và thử đổi phách 2–3 sang chùm 2 như bài trước.'
 WHERE id = 'd2c00605-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
