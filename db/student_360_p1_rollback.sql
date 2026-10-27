-- Rollback Student 360 P1. CẢNH BÁO: xoá toàn bộ hồ sơ chắt lọc + nhật ký. Chỉ chạy khi Owner đồng ý.
-- Không đụng bảng Class nào khác (edu_students, learning_*...). Idempotent.
drop function if exists public.student_360_get(uuid, boolean);
drop function if exists public.student_360_add_fact(uuid, text, text, text, text, text, text);
drop function if exists public.student_360_edit_fact(uuid, text);
drop function if exists public.student_360_set_verification(uuid, text);
drop function if exists public.student_360_revoke_fact(uuid, text);
drop function if exists public.student_360_revoke_by_source(text, text, text);
drop function if exists public.student_360_fact_history(uuid);
drop function if exists public.student_360_fact_json(public.student_360_facts, boolean);
drop function if exists public.student_360_log(uuid, uuid, text, jsonb, jsonb);
drop function if exists public.student_360_need_uid();
drop table if exists public.student_360_fact_log;
drop function if exists public.student_360_log_immutable();
drop table if exists public.student_360_facts;
