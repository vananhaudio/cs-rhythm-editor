-- ═══════════════════════════════════════════════════════════════════════════
-- LỚP CỦA TÔI V1 — HỌC → TRẢ BÀI TẠI CHECKPOINT → CHẤM → MỞ BUỔI TIẾP THEO.
-- Thiết kế: docs/CLASS-CHECKPOINTS-V1.md. Rollback: db/class_checkpoints_v1_rollback.sql.
-- Preflight/postflight (read-only): db/class_checkpoints_v1_{preflight,postflight}.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-learning-threads-db.sh (mục CHECKPOINTS V1).
--
-- Owner chốt (01/10/2026):
--   1. Checkpoint thuộc CHƯƠNG TRÌNH + BUỔI (khoá C:<PROGRAM>:<buổi>:<id>), không thuộc lớp. Thread vẫn đóng dấu
--      class_schedule_id lúc nộp (feed/quyền/ngữ cảnh đúng lớp).
--   2. Quyền xem checkpoint thread MỚI: chính chủ · thành viên CÙNG LỚP · Thầy/admin. Thread cũ GIỮ NGUYÊN luật cũ.
--      → visibility mới 'class' (chỉ cho checkpoint). Mọi Feed/Tường/Hành trình cũ đều lọc visibility = 'community'
--        nên thread 'class' KHÔNG lọt ra ngoài lớp mà không cần sửa các hàm đó.
--   3. DB (class_lesson_content.blocks) là nguồn giáo trình runtime; định nghĩa checkpoint = khối
--      {kind:'checkpoint', id, title, prompt, required, accepts} NGAY TRONG blocks — không bảng định nghĩa riêng.
--   4. Pilot từ Buổi 1: không suy diễn/bulk tạo tiến độ; buổi đầu mở LƯỜI khi người học có quyền giáo trình
--      (class_curriculum_access — Admin bật từng người) mở lớp lần đầu.
--
-- Tiến độ = learning_session_progress (máy chủ là nguồn sự thật): opened_at BẤT BIẾN, completed_at ghi MỘT lần.
-- Sửa giáo trình sau này KHÔNG viết lại lịch sử (không bao giờ "bỏ hoàn thành").
-- Hoàn thành buổi = mọi checkpoint required của buổi đã ĐẠT (passed_at) → completed_at → mở buổi lesson kế tiếp
-- (nếu buổi đó đã xuất bản; chưa xuất bản → mở lười khi xuất bản). Dòng nghỉ (event_type 'break') không phải buổi.
-- Trễ KHÔNG khoá: màu tuần do giao diện suy từ opened_at / completed_at (DB không lưu màu).
--
-- KHÔNG đổi: lt_submit, lt_respond (hoàn thành buổi qua TRIGGER khi passed_at chuyển null → có), Feed/Tường/Hành trình,
-- quyền thread cũ. Thay đúng 3 hàm (có cổng md5 = bản production 01/10): lt_detail, lt_set_visibility, social_class_activity.
-- Idempotent. CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: hiện trạng production đúng như repo đã kiểm ────────────────────────────────────
-- Hàm bị THAY: md5 phải = bản production (đọc 01/10) HOẶC đã là bản V1 (có dấu CHECKPOINT_V1 → chạy lại an toàn).
do $gate$
declare
  replaced constant jsonb := '{"lt_detail": "5b8f57d71b7b2392a17bfe73fcd61a56", "lt_set_visibility": "60c4201a6afc69ec3cb1d196bfd6163f", "social_class_activity": "560d9faa6251606acb288f800deefa09"}';
  needed constant text[] := array['is_teacher', 'is_class_member', 'class_public_identity', 'lt_can_view', 'lt_check_media',
                                  'social_class_is_member', 'social_class_members_of', 'lt_thread_card', 'lt_respond'];
  cols constant jsonb := '{"learning_threads": ["content_kind", "content_key", "program_code", "session_no", "class_schedule_id", "class_stage_id", "visibility", "passed_at", "identity"], "class_sessions": ["id", "class_id", "session_number", "event_type", "title", "stage_id"], "class_lesson_content": ["session_id", "status", "blocks"], "class_schedule": ["id", "code", "name", "program_code", "stage", "status", "public_product"], "class_stages": ["id", "stage_no", "public_title"], "class_curriculum_access": ["class_id", "user_id", "status"]}';
  k text; v text; c text; src text; drift text[] := '{}';
begin
  for k, v in select key, value #>> '{}' from jsonb_each(replaced) loop
    select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = k;
    if src is null then drift := drift || format('thiếu hàm %s', k);
    elsif position('CHECKPOINT_V1' in src) = 0 and md5(src) <> v then drift := drift || format('hàm %s khác bản đã kiểm (md5 %s)', k, md5(src));
    end if;
  end loop;
  foreach k in array needed loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = k) then
      drift := drift || format('thiếu hàm %s', k);
    end if;
  end loop;
  if to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is null then
    drift := drift || 'thiếu hàm tva_private.can_read_class_curriculum(uuid)'::text;
  end if;
  for k in select key from jsonb_each(cols) loop
    for c in select jsonb_array_elements_text(cols -> k) loop
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = k and column_name = c) then
        drift := drift || format('thiếu cột %s.%s', k, c);
      end if;
    end loop;
  end loop;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ')
      using hint = 'Chạy db/class_checkpoints_v1_preflight.sql, gửi kết quả cho người review.';
  end if;
end $gate$;

-- ── 1) learning_threads: loại 'program_checkpoint' + visibility 'class' ─────────────────────
-- Thread cũ (course_lesson) vẫn community|private; checkpoint chỉ class|private (không bao giờ ra Feed chung).
alter table public.learning_threads add column if not exists checkpoint_id text;

alter table public.learning_threads drop constraint if exists learning_threads_kind_check;
alter table public.learning_threads add constraint learning_threads_kind_check
  check (content_kind in ('course_lesson', 'program_session', 'program_checkpoint'));

alter table public.learning_threads drop constraint if exists learning_threads_key_check;
alter table public.learning_threads add constraint learning_threads_key_check check (
  (content_kind = 'course_lesson' and content_key ~ '^L:[0-9a-f-]{36}$')
  or (content_kind = 'program_session' and content_key ~ '^S:[A-Z0-9_]{1,32}:[0-9]{1,4}$')
  or (content_kind = 'program_checkpoint'
      and program_code ~ '^[A-Z0-9_]{1,32}$' and session_no between 1 and 9999
      and checkpoint_id ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$'
      and content_key = 'C:' || program_code || ':' || session_no::text || ':' || checkpoint_id));

alter table public.learning_threads drop constraint if exists learning_threads_visibility_check;
alter table public.learning_threads add constraint learning_threads_visibility_check check (
  (content_kind = 'program_checkpoint' and visibility in ('class', 'private'))
  or (content_kind <> 'program_checkpoint' and visibility in ('community', 'private')));

create index if not exists learning_threads_class_idx on public.learning_threads (class_schedule_id, last_event_at desc)
  where hidden_at is null and archived_at is null and class_schedule_id is not null;

-- ── 2) Tiến độ theo BUỔI (server là nguồn sự thật) ───────────────────────────────────────────
create table if not exists public.learning_session_progress (
  id                          uuid primary key default gen_random_uuid(),
  learner_user_id             uuid not null references auth.users(id) on delete cascade,
  program_code                text not null check (program_code ~ '^[A-Z0-9_]{1,32}$'),
  session_no                  int  not null check (session_no between 1 and 9999),
  class_schedule_id           uuid references public.class_schedule(id) on delete set null,   -- lớp lúc MỞ buổi
  opened_at                   timestamptz not null default now(),
  completed_at                timestamptz,
  completed_class_schedule_id uuid references public.class_schedule(id) on delete set null,   -- lớp lúc HOÀN THÀNH
  created_at                  timestamptz not null default now(),
  constraint learning_session_progress_uq unique (learner_user_id, program_code, session_no),
  constraint learning_session_progress_order_check check (completed_at is null or completed_at >= opened_at)
);
alter table public.learning_session_progress enable row level security;   -- không policy: chỉ qua RPC
revoke all on table public.learning_session_progress from public, anon, authenticated;

-- Lịch sử bất biến: opened_at không đổi; completed_at chỉ ghi một lần. Ngoại lệ DUY NHẤT: migration Admin
-- tường minh đặt `set local tva.lsp_admin_override = 'on'` trong cùng giao dịch.
create or replace function public.lsp_guard_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('tva.lsp_admin_override', true), '') = 'on' then return new; end if;
  if new.learner_user_id is distinct from old.learner_user_id or new.program_code is distinct from old.program_code
     or new.session_no is distinct from old.session_no or new.opened_at is distinct from old.opened_at
     or (old.completed_at is not null and new.completed_at is distinct from old.completed_at) then
    raise exception 'LSP_HISTORY_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists learning_session_progress_guard on public.learning_session_progress;
create trigger learning_session_progress_guard before update on public.learning_session_progress
  for each row execute function public.lsp_guard_history();

-- ── 3) Hàm nội bộ (không cấp cho anon/authenticated) ─────────────────────────────────────────
-- Checkpoint của MỘT buổi lesson đã xuất bản trong lớp — đọc ĐÚNG blocks canonical, không tin client.
-- required mặc định true (chỉ false khi ghi rõ boolean false). accepts mặc định ['text','video_link'].
create or replace function public.cl_session_checkpoints(p_class uuid, p_session_no int)
returns table(id text, title text, prompt text, required boolean, accepts text[], ord int)
language sql stable security definer set search_path = '' as $$
  select b ->> 'id',
         coalesce(nullif(btrim(b ->> 'title'), ''), ''),
         nullif(btrim(b ->> 'prompt'), ''),
         case when jsonb_typeof(b -> 'required') = 'boolean' then (b ->> 'required')::boolean else true end,
         case when jsonb_typeof(b -> 'accepts') = 'array'
              then array(select jsonb_array_elements_text(b -> 'accepts'))
              else array['text', 'video_link'] end,
         x.ord::int
  from public.class_sessions s
  join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
  cross join lateral jsonb_array_elements(c.blocks) with ordinality x(b, ord)
  where s.class_id = p_class and s.session_number = p_session_no and s.event_type = 'lesson'
    and jsonb_typeof(b) = 'object' and b ->> 'kind' = 'checkpoint'
    and coalesce(b ->> 'id', '') ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$';
$$;

-- Buổi lesson KẾ TIẾP trong lớp (bỏ dòng nghỉ / buổi không số) và nó đã xuất bản chưa.
create or replace function public.cl_next_session(p_class uuid, p_session_no int)
returns table(session_no int, published boolean)
language sql stable security definer set search_path = '' as $$
  select s.session_number,
         exists (select 1 from public.class_lesson_content c where c.session_id = s.id and c.status = 'published')
  from public.class_sessions s
  where s.class_id = p_class and s.event_type = 'lesson' and s.session_number > p_session_no
  order by s.session_number limit 1;
$$;

-- Thử hoàn thành một buổi (idempotent): đủ required ĐẠT → completed_at (một lần) → mở buổi kế (nếu đã xuất bản).
-- Buổi không có checkpoint required nào thì KHÔNG tự hoàn thành (tránh dây chuyền mở buổi trống).
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

-- Đồng bộ lười cho NGƯỜI HỌC có quyền giáo trình: mở buổi lesson đầu (pilot từ Buổi 1) · hoàn thành buổi
-- đã đủ required (nếu giáo trình vừa đổi) · mở buổi kế đã xuất bản sau buổi đã hoàn thành. Không bao giờ xoá/bỏ hoàn thành.
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

-- Trigger: Thầy chấm ĐẠT (passed_at null → có) một checkpoint → thử hoàn thành buổi. lt_respond KHÔNG đổi.
create or replace function public.lsp_on_checkpoint_passed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.lsp_try_complete(new.learner_user_id, new.program_code, new.session_no, new.class_schedule_id);
  return null;
end $$;
drop trigger if exists learning_threads_checkpoint_passed on public.learning_threads;
create trigger learning_threads_checkpoint_passed after update of passed_at on public.learning_threads
  for each row when (old.passed_at is null and new.passed_at is not null and new.content_kind = 'program_checkpoint')
  execute function public.lsp_on_checkpoint_passed();

revoke all on function public.lsp_guard_history(), public.cl_session_checkpoints(uuid, int), public.cl_next_session(uuid, int),
  public.lsp_try_complete(uuid, text, int, uuid), public.lsp_sync(uuid, uuid, text), public.lsp_on_checkpoint_passed()
  from public, anon, authenticated;

-- ── 4) RPC: trạng thái học của MỘT lớp cho người gọi (/me/classes/<id>) ──────────────────────
-- enabled = lớp có program_code + giáo trình đã xuất bản có ÍT NHẤT MỘT khối checkpoint + (Thầy/admin HOẶC người học có quyền
-- giáo trình). Công tắc pilot theo DỮ LIỆU: lớp chưa có checkpoint (vd HT2027) giữ nguyên trang lớp cũ, không bị khoá buổi.
-- Người học: đồng bộ lười tiến độ rồi trả buổi + checkpoint + thread của CHÍNH MÌNH. Buổi khoá: không lộ checkpoint.
-- Thầy/admin: xem mọi buổi (preview), không có tiến độ, không trả bài.
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

-- ── 5) RPC: học sinh TRẢ BÀI tại một checkpoint (mở thread nếu chưa có — đóng dấu lớp/buổi/checkpoint) ──
create or replace function public.lt_submit_checkpoint(
  p_class             uuid,
  p_session_no        int,
  p_checkpoint_id     text,
  p_body              text,
  p_media_url         text default null,
  p_media_provider    text default null,
  p_external_media_id text default null,
  p_visibility        text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
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
end $$;

-- ── 6) Thay 3 hàm (giữ nguyên hành vi cũ cho thread cũ; thêm nhánh 'class' cho checkpoint) ─────
-- 6a) lt_detail: + quyền thành viên CÙNG LỚP cho visibility 'class' · + ngữ cảnh checkpoint. CHECKPOINT_V1
create or replace function public.lt_detail(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_thread public.learning_threads%rowtype; v_teacher boolean := public.is_teacher(); v_out jsonb;
begin
  -- CHECKPOINT_V1: thread 'class' xem được bởi chính chủ, Thầy/admin, thành viên CÙNG lớp (snapshot lúc nộp).
  select * into v_thread from public.learning_threads where id = p_thread_id;
  if not found or not (
       public.lt_can_view(v_thread.learner_user_id, v_thread.visibility, v_thread.hidden_at)
       or (v_thread.visibility = 'class' and v_thread.hidden_at is null and v_thread.class_schedule_id is not null
           and public.social_class_is_member(v_thread.class_schedule_id, auth.uid()))) then
    raise exception 'LT_NOT_FOUND' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'id', v_thread.id, 'content_key', v_thread.content_key, 'lesson_id', v_thread.lesson_id,
    'course_id', v_thread.course_id, 'identity', v_thread.identity, 'visibility', v_thread.visibility,
    'status', v_thread.status, 'passed_at', v_thread.passed_at, 'created_at', v_thread.created_at,
    'last_event_at', v_thread.last_event_at, 'event_count', v_thread.event_count,
    'archived_at', v_thread.archived_at, 'is_hidden', v_thread.hidden_at is not null,
    'is_mine', v_thread.learner_user_id = auth.uid(), 'can_respond', v_teacher and v_thread.archived_at is null,
    'content_kind', v_thread.content_kind, 'program_code', v_thread.program_code, 'session_no', v_thread.session_no,
    'checkpoint_id', v_thread.checkpoint_id, 'class_schedule_id', v_thread.class_schedule_id,
    'learner', (select jsonb_build_object('user_id', v_thread.learner_user_id, 'name', i.name, 'avatar_url', i.avatar_url)
                from public.class_public_identity(v_thread.learner_user_id) i),
    'passed_by', (select jsonb_build_object('user_id', v_thread.passed_by, 'name', i.name, 'avatar_url', i.avatar_url)
                  from public.class_public_identity(v_thread.passed_by) i where v_thread.passed_by is not null),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'seq', e.seq, 'kind', e.kind, 'verdict', e.verdict, 'author_role', e.author_role,
        'author', jsonb_build_object('user_id', e.author_user_id, 'name', i.name, 'avatar_url', i.avatar_url),
        'body', e.body, 'media_type', e.media_type, 'media_provider', e.media_provider, 'media_url', e.media_url,
        'external_media_id', e.external_media_id, 'resources', e.resources,
        'tags', coalesce((select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name) order by ct.name)
                            from public.class_tags ct where ct.id = any(e.tag_ids)), '[]'::jsonb),
        'is_hidden', e.hidden_at is not null, 'created_at', e.created_at) order by e.seq)
      from public.learning_thread_events e
      left join lateral public.class_public_identity(e.author_user_id) i on true
      where e.thread_id = v_thread.id and (e.hidden_at is null or v_teacher)), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- 6b) lt_set_visibility: thread cũ community|private (như trước) · checkpoint class|private. CHECKPOINT_V1
create or replace function public.lt_set_visibility(p_thread_id uuid, p_visibility text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_kind text;
begin
  -- CHECKPOINT_V1: checkpoint không bao giờ thành 'community' (không ra Feed chung).
  if p_visibility is null or p_visibility not in ('community', 'private', 'class') then
    raise exception 'LT_BAD_VISIBILITY' using errcode = '22023';
  end if;
  select content_kind into v_kind from public.learning_threads
   where id = p_thread_id and learner_user_id = auth.uid() and auth.uid() is not null;
  if not found then raise exception 'LT_NOT_FOUND' using errcode = '22023'; end if;
  if (v_kind = 'program_checkpoint' and p_visibility = 'community')
     or (v_kind <> 'program_checkpoint' and p_visibility = 'class') then
    raise exception 'LT_BAD_VISIBILITY' using errcode = '22023';
  end if;
  update public.learning_threads set visibility = p_visibility, updated_at = clock_timestamp()
   where id = p_thread_id and learner_user_id = auth.uid();
end $$;

-- 6c) social_class_activity: + thread checkpoint 'class' của ĐÚNG lớp, chỉ cho thành viên lớp / Thầy. CHECKPOINT_V1
create or replace function public.social_class_activity(
  p_class      uuid,
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  -- CHECKPOINT_V1
  select 'learning_thread'::text, t.last_event_at, 't:' || t.id::text, null::jsonb, public.lt_thread_card(t.id)
  from public.learning_threads t
  where public.is_class_member() and t.class_schedule_id = p_class
    and (t.visibility = 'community'
         or (t.visibility = 'class' and (public.is_teacher() or public.social_class_is_member(p_class, auth.uid()))))
    and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
    and (p_before is null or (t.last_event_at, 't:' || t.id::text) < (p_before, coalesce(p_before_key, '')))
  order by t.last_event_at desc, ('t:' || t.id::text) desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ── 7) Quyền RPC: chỉ authenticated (default privileges production cấp cho anon → revoke tường minh) ─
revoke all on function public.class_learning_state(uuid),
  public.lt_submit_checkpoint(uuid, int, text, text, text, text, text, text),
  public.lt_detail(uuid), public.lt_set_visibility(uuid, text),
  public.social_class_activity(uuid, timestamptz, text, int)
  from public, anon;
grant execute on function public.class_learning_state(uuid),
  public.lt_submit_checkpoint(uuid, int, text, text, text, text, text, text),
  public.lt_detail(uuid), public.lt_set_visibility(uuid, text),
  public.social_class_activity(uuid, timestamptz, text, int)
  to authenticated;

notify pgrst, 'reload schema';
