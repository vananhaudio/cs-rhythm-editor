-- ── Buổi 00 · NHẬP MÔN (session_number = 0) — hỗ trợ buổi chuẩn bị KHÔNG khoá buổi 1 (10/2026) ──
-- Quy ước: class_sessions.session_number = 0 là buổi nhập môn. Không có bài trả bắt buộc, không phải điều kiện của buổi 1.
--   · Người học: buổi 0 tự MỞ và coi như XONG ngay lần đầu vào lớp; buổi 1 vẫn là buổi đầu tiên của tiến trình bài trả (min session_number >= 1).
--   · Lớp KHÔNG có buổi 0: hành vi y hệt cũ (min session_number >= 1 trùng min cũ vì mọi lớp hiện có đánh số từ 1).
-- Chỉ sửa đúng 2 điểm chặn số 0 ở DB: (1) CHECK session_no >= 1 của learning_session_progress → >= 0; (2) lsp_sync.
-- learning_threads (bài trả) GIỮ >= 1: buổi 0 không có bài trả. Idempotent. Rollback: db/class_session_zero_intro_rollback.sql
alter table public.learning_session_progress drop constraint if exists learning_session_progress_session_no_check;
alter table public.learning_session_progress add constraint learning_session_progress_session_no_check
  check (session_no >= 0 and session_no <= 9999);

create or replace function public.lsp_sync(p_user uuid, p_class uuid, p_program text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_first int; r record;
begin
  perform pg_advisory_xact_lock(hashtextextended('lsp:' || p_user::text || ':' || p_program, 0));
  select min(s.session_number) into v_first from public.class_sessions s
   where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null and s.session_number >= 1;
  -- Buổi 0 (nhập môn): mở + xong ngay, không bao giờ chặn buổi 1.
  if exists (select 1 from public.class_sessions s where s.class_id = p_class and s.event_type = 'lesson' and s.session_number = 0) then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id, completed_at, completed_class_schedule_id)
    values (p_user, p_program, 0, p_class, now(), p_class)
    on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  if v_first is null then return; end if;
  insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
  values (p_user, p_program, v_first, p_class)
  on conflict (learner_user_id, program_code, session_no) do nothing;
  for r in select p.session_no from public.learning_session_progress p
            where p.learner_user_id = p_user and p.program_code = p_program
            order by p.session_no loop
    perform public.lsp_try_complete(p_user, p_program, r.session_no, p_class);
  end loop;
end $$;
