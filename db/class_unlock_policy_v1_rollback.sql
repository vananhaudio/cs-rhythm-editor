-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — CLASS_UNLOCK_POLICY_V1. Idempotent. Chạy bằng scripts/prod-db.py (không begin/commit).
-- Thứ tự production: (1) đặt mọi lớp về 'sequential' nếu muốn khoá lại (UPDATE riêng, Owner duyệt) hoặc chấp nhận để 'open' đứng yên,
-- (2) frontend về bản trước, (3) file này.
-- LUÔN làm: lsp_sync về ĐÚNG bản Buổi 0 (db/class_session_zero_intro.sql) và class_learning_state về ĐÚNG bản QUIZ V1 (md5 như cổng của setup).
-- CHỈ KHI MỌI LỚP LÀ 'sequential': gỡ ràng buộc + cột. Còn lớp 'open' → GIỮ cột (không xoá cấu hình), báo NOTICE.
-- KHÔNG xoá tiến độ nào (learning_session_progress bất biến lịch sử): các buổi đã mở theo 'open' vẫn mở.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

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

create or replace function public.class_learning_state(p_class uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_teacher boolean;
  v_cls public.class_schedule%rowtype;
  v_learner boolean;
begin
  if v_uid is null then raise exception 'LT_NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into v_cls from public.class_schedule where id = p_class;
  if not found then return jsonb_build_object('class_id', p_class, 'enabled', false); end if;
  v_teacher := public.is_teacher();
  v_learner := not v_teacher and tva_private.can_read_class_curriculum(p_class);
  if coalesce(v_cls.program_code, '') !~ '^[A-Z0-9_]{1,32}$' or not (v_teacher or v_learner)
     or not exists (select 1 from public.class_sessions s join public.class_lesson_content c on c.session_id = s.id
                    cross join lateral jsonb_array_elements(c.blocks) b
                    where s.class_id = p_class and s.event_type = 'lesson' and c.status = 'published'
                      and jsonb_typeof(b) = 'object' and b ->> 'kind' = 'checkpoint') then
    return jsonb_build_object('class_id', p_class, 'enabled', false);
  end if;
  if v_learner then perform public.lsp_sync(v_uid, p_class, v_cls.program_code); end if;

  return jsonb_build_object(
    'class_id', p_class, 'enabled', true, 'role', case when v_teacher then 'teacher' else 'learner' end,
    'program_code', v_cls.program_code, 'class_code', v_cls.code, 'class_name', v_cls.name,
    'server_now', clock_timestamp(), 'pace_days', 7,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id, 'session_no', s.session_number, 'title', s.title,
        'stage_no', st.stage_no, 'stage_title', st.public_title,
        'published', c.session_id is not null,
        'opened_at', p.opened_at, 'completed_at', p.completed_at,
        'checkpoints', case when c.session_id is not null and (v_teacher or p.opened_at is not null) then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', cp.id, 'title', cp.title, 'required', cp.required, 'accepts', to_jsonb(cp.accepts),
            'thread', (select jsonb_build_object('id', t.id, 'status', t.status, 'visibility', t.visibility,
                                                 'passed_at', t.passed_at, 'last_event_at', t.last_event_at)
                       from public.learning_threads t
                       where not v_teacher and t.learner_user_id = v_uid and t.archived_at is null
                         and t.content_key = 'C:' || v_cls.program_code || ':' || s.session_number::text || ':' || cp.id),
            'quiz_passed_at', (select q.passed_at from public.learning_checkpoint_passes q   -- QUIZ_CHECKPOINT_V1
                               where not v_teacher and q.learner_user_id = v_uid
                                 and q.content_key = 'C:' || v_cls.program_code || ':' || s.session_number::text || ':' || cp.id))
            order by cp.ord)
          from public.cl_session_checkpoints(p_class, s.session_number) cp), '[]'::jsonb) else '[]'::jsonb end)
        order by s.session_number)
      from public.class_sessions s
      left join public.class_stages st on st.id = s.stage_id
      left join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
      left join public.learning_session_progress p
             on not v_teacher and p.learner_user_id = v_uid and p.program_code = v_cls.program_code
            and p.session_no = s.session_number
      where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null), '[]'::jsonb));
end $$;

revoke all on function public.lsp_sync(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.class_learning_state(uuid) from public, anon;
grant execute on function public.class_learning_state(uuid) to authenticated;
notify pgrst, 'reload schema';

do $r$ declare v_open int; begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_schedule' and column_name = 'unlock_policy') then
    select count(*) into v_open from public.class_schedule where unlock_policy <> 'sequential';
    if v_open = 0 then
      alter table public.class_schedule drop constraint if exists class_schedule_unlock_policy_check;
      alter table public.class_schedule drop column unlock_policy;
    else
      raise notice 'Giữ cột unlock_policy: % lớp còn đặt khác sequential (hai hàm đã về bản cũ nên chính sách không còn tác dụng).', v_open;
    end if;
  end if;
end $r$;
