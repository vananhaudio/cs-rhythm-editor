-- ============================================================================
-- DH2 — CỤM GẢY THEO 🎸 (Strum Score / ChordStrumPlayer, native lesson).
-- Gắn bài đã dựng trong src/elearn/strumSongs.ts + nativeLessons.tsx vào chương.
-- Idempotent.
-- ============================================================================

-- Ch3 Ballad · Gảy theo: Ode to Joy (d2c00304) → Strum Score 'song-ode-ballad'
UPDATE edu_course_lessons SET lesson_type = 'native', content_url = 'song-ode-ballad',
  title = 'Gảy theo: Ode to Joy (Ballad)'
  WHERE id = 'd2c00304-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
