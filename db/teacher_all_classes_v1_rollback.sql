-- ROLLBACK cho db/teacher_all_classes_v1_setup.sql. Chạy SAU khi frontend đã về bản trước. Idempotent. Không đụng dữ liệu.
drop function if exists public.social_all_classes();
notify pgrst, 'reload schema';
