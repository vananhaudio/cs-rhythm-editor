-- ROLLBACK Class System Chat V2 → trả về đúng V1 (hàm trigger + CHECK kind). Idempotent. Chạy bằng prod-db.py (một transaction).
-- Chỉ XOÁ thông báo do V2 tạo (kind submission_received/question_received/question_answered). Thông báo chấm bài V1 và trạng thái đọc GIỮ NGUYÊN.
-- Không đụng lt_*, dm_*, dữ liệu Learning Thread. Rollback FE (revert PR V2) TRƯỚC khi chạy file này.
delete from public.class_system_notices where kind <> 'checkpoint_graded';
alter table public.class_system_notices drop constraint if exists class_system_notices_kind_check;
alter table public.class_system_notices add constraint class_system_notices_kind_check check (kind in ('checkpoint_graded'));

create or replace function public.class_system_notice_on_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.learning_threads%rowtype; v_label text; v_cycle bigint;
begin
  if new.author_role is distinct from 'teacher' or new.kind is distinct from 'teacher_feedback'
     or new.verdict is null or new.hidden_at is not null then return new; end if;
  select * into v_t from public.learning_threads where id = new.thread_id;
  if not found or v_t.learner_user_id is null then return new; end if;
  select coalesce(max(e.seq), 0) into v_cycle from public.learning_thread_events e
   where e.thread_id = new.thread_id and e.author_role = 'student' and e.seq < new.seq;
  v_label := case when v_t.session_no is not null then 'Bài trả Buổi ' || lpad(v_t.session_no::text, 2, '0') else 'Bài trả' end;
  insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
  values (v_t.learner_user_id, 'checkpoint_graded', v_label || ' của bạn đã được chấm.', 'thread', v_t.id::text,
          'grade:' || v_t.id::text || ':' || v_cycle::text)
  on conflict (user_id, dedupe_key) do nothing;
  return new;
end $$;
comment on function public.class_system_notice_on_event() is 'class_system_chat_v1: trigger nguồn thông báo chấm bài (hoàn tất chấm)';
revoke all on function public.class_system_notice_on_event() from public, anon, authenticated;

notify pgrst, 'reload schema';
