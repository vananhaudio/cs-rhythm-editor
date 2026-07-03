-- Bucket "strum-sheets" — ảnh sheet do HỌC SINH tự tải lên (chụp màn hình/ảnh bản nhạc)
-- trong công cụ Strum Builder (/strum-builder). Public read (cần hiện trực tiếp <img src>),
-- chỉ authenticated mới upload được. Chạy một lần trong Supabase SQL Editor. Idempotent.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'strum-sheets',
  'strum-sheets',
  true,
  20971520,  -- 20MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: ai cũng đọc được (public bucket, ảnh hiện trong <img>)
DROP POLICY IF EXISTS "Public read strum-sheets" ON storage.objects;
CREATE POLICY "Public read strum-sheets" ON storage.objects
  FOR SELECT USING (bucket_id = 'strum-sheets');

-- Policy: chỉ authenticated upload (học sinh/thầy đã đăng nhập)
DROP POLICY IF EXISTS "Auth upload strum-sheets" ON storage.objects;
CREATE POLICY "Auth upload strum-sheets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'strum-sheets');
