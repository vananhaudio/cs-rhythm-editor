-- ═══════════════════════════════════════════════════════════════════════════
-- STAGE_OPEN_V1 (Owner chốt 25/11/2026) — BUỔI MỞ ĐẦU MỖI CHẶNG chỉ phụ thuộc việc THẦY MỞ cho lớp, không phụ thuộc chặng trước.
-- Các buổi sau trong chặng giữ cơ chế tiến độ hiện tại. Áp theo cấu trúc class_stages (không hardcode số buổi).
-- Không áp: lớp unlock_policy 'open', lớp chỉ đọc giáo trình (chưa có bài trả), buổi đầu của cả chương trình.
-- KHÔNG tạo bản ghi mở, KHÔNG đổi dòng khoá, KHÔNG xoá tiến độ. Cần LESSON_HOLD_V2. Hoàn tác: db/stage_open_v1_rollback.sql
-- CHẠY bằng scripts/prod-db.py (không có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  replaced constant jsonb := '{
    "lesson_session_released": "404de7734355c16a05d9ed639b69a496",
    "class_session_no_released": "ff5bde3b747b1a9b2eebbb44ee0b50bb",
    "lsp_sync": "66d128daddab0048a390ed45e21504b1",
    "class_learning_state": "c2008bf61833e7b389db29d97b3b33e2",
    "class_lesson_set_hold": "b8d44ef19492da11be804585b3eb4614"
  }';
  k text; v text; src text; drift text[] := '{}';
begin
  for k, v in select key, value from jsonb_each_text(replaced) loop
    select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.proname = k and n.nspname in ('public', 'tva_private');
    if src is null then drift := drift || format('thiếu hàm %s', k);
    elsif position('STAGE_OPEN_V1' in src) = 0 and md5(src) <> v then drift := drift || format('hàm %s khác bản đã kiểm (md5 %s)', k, md5(src));
    end if;
  end loop;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác bản đã kiểm: %', array_to_string(drift, '; '); end if;
end $gate$;

-- Thầy đã bấm mở buổi nào cho lớp (chỉ ghi qua class_lesson_set_hold). Khoá lại thì xoá.
create table if not exists tva_private.class_stage_opening (
  session_id uuid primary key references public.class_sessions(id) on delete cascade,
  opened_at timestamptz not null default now(),
  opened_by uuid
);
alter table tva_private.class_stage_opening enable row level security;
revoke all on tva_private.class_stage_opening from public, anon, authenticated;

-- Chặng của một buổi — CÙNG luật với giao diện (stageOf, src/classLearning/outline.ts): stage_id trước, không có thì theo khoảng from..to.
create or replace function tva_private.session_stage_id(p_session uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select st.id from public.class_sessions s join public.class_stages st on st.id = s.stage_id and st.class_id = s.class_id where s.id = p_session),
    (select st.id from public.class_sessions s join public.class_stages st on st.class_id = s.class_id and s.session_number between st.from_session and st.to_session
      where s.id = p_session order by st.stage_no limit 1));
$$;

-- Buổi này có phải "mở đầu chặng cần Thầy mở"? = lớp có bài trả, khoá tuần tự · buổi số nhỏ nhất (>= 1) của chặng · không phải buổi đầu của cả chương trình.
create or replace function tva_private.session_needs_stage_open(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select coalesce(c.unlock_policy, 'sequential') <> 'open'
       and tva_private.session_stage_id(s.id) is not null
       and exists (select 1 from public.class_sessions e where e.class_id = s.class_id and e.event_type = 'lesson'
                    and e.session_number >= 1 and e.session_number < s.session_number)
       and not exists (select 1 from public.class_sessions e where e.class_id = s.class_id and e.event_type = 'lesson'
                    and e.session_number >= 1 and e.session_number < s.session_number
                    and tva_private.session_stage_id(e.id) = tva_private.session_stage_id(s.id))
       and exists (select 1 from public.class_sessions x join public.class_lesson_content lc on lc.session_id = x.id
                    where x.class_id = s.class_id and x.event_type = 'lesson' and lc.status = 'published'
                      and lc.blocks @> '[{"kind":"checkpoint"}]'::jsonb)
      from public.class_sessions s join public.class_schedule c on c.id = s.class_id
     where s.id = p_session and s.event_type = 'lesson' and s.session_number >= 1), false);
$$;
revoke all on function tva_private.session_stage_id(uuid), tva_private.session_needs_stage_open(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION tva_private.lesson_session_released(p_session uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- STAGE_OPEN_V1: học viên đọc được khi buổi KHÔNG bị khoá và — nếu là buổi mở đầu chặng — Thầy ĐÃ bấm mở cho lớp. Tiến độ không đi vòng được.
   select not exists (select 1 from tva_private.class_lesson_hold h where h.session_id = p_session)
      and (exists (select 1 from tva_private.class_stage_opening o where o.session_id = p_session)
           or not tva_private.session_needs_stage_open(p_session));
 $function$;

CREATE OR REPLACE FUNCTION tva_private.class_session_no_released(p_class uuid, p_no integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- STAGE_OPEN_V1: cùng MỘT điểm kiểm với lesson_session_released.
  select not exists (select 1 from public.class_sessions s
                      where s.class_id = p_class and s.session_number = p_no and s.event_type = 'lesson'
                        and not tva_private.lesson_session_released(s.id));
$function$;

CREATE OR REPLACE FUNCTION public.lsp_sync(p_user uuid, p_class uuid, p_program text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- STAGE_OPEN_V1
 -- LESSON_HOLD_V2
declare v_first int; r record; v_policy text;
begin
  perform pg_advisory_xact_lock(hashtextextended('lsp:' || p_user::text || ':' || p_program, 0));
  select min(s.session_number) into v_first from public.class_sessions s
   where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null and s.session_number >= 1;
  -- Buổi 0 (nhập môn): mở + xong ngay, không bao giờ chặn buổi 1.
  if exists (select 1 from public.class_sessions s where s.class_id = p_class and s.event_type = 'lesson' and s.session_number = 0)
     and tva_private.class_session_no_released(p_class, 0) then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id, completed_at, completed_class_schedule_id)
    values (p_user, p_program, 0, p_class, now(), p_class)
    on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  if v_first is null then return; end if;
  insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
   select p_user, p_program, v_first, p_class where tva_private.class_session_no_released(p_class, v_first)
  on conflict (learner_user_id, program_code, session_no) do nothing;
  -- CLASS_UNLOCK_POLICY_V1: chính sách theo lớp ('sequential' = như cũ · 'open' = mọi buổi ĐÃ XUẤT BẢN đều mở)
  select coalesce(c.unlock_policy, 'sequential') into v_policy from public.class_schedule c where c.id = p_class;
  if v_policy = 'open' then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
    select p_user, p_program, s.session_number, p_class
      from public.class_sessions s
      join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
     where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null
        and tva_private.lesson_session_released(s.id)
     on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  -- STAGE_OPEN_V1: buổi mở đầu chặng Thầy đã mở → vào học ngay, KHÔNG cần xong chặng trước (tiến độ chặng cũ giữ nguyên)
  insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
  select p_user, p_program, s.session_number, p_class
    from public.class_sessions s
    join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
   where s.class_id = p_class and s.event_type = 'lesson'
     and tva_private.session_needs_stage_open(s.id) and tva_private.lesson_session_released(s.id)
  on conflict (learner_user_id, program_code, session_no) do nothing;
  for r in select p.session_no from public.learning_session_progress p
            where p.learner_user_id = p_user and p.program_code = p_program
            order by p.session_no loop
    perform public.lsp_try_complete(p_user, p_program, r.session_no, p_class);
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.class_learning_state(p_class uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- STAGE_OPEN_V1
 -- LESSON_HOLD_V2
declare
  v_uid uuid := auth.uid();
  v_teacher boolean;
  v_cls public.class_schedule%rowtype;
  v_learner boolean;
begin
  -- CLASS_UNLOCK_POLICY_V1: thêm unlock_policy · pace_days (0 = không nhịp tuần khi 'open') · start_at từng buổi
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
    'server_now', clock_timestamp(), 'unlock_policy', coalesce(v_cls.unlock_policy, 'sequential'),
    'pace_days', case when v_cls.unlock_policy = 'open' then 0 else 7 end,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id, 'session_no', s.session_number, 'title', s.title,
        'stage_no', st.stage_no, 'stage_title', st.public_title,
        'published', c.session_id is not null, 'start_at', s.start_at,
        'held', not tva_private.lesson_session_released(s.id),
         'stage_start', tva_private.session_needs_stage_open(s.id),
         'opened_at', case when v_teacher or tva_private.lesson_session_released(s.id) then p.opened_at end,
         'completed_at', case when v_teacher or tva_private.lesson_session_released(s.id) then p.completed_at end,
        'checkpoints', case when c.session_id is not null and (v_teacher or (p.opened_at is not null and tva_private.lesson_session_released(s.id))) then coalesce((
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
end $function$;

CREATE OR REPLACE FUNCTION public.class_lesson_set_hold(p_session uuid, p_hold boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- STAGE_OPEN_V1
begin
  -- LESSON_HOLD_V2: thao tác mở/khoá buổi CHỈ dành cho Thầy.
  if auth.uid() is null or not coalesce(public.is_teacher(), false) then raise exception 'LH_TEACHER_ONLY' using errcode = '42501'; end if;
  if p_hold is null or not exists (select 1 from public.class_sessions s where s.id = p_session and s.event_type = 'lesson') then
    raise exception 'LH_BAD_SESSION' using errcode = '22023';
  end if;
  if p_hold then
    insert into tva_private.class_lesson_hold (session_id, reason) values (p_session, 'Thầy khoá trong ứng dụng · ' || auth.uid()::text)
    on conflict (session_id) do nothing;
    delete from tva_private.class_stage_opening where session_id = p_session;
  else
    delete from tva_private.class_lesson_hold where session_id = p_session;
    insert into tva_private.class_stage_opening (session_id, opened_by) values (p_session, auth.uid())
    on conflict (session_id) do nothing;
  end if;
  return jsonb_build_object('session_id', p_session, 'held', p_hold);
end $function$;

notify pgrst, 'reload schema';
