-- Tạo bucket "lessons" (public) để lưu audio/ảnh bài học.
-- Chạy một lần trong Supabase SQL Editor.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lessons',
  'lessons',
  true,
  52428800,  -- 50MB
  ARRAY['audio/wav','audio/mpeg','audio/mp3','audio/ogg','audio/webm','image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: ai cũng đọc được (public bucket)
CREATE POLICY "Public read lessons" ON storage.objects
  FOR SELECT USING (bucket_id = 'lessons');

-- Policy: chỉ authenticated upload
CREATE POLICY "Auth upload lessons" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lessons');
