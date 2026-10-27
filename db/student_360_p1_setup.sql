-- ═══════════════════════════════════════════════════════════════════════════
-- STUDENT 360° P1 — nền tảng hồ sơ học viên 360° (thông tin chắt lọc có nguồn). CHƯA CHẠY production. Idempotent.
-- Rollback: db/student_360_p1_rollback.sql. Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-student-360-db.sh
-- Thiết kế: docs/STUDENT-360-P1.md
--
-- Nguyên tắc:
--   • Hồ sơ gắn auth.users.id. Dữ liệu học tập (lớp, bài, nộp bài, nhận xét, XP) KHÔNG sao chép — vẫn ở bảng Class.
--   • Bảng này chỉ giữ "thông tin chắt lọc" (≤500 ký tự/mục), KHÔNG chứa tin nhắn Zalo gốc.
--     source_ref chỉ là con trỏ mờ (vd. 'crm-link:<id>'), không phải nội dung.
--   • Mỗi mục có: origin (học viên tự nêu / Class xác nhận / suy luận), verification (chưa xác minh /
--     học viên xác nhận / Thầy xác minh), nguồn, thời điểm. Suy luận KHÔNG bao giờ tự thành đã xác minh.
--   • Sửa/thu hồi có nhật ký bất biến (student_360_fact_log). Thu hồi theo nguồn để P2 sửa liên kết sai.
--   • Mọi truy cập qua RPC SECURITY DEFINER; bảng REVOKE hết (production cấp mặc định MỌI quyền bảng).
--     Hai bảng nằm trong self_managed của db/rls_setup.sql.
--   • Học viên chỉ thấy hồ sơ CỦA MÌNH, và chỉ mục visibility='student_and_teacher'. Mira (P4) đọc bằng JWT
--     học viên → cùng phạm vi này, không đọc hồ sơ người khác.
--
-- CHẠY: dán NGUYÊN FILE (tự mở/đóng MỘT giao dịch). Cần sẵn: auth.users, app_users, edu_students, is_teacher().
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ begin
  if to_regclass('public.app_users') is null or to_regclass('public.edu_students') is null
     or to_regprocedure('public.is_teacher()') is null then
    raise exception 'student_360_p1: thiếu app_users / edu_students / is_teacher() — dừng';
  end if;
end $$;

-- ── 1) Bảng ──
create table if not exists public.student_360_facts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null check (category in
                  ('goal','music_taste','difficulty','support_need','key_topic','commitment')),
  content       text not null check (char_length(content) between 1 and 500),
  origin        text not null check (origin in ('self_reported','class_confirmed','inferred')),
  verification  text not null default 'unverified'
                  check (verification in ('unverified','student_confirmed','teacher_verified')),
  source_kind   text not null check (source_kind in ('student','teacher','class','crm_zalo','mira')),
  source_ref    text check (source_ref is null or char_length(source_ref) <= 200),
  visibility    text not null default 'student_and_teacher' check (visibility in ('teacher','student_and_teacher')),
  status        text not null default 'active' check (status in ('active','revoked')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  verified_by   uuid references auth.users(id) on delete set null,
  verified_at   timestamptz,
  revoked_by    uuid references auth.users(id) on delete set null,
  revoked_at    timestamptz,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 300),
  constraint s360_revoked_has_time check (status <> 'revoked' or revoked_at is not null),
  constraint s360_teacher_verified_has_actor check (verification <> 'teacher_verified' or verified_at is not null)
);
create index if not exists student_360_facts_user_idx on public.student_360_facts (user_id, status);
create index if not exists student_360_facts_source_idx on public.student_360_facts (source_kind, source_ref)
  where source_ref is not null;

create table if not exists public.student_360_fact_log (
  id       bigint generated always as identity primary key,
  fact_id  uuid not null,
  user_id  uuid not null,
  action   text not null,
  actor    uuid,
  before   jsonb,
  after    jsonb,
  at       timestamptz not null default now()
);
create index if not exists student_360_fact_log_fact_idx on public.student_360_fact_log (fact_id, at);

create or replace function public.student_360_log_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'student_360_fact_log là nhật ký bất biến' using errcode = '42501'; end $$;
revoke all on function public.student_360_log_immutable() from public, anon, authenticated;
drop trigger if exists student_360_fact_log_immutable on public.student_360_fact_log;
create trigger student_360_fact_log_immutable before update or delete on public.student_360_fact_log
  for each row execute function public.student_360_log_immutable();

alter table public.student_360_facts    enable row level security;
alter table public.student_360_fact_log enable row level security;
revoke all on public.student_360_facts, public.student_360_fact_log from public, anon, authenticated;

-- ── 2) Hàm nội bộ ──
create or replace function public.student_360_log(p_fact uuid, p_user uuid, p_action text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.student_360_fact_log (fact_id, user_id, action, actor, before, after)
  values (p_fact, p_user, p_action, auth.uid(), p_before, p_after);
$$;
revoke all on function public.student_360_log(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.student_360_need_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return v;
end $$;
revoke all on function public.student_360_need_uid() from public, anon, authenticated;

-- JSON một mục cho người xem: học viên không thấy source_ref (con trỏ CRM) và không thấy mục chỉ-cho-Thầy.
create or replace function public.student_360_fact_json(f public.student_360_facts, p_teacher boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', f.id, 'category', f.category, 'content', f.content, 'origin', f.origin,
    'verification', f.verification, 'source_kind', f.source_kind, 'visibility', f.visibility,
    'status', f.status, 'created_at', f.created_at, 'updated_at', f.updated_at, 'verified_at', f.verified_at)
    || case when p_teacher then jsonb_build_object('source_ref', f.source_ref, 'created_by', f.created_by,
         'verified_by', f.verified_by, 'revoked_at', f.revoked_at, 'revoked_by', f.revoked_by,
         'revoke_reason', f.revoke_reason) else '{}'::jsonb end);
$$;
revoke all on function public.student_360_fact_json(public.student_360_facts, boolean) from public, anon, authenticated;

-- ── 3) RPC công khai (authenticated) ──
-- Đọc hồ sơ. p_user null = chính mình. Thầy đọc được mọi học viên; học viên chỉ đọc của mình.
create or replace function public.student_360_get(p_user uuid default null, p_include_revoked boolean default false)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_target uuid := coalesce(p_user, v_uid);
  v_teacher boolean := public.is_teacher();
  v_profile jsonb; v_facts jsonb;
begin
  if v_target <> v_uid and not v_teacher then raise exception 'forbidden' using errcode = '42501'; end if;

  select jsonb_build_object('student_id', es.id, 'display_name', es.display_name, 'level', es.level,
           'enrolled_at', es.enrolled_at, 'is_active', es.is_active,
           'goals', to_jsonb(es)->'goals', 'learning_style', to_jsonb(es)->'learning_style',
           'instruments', to_jsonb(es)->'instruments')
    into v_profile
    from public.edu_students es where es.user_id = v_target
    order by es.is_active desc nulls last, es.enrolled_at desc nulls last limit 1;

  select coalesce(jsonb_agg(public.student_360_fact_json(f, v_teacher) order by f.category, f.created_at), '[]'::jsonb)
    into v_facts
    from public.student_360_facts f
   where f.user_id = v_target
     and (f.status = 'active' or (v_teacher and p_include_revoked))
     and (v_teacher or f.visibility = 'student_and_teacher');

  return jsonb_build_object(
    'user_id', v_target, 'profile', v_profile, 'facts', v_facts,
    -- Dữ liệu học tập KHÔNG sao chép: nơi đọc đúng nguồn Class (đều theo auth.uid() / quyền Thầy).
    'learning_sources', jsonb_build_array('my_learning_state()', 'lt_* (learning_threads)', 'student_xp_log', 'edu_lesson_progress'),
    'generated_at', now());
end $$;

-- Thêm một mục. Học viên: chỉ cho mình, luôn là self_reported/student, hiển thị cho cả hai.
-- Thầy: mọi học viên, mọi origin; origin='inferred' mặc định chỉ Thầy thấy. Luôn bắt đầu 'unverified'.
create or replace function public.student_360_add_fact(
  p_user uuid, p_category text, p_content text,
  p_origin text default 'self_reported', p_source_kind text default 'student',
  p_source_ref text default null, p_visibility text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_target uuid := coalesce(p_user, v_uid);
  v_teacher boolean := public.is_teacher();
  v_content text := btrim(coalesce(p_content, ''));
  v_origin text; v_kind text; v_ref text; v_vis text; v_row public.student_360_facts;
begin
  if v_target <> v_uid and not v_teacher then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_content = '' then raise exception 'content_required' using errcode = '22023'; end if;

  if v_teacher then
    v_origin := coalesce(p_origin, 'self_reported'); v_kind := coalesce(p_source_kind, 'teacher'); v_ref := p_source_ref;
    v_vis := coalesce(p_visibility, case when v_origin = 'inferred' then 'teacher' else 'student_and_teacher' end);
  else
    v_origin := 'self_reported'; v_kind := 'student'; v_ref := null; v_vis := 'student_and_teacher';
    if (select count(*) from public.student_360_facts where user_id = v_target and status = 'active') >= 50 then
      raise exception 'too_many_facts' using errcode = '54000';
    end if;
  end if;

  insert into public.student_360_facts (user_id, category, content, origin, source_kind, source_ref, visibility, created_by)
  values (v_target, p_category, v_content, v_origin, v_kind, v_ref, v_vis, v_uid)
  returning * into v_row;
  perform public.student_360_log(v_row.id, v_target, 'create', null, to_jsonb(v_row));
  return public.student_360_fact_json(v_row, v_teacher);
end $$;

-- Sửa nội dung. Học viên: chỉ mục self_reported của mình còn hiệu lực. Sửa luôn đưa verification về 'unverified'.
create or replace function public.student_360_edit_fact(p_fact uuid, p_content text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_teacher boolean := public.is_teacher();
  v_content text := btrim(coalesce(p_content, ''));
  v_old public.student_360_facts; v_row public.student_360_facts;
begin
  if v_content = '' then raise exception 'content_required' using errcode = '22023'; end if;
  select * into v_old from public.student_360_facts where id = p_fact for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not v_teacher and (v_old.user_id <> v_uid or v_old.origin <> 'self_reported'
                        or v_old.visibility <> 'student_and_teacher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_old.status <> 'active' then raise exception 'revoked' using errcode = '22023'; end if;

  update public.student_360_facts
     set content = v_content, verification = 'unverified', verified_by = null, verified_at = null, updated_at = now()
   where id = p_fact returning * into v_row;
  perform public.student_360_log(p_fact, v_row.user_id, 'edit', to_jsonb(v_old), to_jsonb(v_row));
  return public.student_360_fact_json(v_row, v_teacher);
end $$;

-- Đặt mức xác minh. Thầy: 'teacher_verified' | 'unverified'. Học viên: 'student_confirmed' | 'unverified'
-- trên mục của mình mà họ nhìn thấy. Không ai (kể cả Mira) tự nâng suy luận lên đã xác minh.
create or replace function public.student_360_set_verification(p_fact uuid, p_level text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_teacher boolean := public.is_teacher();
  v_old public.student_360_facts; v_row public.student_360_facts;
begin
  if p_level not in ('unverified','student_confirmed','teacher_verified') then
    raise exception 'bad_level' using errcode = '22023';
  end if;
  select * into v_old from public.student_360_facts where id = p_fact for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_teacher then
    if p_level = 'student_confirmed' then raise exception 'forbidden' using errcode = '42501'; end if;
  else
    if v_old.user_id <> v_uid or v_old.visibility <> 'student_and_teacher' or p_level = 'teacher_verified' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  if v_old.status <> 'active' then raise exception 'revoked' using errcode = '22023'; end if;

  update public.student_360_facts
     set verification = p_level, updated_at = now(),
         verified_by = case when p_level = 'unverified' then null else v_uid end,
         verified_at = case when p_level = 'unverified' then null else now() end
   where id = p_fact returning * into v_row;
  perform public.student_360_log(p_fact, v_row.user_id, 'verify:' || p_level, to_jsonb(v_old), to_jsonb(v_row));
  return public.student_360_fact_json(v_row, v_teacher);
end $$;

-- Thu hồi một mục (ẩn khỏi mọi lần đọc thường; nhật ký giữ lại). Học viên: mục của mình họ nhìn thấy. Idempotent.
create or replace function public.student_360_revoke_fact(p_fact uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_teacher boolean := public.is_teacher();
  v_old public.student_360_facts; v_row public.student_360_facts;
begin
  select * into v_old from public.student_360_facts where id = p_fact for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not v_teacher and (v_old.user_id <> v_uid or v_old.visibility <> 'student_and_teacher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_old.status = 'revoked' then return public.student_360_fact_json(v_old, v_teacher); end if;

  update public.student_360_facts
     set status = 'revoked', revoked_by = v_uid, revoked_at = now(), updated_at = now(),
         revoke_reason = left(p_reason, 300)
   where id = p_fact returning * into v_row;
  perform public.student_360_log(p_fact, v_row.user_id, 'revoke', to_jsonb(v_old), to_jsonb(v_row));
  return public.student_360_fact_json(v_row, v_teacher);
end $$;

-- Thu hồi hàng loạt theo nguồn (P2: sửa một liên kết Zalo sai → thu hồi mọi thông tin chắt lọc từ liên kết đó). Chỉ Thầy.
create or replace function public.student_360_revoke_by_source(p_source_kind text, p_source_ref text, p_reason text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_old public.student_360_facts; v_row public.student_360_facts; v_n integer := 0;
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_source_kind is null or p_source_ref is null then raise exception 'source_required' using errcode = '22023'; end if;
  for v_old in select * from public.student_360_facts
                where source_kind = p_source_kind and source_ref = p_source_ref and status = 'active' for update
  loop
    update public.student_360_facts
       set status = 'revoked', revoked_by = v_uid, revoked_at = now(), updated_at = now(),
           revoke_reason = left(p_reason, 300)
     where id = v_old.id returning * into v_row;
    perform public.student_360_log(v_old.id, v_old.user_id, 'revoke_by_source', to_jsonb(v_old), to_jsonb(v_row));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Lịch sử một mục (kể cả nội dung cũ). Chỉ Thầy.
create or replace function public.student_360_fact_history(p_fact uuid)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  perform public.student_360_need_uid();
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'action', l.action, 'actor', l.actor,
                                                       'before', l.before, 'after', l.after) order by l.id)
                     from public.student_360_fact_log l where l.fact_id = p_fact), '[]'::jsonb);
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'student_360_get(uuid, boolean)', 'student_360_add_fact(uuid, text, text, text, text, text, text)',
    'student_360_edit_fact(uuid, text)', 'student_360_set_verification(uuid, text)',
    'student_360_revoke_fact(uuid, text)', 'student_360_revoke_by_source(text, text, text)',
    'student_360_fact_history(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

comment on table public.student_360_facts is
  'Student 360 P1: thông tin chắt lọc về học viên (có nguồn/xác minh). KHÔNG chứa tin nhắn gốc. Chỉ qua RPC student_360_*.';

commit;
