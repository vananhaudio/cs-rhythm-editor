-- ═══════════════════════════════════════════════════════════════════════════
-- SOCIAL UX + LỚP HỌC V1 (/me) — CHỈ ĐỌC, KHÔNG BẢNG MỚI. Idempotent.
-- Thiết kế: docs/SOCIAL-CLASSES-V1.md. Rollback: db/social_classes_v1_rollback.sql.
--
-- Lớp = class_schedule (không social_classes). Thành viên = edu_group_members active trong nhóm cohort
-- (class_schedule.cohort_group_id) hoặc nhóm gắn lớp (group_id / cùng mã lớp) — cùng nguồn với "Lớp đang học".
-- Giáo viên của lớp = thành viên nhóm có app_users.role teacher/admin (không hard-code tên).
-- Quyền:
--   • Thành viên Class (is_class_member) mới gọi được. Khách: không.
--   • Mọi thành viên Class: xem thẻ lớp (tên, mã, trạng thái, lịch chữ, khoá chính, số thành viên, số hoạt động)
--     và HOẠT ĐỘNG CÔNG KHAI của lớp = Learning Thread community (không ẩn, không lưu trữ) có snapshot thuộc lớp.
--   • Danh sách THÀNH VIÊN: chỉ thành viên lớp + Thầy/admin. Chỉ tên/avatar/vai trò/quan hệ bạn bè — không PII.
--   • Không lộ: zoom_url, giá, metadata, email/SĐT, gói, tiến độ, thread private, bài tường friends-only.
-- Feed "Dành cho bạn" (social_feed): thêm bài tường của CHÍNH MÌNH + của BẠN BÈ (đúng quyền RLS hiện có của bài
-- 'friends') để bài vừa chia sẻ hiện ngay trên Home. Bài 'friends' vẫn KHÔNG tới người không phải bạn.
-- CHẠY: dán NGUYÊN FILE vào Supabase SQL Editor — file tự mở/đóng MỘT giao dịch.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 0) Cổng phụ thuộc: hàm sắp gọi / thay thế phải đúng bản repo đang chạy production ──────────
do $gate$
declare
  fn_expected constant jsonb := '{"class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "friendship_status": ["9f653ba0b1fbcb58c69acaba880906fc"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_friend_of": ["c5281e64105ae14e008445ba7fb5c354"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"], "lt_thread_card": ["172c1d1d323e637944097493b5bf5344"], "social_feed": ["0916ccb443782eb7b8070a1bb439ed00", "d62b6a78984817b787e7731e46c2a0e5"]}';
  col_required constant jsonb := '{"class_schedule": ["id", "code", "name", "status", "is_active", "program_code", "stage", "start_date", "end_date", "schedule", "main_course_id", "cohort_group_id", "group_id"], "edu_groups": ["id", "code"], "edu_group_members": ["user_id", "group_id", "status"], "learning_threads": ["class_schedule_id", "visibility", "hidden_at", "archived_at", "last_event_at"]}';
  k text; allowed jsonb; actual text; c text; drift text[] := '{}';
begin
  for k, allowed in select * from jsonb_each(fn_expected) loop
    select string_agg(md5(p.prosrc), ',') into actual from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = k;
    if actual is null then drift := drift || format('thiếu hàm %s', k);
    elsif not allowed ? actual then drift := drift || format('hàm %s (md5 %s)', k, actual); end if;
  end loop;
  for k, allowed in select * from jsonb_each(col_required) loop
    for c in select jsonb_array_elements_text(allowed) loop
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = k and column_name = c) then
        drift := drift || format('thiếu cột %s.%s', k, c);
      end if;
    end loop;
  end loop;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ')
      using hint = 'Chạy db/social_classes_v1_preflight.sql, gửi kết quả cho người review.';
  end if;
end $gate$;

-- ── 1) Thành viên lớp (nội bộ) ───────────────────────────────────────────────
create or replace function public.social_class_members_of(p_class uuid)
returns table(user_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct gm.user_id
  from public.class_schedule cs
  join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id
                           or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
  join public.edu_group_members gm on gm.group_id = g.id and gm.status = 'active'
  where cs.id = p_class;
$$;

create or replace function public.social_class_is_member(p_class uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists (select 1 from public.social_class_members_of(p_class) m where m.user_id = p_user);
$$;

-- Thẻ lớp: CHỈ thông tin công khai (không zoom_url / giá / metadata).
create or replace function public.social_class_card(p_class uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', cs.id, 'code', cs.code, 'name', cs.name, 'status', cs.status, 'program_code', cs.program_code,
    'stage', cs.stage, 'start_date', cs.start_date, 'end_date', cs.end_date, 'schedule', cs.schedule,
    'course', (select jsonb_build_object('code', c.code, 'name', c.name, 'track', c.track)
               from public.edu_courses c where c.id = cs.main_course_id),
    'member_count', (select count(*)::int from public.social_class_members_of(cs.id) m
                     where not exists (select 1 from public.app_users a where a.id = m.user_id and a.role in ('teacher', 'admin'))),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', i.name, 'avatar_url', i.avatar_url) order by i.name)
                          from public.social_class_members_of(cs.id) m
                          join public.app_users a on a.id = m.user_id and a.role in ('teacher', 'admin')
                          cross join lateral public.class_public_identity(m.user_id) i), '[]'::jsonb),
    'activity_count', (select count(*)::int from public.learning_threads t
                       where t.class_schedule_id = cs.id and t.visibility = 'community' and t.hidden_at is null and t.archived_at is null),
    'last_activity_at', (select max(t.last_event_at) from public.learning_threads t
                         where t.class_schedule_id = cs.id and t.visibility = 'community' and t.hidden_at is null and t.archived_at is null),
    'is_member', public.social_class_is_member(cs.id, auth.uid()))
  from public.class_schedule cs where cs.id = p_class;
$$;

revoke all on function public.social_class_members_of(uuid), public.social_class_is_member(uuid, uuid), public.social_class_card(uuid)
  from public, anon, authenticated;

-- ── 2) Lớp của tôi (mọi lớp đang là thành viên; lớp đang diễn ra trước) ──────
create or replace function public.social_my_classes()
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select public.social_class_card(cs.id)
  from public.class_schedule cs
  where public.is_class_member() and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
    and public.social_class_is_member(cs.id, auth.uid())
  order by (cs.status in ('active', 'ending_soon')) desc, cs.start_date desc nulls last, cs.name, cs.id;
$$;

-- ── 3) Khám phá: lớp đang hoạt động/tuyển sinh mà mình CHƯA tham gia (xác định, không "gợi ý AI") ──
create or replace function public.social_discover_classes(p_limit int default 50)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select public.social_class_card(cs.id)
  from public.class_schedule cs
  where public.is_class_member() and cs.is_active
    and cs.status in ('recruiting', 'ready_to_open', 'scheduled', 'upcoming', 'active', 'ending_soon')
    and not public.social_class_is_member(cs.id, auth.uid())
  order by (cs.status in ('active', 'ending_soon')) desc, cs.start_date desc nulls last, cs.name, cs.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- ── 4) Chi tiết một lớp (ai trong Class cũng xem được phần công khai) ────────
create or replace function public.social_class_detail(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_class_member() then raise exception 'SC_NOT_MEMBER' using errcode = '42501'; end if;
  select public.social_class_card(cs.id) into v from public.class_schedule cs
   where cs.id = p_class and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft');
  if v is null then raise exception 'SC_NOT_FOUND' using errcode = '22023'; end if;
  return v || jsonb_build_object('can_view_members', (v ->> 'is_member')::boolean or public.is_teacher());
end $$;

-- ── 5) Hoạt động của lớp: Learning Thread community có snapshot thuộc lớp (1 thread = 1 mục) ──
-- Cùng dạng hàng với social_feed để frontend dùng lại. Tự học (không lớp) KHÔNG thuộc lớp nào.
create or replace function public.social_class_activity(
  p_class      uuid,
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  select 'learning_thread'::text, t.last_event_at, 't:' || t.id::text, null::jsonb, public.lt_thread_card(t.id)
  from public.learning_threads t
  where public.is_class_member() and t.class_schedule_id = p_class
    and t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
    and (p_before is null or (t.last_event_at, 't:' || t.id::text) < (p_before, coalesce(p_before_key, '')))
  order by t.last_event_at desc, ('t:' || t.id::text) desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ── 6) Thành viên lớp: CHỈ thành viên lớp + Thầy/admin xem ────────────────────
create or replace function public.social_class_members(p_class uuid)
returns table(user_id uuid, name text, avatar_url text, role text, relationship text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_class_member() then raise exception 'SC_NOT_MEMBER' using errcode = '42501'; end if;
  if not (public.social_class_is_member(p_class, auth.uid()) or public.is_teacher()) then
    raise exception 'SC_MEMBERS_ONLY' using errcode = '42501';
  end if;
  return query
  select m.user_id, i.name, i.avatar_url, i.role, public.friendship_status(m.user_id)
  from public.social_class_members_of(p_class) m
  cross join lateral public.class_public_identity(m.user_id) i
  where public.is_class_member_user(m.user_id)
  order by (i.role = 'teacher') desc, i.name, m.user_id
  limit 500;
end $$;

-- ── 7) Feed "Dành cho bạn": + bài tường của chính mình và bạn bè (đúng quyền bài 'friends') ────
create or replace function public.social_feed(
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  with items as (
    select 'post'::text as kind, p.created_at as sort_at, 'p:' || p.id::text as sort_key, p.id, null::uuid as tid
    from public.class_posts p
    where (p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
       or (p.audience = 'friends' and p.hidden_at is null
           and (p.author_user_id = auth.uid() or public.is_friend_of(p.author_user_id)))
    union all
    select 'learning_thread', t.last_event_at, 't:' || t.id::text, null::uuid, t.id
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
  ),
  page as (
    select * from items
    where public.is_class_member()
      and (p_before is null or (sort_at, sort_key) < (p_before, coalesce(p_before_key, '')))
    order by sort_at desc, sort_key desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.kind, pg.sort_at, pg.sort_key,
         case when pg.kind = 'post' then (
           select jsonb_build_object(
             'id', p.id, 'type', p.type, 'body', p.body, 'media_type', p.media_type, 'media_provider', p.media_provider,
             'media_url', p.media_url, 'external_media_id', p.external_media_id, 'created_at', p.created_at,
             'updated_at', p.updated_at, 'author_user_id', p.author_user_id, 'author_name', idn.name,
             'author_avatar_url', idn.avatar_url, 'author_role', idn.role, 'author_ht_member', idn.ht_member,
             'is_mine', p.author_user_id = auth.uid(), 'is_hidden', p.hidden_at is not null,
             'comment_count', (select count(*)::int from public.class_post_comments c
                               where c.post_id = p.id and (c.hidden_at is null or public.is_teacher())),
             'audience', p.audience)
           from public.class_posts p cross join lateral public.class_public_identity(p.author_user_id) idn
           where p.id = pg.id) end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$$;

revoke all on function public.social_my_classes(), public.social_discover_classes(int), public.social_class_detail(uuid),
  public.social_class_activity(uuid, timestamptz, text, int), public.social_class_members(uuid),
  public.social_feed(timestamptz, text, int)
  from public, anon;
grant execute on function public.social_my_classes(), public.social_discover_classes(int), public.social_class_detail(uuid),
  public.social_class_activity(uuid, timestamptz, text, int), public.social_class_members(uuid),
  public.social_feed(timestamptz, text, int)
  to authenticated;

notify pgrst, 'reload schema';
commit;
