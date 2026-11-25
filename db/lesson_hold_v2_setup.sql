-- ═══════════════════════════════════════════════════════════════════════════
-- LESSON_HOLD_V2 — buổi bị Thầy khoá thì học viên KHÔNG đọc được, bất kể tiến độ.
-- Lỗi V1: lesson_session_released cho đọc khi học viên có dòng tiến độ, mà lsp_try_complete tự tạo dòng đó khi xong buổi trước
--         → khoá không chặn học viên đi tuần tự. Các hàm chia sẻ/tra cứu SECURITY DEFINER cũng không kiểm khoá.
-- V2: một điểm kiểm (lesson_session_released = không có dòng khoá) áp cho: đọc giáo trình (RLS), trạng thái lớp, tự mở buổi,
--     trả bài, chia sẻ, tra cứu giáo trình, thẻ clip, ngữ cảnh Mira. Thêm class_lesson_set_hold (CHỈ Thầy) để mở/khoá.
-- KHÔNG thêm/xoá dòng khoá nào, KHÔNG mở bài nào, KHÔNG xoá tiến độ hay điểm đã có. Không đổi policy.
-- Lớp không có dòng khoá: hành vi giữ nguyên.
-- CHẠY bằng scripts/prod-db.py (không có begin/commit). Hoàn tác: db/lesson_hold_v2_rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  replaced constant jsonb := '{
    "lesson_session_released": "41321181179e9d516f4aa70f51cfc0eb",
    "lsp_sync": "fcc51b82a7e703330381795a912a9e0f",
    "lsp_try_complete": "bc02a6cc2e39107d94799522fbc95cc1",
    "class_learning_state": "9227cbb94195de96a034164f7c3cbc4d",
    "lt_answer_checkpoint": "f664e21f7247aa7b20eae9f51c5d61a6",
    "lt_submit_checkpoint": "e2c4e8200b81631eeee02d4aa6cc60bf",
    "share_note_score_ok": "36ddb7c8d45a2fe1f2e4c797e6e37945",
    "dp_class_curriculum_rows": "6a0191cda517962f72e4260051eec91e",
    "social_feed_clip_items": "09559eaaa474aca6649522c9dfb594e0",
    "mira_student_context": "9a2b519a3e110219b0ad4a99c82fdd1b"
  }';
  k text; v text; src text; drift text[] := '{}';
begin
  for k, v in select key, value from jsonb_each_text(replaced) loop
    select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.proname = k and n.nspname = case when k = 'lesson_session_released' then 'tva_private' else 'public' end;
    if src is null then drift := drift || format('thiếu hàm %s', k);
    elsif position('LESSON_HOLD_V2' in src) = 0 and md5(src) <> v then drift := drift || format('hàm %s khác bản đã kiểm (md5 %s)', k, md5(src));
    end if;
  end loop;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác bản đã kiểm: %', array_to_string(drift, '; '); end if;
end $gate$;

create or replace function tva_private.class_session_no_released(p_class uuid, p_no integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.class_sessions s join tva_private.class_lesson_hold h on h.session_id = s.id
                      where s.class_id = p_class and s.session_number = p_no and s.event_type = 'lesson');
$$;
revoke all on function tva_private.class_session_no_released(uuid, integer) from public, anon, authenticated;

create or replace function public.class_lesson_set_hold(p_session uuid, p_hold boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- LESSON_HOLD_V2: thao tác mở/khoá buổi CHỈ dành cho Thầy.
  if auth.uid() is null or not coalesce(public.is_teacher(), false) then raise exception 'LH_TEACHER_ONLY' using errcode = '42501'; end if;
  if p_hold is null or not exists (select 1 from public.class_sessions s where s.id = p_session and s.event_type = 'lesson') then
    raise exception 'LH_BAD_SESSION' using errcode = '22023';
  end if;
  if p_hold then
    insert into tva_private.class_lesson_hold (session_id, reason) values (p_session, 'Thầy khoá trong ứng dụng · ' || auth.uid()::text)
    on conflict (session_id) do nothing;
  else
    delete from tva_private.class_lesson_hold where session_id = p_session;
  end if;
  return jsonb_build_object('session_id', p_session, 'held', p_hold);
end $$;
revoke all on function public.class_lesson_set_hold(uuid, boolean) from public, anon;
grant execute on function public.class_lesson_set_hold(uuid, boolean) to authenticated;


CREATE OR REPLACE FUNCTION tva_private.lesson_session_released(p_session uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2: buổi còn dòng khoá = KHÔNG học viên nào đọc được, bất kể tiến độ. Chỉ Thầy mở khoá (class_lesson_set_hold).
   select not exists (select 1 from tva_private.class_lesson_hold h where h.session_id = p_session);
 $function$;

CREATE OR REPLACE FUNCTION public.lsp_sync(p_user uuid, p_class uuid, p_program text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  for r in select p.session_no from public.learning_session_progress p
            where p.learner_user_id = p_user and p.program_code = p_program
            order by p.session_no loop
    perform public.lsp_try_complete(p_user, p_program, r.session_no, p_class);
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.lsp_try_complete(p_user uuid, p_program text, p_session_no integer, p_class uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
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
                   and t.passed_at is not null)
               and not exists (                                   -- QUIZ_CHECKPOINT_V1: trắc nghiệm tự chấm ĐẠT
                 select 1 from public.learning_checkpoint_passes q
                 where q.learner_user_id = p_user
                   and q.content_key = 'C:' || p_program || ':' || p_session_no::text || ':' || r.cid
                   and q.passed_at is not null)) then
      return false;
    end if;
    update public.learning_session_progress
       set completed_at = greatest(clock_timestamp(), opened_at), completed_class_schedule_id = p_class
     where id = v_row.id and completed_at is null;
  end if;
  select * into v_next from public.cl_next_session(p_class, p_session_no);
  if found and v_next.published and tva_private.class_session_no_released(p_class, v_next.session_no) then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
    values (p_user, p_program, v_next.session_no, p_class)
    on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.class_learning_state(p_class uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.lt_answer_checkpoint(p_class uuid, p_session_no integer, p_checkpoint_id text, p_choices text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
declare
  v_uid uuid := auth.uid();
  v_cls public.class_schedule%rowtype;
  v_sid uuid; v_quiz jsonb; v_accepts jsonb;
  v_mode text; v_opts text[]; v_choices text[]; v_correct_set text[];
  v_key public.class_checkpoint_keys%rowtype;
  v_ck text; v_row public.learning_checkpoint_passes%rowtype;
  v_correct boolean; v_now timestamptz := clock_timestamp();
begin  -- QUIZ_CHECKPOINT_V1
  if v_uid is null then raise exception 'LT_NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if public.is_teacher() then raise exception 'LT_TEACHER_CANNOT_SUBMIT' using errcode = '42501'; end if;
  select * into v_cls from public.class_schedule where id = p_class;
  if not found or coalesce(v_cls.program_code, '') !~ '^[A-Z0-9_]{1,32}$' then
    raise exception 'LT_CHECKPOINT_NOT_FOUND' using errcode = '22023';
  end if;
  if not tva_private.can_read_class_curriculum(p_class) then raise exception 'LT_NO_ACCESS' using errcode = '42501'; end if;

  -- checkpoint THẬT trong blocks đã xuất bản (cùng luật id với cl_session_checkpoints; không tin client)
  select s.id, x.b -> 'quiz', x.b -> 'accepts' into v_sid, v_quiz, v_accepts
    from public.class_sessions s
    join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
    cross join lateral jsonb_array_elements(c.blocks) with ordinality x(b, ord)
   where s.class_id = p_class and s.session_number = p_session_no and s.event_type = 'lesson'
     and jsonb_typeof(x.b) = 'object' and x.b ->> 'kind' = 'checkpoint' and x.b ->> 'id' = p_checkpoint_id
     and coalesce(x.b ->> 'id', '') ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$'
   order by x.ord limit 1;
  if v_sid is null then raise exception 'LT_CHECKPOINT_NOT_FOUND' using errcode = '22023'; end if;
   if not tva_private.lesson_session_released(v_sid) then raise exception 'LT_SESSION_LOCKED' using errcode = '42501'; end if;
  if coalesce(jsonb_typeof(v_accepts), '') <> 'array' or not (v_accepts ? 'quiz') or coalesce(jsonb_typeof(v_quiz), '') <> 'object' then
    raise exception 'LT_NOT_QUIZ' using errcode = '22023';
  end if;
  v_mode := v_quiz ->> 'mode';
  if v_mode is null or v_mode not in ('single', 'multiple') or coalesce(jsonb_typeof(v_quiz -> 'options'), '') <> 'array' then
    raise exception 'LT_NOT_QUIZ' using errcode = '22023';
  end if;
  select array_agg(o ->> 'id') into v_opts from jsonb_array_elements(v_quiz -> 'options') o where jsonb_typeof(o) = 'object';

  -- lựa chọn gửi lên: có, không trùng, không rỗng, đều là lựa chọn THẬT; single = đúng 1
  select array_agg(distinct x order by x) into v_choices from unnest(p_choices) x;
  if v_choices is null or cardinality(p_choices) > 20 or cardinality(v_choices) <> cardinality(p_choices)
     or exists (select 1 from unnest(p_choices) x where x is null or not (x = any(coalesce(v_opts, '{}'))))
     or (v_mode = 'single' and cardinality(v_choices) <> 1) then
    raise exception 'LT_BAD_ANSWER' using errcode = '22023';
  end if;

  -- buổi phải ĐÃ MỞ với người học (đồng bộ lười như lt_submit_checkpoint)
  perform public.lsp_sync(v_uid, p_class, v_cls.program_code);
  if not exists (select 1 from public.learning_session_progress p
                 where p.learner_user_id = v_uid and p.program_code = v_cls.program_code and p.session_no = p_session_no) then
    raise exception 'LT_SESSION_LOCKED' using errcode = '42501';
  end if;

  select * into v_key from public.class_checkpoint_keys where session_id = v_sid and checkpoint_id = p_checkpoint_id;
  if not found or v_key.mode <> v_mode
     or exists (select 1 from unnest(v_key.correct) k where not (k = any(coalesce(v_opts, '{}')))) then
    raise exception 'LT_QUIZ_NOT_READY' using errcode = '22023';   -- giáo trình xuất bản thiếu/lệch đáp án: không chấm bừa
  end if;

  v_ck := 'C:' || v_cls.program_code || ':' || p_session_no::text || ':' || p_checkpoint_id;
  perform pg_advisory_xact_lock(hashtextextended('learning_checkpoint:' || v_uid::text || ':' || v_ck, 0));
  select * into v_row from public.learning_checkpoint_passes where learner_user_id = v_uid and content_key = v_ck;
  if found and v_row.passed_at is not null then   -- đã ĐẠT: giữ nguyên, không chấm lại
    return jsonb_build_object('correct', true, 'passed_at', v_row.passed_at, 'attempts', v_row.attempts, 'already_passed', true);
  end if;

  select array_agg(distinct k order by k) into v_correct_set from unnest(v_key.correct) k;
  v_correct := v_choices = v_correct_set;   -- multiple: đúng CẢ TẬP (thiếu hay thừa đều sai)

  insert into public.learning_checkpoint_passes as q
    (learner_user_id, content_key, program_code, session_no, checkpoint_id, class_schedule_id, attempts, last_attempt_at, passed_at)
  values (v_uid, v_ck, v_cls.program_code, p_session_no, p_checkpoint_id, p_class, 1, v_now, case when v_correct then v_now end)
  on conflict (learner_user_id, content_key) do update
     set attempts = q.attempts + 1, last_attempt_at = v_now, class_schedule_id = excluded.class_schedule_id,
         passed_at = case when v_correct then v_now else q.passed_at end
  returning * into v_row;

  if v_correct then perform public.lsp_try_complete(v_uid, v_cls.program_code, p_session_no, p_class); end if;
  return jsonb_build_object('correct', v_correct, 'passed_at', v_row.passed_at, 'attempts', v_row.attempts);
end $function$;

CREATE OR REPLACE FUNCTION public.lt_submit_checkpoint(p_class uuid, p_session_no integer, p_checkpoint_id text, p_body text, p_media_url text DEFAULT NULL::text, p_media_provider text DEFAULT NULL::text, p_external_media_id text DEFAULT NULL::text, p_visibility text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
declare
  v_uid uuid := auth.uid();
  v_cls public.class_schedule%rowtype;
  v_cp record;
  v_ses record;
  v_key text;
  v_url text := nullif(btrim(p_media_url), '');
  v_body text := btrim(coalesce(p_body, ''));
  v_thread public.learning_threads%rowtype;
  v_identity jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'LT_NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if public.is_teacher() then raise exception 'LT_TEACHER_CANNOT_SUBMIT' using errcode = '42501'; end if;
  if p_visibility is not null and p_visibility not in ('class', 'private') then
    raise exception 'LT_BAD_VISIBILITY' using errcode = '22023';
  end if;
  select * into v_cls from public.class_schedule where id = p_class;
  if not found or coalesce(v_cls.program_code, '') !~ '^[A-Z0-9_]{1,32}$' then
    raise exception 'LT_CHECKPOINT_NOT_FOUND' using errcode = '22023';
  end if;
  if not tva_private.can_read_class_curriculum(p_class) then raise exception 'LT_NO_ACCESS' using errcode = '42501'; end if;
   if not tva_private.class_session_no_released(p_class, p_session_no) then raise exception 'LT_SESSION_LOCKED' using errcode = '42501'; end if;

  select * into v_cp from public.cl_session_checkpoints(p_class, p_session_no) cp where cp.id = p_checkpoint_id order by cp.ord limit 1;
  if not found then raise exception 'LT_CHECKPOINT_NOT_FOUND' using errcode = '22023'; end if;
  if not (v_cp.accepts && array['text', 'video_link']) then raise exception 'LT_CHECKPOINT_UNSUPPORTED' using errcode = '22023'; end if;
  perform public.lt_check_media(v_url, p_media_provider, p_external_media_id);
  if v_url is not null and not ('video_link' = any(v_cp.accepts)) then raise exception 'LT_BAD_MEDIA' using errcode = '22023'; end if;
  if v_url is null and not ('text' = any(v_cp.accepts)) then raise exception 'LT_MEDIA_REQUIRED' using errcode = '22023'; end if;
  if v_url is null and v_body = '' then raise exception 'LT_EMPTY' using errcode = '22023'; end if;

  perform public.lsp_sync(v_uid, p_class, v_cls.program_code);
  if not exists (select 1 from public.learning_session_progress p
                 where p.learner_user_id = v_uid and p.program_code = v_cls.program_code and p.session_no = p_session_no) then
    raise exception 'LT_SESSION_LOCKED' using errcode = '42501';
  end if;

  v_key := 'C:' || v_cls.program_code || ':' || p_session_no::text || ':' || v_cp.id;
  perform pg_advisory_xact_lock(hashtextextended('learning_thread:' || v_uid::text || ':' || v_key, 0));
  select * into v_thread from public.learning_threads
   where learner_user_id = v_uid and content_key = v_key and archived_at is null;

  if not found then
    select s.title, st.id as stage_id, st.stage_no, st.public_title into v_ses
      from public.class_sessions s left join public.class_stages st on st.id = s.stage_id
     where s.class_id = p_class and s.session_number = p_session_no and s.event_type = 'lesson';
    v_identity := jsonb_build_object(
      'v', 1, 'kind', 'checkpoint', 'captured_at', v_now,
      'lesson', jsonb_build_object('id', null, 'lesson_type', 'checkpoint', 'order_index', v_cp.ord,
                                   'title', 'Bài trả ' || v_cp.id || case when v_cp.title <> '' then ' · ' || v_cp.title else '' end),
      'module', jsonb_build_object('id', null, 'order_index', p_session_no, 'level', null,
                                   'name', v_cls.program_code || ' · Buổi ' || lpad(p_session_no::text, 2, '0')
                                           || coalesce(' · ' || nullif(regexp_replace(coalesce(v_ses.title, ''), '^Buổi\s*\d+\s*[·:–-]\s*', ''), ''), '')),
      'course', jsonb_build_object('id', null, 'code', v_cls.program_code, 'name', v_cls.name, 'track', null, 'subject', null, 'level', null),
      'class', jsonb_build_object('schedule_id', v_cls.id, 'code', v_cls.code, 'name', v_cls.name,
                                  'program_code', v_cls.program_code, 'stage', v_cls.stage, 'public_product', v_cls.public_product,
                                  'status', v_cls.status, 'stage_id', v_ses.stage_id, 'stage_no', v_ses.stage_no,
                                  'stage_title', v_ses.public_title),
      'checkpoint', jsonb_build_object('program_code', v_cls.program_code, 'session_no', p_session_no, 'id', v_cp.id,
                                       'title', v_cp.title, 'required', v_cp.required),
      'learner', (select jsonb_build_object('student_id', es.id, 'ht_member', coalesce(es.ht_member, false), 'level', es.level)
                  from public.edu_students es where es.user_id = v_uid order by es.enrolled_at desc nulls last limit 1));
    insert into public.learning_threads (
      learner_user_id, content_kind, content_key, program_code, session_no, checkpoint_id,
      class_schedule_id, class_stage_id, student_id, identity, visibility, status)
    values (
      v_uid, 'program_checkpoint', v_key, v_cls.program_code, p_session_no, v_cp.id,
      v_cls.id, v_ses.stage_id, (v_identity #>> '{learner,student_id}')::uuid, v_identity,
      coalesce(p_visibility, 'class'), 'waiting_teacher')
    returning * into v_thread;
  elsif v_thread.hidden_at is not null then
    raise exception 'LT_THREAD_HIDDEN' using errcode = '42501';
  end if;

  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body,
                                             media_type, media_provider, media_url, external_media_id)
  values (v_thread.id, v_uid, 'student', 'submission', v_body,
          case when v_url is not null then 'external_video' end,
          case when v_url is not null then p_media_provider end,
          v_url,
          case when v_url is not null then p_external_media_id end);

  update public.learning_threads
     set status = 'waiting_teacher', last_event_at = v_now, last_student_event_at = v_now,
         event_count = event_count + 1, updated_at = v_now
   where id = v_thread.id;
  return v_thread.id;
end $function$;

CREATE OR REPLACE FUNCTION public.share_note_score_ok(p_session uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
  select auth.uid() is not null and exists (
    select 1 from public.class_sessions s where s.id = p_session and s.event_type = 'lesson'
       and (public.is_teacher() or (tva_private.can_read_class_curriculum(s.class_id) and tva_private.lesson_session_released(s.id)
            and exists (select 1 from public.class_lesson_content c where c.session_id = s.id and c.status = 'published'))));
$function$;

CREATE OR REPLACE FUNCTION public.dp_class_curriculum_rows(p_teacher boolean, p_q text)
 RETURNS TABLE(prog text, pname text, session_no integer, title text, blocks jsonb, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
  select coalesce(nullif(btrim(cs.program_code), ''), cs.code), cs.name, s.session_number, s.title, c.blocks, c.updated_at
    from public.class_schedule cs
    join public.class_sessions s on s.class_id = cs.id and s.event_type = 'lesson'
    join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
   where (p_teacher or (tva_private.can_read_class_curriculum(cs.id) and tva_private.lesson_session_released(s.id)))
     and (p_q = '' or position(p_q in public.dp_fold(coalesce(cs.program_code, '') || ' ' || coalesce(cs.code, '') || ' ' || coalesce(cs.name, ''))) > 0)
$function$;

CREATE OR REPLACE FUNCTION public.social_feed_clip_items(p_class_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(sort_at timestamp with time zone, sort_key text, payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
  select distinct on (s.id, k.key) v.at, 'c:' || s.id::text || ':' || k.key,
         jsonb_build_object('session_id', s.id, 'class_id', cs.id, 'class_code', cs.code, 'class_name', cs.name,
                            'session_no', s.session_number, 'title', left(btrim(b.e ->> 'title'), 120),
                            'duration', left(btrim(coalesce(b.e ->> 'duration', '')), 20), 'added_at', v.at)
  from public.class_lesson_content lc
  join public.class_sessions s on s.id = lc.session_id and s.event_type = 'lesson'
  join public.class_schedule cs on cs.id = s.class_id
  cross join lateral jsonb_array_elements(lc.blocks) with ordinality b(e, ord)
  cross join lateral (select public.social_clip_added_at(b.e ->> 'added_at') as at) v
  cross join lateral (select substr(md5(coalesce(b.e ->> 'added_at', '') || '|' || coalesce(b.e ->> 'title', '')), 1, 10) as key) k
  where lc.status = 'published'
    and lc.blocks @> '[{"kind":"video"}]'::jsonb
    and b.e ->> 'kind' = 'video'
    and v.at is not null and v.at > now() - interval '90 days' and v.at <= now() + interval '5 minutes'
    and s.session_number is not null
    and btrim(coalesce(b.e ->> 'title', '')) <> ''
    and (p_class_ids is null or cs.id = any (p_class_ids))
    and tva_private.can_read_class_curriculum(cs.id)
     and (public.is_teacher() or tva_private.lesson_session_released(s.id))
  order by s.id, k.key, b.ord
$function$;

CREATE OR REPLACE FUNCTION public.mira_student_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
declare
  v_uid uuid := auth.uid();
  v_classes jsonb; v_threads jsonb;
begin
  if not public.mira_student_pilot_enabled() then raise exception 'MIRA_FORBIDDEN' using errcode = '42501'; end if;
  -- V1.3: dữ liệu học tập CHỈ khi có đồng ý hợp lệ (phòng thủ tầng DB; edge cũng chỉ gọi khi đã đồng ý)
  if public.ai_consent_state(v_uid, 'mira_student') <> 'ok' then raise exception 'AI_CONSENT_REQUIRED' using errcode = 'P0001'; end if;

  select coalesce(jsonb_agg(k.j order by k.start_date desc nulls last, k.code), '[]'::jsonb) into v_classes
  from (
    select cs.start_date, cs.code, jsonb_build_object(
      'class_id', cs.id, 'code', cs.code, 'name', cs.name, 'program_code', cs.program_code,
      'curriculum_access', coalesce(tva_private.can_read_class_curriculum(cs.id), false),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'session_no', s.session_number, 'title', s.title,
          'opened_at', p.opened_at, 'completed_at', p.completed_at,
          'checkpoints', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', cp.id, 'title', cp.title, 'required', cp.required,
              'status', t.status, 'passed_at', t.passed_at, 'last_event_at', t.last_event_at) order by cp.ord), '[]'::jsonb)
            from public.cl_session_checkpoints(cs.id, s.session_number) cp
            left join public.learning_threads t
                   on t.learner_user_id = v_uid and t.archived_at is null and t.hidden_at is null
                  and t.content_key = 'C:' || cs.program_code || ':' || s.session_number::text || ':' || cp.id)
        ) order by s.session_number)
        from public.class_sessions s
        join public.learning_session_progress p
          on p.learner_user_id = v_uid and p.program_code = cs.program_code and p.session_no = s.session_number
        where s.class_id = cs.id and s.event_type = 'lesson' and s.session_number is not null
           and tva_private.lesson_session_released(s.id)), '[]'::jsonb)
    ) as j
    from public.class_schedule cs
    where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
      and coalesce(cs.program_code, '') ~ '^[A-Z0-9_]{1,32}$'
      and public.social_class_is_member(cs.id, v_uid)
    order by cs.start_date desc nulls last, cs.code
    limit 5
  ) k;

  -- Bài trả gần nhất của CHÍNH học viên + nhận xét do tài khoản giáo viên viết (kind teacher_*; ràng buộc DB: author_role='teacher').
  select coalesce(jsonb_agg(x.j order by x.last_event_at desc nulls last), '[]'::jsonb) into v_threads
  from (
    select t.last_event_at, jsonb_build_object(
      'program_code', t.program_code, 'session_no', t.session_no, 'checkpoint_id', t.checkpoint_id,
      'status', t.status, 'passed_at', t.passed_at, 'last_event_at', t.last_event_at,
      'my_last_post', (select jsonb_build_object('kind', e.kind, 'body', left(e.body, 600), 'created_at', e.created_at)
                         from public.learning_thread_events e
                        where e.thread_id = t.id and e.author_role = 'student' and e.hidden_at is null
                        order by e.seq desc limit 1),
      'teacher_feedback', coalesce((
        select jsonb_agg(jsonb_build_object('kind', f.kind, 'verdict', f.verdict, 'body', left(f.body, 800), 'created_at', f.created_at) order by f.seq)
        from (select * from public.learning_thread_events e
               where e.thread_id = t.id and e.author_role = 'teacher' and e.hidden_at is null
               order by e.seq desc limit 2) f), '[]'::jsonb)) as j
    from public.learning_threads t
    where t.learner_user_id = v_uid and t.archived_at is null and t.hidden_at is null
    order by t.last_event_at desc nulls last
    limit 5
  ) x;

  return jsonb_build_object('schema', 'mira-student-learning/1', 'user_id', v_uid, 'generated_at', clock_timestamp(),
                            'classes', v_classes, 'recent_threads', v_threads);
end $function$;
notify pgrst, 'reload schema';
