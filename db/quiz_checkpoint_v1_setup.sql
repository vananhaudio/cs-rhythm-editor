-- ═══════════════════════════════════════════════════════════════════════════
-- QUIZ CHECKPOINT V1 — Bài trả TRẮC NGHIỆM TỰ CHẤM (single / multiple · 1 câu / checkpoint · server chấm).
-- Thiết kế: docs/QUIZ-CHECKPOINT-V1.md. Rollback: db/quiz_checkpoint_v1_rollback.sql.
-- Preflight/postflight (read-only): db/quiz_checkpoint_v1_{preflight,postflight}.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-learning-threads-db.sh (mục QUIZ V1).
--
-- Owner duyệt (03/10/2026):
--   • Khối checkpoint công khai chỉ có câu hỏi + lựa chọn + mode + gợi ý: {accepts:['quiz'], quiz:{mode, question, options[{id,text}], hint?}}.
--     ĐÁP ÁN KHÔNG BAO GIỜ nằm trong blocks / bundle: học sinh đọc blocks trực tiếp qua RLS (class_lesson_content_student_read).
--   • Đáp án = class_checkpoint_keys (theo buổi của lớp + id checkpoint): KHÔNG ai ngoài server đọc/ghi (RLS bật, không policy, không grant).
--   • Chấm = RPC lt_answer_checkpoint (SECURITY DEFINER): tự kiểm đăng nhập · không phải Thầy · quyền giáo trình · checkpoint THẬT
--     trong blocks đã xuất bản · lựa chọn hợp lệ · buổi đã mở. Trả về ĐÚNG/SAI (không bao giờ trả đáp án). Làm lại không giới hạn.
--   • ĐẠT = learning_checkpoint_passes (một dòng / người / checkpoint: attempts, last_attempt_at, passed_at). KHÔNG Learning Thread
--     → không Feed, không Không gian lớp, không Hàng đợi Thầy. Không ai ghi trực tiếp (không grant) — chỉ qua RPC.
--   • Hoàn thành buổi: lsp_try_complete coi một checkpoint bắt buộc là ĐẠT khi thread passed HOẶC trắc nghiệm ĐẠT.
--     class_learning_state trả thêm quiz_passed_at. Checkpoint chữ/video cũ: hành vi KHÔNG đổi.
-- Thay đúng 2 hàm (cổng md5 = bản production 03/10): lsp_try_complete, class_learning_state.
-- Idempotent. CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: hàm bị thay = bản production đã kiểm (hoặc đã là bản QUIZ_CHECKPOINT_V1 → chạy lại an toàn) ──
do $gate$
declare
  replaced constant jsonb := '{"lsp_try_complete": "8feb5d0c9f16151857bf2ea625d2e83a", "class_learning_state": "fd0ebe70a9674b8c1cc12c6df97d6c47"}';
  needed constant text[] := array['is_teacher', 'cl_session_checkpoints', 'cl_next_session', 'lsp_sync', 'lsp_on_checkpoint_passed'];
  k text; v text; src text; drift text[] := '{}';
begin
  for k, v in select key, value #>> '{}' from jsonb_each(replaced) loop
    select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = k;
    if src is null then drift := drift || format('thiếu hàm %s', k);
    elsif position('QUIZ_CHECKPOINT_V1' in src) = 0 and md5(src) <> v then drift := drift || format('hàm %s khác bản đã kiểm (md5 %s)', k, md5(src));
    end if;
  end loop;
  foreach k in array needed loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = k) then
      drift := drift || format('thiếu hàm %s', k);
    end if;
  end loop;
  if to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is null then drift := drift || 'thiếu tva_private.can_read_class_curriculum(uuid)'::text; end if;
  if to_regclass('public.learning_session_progress') is null then drift := drift || 'thiếu bảng learning_session_progress'::text; end if;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác repo: %', array_to_string(drift, '; '); end if;
end $gate$;

-- ── 1) Đáp án (server-only) ───────────────────────────────────────────────────────────────────
create table if not exists public.class_checkpoint_keys (
  session_id    uuid not null references public.class_sessions(id) on delete cascade,
  checkpoint_id text not null,
  mode          text not null,
  correct       text[] not null,
  updated_at    timestamptz not null default now(),
  primary key (session_id, checkpoint_id),
  constraint class_checkpoint_keys_id_check check (checkpoint_id ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$'),
  constraint class_checkpoint_keys_mode_check check (mode in ('single', 'multiple')),
  constraint class_checkpoint_keys_correct_check check (
    cardinality(correct) between 1 and 20 and array_position(correct, null) is null
    and (mode <> 'single' or cardinality(correct) = 1))
);
alter table public.class_checkpoint_keys enable row level security;       -- không policy, không grant: chỉ server
revoke all on table public.class_checkpoint_keys from public, anon, authenticated;

-- ── 2) Trắc nghiệm ĐẠT (một dòng / người / checkpoint) ────────────────────────────────────────
create table if not exists public.learning_checkpoint_passes (
  id                uuid primary key default gen_random_uuid(),
  learner_user_id   uuid not null references auth.users(id) on delete cascade,
  content_key       text not null,
  program_code      text not null check (program_code ~ '^[A-Z0-9_]{1,32}$'),
  session_no        int  not null check (session_no between 1 and 9999),
  checkpoint_id     text not null check (checkpoint_id ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$'),
  class_schedule_id uuid references public.class_schedule(id) on delete set null,   -- lớp lúc trả lời
  attempts          int  not null default 0 check (attempts >= 0),
  last_attempt_at   timestamptz,
  passed_at         timestamptz,
  created_at        timestamptz not null default now(),
  constraint learning_checkpoint_passes_uq unique (learner_user_id, content_key),
  constraint learning_checkpoint_passes_key_check check (content_key = 'C:' || program_code || ':' || session_no::text || ':' || checkpoint_id)
);
alter table public.learning_checkpoint_passes enable row level security;  -- không policy: chỉ qua RPC
revoke all on table public.learning_checkpoint_passes from public, anon, authenticated;

-- ── 3) RPC: trả lời MỘT checkpoint trắc nghiệm — server chấm, trả ĐÚNG/SAI, không lộ đáp án ──────
create or replace function public.lt_answer_checkpoint(p_class uuid, p_session_no int, p_checkpoint_id text, p_choices text[])
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
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
end $$;

-- ── 4) Hoàn thành buổi: required ĐẠT = thread passed HOẶC trắc nghiệm ĐẠT (phần còn lại GIỮ NGUYÊN bản V1) ──
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
  if found and v_next.published then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
    values (p_user, p_program, v_next.session_no, p_class)
    on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  return true;
end $$;

-- ── 5) Trạng thái học: thêm quiz_passed_at cho từng checkpoint của chính người học (phần còn lại GIỮ NGUYÊN bản V1) ──
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

-- ── 6) Quyền: RPC chỉ authenticated; hàm nội bộ không cấp cho ai (default privileges production cấp cho anon → revoke tường minh) ──
revoke all on function public.lt_answer_checkpoint(uuid, int, text, text[]) from public, anon;
grant execute on function public.lt_answer_checkpoint(uuid, int, text, text[]) to authenticated;
revoke all on function public.lsp_try_complete(uuid, text, int, uuid) from public, anon, authenticated;
revoke all on function public.class_learning_state(uuid) from public, anon;
grant execute on function public.class_learning_state(uuid) to authenticated;

notify pgrst, 'reload schema';
