-- Hoàn tác buổi 0: trả lsp_sync + CHECK về như trước (xoá dòng tiến độ buổi 0 trước khi siết lại CHECK).
delete from public.learning_session_progress where session_no = 0;
alter table public.learning_session_progress drop constraint if exists learning_session_progress_session_no_check;
alter table public.learning_session_progress add constraint learning_session_progress_session_no_check
  check (session_no >= 1 and session_no <= 9999);
create or replace function public.lsp_sync(p_user uuid, p_class uuid, p_program text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_first int; r record;
begin
  perform pg_advisory_xact_lock(hashtextextended('lsp:' || p_user::text || ':' || p_program, 0));
  select min(s.session_number) into v_first from public.class_sessions s
   where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null;
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
