-- ═══════════════════════════════════════════════════════════════════════════
-- LEARNING THREAD P1 — Trả bài / Hỏi bài theo bài học (App học ↔ /me). CHƯA CHẠY. Idempotent.
-- Thiết kế: docs/LEARNING-THREAD-P1.md. Rollback: db/learning_threads_p1_rollback.sql.
-- Preflight (read-only, production): db/learning_threads_p1_preflight.sql → GATE = PASS mới chạy file này.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-learning-threads-db.sh
--
-- Owner chốt (29/09/2026):
--   • MỘT bài học = MỘT learning thread đang mở cho mỗi người học; submission / câu hỏi / Thầy sửa /
--     làm lại đều là EVENT trong thread. Không tạo post Social cho từng lần.
--   • Không mặc định bài nào cũng được Trả bài: cấu hình Ở TẦNG BÀI (learning_lesson_settings),
--     tách "cho phép" (allowed) và "yêu cầu" (required). KHÔNG suy từ lesson_type. Chưa cấu hình = tắt.
--   • Ai được xem (visibility: community | private) ĐỘC LẬP với danh tính học tập (lớp/khoá/chặng/bài).
--     community = mọi thành viên Class (is_class_member) — KHÔNG cần thuộc lớp. Mặc định community.
--   • Danh tính học tập đóng dấu Ở SERVER lúc mở thread, không bao giờ cập nhật theo hồ sơ sau này.
--   • Thầy không hard-code: mọi phản hồi ghi author_user_id; nhiều giáo viên dùng chung hàng đợi.
--   • ĐẠT chỉ ghi vào thread (passed_at/passed_by). P1 KHÔNG ghi edu_lesson_progress, KHÔNG mở khoá bài.
--   • P1 KHÔNG đụng class_posts / class_feed / tiến độ / XP. Chưa lên Feed.
--
-- Định danh người = auth.users.id (không dùng edu_students.id làm khoá — chỉ lưu snapshot).
-- Mọi truy cập đi qua RPC SECURITY DEFINER; bảng REVOKE hết với anon/authenticated
-- (production cấp mặc định MỌI quyền bảng + EXECUTE hàm mới → REVOKE tường minh).
-- Bảng phải nằm trong self_managed của db/rls_setup.sql (đã thêm) — nếu không rls_setup mở policy rộng.
--
-- CHẠY: dán NGUYÊN FILE vào Supabase SQL Editor (hoặc psql -f) — file tự mở/đóng MỘT giao dịch.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 0) Cổng phụ thuộc: các hàm/bảng file này GỌI phải đúng bản đang chạy production ─────────────
-- File này KHÔNG thay thế hàm/policy có sẵn nào; chỉ tạo object mới. Nhưng RPC mới dựa vào
-- is_teacher / is_class_member / class_public_identity (md5 prosrc = bản production 29/09) và hợp đồng
-- my_learning_state() → jsonb {courses:[{lessons:[{id, access}]}]} (policy lesson_entitlement_read dùng y hệt).
-- Giữ ĐỒNG BỘ hằng số với db/learning_threads_p1_preflight.sql (test kiểm).
do $gate$
declare
  fn_expected constant jsonb := '{"class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"]}';
  col_required constant jsonb := '{"edu_course_lessons": ["id", "module_id", "title", "order_index", "lesson_type"], "edu_modules": ["id", "course_id", "name", "order_index", "level"], "edu_courses": ["id", "code", "name", "track"], "journey_curriculum": ["course_id", "subject", "level"], "edu_students": ["id", "user_id", "ht_member", "level", "enrolled_at"], "edu_groups": ["id", "code"], "edu_group_members": ["user_id", "group_id", "status"], "class_schedule": ["id", "code", "name", "program_code", "stage", "public_product", "status", "main_course_id", "course_ids", "start_date", "cohort_group_id"], "class_stages": ["id", "class_id", "stage_no", "public_title", "course_id", "starts_on", "ends_on"], "class_tags": ["id", "name"], "app_users": ["id", "role"]}';
  k text; allowed jsonb; actual text; c text; drift text[] := '{}';
begin
  for k, allowed in select * from jsonb_each(fn_expected) loop
    select string_agg(md5(p.prosrc), ',') into actual from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = k;
    if actual is null then drift := drift || format('thiếu hàm %s', k);
    elsif not allowed ? actual then drift := drift || format('hàm %s (md5 %s)', k, actual); end if;
  end loop;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'my_learning_state' and p.pronargs = 0
                   and p.prorettype = 'jsonb'::regtype) then
    drift := drift || 'thiếu hàm my_learning_state() returns jsonb'::text;
  end if;
  for k, allowed in select * from jsonb_each(col_required) loop
    for c in select jsonb_array_elements_text(allowed) loop
      if not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = k and column_name = c) then
        drift := drift || format('thiếu cột %s.%s', k, c);
      end if;
    end loop;
  end loop;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ')
      using hint = 'Chạy db/learning_threads_p1_preflight.sql, gửi kết quả cho người review.';
  end if;
end $gate$;

-- ── 1) Cấu hình Trả bài / Hỏi bài Ở TẦNG BÀI ─────────────────────────────────────────────────
-- content_key tổng quát: 'L:<edu_course_lessons.id>' (P1) · sau này 'S:<PROGRAM>:<session_no>' (HT2027/Solo)
-- submission_mode: off | allowed (được Trả bài) | required (bài YÊU CẦU Trả bài — P1 chỉ hiển thị, chưa khoá bài)
-- question_mode:   off | allowed (được Hỏi bài)
-- Chưa có dòng = cả hai 'off'. Không suy từ lesson_type.
create table if not exists public.learning_lesson_settings (
  content_key     text primary key,
  content_kind    text not null default 'course_lesson',
  lesson_id       uuid unique references public.edu_course_lessons(id) on delete cascade,
  program_code    text,
  session_no      int,
  submission_mode text not null default 'off',
  question_mode   text not null default 'off',
  prompt          text,                    -- lời dặn của Thầy cho bài này (hiện trên nút/khung gửi)
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  constraint learning_lesson_settings_kind_check check (content_kind in ('course_lesson', 'program_session')),
  constraint learning_lesson_settings_shape_check check (
    (content_kind = 'course_lesson' and lesson_id is not null and program_code is null and session_no is null
       and content_key = 'L:' || lesson_id::text)
    or (content_kind = 'program_session' and lesson_id is null and program_code ~ '^[A-Z0-9_]{1,32}$'
       and session_no between 1 and 1000 and content_key = 'S:' || program_code || ':' || session_no::text)),
  constraint learning_lesson_settings_submission_check check (submission_mode in ('off', 'allowed', 'required')),
  constraint learning_lesson_settings_question_check check (question_mode in ('off', 'allowed')),
  constraint learning_lesson_settings_prompt_check check (prompt is null or char_length(btrim(prompt)) between 1 and 1000)
);

-- ── 2) Learning thread: MỘT câu chuyện học của MỘT người với MỘT bài ──────────────────────────
create table if not exists public.learning_threads (
  id                     uuid primary key default gen_random_uuid(),
  learner_user_id        uuid not null references auth.users(id) on delete cascade,
  content_kind           text not null default 'course_lesson',
  content_key            text not null,   -- cố định lúc tạo; còn nguyên khi bài bị xoá
  lesson_id              uuid references public.edu_course_lessons(id) on delete set null,
  program_code           text,
  session_no             int,
  -- Danh tính học tập (snapshot lúc mở thread — KHÔNG cập nhật). Cột để lọc; nhãn đầy đủ ở identity.
  course_id              uuid references public.edu_courses(id) on delete set null,
  module_id              uuid references public.edu_modules(id) on delete set null,
  class_schedule_id      uuid references public.class_schedule(id) on delete set null,
  class_stage_id         bigint references public.class_stages(id) on delete set null,
  student_id             uuid,            -- edu_students.id lúc tạo (tham khảo, không FK)
  identity               jsonb not null,
  -- Ai được xem — độc lập với danh tính học tập
  visibility             text not null default 'community',
  -- Workflow
  status                 text not null default 'waiting_teacher',
  passed_at              timestamptz,
  passed_by              uuid references auth.users(id) on delete set null,
  last_teacher_user_id   uuid references auth.users(id) on delete set null,
  last_event_at          timestamptz,
  last_student_event_at  timestamptz,
  last_teacher_event_at  timestamptz,
  event_count            int not null default 0,
  archived_at            timestamptz,
  archived_by            uuid references auth.users(id) on delete set null,
  hidden_at              timestamptz,
  hidden_by              uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint learning_threads_kind_check check (content_kind in ('course_lesson', 'program_session')),
  constraint learning_threads_key_check check (
    (content_kind = 'course_lesson' and content_key ~ '^L:[0-9a-f-]{36}$')
    or (content_kind = 'program_session' and content_key ~ '^S:[A-Z0-9_]{1,32}:[0-9]{1,4}$')),
  constraint learning_threads_visibility_check check (visibility in ('community', 'private')),
  constraint learning_threads_status_check check (status in
    ('waiting_teacher', 'teacher_responded', 'needs_retry', 'passed', 'archived')),
  constraint learning_threads_archived_check check ((status = 'archived') = (archived_at is not null)),
  constraint learning_threads_identity_check check (jsonb_typeof(identity) = 'object')
);
-- Mỗi người chỉ MỘT thread đang mở cho mỗi bài; học lại sau này = archive thread cũ rồi mở thread mới.
create unique index if not exists learning_threads_open_uq
  on public.learning_threads (learner_user_id, content_key) where archived_at is null;
create index if not exists learning_threads_learner_idx on public.learning_threads (learner_user_id, last_event_at desc);
create index if not exists learning_threads_queue_idx on public.learning_threads (status, last_student_event_at, id)
  where archived_at is null;
create index if not exists learning_threads_lesson_idx on public.learning_threads (lesson_id);

-- ── 3) Event trong thread ────────────────────────────────────────────────────────────────────
create table if not exists public.learning_thread_events (
  id                uuid primary key default gen_random_uuid(),
  seq               bigint generated always as identity,
  thread_id         uuid not null references public.learning_threads(id) on delete cascade,
  author_user_id    uuid references auth.users(id) on delete set null,
  author_role       text not null,       -- đóng dấu lúc ghi: student | teacher
  kind              text not null,       -- submission | question | teacher_feedback | teacher_answer
  verdict           text,                -- chỉ teacher_feedback: retry | pass
  body              text not null default '',
  media_type        text,
  media_provider    text,
  media_url         text,
  external_media_id text,
  tag_ids           bigint[] not null default '{}',   -- class_tags (chỉ Thầy)
  resources         jsonb not null default '[]',      -- video Kho: tham chiếu + snapshot (chỉ Thầy)
  hidden_at         timestamptz,
  hidden_by         uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default clock_timestamp(),
  constraint lte_role_check check (author_role in ('student', 'teacher')),
  constraint lte_kind_check check (kind in ('submission', 'question', 'teacher_feedback', 'teacher_answer')),
  constraint lte_kind_role_check check ((author_role = 'student') = (kind in ('submission', 'question'))),
  constraint lte_verdict_check check (verdict is null or (kind = 'teacher_feedback' and verdict in ('retry', 'pass'))),
  constraint lte_body_check check (char_length(body) <= 4000),
  constraint lte_content_check check (char_length(btrim(body)) > 0 or media_url is not null),
  constraint lte_media_type_check check (media_type is null or media_type in ('external_video')),
  constraint lte_media_provider_check check (media_provider is null or media_provider in ('youtube', 'tiktok', 'facebook', 'external_link')),
  constraint lte_media_pair_check check ((media_type is null) = (media_provider is null) and (media_type is null) = (media_url is null)),
  constraint lte_media_url_check check (media_url is null or (char_length(media_url) <= 2048 and media_url ~ '^https?://[^[:space:]<>"]+$')),
  constraint lte_external_media_id_check check (external_media_id is null or external_media_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint lte_teacher_extras_check check (author_role = 'teacher' or (cardinality(tag_ids) = 0 and resources = '[]'::jsonb)),
  constraint lte_tags_check check (cardinality(tag_ids) <= 10),
  constraint lte_resources_check check (jsonb_typeof(resources) = 'array' and jsonb_array_length(resources) <= 5)
);
create index if not exists learning_thread_events_thread_idx on public.learning_thread_events (thread_id, seq);

-- ── 4) Quyền bảng: KHÔNG truy cập trực tiếp — chỉ qua RPC ─────────────────────────────────────
alter table public.learning_lesson_settings enable row level security;
alter table public.learning_threads enable row level security;
alter table public.learning_thread_events enable row level security;
revoke all on table public.learning_lesson_settings, public.learning_threads, public.learning_thread_events
  from public, anon, authenticated;

-- ── 5) Hàm nội bộ (không cấp cho anon/authenticated) ─────────────────────────────────────────
-- Bài có đang MỞ cho người gọi không — dùng đúng nguồn quyền server-driven của App.
create or replace function public.lt_lesson_open_for_me(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(public.my_learning_state() -> 'courses', '[]'::jsonb)) c,
         jsonb_array_elements(coalesce(c -> 'lessons', '[]'::jsonb)) l
    where l ->> 'id' = p_lesson_id::text and l ->> 'access' = 'open');
$$;

-- Ai xem được một thread: chính chủ · Thầy/admin · thành viên Class nếu community và không bị ẩn.
create or replace function public.lt_can_view(p_learner uuid, p_visibility text, p_hidden_at timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_learner = auth.uid()
    or public.is_teacher()
    or (p_visibility = 'community' and p_hidden_at is null and public.is_class_member()));
$$;

-- Media link ngoài: cùng luật với class_posts (client đã chuẩn hoá bằng parseExternalMedia).
create or replace function public.lt_check_media(p_url text, p_provider text, p_media_id text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_url is null then
    if p_provider is not null or p_media_id is not null then raise exception 'LT_BAD_MEDIA' using errcode = '22023'; end if;
    return;
  end if;
  if p_provider is null or p_provider not in ('youtube', 'tiktok', 'facebook', 'external_link') then
    raise exception 'LT_BAD_MEDIA' using errcode = '22023';
  end if;
end $$;

-- Tài nguyên Kho đính kèm của Thầy: chuẩn hoá + kiểm (cùng luật class_comment_resources).
create or replace function public.lt_normalize_resources(p_resources jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare r jsonb; v_out jsonb := '[]'::jsonb; v_start int; v_end int; v_title text; v_excerpt text;
begin
  if p_resources is null or p_resources = 'null'::jsonb then return v_out; end if;
  if jsonb_typeof(p_resources) <> 'array' or jsonb_array_length(p_resources) > 5 then
    raise exception 'LT_BAD_RESOURCES' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(p_resources) loop
    if coalesce(r ->> 'resource_type', '') <> 'kho_video' or coalesce(r ->> 'resource_id', '') !~ '^[A-Za-z0-9_-]{1,64}$' then
      raise exception 'LT_BAD_RESOURCES' using errcode = '22023';
    end if;
    v_start := nullif(r ->> 'start_seconds', '')::int;
    v_end := nullif(r ->> 'end_seconds', '')::int;
    v_title := nullif(btrim(r ->> 'title_snapshot'), '');
    v_excerpt := nullif(btrim(r ->> 'excerpt'), '');
    if (v_start is not null and v_start not between 0 and 86400)
       or (v_end is not null and (v_start is null or v_end <= v_start or v_end > 86400))
       or (v_title is not null and char_length(v_title) > 200)
       or (v_excerpt is not null and char_length(v_excerpt) > 500) then
      raise exception 'LT_BAD_RESOURCES' using errcode = '22023';
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'resource_type', 'kho_video', 'resource_id', r ->> 'resource_id', 'title_snapshot', v_title,
      'start_seconds', v_start, 'end_seconds', v_end, 'excerpt', v_excerpt));
  end loop;
  return v_out;
end $$;

-- Danh tính học tập lúc này của người gọi với một bài (snapshot). Lớp: lớp active/gần nhất của
-- người học có dạy khoá của bài (class_stages / main_course_id / course_ids); không có → null = "Tự học".
create or replace function public.lt_identity_snapshot(p_lesson_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with l as (
    select l.id, l.title, l.order_index, l.lesson_type, m.id as module_id, m.name as module_name,
           m.order_index as module_order, m.level as module_level,
           c.id as course_id, c.code as course_code, c.name as course_name, c.track,
           jc.subject, jc.level as journey_level
    from public.edu_course_lessons l
    join public.edu_modules m on m.id = l.module_id
    join public.edu_courses c on c.id = m.course_id
    left join public.journey_curriculum jc on jc.course_id = c.id
    where l.id = p_lesson_id
  ),
  st as (
    select es.id, es.ht_member, es.level from public.edu_students es
    where es.user_id = auth.uid() order by es.enrolled_at desc nulls last limit 1
  ),
  today as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as d),
  cls as (
    select cs.id as schedule_id, cs.code, cs.name, cs.program_code, cs.stage, cs.public_product, cs.status,
           stg.id as stage_id, stg.stage_no, stg.public_title
    from l cross join today cross join public.edu_group_members gm
    join public.edu_groups g on g.id = gm.group_id
    join public.class_schedule cs on cs.cohort_group_id = g.id or upper(cs.code) = upper(g.code)
    left join lateral (
      select s.* from public.class_stages s
      where s.class_id = cs.id and s.course_id = l.course_id
      order by (today.d between coalesce(s.starts_on, '-infinity'::date) and coalesce(s.ends_on, 'infinity'::date)) desc,
               s.stage_no
      limit 1
    ) stg on true
    where gm.user_id = auth.uid() and gm.status = 'active' and g.code is not null
      and coalesce(cs.status, '') not in ('draft', 'cancelled', 'merged')
      and (stg.id is not null or cs.main_course_id = l.course_id or l.course_id = any(coalesce(cs.course_ids, '{}')))
    order by (coalesce(cs.status, '') in ('active', 'ending_soon', 'upcoming', 'scheduled', 'ready_to_open', 'recruiting')) desc,
             (stg.id is not null and today.d between coalesce(stg.starts_on, '-infinity'::date) and coalesce(stg.ends_on, 'infinity'::date)) desc,
             cs.start_date desc nulls last, cs.id
    limit 1
  )
  select jsonb_build_object(
    'v', 1,
    'captured_at', now(),
    'lesson', jsonb_build_object('id', l.id, 'title', l.title, 'order_index', l.order_index, 'lesson_type', l.lesson_type),
    'module', jsonb_build_object('id', l.module_id, 'name', l.module_name, 'order_index', l.module_order, 'level', l.module_level),
    'course', jsonb_build_object('id', l.course_id, 'code', l.course_code, 'name', l.course_name, 'track', l.track,
                                 'subject', coalesce(l.subject, l.track), 'level', l.journey_level),
    'class', (select jsonb_build_object('schedule_id', cls.schedule_id, 'code', cls.code, 'name', cls.name,
                                        'program_code', cls.program_code, 'stage', cls.stage,
                                        'public_product', cls.public_product, 'status', cls.status,
                                        'stage_id', cls.stage_id, 'stage_no', cls.stage_no, 'stage_title', cls.public_title)
              from cls),
    'learner', (select jsonb_build_object('student_id', st.id, 'ht_member', coalesce(st.ht_member, false), 'level', st.level) from st))
  from l;
$$;

revoke all on function public.lt_lesson_open_for_me(uuid), public.lt_can_view(uuid, text, timestamptz),
  public.lt_check_media(text, text, text), public.lt_normalize_resources(jsonb), public.lt_identity_snapshot(uuid)
  from public, anon, authenticated;

-- ── 6) RPC cho App / Social ─────────────────────────────────────────────────────────────────
-- 6a) Trạng thái Trả/Hỏi bài của NGƯỜI GỌI cho một loạt bài (App: nút + chip trên bài). Tối đa 500 bài.
create or replace function public.lt_lessons_state(p_lesson_ids uuid[])
returns table(lesson_id uuid, submission_mode text, question_mode text, prompt text,
              thread_id uuid, status text, visibility text, passed_at timestamptz,
              last_event_at timestamptz, event_count int)
language sql stable security definer set search_path = '' as $$
  select ids.lid, coalesce(s.submission_mode, 'off'), coalesce(s.question_mode, 'off'), s.prompt,
         t.id, t.status, t.visibility, t.passed_at, t.last_event_at, t.event_count
  from (select distinct unnest(p_lesson_ids[1:500]) as lid) ids
  left join public.learning_lesson_settings s on s.content_key = 'L:' || ids.lid::text
  left join public.learning_threads t on t.learner_user_id = auth.uid()
        and t.content_key = 'L:' || ids.lid::text and t.archived_at is null
  where auth.uid() is not null;
$$;

-- 6b) Học sinh Trả bài / Hỏi bài tại bài đang học. Tự mở thread (đóng dấu danh tính) nếu chưa có.
create or replace function public.lt_submit(
  p_lesson_id         uuid,
  p_kind              text,
  p_body              text,
  p_media_url         text default null,
  p_media_provider    text default null,
  p_external_media_id text default null,
  p_visibility        text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_key text := 'L:' || p_lesson_id::text;
  v_set public.learning_lesson_settings%rowtype;
  v_thread public.learning_threads%rowtype;
  v_identity jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'LT_NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if public.is_teacher() then raise exception 'LT_TEACHER_CANNOT_SUBMIT' using errcode = '42501'; end if;
  if not public.is_class_member() then raise exception 'LT_NOT_MEMBER' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('submission', 'question') then raise exception 'LT_BAD_KIND' using errcode = '22023'; end if;
  if p_visibility is not null and p_visibility not in ('community', 'private') then
    raise exception 'LT_BAD_VISIBILITY' using errcode = '22023';
  end if;
  perform public.lt_check_media(nullif(btrim(p_media_url), ''), p_media_provider, p_external_media_id);

  select * into v_set from public.learning_lesson_settings where content_key = v_key;
  if p_kind = 'submission' and coalesce(v_set.submission_mode, 'off') = 'off' then
    raise exception 'LT_SUBMISSION_NOT_ENABLED' using errcode = '42501';
  end if;
  if p_kind = 'question' and coalesce(v_set.question_mode, 'off') = 'off' then
    raise exception 'LT_QUESTION_NOT_ENABLED' using errcode = '42501';
  end if;
  if not public.lt_lesson_open_for_me(p_lesson_id) then raise exception 'LT_NO_ACCESS' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended('learning_thread:' || v_uid::text || ':' || v_key, 0));
  select * into v_thread from public.learning_threads
   where learner_user_id = v_uid and content_key = v_key and archived_at is null;

  if not found then
    v_identity := public.lt_identity_snapshot(p_lesson_id);
    if v_identity is null then raise exception 'LT_LESSON_NOT_FOUND' using errcode = '22023'; end if;
    insert into public.learning_threads (
      learner_user_id, content_kind, content_key, lesson_id, course_id, module_id,
      class_schedule_id, class_stage_id, student_id, identity, visibility, status)
    values (
      v_uid, 'course_lesson', v_key, p_lesson_id,
      (v_identity #>> '{course,id}')::uuid, (v_identity #>> '{module,id}')::uuid,
      (v_identity #>> '{class,schedule_id}')::uuid, (v_identity #>> '{class,stage_id}')::bigint,
      (v_identity #>> '{learner,student_id}')::uuid, v_identity,
      coalesce(p_visibility, 'community'), 'waiting_teacher')
    returning * into v_thread;
  elsif v_thread.hidden_at is not null then
    raise exception 'LT_THREAD_HIDDEN' using errcode = '42501';
  end if;

  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body,
                                             media_type, media_provider, media_url, external_media_id)
  values (v_thread.id, v_uid, 'student', p_kind, btrim(coalesce(p_body, '')),
          case when nullif(btrim(p_media_url), '') is not null then 'external_video' end,
          case when nullif(btrim(p_media_url), '') is not null then p_media_provider end,
          nullif(btrim(p_media_url), ''),
          case when nullif(btrim(p_media_url), '') is not null then p_external_media_id end);

  update public.learning_threads
     set status = 'waiting_teacher', last_event_at = v_now, last_student_event_at = v_now,
         event_count = event_count + 1, updated_at = v_now
   where id = v_thread.id;
  return v_thread.id;
end $$;

-- 6c) Thầy/admin phản hồi. verdict (chỉ teacher_feedback): retry → needs_retry · pass → passed.
create or replace function public.lt_respond(
  p_thread_id         uuid,
  p_kind              text,
  p_body              text,
  p_verdict           text     default null,
  p_tag_ids           bigint[] default '{}',
  p_resources         jsonb    default '[]'::jsonb,
  p_media_url         text     default null,
  p_media_provider    text     default null,
  p_external_media_id text     default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_thread public.learning_threads%rowtype;
  v_tags bigint[];
  v_res jsonb;
  v_event uuid;
  v_status text;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null or not public.is_teacher() then raise exception 'LT_TEACHER_ONLY' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('teacher_feedback', 'teacher_answer') then raise exception 'LT_BAD_KIND' using errcode = '22023'; end if;
  if p_verdict is not null and (p_kind <> 'teacher_feedback' or p_verdict not in ('retry', 'pass')) then
    raise exception 'LT_BAD_VERDICT' using errcode = '22023';
  end if;
  perform public.lt_check_media(nullif(btrim(p_media_url), ''), p_media_provider, p_external_media_id);
  select array(select distinct t from unnest(coalesce(p_tag_ids, '{}')) t where t is not null order by 1) into v_tags;
  if cardinality(v_tags) > 10 then raise exception 'LT_BAD_TAGS' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_tags) t where not exists (select 1 from public.class_tags ct where ct.id = t)) then
    raise exception 'LT_BAD_TAGS' using errcode = '22023';
  end if;
  v_res := public.lt_normalize_resources(p_resources);

  select * into v_thread from public.learning_threads where id = p_thread_id for update;
  if not found then raise exception 'LT_NOT_FOUND' using errcode = '22023'; end if;
  if v_thread.archived_at is not null then raise exception 'LT_THREAD_ARCHIVED' using errcode = '42501'; end if;

  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, verdict, body,
                                             media_type, media_provider, media_url, external_media_id, tag_ids, resources)
  values (v_thread.id, v_uid, 'teacher', p_kind, p_verdict, btrim(coalesce(p_body, '')),
          case when nullif(btrim(p_media_url), '') is not null then 'external_video' end,
          case when nullif(btrim(p_media_url), '') is not null then p_media_provider end,
          nullif(btrim(p_media_url), ''),
          case when nullif(btrim(p_media_url), '') is not null then p_external_media_id end,
          v_tags, v_res)
  returning id into v_event;

  v_status := case p_verdict when 'pass' then 'passed' when 'retry' then 'needs_retry' else 'teacher_responded' end;
  update public.learning_threads
     set status = v_status,
         passed_at = case when p_verdict = 'pass' then coalesce(passed_at, v_now) else passed_at end,
         passed_by = case when p_verdict = 'pass' then coalesce(passed_by, v_uid) else passed_by end,
         last_teacher_user_id = v_uid, last_event_at = v_now, last_teacher_event_at = v_now,
         event_count = event_count + 1, updated_at = v_now
   where id = v_thread.id;
  return v_event;
end $$;

-- 6d) Chi tiết một thread (App + /me/t/<id>). Không xem được → LT_NOT_FOUND (không lộ sự tồn tại).
create or replace function public.lt_detail(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_thread public.learning_threads%rowtype; v_teacher boolean := public.is_teacher(); v_out jsonb;
begin
  select * into v_thread from public.learning_threads where id = p_thread_id;
  if not found or not public.lt_can_view(v_thread.learner_user_id, v_thread.visibility, v_thread.hidden_at) then
    raise exception 'LT_NOT_FOUND' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'id', v_thread.id, 'content_key', v_thread.content_key, 'lesson_id', v_thread.lesson_id,
    'course_id', v_thread.course_id, 'identity', v_thread.identity, 'visibility', v_thread.visibility,
    'status', v_thread.status, 'passed_at', v_thread.passed_at, 'created_at', v_thread.created_at,
    'last_event_at', v_thread.last_event_at, 'event_count', v_thread.event_count,
    'archived_at', v_thread.archived_at, 'is_hidden', v_thread.hidden_at is not null,
    'is_mine', v_thread.learner_user_id = auth.uid(), 'can_respond', v_teacher and v_thread.archived_at is null,
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

-- 6e) Thread của chính mình (/me: tiếp tục Trả/Hỏi bài từ thread đã có ngữ cảnh). Keyset theo last_event_at.
create or replace function public.lt_my_threads(p_before timestamptz default null, p_before_id uuid default null, p_limit int default 20)
returns table(id uuid, content_key text, lesson_id uuid, identity jsonb, visibility text, status text,
              passed_at timestamptz, last_event_at timestamptz, event_count int, archived_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.content_key, t.lesson_id, t.identity, t.visibility, t.status, t.passed_at, t.last_event_at,
         t.event_count, t.archived_at
  from public.learning_threads t
  where auth.uid() is not null and t.learner_user_id = auth.uid()
    and (p_before is null or t.last_event_at < p_before
         or (t.last_event_at = p_before and p_before_id is not null and t.id < p_before_id))
  order by t.last_event_at desc nulls last, t.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- 6f) Hàng đợi Thầy (mọi giáo viên dùng chung). Mặc định: đang chờ Thầy, cũ nhất trước (FIFO).
create or replace function public.lt_teacher_queue(
  p_status   text        default 'waiting_teacher',
  p_after    timestamptz default null,
  p_after_id uuid        default null,
  p_limit    int         default 20
)
returns table(id uuid, status text, visibility text, identity jsonb, learner_user_id uuid, learner_name text,
              learner_avatar_url text, last_student_event_at timestamptz, last_event_at timestamptz, event_count int,
              last_event_kind text, last_event_excerpt text, is_hidden boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'LT_TEACHER_ONLY' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('waiting_teacher', 'teacher_responded', 'needs_retry', 'passed', 'archived') then
    raise exception 'LT_BAD_STATUS' using errcode = '22023';
  end if;
  return query
  select t.id, t.status, t.visibility, t.identity, t.learner_user_id, i.name, i.avatar_url,
         t.last_student_event_at, t.last_event_at, t.event_count, le.kind, left(le.body, 140), t.hidden_at is not null
  from public.learning_threads t
  cross join lateral public.class_public_identity(t.learner_user_id) i
  left join lateral (select e.kind, e.body from public.learning_thread_events e
                     where e.thread_id = t.id order by e.seq desc limit 1) le on true
  where (p_status is null or t.status = p_status)
    and (p_after is null or t.last_student_event_at > p_after
         or (t.last_student_event_at = p_after and p_after_id is not null and t.id > p_after_id))
  order by t.last_student_event_at asc nulls last, t.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;

-- 6g) Người học đổi "Cộng đồng học tập" ↔ "Chỉ Thầy" cho thread của mình.
create or replace function public.lt_set_visibility(p_thread_id uuid, p_visibility text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_visibility is null or p_visibility not in ('community', 'private') then
    raise exception 'LT_BAD_VISIBILITY' using errcode = '22023';
  end if;
  update public.learning_threads set visibility = p_visibility, updated_at = clock_timestamp()
   where id = p_thread_id and learner_user_id = auth.uid() and auth.uid() is not null;
  if not found then raise exception 'LT_NOT_FOUND' using errcode = '22023'; end if;
end $$;

-- 6h) Thầy đóng thread (học lại khoá sau này → thread mới cho cùng bài).
create or replace function public.lt_archive(p_thread_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'LT_TEACHER_ONLY' using errcode = '42501'; end if;
  update public.learning_threads
     set archived_at = clock_timestamp(), archived_by = auth.uid(), status = 'archived', updated_at = clock_timestamp()
   where id = p_thread_id and archived_at is null;
  if not found then raise exception 'LT_NOT_FOUND' using errcode = '22023'; end if;
end $$;

-- 6i) Thầy ẩn/bỏ ẩn thread hoặc một event (kiểm duyệt nội dung community).
create or replace function public.lt_moderate(p_kind text, p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'LT_TEACHER_ONLY' using errcode = '42501'; end if;
  if p_kind = 'thread' then
    update public.learning_threads
       set hidden_at = case when p_hidden then clock_timestamp() end,
           hidden_by = case when p_hidden then auth.uid() end, updated_at = clock_timestamp()
     where id = p_id;
  elsif p_kind = 'event' then
    update public.learning_thread_events
       set hidden_at = case when p_hidden then clock_timestamp() end,
           hidden_by = case when p_hidden then auth.uid() end
     where id = p_id;
  else
    raise exception 'LT_BAD_KIND' using errcode = '22023';
  end if;
  if not found then raise exception 'LT_NOT_FOUND' using errcode = '22023'; end if;
end $$;

-- 6j) Thầy cấu hình Trả bài / Hỏi bài cho một bài.
create or replace function public.lt_set_lesson_settings(
  p_lesson_id       uuid,
  p_submission_mode text,
  p_question_mode   text,
  p_prompt          text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'LT_TEACHER_ONLY' using errcode = '42501'; end if;
  if not exists (select 1 from public.edu_course_lessons where id = p_lesson_id) then
    raise exception 'LT_LESSON_NOT_FOUND' using errcode = '22023';
  end if;
  insert into public.learning_lesson_settings (content_key, content_kind, lesson_id, submission_mode, question_mode,
                                               prompt, updated_by, updated_at)
  values ('L:' || p_lesson_id::text, 'course_lesson', p_lesson_id, p_submission_mode, p_question_mode,
          nullif(btrim(p_prompt), ''), auth.uid(), now())
  on conflict (content_key) do update
     set submission_mode = excluded.submission_mode, question_mode = excluded.question_mode,
         prompt = excluded.prompt, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end $$;

-- Quyền RPC: chỉ authenticated. (default privileges production cấp cho anon → revoke tường minh)
revoke all on function public.lt_lessons_state(uuid[]),
  public.lt_submit(uuid, text, text, text, text, text, text),
  public.lt_respond(uuid, text, text, text, bigint[], jsonb, text, text, text),
  public.lt_detail(uuid),
  public.lt_my_threads(timestamptz, uuid, int),
  public.lt_teacher_queue(text, timestamptz, uuid, int),
  public.lt_set_visibility(uuid, text),
  public.lt_archive(uuid),
  public.lt_moderate(text, uuid, boolean),
  public.lt_set_lesson_settings(uuid, text, text, text)
  from public, anon;
grant execute on function public.lt_lessons_state(uuid[]),
  public.lt_submit(uuid, text, text, text, text, text, text),
  public.lt_respond(uuid, text, text, text, bigint[], jsonb, text, text, text),
  public.lt_detail(uuid),
  public.lt_my_threads(timestamptz, uuid, int),
  public.lt_teacher_queue(text, timestamptz, uuid, int),
  public.lt_set_visibility(uuid, text),
  public.lt_archive(uuid),
  public.lt_moderate(text, uuid, boolean),
  public.lt_set_lesson_settings(uuid, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
