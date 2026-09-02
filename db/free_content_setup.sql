-- =====================================================================
-- FREE CONTENT — Free ở CẤP CHƯƠNG (module) — vòng "Free content = Admin quyết"
--
-- Bối cảnh (đã audit 09/2026):
--   • Free cấp KHOÁ  = edu_courses.is_free (đã có).
--   • Free cấp BÀI   = edu_course_lessons.tier='free' (legacy) hoặc
--                      access_policy_mode='override' + required_tier='free' (policy mới).
--   • Free cấp CHƯƠNG chưa tồn tại → thêm edu_modules.is_free.
--
-- Luật truy cập (my_learning_state — sửa trong db/learning_state_setup.sql):
--   lesson OPEN khi: module.is_free  OR  lesson free  OR  entitlement đủ tier
--   (teacher luôn open; hidden/coming_soon/prereq giữ nguyên thứ tự ưu tiên cũ).
--
-- Backward-compatible + idempotent: default FALSE → không đổi hành vi hiện tại
-- cho tới khi Admin bật từng chương. Sau file này PHẢI chạy lại
-- db/learning_state_setup.sql để cập nhật RPC.
-- =====================================================================

alter table public.edu_modules
  add column if not exists is_free boolean not null default false;

notify pgrst, 'reload schema';
