-- Thêm KHOÁ CHÍNH cho mỗi lớp (để hiển thị tên khoá/cấp độ trên trang tuyển sinh).
-- Các khoá khác trong course_ids vẫn được mở khi đăng ký, nhưng chỉ khoá chính hiện ra.
-- Chạy trong Supabase SQL Editor. Idempotent.

alter table public.class_schedule add column if not exists main_course_id uuid;

notify pgrst, 'reload schema';
