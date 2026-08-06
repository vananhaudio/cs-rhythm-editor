-- ═══ PIANO JOURNEY — Server Storage ═══
-- Chuyển piano_level + thư viện "Bài hát của con" từ localStorage → Supabase.
-- Lý do: localStorage mất khi đổi máy/xoá app; phụ huynh không xem được từ máy khác.
--
-- Chạy file này trong Supabase SQL Editor.

-- 1. Thêm cột piano_level vào edu_students
ALTER TABLE public.edu_students
  ADD COLUMN IF NOT EXISTS piano_level INTEGER DEFAULT 1;

COMMENT ON COLUMN public.edu_students.piano_level IS 'Bậc hiện tại của bé trong Piano Journey (1–15)';

-- 2. Bảng piano_songs — "Bài hát của con"
CREATE TABLE IF NOT EXISTS public.piano_songs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id     TEXT NOT NULL,           -- chữ ký giai điệu (pitch:duration-...), chống trùng
  title       TEXT NOT NULL,
  level_id    INTEGER NOT NULL,
  exercise    JSONB NOT NULL,          -- { title, bpm, notes, beatsPerBar }
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_played_at TIMESTAMPTZ DEFAULT now(),
  plays       INTEGER DEFAULT 0,
  best_hit    INTEGER DEFAULT 0,
  best_total  INTEGER DEFAULT 0,
  UNIQUE(user_id, song_id)
);

COMMENT ON TABLE public.piano_songs IS 'Bài hát trong thư viện Piano Journey của từng học viên';
COMMENT ON COLUMN public.piano_songs.song_id IS 'Chữ ký giai điệu: pitch1:duration1-pitch2:duration2-...';

-- 3. RLS — mỗi học viên chỉ thấy bài của mình
ALTER TABLE public.piano_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "piano_songs_select_own" ON public.piano_songs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "piano_songs_insert_own" ON public.piano_songs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "piano_songs_update_own" ON public.piano_songs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "piano_songs_delete_own" ON public.piano_songs
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Index cho query nhanh
CREATE INDEX IF NOT EXISTS idx_piano_songs_user ON public.piano_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_piano_songs_level ON public.piano_songs(user_id, level_id);
CREATE INDEX IF NOT EXISTS idx_piano_songs_played ON public.piano_songs(user_id, last_played_at DESC);
