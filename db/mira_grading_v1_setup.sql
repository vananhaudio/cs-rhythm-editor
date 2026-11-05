-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- MIRA CẠNH MÀN CHẤM BÀI — vé ngắn hạn + đọc ngữ cảnh bài trả (V1). CHƯA áp production.
-- CHẠY: scripts/prod-db.py (file KHÔNG có begin/commit) hoặc psql -1 -f. THUẦN BỔ SUNG: 2 bảng + 3 hàm mới, không đổi
-- bảng/hàm hiện có. Idempotent (create ... if not exists / or replace). Rollback: db/mira_grading_v1_rollback.sql.
--
-- BÀI TOÁN: Mira (máy chủ riêng) cần hiểu bài trả Thầy đang mở, nhưng KHÔNG được cầm access token Class và
-- KHÔNG được dùng service-role. Quyền được giữ Ở TẦNG DỮ LIỆU:
--   1) Trình duyệt Thầy (JWT của chính Thầy, ở Class) gọi mira_grading_ticket(thread) → nhận VÉ ngẫu nhiên, sống 5 phút,
--      gắn đúng (Thầy, bài trả). Chỉ băm SHA-256 của vé được lưu. Vé KHÔNG phải credential Class: không gọi được RPC nào khác.
--   2) Máy chủ Mira gọi mira_grading_context(vé, nguồn) bằng khoá anon + header x-mira-grading-key (chỉ băm khoá nằm ở
--      mira_grading_keys). Thiếu một trong hai (khoá hoặc vé) → từ chối. Kết quả: dữ liệu ĐÚNG bài trả đó, hình dạng cố định,
--      giới hạn kích thước, chỉ đọc. Mira không có đường nào tới bài trả khác, học viên khác, hay bảng khác.
-- Đặt khoá: Owner sinh khoá ngẫu nhiên, đặt vào biến môi trường Mira (MIRA_GRADING_KEY) rồi chạy MỘT lệnh có băm
--   insert into public.mira_grading_keys (key_hash) values ('<sha256 hex của khoá>');
-- (băm là một chiều, không phải bí mật nhưng vẫn không đưa vào repo). Xoay khoá = thêm băm mới + đặt revoked_at cho băm cũ.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

do $$ begin
  if to_regclass('public.learning_threads') is null or to_regclass('public.learning_thread_events') is null
     or to_regclass('public.class_lesson_content') is null or to_regclass('public.class_sessions') is null
     or to_regclass('public.student_360_facts') is null or to_regprocedure('public.class_public_identity(uuid)') is null
     or (select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in (
          ('class_lesson_content','updated_at'), ('class_lesson_content','blocks'), ('class_lesson_content','status'), ('class_lesson_content','session_id'),
          ('class_sessions','session_number'), ('class_sessions','event_type'), ('class_sessions','title'), ('class_sessions','class_id'),
          ('learning_threads','identity'), ('learning_threads','class_schedule_id'), ('learning_threads','checkpoint_id'), ('learning_threads','session_no'),
          ('learning_thread_events','hidden_at'), ('learning_thread_events','seq'), ('learning_thread_events','media_url'),
          ('app_users','name'), ('app_users','role'), ('edu_students','level'), ('student_360_facts','status'))) <> 19 then
    raise exception 'mira_grading_v1: thiếu bảng/hàm nền (learning_threads, class_lesson_content, student_360_facts, class_public_identity) — dừng';
  end if;
end $$;

-- ── 1) Khoá của Mira (chỉ băm) ──
create table if not exists public.mira_grading_keys (
  key_hash   text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.mira_grading_keys enable row level security;
revoke all on public.mira_grading_keys from public, anon, authenticated;

-- ── 2) Vé ngắn hạn (chỉ băm vé) ──
create table if not exists public.mira_grading_tickets (
  ticket_hash text primary key check (ticket_hash ~ '^[0-9a-f]{64}$'),
  -- KHÔNG FK tới auth.users / learning_threads: tạo FK khoá bảng gốc (đụng đăng nhập/trả bài) mà vé chỉ sống 5 phút, hàm đọc đã tự kiểm
  -- Thầy còn vai và bài trả còn tồn tại ở MỖI lần đọc; vé mồ côi tự hết hạn và bị dọn ở lần cấp vé kế tiếp.
  teacher_id  uuid not null,
  thread_id   uuid not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists mira_grading_tickets_teacher_idx on public.mira_grading_tickets (teacher_id, created_at desc);
create index if not exists mira_grading_tickets_exp_idx on public.mira_grading_tickets (expires_at);
alter table public.mira_grading_tickets enable row level security;
revoke all on public.mira_grading_tickets from public, anon, authenticated;

-- ── 3) Cấp vé: CHỈ Thầy/admin đang đăng nhập, cho một bài trả có thật ──
create or replace function public.mira_grading_ticket(p_thread uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_raw text; v_exp timestamptz := now() + interval '5 minutes';
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_thread is null or not exists (select 1 from public.learning_threads t where t.id = p_thread) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.mira_grading_tickets where expires_at < now() - interval '1 hour';
  if (select count(*) from public.mira_grading_tickets x where x.teacher_id = v_uid and x.created_at > now() - interval '1 hour') >= 240 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.mira_grading_tickets (ticket_hash, teacher_id, thread_id, expires_at)
  values (encode(sha256(convert_to(v_raw, 'UTF8')), 'hex'), v_uid, p_thread, v_exp);
  return jsonb_build_object('ticket', v_raw, 'expires_at', v_exp);
end $$;
revoke all on function public.mira_grading_ticket(uuid) from public, anon;
grant execute on function public.mira_grading_ticket(uuid) to authenticated;

-- ── 4) Thu hồi vé của chính mình cho một bài trả (đóng khung Mira / chuyển bài) ──
create or replace function public.mira_grading_end(p_thread uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.mira_grading_tickets where teacher_id = v_uid and thread_id = p_thread;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mira_grading_end(uuid) from public, anon;
grant execute on function public.mira_grading_end(uuid) to authenticated;

-- ── 5) Đọc ngữ cảnh: Mira (anon + header khoá) + vé. Mỗi lần một NGUỒN, hình dạng cố định, chỉ đọc ──
create or replace function public.mira_grading_context(p_ticket text, p_source text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  v_hdr text := nullif(coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-mira-grading-key', ''), '');
  v_tk public.mira_grading_tickets%rowtype;
  v_th public.learning_threads%rowtype;
  v_teacher jsonb;
  v_data jsonb; v_status text := 'ok';
  v_cp_id text; v_blocks jsonb; v_content_at timestamptz; v_session public.class_sessions%rowtype;
begin
  -- Khoá của Mira: sai/thiếu → cùng một lỗi như vé sai (không lộ gì)
  if v_hdr is null or not exists (select 1 from public.mira_grading_keys k
                                   where k.revoked_at is null and k.key_hash = encode(sha256(convert_to(v_hdr, 'UTF8')), 'hex')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_source not in ('thread', 'curriculum', 'student360') then raise exception 'bad_source' using errcode = '22023'; end if;
  select * into v_tk from public.mira_grading_tickets
   where ticket_hash = encode(sha256(convert_to(coalesce(p_ticket, ''), 'UTF8')), 'hex') and expires_at > now();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  -- Thầy phải CÒN là Thầy/admin ở thời điểm đọc
  select jsonb_build_object('id', au.id, 'name', coalesce(nullif(trim(au.name), ''), 'Thầy')) into v_teacher
    from public.app_users au where au.id = v_tk.teacher_id and au.role in ('teacher', 'admin');
  if v_teacher is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_th from public.learning_threads t where t.id = v_tk.thread_id;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_source = 'thread' then
    v_data := jsonb_build_object(
      'learner', (select jsonb_build_object('name', i.name) from public.class_public_identity(v_th.learner_user_id) i),
      'status', v_th.status, 'program_code', v_th.program_code, 'session_no', v_th.session_no, 'checkpoint_id', v_th.checkpoint_id,
      'class', jsonb_build_object('code', v_th.identity #>> '{class,code}', 'name', v_th.identity #>> '{class,name}'),
      'checkpoint', jsonb_build_object('title', v_th.identity #>> '{checkpoint,title}', 'required', v_th.identity #> '{checkpoint,required}'),
      'created_at', v_th.created_at, 'passed_at', v_th.passed_at,
      'events', coalesce((
        select jsonb_agg(e order by e.seq) from (
          select ev.seq, ev.author_role as role, ev.kind, ev.verdict, left(ev.body, 4000) as body,
                 ev.media_provider, ev.media_url, ev.created_at
            from public.learning_thread_events ev
           where ev.thread_id = v_th.id and ev.hidden_at is null
           order by ev.seq desc limit 20) e), '[]'::jsonb));
  elsif p_source = 'curriculum' then
    select * into v_session from public.class_sessions s
     where s.class_id = v_th.class_schedule_id and s.session_number = v_th.session_no and s.event_type = 'lesson' limit 1;
    if v_th.class_schedule_id is null or v_session.id is null then
      v_status := 'empty'; v_data := '{}'::jsonb;
    else
      select c.blocks, c.updated_at into v_blocks, v_content_at
        from public.class_lesson_content c where c.session_id = v_session.id and c.status = 'published';
      if v_blocks is null then v_status := 'empty'; v_data := '{}'::jsonb;
      else
        v_data := jsonb_build_object(
          'session_title', v_session.title, 'content_updated_at', v_content_at,
          'checkpoint', (select jsonb_build_object('id', b ->> 'id', 'title', b ->> 'title', 'prompt', b ->> 'prompt',
                                                  'required', b -> 'required', 'accepts', b -> 'accepts')
                           from jsonb_array_elements(v_blocks) b
                          where jsonb_typeof(b) = 'object' and b ->> 'kind' = 'checkpoint' and b ->> 'id' = v_th.checkpoint_id limit 1),
          -- Mục tiêu và ghi chú của buổi (cắt gọn). KHÔNG đưa quiz/đáp án: chỉ lấy kind objectives|note.
          'objectives', coalesce((select jsonb_agg(left(i, 400)) from (
              select jsonb_array_elements_text(b -> 'items') i from jsonb_array_elements(v_blocks) b
               where jsonb_typeof(b) = 'object' and b ->> 'kind' = 'objectives' and jsonb_typeof(b -> 'items') = 'array' limit 12) q), '[]'::jsonb),
          'notes', coalesce((select jsonb_agg(jsonb_build_object('title', left(coalesce(b ->> 'title', ''), 200), 'text', left(coalesce(b ->> 'text', ''), 800)))
              from (select b from jsonb_array_elements(v_blocks) b
                     where jsonb_typeof(b) = 'object' and b ->> 'kind' = 'note' and coalesce(b ->> 'text', '') <> '' limit 8) n), '[]'::jsonb));
        if v_data -> 'checkpoint' is null or v_data -> 'checkpoint' = 'null'::jsonb then v_data := v_data - 'checkpoint'; end if;
      end if;
    end if;
  else -- student360: mục đang hiệu lực, bản nhìn của Thầy nhưng KHÔNG có source_ref/người tạo (con trỏ nội bộ)
    v_data := jsonb_build_object(
      'level', (select es.level from public.edu_students es where es.user_id = v_th.learner_user_id order by es.enrolled_at desc nulls last limit 1),
      'facts', coalesce((select jsonb_agg(jsonb_build_object('category', f.category, 'content', f.content, 'origin', f.origin,
                          'verification', f.verification, 'source_kind', f.source_kind, 'updated_at', f.updated_at) order by f.category, f.created_at)
                           from (select * from public.student_360_facts x where x.user_id = v_th.learner_user_id and x.status = 'active'
                                  order by x.category, x.created_at limit 50) f), '[]'::jsonb));
    if jsonb_array_length(v_data -> 'facts') = 0 then v_status := 'empty'; end if;
  end if;

  return jsonb_build_object('v', 1, 'source', p_source, 'status', v_status, 'thread_id', v_th.id,
                            'teacher', v_teacher, 'as_of', now(), 'data', v_data);
end $$;
revoke all on function public.mira_grading_context(text, text) from public, authenticated;
grant execute on function public.mira_grading_context(text, text) to anon;

notify pgrst, 'reload schema';
