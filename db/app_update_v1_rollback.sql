-- Rollback App Update Manager V1. App đã cài sẽ gặp lỗi khi hỏi chính sách → tự im lặng, việc học không ảnh hưởng.
-- Muốn chỉ TẮT thông báo: dùng trang /admin/app-update, không cần rollback.
drop function if exists public.app_update_policy_save(text, boolean, text, int, text, int, boolean, text, timestamptz);
drop function if exists public.app_update_policy_admin();
drop function if exists public.app_update_policy_get(text);
drop table if exists public.app_update_policy_log;
drop table if exists public.app_update_policy;
drop function if exists public.app_version_key(text);
notify pgrst, 'reload schema';
