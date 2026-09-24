-- ROLLBACK cho db/profile_media_setup.sql — gỡ bảng ảnh bìa.
-- ⚠ Mất liên kết ảnh bìa đã đặt (file ảnh trong bucket 'avatars' vẫn còn, không bị xoá).
-- Code: Social tự về ảnh bìa mặc định khi không đọc được bảng (không lỗi trang).
begin;
drop table if exists public.profile_media;
drop function if exists public.profile_media_touch();
commit;
notify pgrst, 'reload schema';
