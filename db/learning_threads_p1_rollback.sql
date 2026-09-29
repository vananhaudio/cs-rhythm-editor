-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK LEARNING THREAD P1 (db/learning_threads_p1_setup.sql). Idempotent.
-- ⚠ XOÁ VĨNH VIỄN mọi thread Trả/Hỏi bài, phản hồi của Thầy và cấu hình Trả bài theo bài.
--   Muốn giữ dữ liệu thì CHỈ gỡ frontend (App/me) — DB P1 không ảnh hưởng gì khác khi không ai gọi RPC.
-- Không đụng bảng/hàm có sẵn: edu_*, class_*, my_learning_state, is_teacher, is_class_member...
-- ═══════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '5s';

drop function if exists public.lt_lessons_state(uuid[]);
drop function if exists public.lt_submit(uuid, text, text, text, text, text, text);
drop function if exists public.lt_respond(uuid, text, text, text, bigint[], jsonb, text, text, text);
drop function if exists public.lt_detail(uuid);
drop function if exists public.lt_my_threads(timestamptz, uuid, int);
drop function if exists public.lt_teacher_queue(text, timestamptz, uuid, int);
drop function if exists public.lt_set_visibility(uuid, text);
drop function if exists public.lt_archive(uuid);
drop function if exists public.lt_moderate(text, uuid, boolean);
drop function if exists public.lt_set_lesson_settings(uuid, text, text, text);
drop function if exists public.lt_lesson_open_for_me(uuid);
drop function if exists public.lt_can_view(uuid, text, timestamptz);
drop function if exists public.lt_check_media(text, text, text);
drop function if exists public.lt_normalize_resources(jsonb);
drop function if exists public.lt_identity_snapshot(uuid);

drop table if exists public.learning_thread_events;
drop table if exists public.learning_threads;
drop table if exists public.learning_lesson_settings;

notify pgrst, 'reload schema';
commit;
