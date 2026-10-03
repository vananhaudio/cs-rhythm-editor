-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — QUIZ CHECKPOINT V1. Idempotent. Chạy bằng scripts/prod-db.py (không begin/commit).
-- Thứ tự production: (1) nội dung buổi có trắc nghiệm về bản trước (vd Buổi 02: prod-migrations/solo01-buoi02-quiz/rollback.sql),
-- (2) frontend về bản trước, (3) file này.
-- LUÔN làm: gỡ RPC lt_answer_checkpoint; lsp_try_complete + class_learning_state về ĐÚNG bản V1 (md5 production 03/10).
-- CHỈ KHI CHƯA CÓ DỮ LIỆU (0 dòng learning_checkpoint_passes): gỡ 2 bảng. Có dữ liệu → GIỮ (không xoá kết quả học sinh), báo NOTICE.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

drop function if exists public.lt_answer_checkpoint(uuid, int, text, text[]);

-- ── Về đúng bản V1 (chép nguyên văn từ db/class_checkpoints_v1_setup.sql) ──
create or replace function public.lsp_try_complete(p_user uuid, p_program text, p_session_no int, p_class uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.learning_session_progress%rowtype; v_required text[]; v_next record; v_done boolean;
begin
  if p_user is null or p_program is null or p_session_no is null or p_class is null then return false; end if;
  select * into v_row from public.learning_session_progress
   where learner_user_id = p_user and program_code = p_program and session_no = p_session_no for update;
  if not found then return false; end if;
  v_done := v_row.completed_at is not null;
  if not v_done then
    select array_agg(distinct cp.id) into v_required from public.cl_session_checkpoints(p_class, p_session_no) cp where cp.required;
    if coalesce(cardinality(v_required), 0) = 0 then return false; end if;
    if exists (select 1 from unnest(v_required) r(cid) where not exists (
                 select 1 from public.learning_threads t
                 where t.learner_user_id = p_user and t.content_kind = 'program_checkpoint'
                   and t.content_key = 'C:' || p_program || ':' || p_session_no::text || ':' || r.cid
                   and t.passed_at is not null)) then
      return false;
    end if;
    update public.learning_session_progress
       set completed_at = greatest(clock_timestamp(), opened_at), completed_class_schedule_id = p_class
     where id = v_row.id and completed_at is null;
  end if;
  select * into v_next from public.cl_next_session(p_class, p_session_no);
  if found and v_next.published then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
    values (p_user, p_program, v_next.session_no, p_class)
    on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  return true;
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
                         and t.content_key = 'C:' || v_cls.program_code || ':' || s.session_number::text || ':' || cp.id))
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

revoke all on function public.lsp_try_complete(uuid, text, int, uuid) from public, anon, authenticated;
revoke all on function public.class_learning_state(uuid) from public, anon;
grant execute on function public.class_learning_state(uuid) to authenticated;

do $$
declare v_has boolean := false;
begin
  if to_regclass('public.learning_checkpoint_passes') is not null then
    execute 'select exists (select 1 from public.learning_checkpoint_passes)' into v_has;   -- execute: bảng có thể đã bị gỡ (chạy lại)
  end if;
  if v_has then
    raise notice 'GIỮ learning_checkpoint_passes + class_checkpoint_keys: đã có kết quả trắc nghiệm của học sinh';
  else
    drop table if exists public.learning_checkpoint_passes;
    drop table if exists public.class_checkpoint_keys;
  end if;
end $$;

notify pgrst, 'reload schema';
