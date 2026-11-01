-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- MIRA GRADING — PILOT THEO TÀI KHOẢN (V1.1). CHƯA áp production.
-- Chạy sau db/mira_grading_v1_setup.sql (đã COMMIT ở production). Không có begin/commit (prod-db.py giữ giao dịch). Idempotent.
-- Thêm: bảng mira_grading_pilot (danh sách uid được dùng Mira), hàm mira_grading_pilot_enabled() (giao diện hỏi "tôi có được dùng không"
-- mà KHÔNG phải xin vé), và thay thân 2 hàm của V1: mira_grading_ticket (đòi có trong pilot) và mira_grading_context (đòi Thầy của vé
-- còn trong pilot → gỡ khỏi pilot là vô hiệu mọi vé đang sống ngay lập tức).
-- Chỉ thêm uid Owner khi Owner duyệt: insert … select id from app_users where id = '<uid>' and role in ('teacher','admin').
-- Rollback: db/mira_grading_pilot_v1_rollback.sql (trả đúng thân hàm V1, gỡ hàm/bảng pilot; không đụng bảng vé/khoá).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

do $$
declare v_t text; v_c text;
begin
  if to_regclass('public.mira_grading_keys') is null or to_regclass('public.mira_grading_tickets') is null
     or to_regprocedure('public.mira_grading_ticket(uuid)') is null or to_regprocedure('public.mira_grading_context(text,text)') is null
     or to_regprocedure('public.is_teacher()') is null then
    raise exception 'mira_grading_pilot: thiếu nền V1 (bảng/hàm mira_grading_*) — dừng';
  end if;
  select prosrc into v_t from pg_proc where oid = 'public.mira_grading_ticket(uuid)'::regprocedure;
  select prosrc into v_c from pg_proc where oid = 'public.mira_grading_context(text,text)'::regprocedure;
  -- Chỉ thay khi thân hàm là đúng bản V1 đã nghiệm thu HOẶC đã là bản pilot (chạy lại an toàn). Bản lạ → dừng, không ghi đè.
  if v_t not like '%mira_grading_pilot%' and md5(v_t) <> 'b21ea3384d940448694b1fcc80a486ce' then raise exception 'mira_grading_pilot: thân mira_grading_ticket khác bản V1 đã nghiệm thu — dừng'; end if;
  if v_c not like '%mira_grading_pilot%' and md5(v_c) <> '32741fd4dc1a4e8ec9903d4c00e90895' then raise exception 'mira_grading_pilot: thân mira_grading_context khác bản V1 đã nghiệm thu — dừng'; end if;
end $$;

-- ── 1) Danh sách pilot (không FK; RLS bật; không policy; không quyền cho client) ──
create table if not exists public.mira_grading_pilot (
  user_id  uuid primary key,
  added_at timestamptz not null default now(),
  note     text check (note is null or char_length(note) <= 200)
);
alter table public.mira_grading_pilot enable row level security;
revoke all on public.mira_grading_pilot from public, anon, authenticated;

-- ── 2) Giao diện hỏi "tôi có được dùng Mira không": chỉ trả trạng thái của CHÍNH người gọi, không tạo vé ──
create or replace function public.mira_grading_pilot_enabled()
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(public.is_teacher() and exists (select 1 from public.mira_grading_pilot pl where pl.user_id = auth.uid()), false);
$$;
revoke all on function public.mira_grading_pilot_enabled() from public, anon;
grant execute on function public.mira_grading_pilot_enabled() to authenticated;

-- ── 3) Thay thân 2 hàm V1 (quyền EXECUTE giữ nguyên) ──
create or replace function public.mira_grading_ticket(p_thread uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_raw text; v_exp timestamptz := now() + interval '5 minutes';
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  -- PILOT: chỉ tài khoản có trong mira_grading_pilot (Owner thêm từng uid) mới được cấp vé; cùng lỗi 'forbidden' (không lộ danh sách)
  if not exists (select 1 from public.mira_grading_pilot pl where pl.user_id = v_uid) then raise exception 'forbidden' using errcode = '42501'; end if;
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
    from public.app_users au where au.id = v_tk.teacher_id and au.role in ('teacher', 'admin')
     and exists (select 1 from public.mira_grading_pilot pl where pl.user_id = au.id);
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
