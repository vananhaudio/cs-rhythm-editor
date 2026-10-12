-- Rollback CLASS SYSTEM CHAT V1: bỏ trigger → hàm → bảng. Không đụng dm_* / learning_*.
drop trigger if exists class_system_notice_on_event on public.learning_thread_events;
drop function if exists public.class_system_notice_on_event();
drop function if exists public.class_system_notices(bigint, int);
drop function if exists public.class_system_notice_summary();
drop function if exists public.class_system_notice_mark_read(bigint);
drop table if exists public.class_system_notice_reads;
drop table if exists public.class_system_notices;
notify pgrst, 'reload schema';
