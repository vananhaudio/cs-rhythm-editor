-- ============================================================================
-- DH2 — CỤM GẢY THEO 🎸 (Strum Score / ChordStrumPlayer, native lesson).
-- Gắn bài đã dựng trong src/elearn/strumSongs.ts + nativeLessons.tsx vào chương.
-- Idempotent.
-- ============================================================================

-- Ch3 Ballad · Gảy theo: Ode to Joy (d2c00304) → Strum Score 'song-ode-ballad'
-- (tiêu đề do generator đặt số; ở đây chỉ gắn công cụ)
UPDATE edu_course_lessons SET lesson_type = 'native', content_url = 'song-ode-ballad'
  WHERE id = 'd2c00304-0000-4000-8000-000000000000';

-- Ch2 Valse · Gảy theo: Scarborough Fair (d2c00607) → Strum Score 'song-scarborough' (tiết tấu trộn)
UPDATE edu_course_lessons SET lesson_type = 'native', content_url = 'song-scarborough'
  WHERE id = 'd2c00607-0000-4000-8000-000000000000';

-- Ch2 Valse · Gảy theo: Amazing Grace (d2c00606) → Strum Score 'song-amazing'
UPDATE edu_course_lessons SET lesson_type = 'native', content_url = 'song-amazing'
  WHERE id = 'd2c00606-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
