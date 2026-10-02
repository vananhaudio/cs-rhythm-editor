-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS MEMBERSHIP CANONICAL V1 — SCHEMA + MỘT NGUỒN SỰ THẬT CHO THÀNH VIÊN LỚP.
-- Luật (docs/CLASS-MEMBERSHIP-CANONICAL.md):
--   class_schedule.cohort_group_id  →  edu_group_members(status = 'active')  →  học sinh.
--   Định nghĩa DUY NHẤT: view tva_private.class_memberships. Mọi consumer (Social, App, Admin, Giáo trình,
--   Learning Identity, Learning Thread, trigger cấp khoá, gói membership, bảng xếp hạng) đọc view này.
--   KHÔNG suy theo tên/mã nhóm trùng mã lớp, ht_member, lead, gói, group_id thứ hai.
--   group_id (cột cũ, nhiều nơi còn ghi/đọc) = BẢN SAO luôn bằng cohort_group_id (trigger + CHECK).
--   Membership ≠ quyền Giáo trình: can_read_class_curriculum = thành viên canonical ∧ class_curriculum_access.
-- Cổng: mọi lớp phải có group_id = cohort_group_id. Ánh xạ lớp → nhóm canonical của production là DỮ LIỆU vận hành,
-- nằm ở hạ tầng PRIVATE (cs-rhythm-editor-wip: prod-migrations/class-membership-canonical-v1/data.sql) và chạy
-- TRƯỚC file này trong CÙNG transaction. Repo public không chứa id/sĩ số production.
-- Rollback: db/class_membership_canonical_v1_rollback.sql (khôi phục ĐÚNG thân hàm cũ từ bảng sao lưu; dữ liệu → private).
-- File KHÔNG có begin/commit. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: thân hàm bị thay = bản production 02/10 (hoặc bản V1 khi chạy lại); dữ liệu đã canonical ─────
do $gate$
declare fn_expected constant jsonb := '{
  "public.activate_class_membership": ["ce80cf7f4a59f6ac71a33d2cd85ddd44", "59010ff15181f9feb4bcaee777e62a1f"],
  "public.backfill_class": ["b95f87d3ac7a7ac80d881eacb77f17cc", "c43662ab8ee72870afa6eef96195b7e9"],
  "public.grant_class_courses_on_join": ["8895fa8f4d3950cd22dc20dd250e1055", "654a3de6b322c28b244dc7edc196efc3"],
  "public.lt_identity_snapshot": ["0c6477c720eeb4680ae16365bc376746", "e0242da3574864c1c52d6c95305b42fa"],
  "public.manage_class_curriculum_access": ["cc1e6dedaff15d32102913203f484695", "39871f3c28fd87b40d950d81a39f77f2"],
  "public.manage_class_membership": ["0920764fcc144c227e552726d6bdacdb", "328237694b986a72b4059ab6b82f0c84"],
  "public.my_class_leaderboard": ["56fcb587e7df2654c1db2784d1bbe992", "942559194581b04e02e3d18ec10c6657"],
  "public.my_membership": ["2eb4d72828e2b00cf0d0134a0aff047b", "676c4ee0013aee9c838a56801ad26c62"],
  "public.social_class_card": ["3b2e545df332f91f1d9b9096c58a1526", "a08c4c854ea53822f06c1e06a1049bc0"],
  "public.social_class_members_of": ["b434c0e8478ec8ed62c004fffe6668d0", "a5db1dcf479289c36f5b74c668a79a23"],
  "public.social_learning_identities": ["7b0e086d95156d539a965c6b87210185", "60bba2af5d971c7a196e1b638b4b8b7a"],
  "tva_private.can_read_class_curriculum": ["b25d62fbbd2781fa98886319dca01a65", "d393664dbcdaf4c5667c2d043da76d9e"]}';
  k text; allowed jsonb; actual text; drift text[] := '{}';
begin
  for k, allowed in select * from jsonb_each(fn_expected) loop
    select string_agg(md5(p.prosrc), ',') into actual from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname || '.' || p.proname = k;
    if actual is null then drift := drift || format('thiếu hàm %s', k);
    elsif not allowed ? actual then drift := drift || format('hàm %s (md5 %s)', k, actual); end if;
  end loop;
  if exists (select 1 from public.class_schedule where group_id is distinct from cohort_group_id) then
    drift := drift || 'còn lớp group_id ≠ cohort_group_id — chạy phần dữ liệu trước'::text;
  end if;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ');
  end if;
end $gate$;

-- ── 1) Sao lưu ĐÚNG thân hàm cũ (chỉ bản production gốc) để rollback khôi phục nguyên văn ───────────
create table if not exists tva_private.ccm_v1_backup (
  fn text primary key, def text not null, src_md5 text not null, saved_at timestamptz not null default now());
revoke all on tva_private.ccm_v1_backup from public, anon, authenticated;
insert into tva_private.ccm_v1_backup (fn, def, src_md5)
select n.nspname || '.' || p.proname, pg_get_functiondef(p.oid), md5(p.prosrc)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (('public', 'activate_class_membership'), ('public', 'backfill_class'), ('public', 'grant_class_courses_on_join'),
        ('public', 'lt_identity_snapshot'), ('public', 'manage_class_curriculum_access'), ('public', 'manage_class_membership'),
        ('public', 'my_class_leaderboard'), ('public', 'my_membership'), ('public', 'social_class_card'), ('public', 'social_class_members_of'),
        ('public', 'social_learning_identities'), ('tva_private', 'can_read_class_curriculum'))
  -- lần chạy đầu lưu bản gốc; chạy lại (đã có bản lưu) không ghi đè bằng bản V1
  and not exists (select 1 from tva_private.ccm_v1_backup b where b.fn = n.nspname || '.' || p.proname);

-- ── 2) MỘT lớp → MỘT nhóm: group_id luôn = cohort_group_id ────────────────────────────────────────
create or replace function tva_private.class_schedule_sync_member_group() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- cohort_group_id là cột canonical; group_id là bản sao cho code cũ (Lịch lớp, admin-ai, link Zalo).
  if tg_op = 'INSERT' then
    if new.cohort_group_id is null then new.cohort_group_id := new.group_id;
    elsif new.group_id is null then new.group_id := new.cohort_group_id; end if;
  elsif new.cohort_group_id is distinct from old.cohort_group_id then
    new.group_id := new.cohort_group_id;
  elsif new.group_id is distinct from old.group_id then
    new.cohort_group_id := new.group_id;
  end if;
  return new;
end $$;
revoke all on function tva_private.class_schedule_sync_member_group() from public, anon, authenticated;
drop trigger if exists class_schedule_sync_member_group on public.class_schedule;
create trigger class_schedule_sync_member_group before insert or update of group_id, cohort_group_id on public.class_schedule
  for each row execute function tva_private.class_schedule_sync_member_group();
alter table public.class_schedule drop constraint if exists class_schedule_one_member_group;
alter table public.class_schedule add constraint class_schedule_one_member_group check (group_id is not distinct from cohort_group_id);
create index if not exists class_schedule_cohort_group_idx on public.class_schedule (cohort_group_id);
create index if not exists edu_group_members_group_active_idx on public.edu_group_members (group_id) where status = 'active';

-- ── 3) ĐỊNH NGHĨA DUY NHẤT của thành viên lớp ──────────────────────────────────────────────────────
create or replace view tva_private.class_memberships as
  select cs.id as class_id, gm.group_id, gm.user_id, gm.source, gm.created_at as joined_at
  from public.class_schedule cs
  join public.edu_group_members gm on gm.group_id = cs.cohort_group_id and gm.status = 'active';
revoke all on tva_private.class_memberships from public, anon, authenticated;
comment on view tva_private.class_memberships is
  'CLASS MEMBERSHIP SOURCE OF TRUTH: class_schedule.cohort_group_id -> edu_group_members(active). Không name/code match, ht_member, lead.';

-- Sĩ số học sinh (không tính Thầy/Admin) — Social, Admin, App dùng chung một con số.
create or replace function tva_private.class_student_count(p_class uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from tva_private.class_memberships m
  where m.class_id = p_class
    and not exists (select 1 from public.app_users a where a.id = m.user_id and a.role in ('teacher', 'admin'));
$$;
revoke all on function tva_private.class_student_count(uuid) from public, anon, authenticated;

-- ── 4) Consumer: Social ───────────────────────────────────────────────────────────────────────────
create or replace function public.social_class_members_of(p_class uuid)
 returns table(user_id uuid) language sql stable security definer set search_path to '' as $$
  select m.user_id from tva_private.class_memberships m where m.class_id = p_class;
$$;

create or replace function public.social_class_card(p_class uuid)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'id', cs.id, 'code', cs.code, 'name', cs.name, 'status', cs.status, 'program_code', cs.program_code,
    'stage', cs.stage, 'start_date', cs.start_date, 'end_date', cs.end_date, 'schedule', cs.schedule,
    'course', (select jsonb_build_object('code', c.code, 'name', c.name, 'track', c.track)
               from public.edu_courses c where c.id = cs.main_course_id),
    'member_count', tva_private.class_student_count(cs.id),
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

-- ── 5) Consumer: Learning Identity (current / upcoming / graduated giữ nguyên ở client) ──────────────
create or replace function public.social_learning_identities(p_users uuid[])
 returns table(user_id uuid, memberships jsonb) language sql stable security definer set search_path to '' as $$
  with u as (
    select distinct x as uid
    from unnest((coalesce(p_users, '{}'::uuid[]))[1:200]) x
    where x is not null and public.is_class_member()
      and not exists (select 1 from public.app_users a where a.id = x and a.role in ('teacher', 'admin'))
  ),
  m as (   -- luật canonical: tva_private.class_memberships
    select cm.user_id as uid, cm.class_id
    from u
    join tva_private.class_memberships cm on cm.user_id = u.uid
    join public.class_schedule cs on cs.id = cm.class_id
    where cs.status in ('active', 'ending_soon', 'paused', 'recruiting', 'ready_to_open', 'scheduled', 'upcoming', 'completed')
  )
  select u.uid,
         coalesce(jsonb_agg(jsonb_build_object(
           'class_id', cs.id, 'class_code', cs.code, 'class_name', cs.name, 'status', cs.status,
           'program_code', cs.program_code, 'start_date', cs.start_date, 'end_date', cs.end_date,
           'course_code', c.code, 'course_name', c.name, 'track', c.track)
           order by cs.start_date desc nulls last, cs.id) filter (where cs.id is not null), '[]'::jsonb)
  from u
  left join m on m.uid = u.uid
  left join public.class_schedule cs on cs.id = m.class_id
  left join public.edu_courses c on c.id = cs.main_course_id
  group by u.uid;
$$;

-- ── 6) Consumer: Learning Thread — chỉ thread MỚI; identity thread cũ không bị viết lại ─────────────
create or replace function public.lt_identity_snapshot(p_lesson_id uuid)
 returns jsonb language sql stable security definer set search_path to '' as $$
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
    from l cross join today
    cross join tva_private.class_memberships cm
    join public.class_schedule cs on cs.id = cm.class_id
    left join lateral (
      select s.* from public.class_stages s
      where s.class_id = cs.id and s.course_id = l.course_id
      order by (today.d between coalesce(s.starts_on, '-infinity'::date) and coalesce(s.ends_on, 'infinity'::date)) desc,
               s.stage_no
      limit 1
    ) stg on true
    where cm.user_id = auth.uid()
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

-- ── 7) Consumer: Giáo trình — membership canonical ∧ quyền Giáo trình (lớp quyền riêng) ─────────────
create or replace function tva_private.can_read_class_curriculum(p_class_id uuid)
 returns boolean language sql stable security definer set search_path to '' as $$
  select auth.uid() is not null and exists (
    select 1 from tva_private.class_memberships m
    join public.class_curriculum_access a on a.class_id = m.class_id and a.user_id = m.user_id and a.status = 'active'
    where m.class_id = p_class_id and m.user_id = auth.uid());
$$;

create or replace function public.manage_class_curriculum_access(p_class_id uuid, p_user_id uuid, p_action text)
 returns text language plpgsql security definer set search_path to '' as $$
declare v_actor uuid := auth.uid(); v_status text;
begin
  if v_actor is null or not public.is_teacher() then
    raise exception 'teacher/admin required' using errcode = '42501';
  end if;
  if p_action not in ('grant', 'revoke') or p_class_id is null or p_user_id is null then
    raise exception 'invalid curriculum access action';
  end if;
  perform 1 from public.class_schedule where id = p_class_id for share;
  if not found then raise exception 'class not found'; end if;
  if p_action = 'grant' then
    if not exists (select 1 from tva_private.class_memberships m where m.class_id = p_class_id and m.user_id = p_user_id) then
      raise exception 'active class membership required';
    end if;
    if not exists (select 1 from public.edu_students s where s.user_id = p_user_id and s.is_active = true) then
      raise exception 'active student account required';
    end if;
    insert into public.class_curriculum_access (class_id, user_id, status, granted_at, granted_by)
    values (p_class_id, p_user_id, 'active', now(), v_actor)
    on conflict (class_id, user_id) do update set
      status = 'active', granted_at = now(), granted_by = v_actor, revoked_at = null, revoked_by = null, updated_at = now()
    where class_curriculum_access.status <> 'active';
    return 'active';
  end if;
  update public.class_curriculum_access set status = 'revoked', revoked_at = now(), revoked_by = v_actor, updated_at = now()
  where class_id = p_class_id and user_id = p_user_id and status = 'active';
  select status into v_status from public.class_curriculum_access where class_id = p_class_id and user_id = p_user_id;
  return coalesce(v_status, 'not_granted');
end $$;

-- ── 8) Đường GHI thành viên: mọi lối vào lớp đều ghi vào nhóm canonical ──────────────────────────────
create or replace function public.manage_class_membership(p_class_id uuid, p_user_id uuid, p_action text)
 returns text language plpgsql security definer set search_path to '' as $$
declare v_actor uuid := auth.uid(); v_group uuid; v_cls_status text; v_status text;
begin
  if v_actor is null or not public.is_teacher() then
    raise exception 'teacher/admin required' using errcode = '42501';
  end if;
  if p_action not in ('add', 'remove') or p_class_id is null or p_user_id is null then
    raise exception 'invalid class membership action';
  end if;
  select c.cohort_group_id, c.status into v_group, v_cls_status from public.class_schedule c where c.id = p_class_id for share;
  if not found then raise exception 'class not found'; end if;
  if v_group is null then raise exception 'class has no member group'; end if;
  if p_action = 'add' then
    if coalesce(v_cls_status, '') in ('cancelled', 'merged') then raise exception 'class is closed'; end if;
    if not exists (select 1 from public.edu_students s where s.user_id = p_user_id and s.is_active = true) then
      raise exception 'active student account required';
    end if;
    insert into public.edu_group_members (group_id, user_id, source, status)
    values (v_group, p_user_id, 'admin', 'active')
    on conflict (user_id, group_id) do update set status = 'active', source = 'admin'
    where edu_group_members.status <> 'active';
    return 'active';
  end if;
  update public.edu_group_members set status = 'removed' where group_id = v_group and user_id = p_user_id and status = 'active';
  select status into v_status from public.edu_group_members where group_id = v_group and user_id = p_user_id;
  return coalesce(v_status, 'not_member');
end $$;

create or replace function public.activate_class_membership(p_lead bigint)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_lead public.leads; v_plan text; v_code text; v_cls public.class_schedule; v_pkg public.packages;
  v_course text; v_uid uuid; v_req uuid; v_sp bigint; v_old public.student_packages; v_done boolean := false;
begin
  if not coalesce(public.is_teacher(), false) then raise exception 'Chỉ Thầy/Admin được kích hoạt'; end if;
  select * into v_lead from public.leads where id = p_lead for update;
  if v_lead.id is null then raise exception 'Không tìm thấy đăng ký #%', p_lead; end if;
  if v_lead.student_id is null then raise exception 'Đăng ký chưa gắn tài khoản học viên'; end if;
  v_plan := (regexp_match(coalesce(v_lead.note, ''), '\[plan:(monthly|six_month)\]'))[1];
  if v_plan is null then raise exception 'Đăng ký không có [plan:…] — không thuộc mô hình membership mới'; end if;
  v_code := upper((regexp_match(coalesce(v_lead.class_name, ''), '·\s*([A-Za-z0-9]+\.[A-Za-z0-9]+)\s*$'))[1]);
  if v_code is null then raise exception 'Không đọc được mã lớp trong đăng ký'; end if;
  select * into v_cls from public.class_schedule where upper(code) = v_code limit 1;
  if v_cls.id is null or v_cls.public_product is null then raise exception 'Lớp % không thuộc mô hình tuyển sinh mới', v_code; end if;
  if v_cls.cohort_group_id is null then raise exception 'Lớp % chưa có nhóm thành viên', v_code; end if;
  -- 09/2026: khoá của CHẶNG đang học (class_stages), lùi về khoá chính nếu lớp chưa khai báo chặng
  select code into v_course from public.edu_courses where id = public.class_current_course(v_cls.id);
  if v_course is null then raise exception 'Lớp % chưa có khoá cho chặng hiện tại', v_code; end if;
  select * into strict v_pkg from public.packages
   where package_code = case v_plan when 'monthly' then 'CLASS_MONTHLY' else 'CLASS_SIXMONTH' end and status = 'active';
  select user_id into v_uid from public.edu_students where id = v_lead.student_id;
  if v_uid is null then raise exception 'Học viên chưa có tài khoản đăng nhập'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_lead.student_id::text, 0));
  v_req := md5('class-membership:lead:' || p_lead)::uuid;
  select id into v_sp from public.student_packages
   where student_id = v_lead.student_id and external_transaction_id = 'admin-request:' || v_req;
  if v_sp is not null then
    v_done := true;
  else
    select * into v_old from public.student_packages
     where student_id = v_lead.student_id and package_id = v_pkg.id and status = 'active' and entitlement_id is null
     order by renews_at desc nulls last limit 1;
    if v_old.id is null then
      v_sp := public.manage_student_package(v_lead.student_id, 'grant', v_pkg.id, null, null, 'admin', array[v_course], v_req);
    else
      v_sp := public.manage_student_package(v_lead.student_id, 'renew', null, v_old.id, null, 'admin',
        array(select distinct unnest(coalesce(v_old.granted_course_codes, '{}') || array[v_course])), v_req);
    end if;
  end if;

  -- Vào NHÓM THÀNH VIÊN CANONICAL của lớp (cohort_group_id) — cùng nhóm App/Admin/Social đọc.
  insert into public.edu_group_members (user_id, group_id, source, status)
  values (v_uid, v_cls.cohort_group_id, 'membership', 'active')
  on conflict (user_id, group_id) do update set status = 'active';

  update public.leads set status = 'Đã đóng phí' where id = p_lead and status is distinct from 'Đã đóng phí';

  return jsonb_build_object(
    'already_done', v_done, 'student_package_id', v_sp, 'package_code', v_pkg.package_code, 'plan', v_plan,
    'class_code', v_cls.code, 'course_code', v_course,
    'renews_at', (select renews_at from public.student_packages where id = v_sp),
    'granted_codes', (select to_jsonb(granted_course_codes) from public.student_packages where id = v_sp),
    'zalo_url', (select zalo_url from public.edu_groups where id = v_cls.cohort_group_id));
end $$;

-- ── 9) Trigger cấp khoá: vào nhóm canonical của lớp → cấp course_ids của CHÍNH lớp đó ────────────────
create or replace function public.grant_class_courses_on_join()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare sid uuid; r record; cid uuid;
begin
  if new.status <> 'active' then return new; end if;
  select id into sid from public.edu_students where user_id = new.user_id limit 1;
  if sid is null then return new; end if;                                       -- chưa có hồ sơ học sinh
  for r in select cs.code, cs.course_ids from public.class_schedule cs
           where cs.cohort_group_id = new.group_id and coalesce(array_length(cs.course_ids, 1), 0) > 0 loop
    foreach cid in array r.course_ids loop
      insert into public.edu_enrollments (student_id, course_id, is_active, enrolled_by)
        values (sid, cid, true, new.user_id)
        on conflict (student_id, course_id) do update set is_active = true;
      insert into public.edu_course_access (student_id, course_id, active, note)
        values (sid, cid, true, 'Vào lớp ' || r.code)
        on conflict (student_id, course_id) do update set active = true;
    end loop;
  end loop;
  return new;
end $$;

create or replace function public.backfill_class(p_code text)
 returns integer language plpgsql security definer set search_path to '' as $$
declare r record; n int := 0; k int;
begin
  if not (coalesce(public.is_teacher(), false) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'teacher/admin required' using errcode = '42501';
  end if;
  -- p_code = mã lớp, hoặc mã của nhóm canonical (admin-ai gửi mã nhóm). Thành viên: luật canonical.
  for r in select cs.id, cs.code, cs.course_ids from public.class_schedule cs
           where coalesce(array_length(cs.course_ids, 1), 0) > 0
             and (cs.code = p_code or cs.cohort_group_id in (select g.id from public.edu_groups g where g.code = p_code)) loop
    insert into public.edu_enrollments (student_id, course_id, is_active)
    select s.id, cid, true
    from tva_private.class_memberships m
    join public.edu_students s on s.user_id = m.user_id
    cross join unnest(r.course_ids) as cid
    where m.class_id = r.id
    on conflict (student_id, course_id) do update set is_active = true;

    insert into public.edu_course_access (student_id, course_id, active, note)
    select s.id, cid, true, 'Vào lớp ' || r.code
    from tva_private.class_memberships m
    join public.edu_students s on s.user_id = m.user_id
    cross join unnest(r.course_ids) as cid
    where m.class_id = r.id
    on conflict (student_id, course_id) do update set active = true;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
revoke all on function public.backfill_class(text) from public, anon;
grant execute on function public.backfill_class(text) to authenticated, service_role;

-- ── 10) Consumer: Quyền lợi membership (my_membership.classes) ──────────────────────────────────────
create or replace function public.my_membership(p_student uuid default null::uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_sid uuid; v_uid uuid; v_teacher boolean := coalesce(public.is_teacher(), false);
  v_tier text := 'free'; v_tier_idx int; v_m record; v_valid boolean := false; v_plan_benefits jsonb := '[]';
  v_classes jsonb; v_benefits jsonb; v_history jsonb; v_membership jsonb := null;
  tiers constant text[] := array['free', 'khoi_dau_99', 'can_ban_396', 'nang_cao_499'];
begin
  if p_student is null then
    select id, user_id into v_sid, v_uid from public.edu_students where user_id = auth.uid() limit 1;
    if v_sid is null then return jsonb_build_object('student_id', null, 'membership', null); end if;
  else
    select id, user_id into v_sid, v_uid from public.edu_students where id = p_student;
    if v_sid is null then raise exception 'Không tìm thấy học viên'; end if;
    if not v_teacher and v_uid is distinct from auth.uid() then raise exception 'Không được xem quyền lợi của học viên khác'; end if;
  end if;

  -- Tier App thật (Store + gói + legacy) — cùng resolver với my_learning_state.
  select e.effective_tier into v_tier from public.get_effective_student_entitlement(v_sid) e;
  v_tier := coalesce(v_tier, 'free');
  v_tier_idx := coalesce(array_position(tiers, v_tier), 1) - 1;

  -- Membership = gói có config.plan (không phải gói Store). Ưu tiên gói đang hiệu lực,
  -- rồi six_month > monthly, rồi hạn xa hơn; không có gói hiệu lực → gói gần nhất (để hiện "đã hết hạn").
  select sp.*, p.package_code, p.name as pkg_name, p.config
    into v_m
    from public.student_packages sp join public.packages p on p.id = sp.package_id
   where sp.student_id = v_sid and p.config ? 'plan' and sp.entitlement_id is null
     and sp.status in ('active', 'trialing', 'expired', 'cancelled')
   order by public.package_term_valid(sp.status, sp.starts_at, sp.renews_at) desc,
            (p.config->>'plan' = 'six_month') desc, sp.renews_at desc nulls last, sp.starts_at desc
   limit 1;

  if v_m.id is not null then
    v_valid := public.package_term_valid(v_m.status, v_m.starts_at, v_m.renews_at);
    -- Quyền lợi vận hành theo plan: gói tự khai báo, thiếu thì lấy gói lớp chuẩn cùng plan.
    v_plan_benefits := coalesce(v_m.config->'benefits',
      (select p2.config->'benefits' from public.packages p2
        where p2.package_code in ('CLASS_MONTHLY', 'CLASS_SIXMONTH') and p2.config->>'plan' = v_m.config->>'plan'), '[]');
    v_membership := jsonb_build_object(
      'plan', v_m.config->>'plan',
      'label', coalesce(v_m.config->>'plan_label', v_m.pkg_name),
      'package_code', v_m.package_code,
      'status', case when v_valid then 'active'
                     when v_m.status in ('cancelled') then 'cancelled'
                     when v_m.starts_at > now() then 'scheduled'
                     else 'expired' end,
      'starts_at', v_m.starts_at,
      'ends_at', v_m.renews_at,
      'days_left', case when v_valid and v_m.renews_at is not null
                        then ceil(extract(epoch from (v_m.renews_at - now())) / 86400)::int end,
      'source', v_m.source,
      'renewal', case when coalesce(v_m.auto_renew, false) then 'auto' else 'manual' end,
      'course_codes', to_jsonb(coalesce(v_m.granted_course_codes, '{}'))
    );
  end if;

  -- Lớp đang theo: thành viên canonical (tva_private.class_memberships), lớp chưa huỷ/kết thúc.
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', c.code, 'name', c.name, 'public_product', c.public_product,
           'schedule', c.schedule, 'start_date', c.start_date, 'end_date', c.end_date,
           'next_session', (select jsonb_build_object('number', s.session_number, 'start_at', s.start_at, 'end_at', s.end_at)
                              from public.class_sessions s
                             where s.class_id = c.id and s.event_type = 'lesson' and s.status = 'scheduled' and s.end_at > now()
                             order by s.start_at limit 1))
         order by c.start_date nulls last), '[]')
    into v_classes
    from tva_private.class_memberships cm
    join public.class_schedule c on c.id = cm.class_id
   where cm.user_id = v_uid
     and coalesce(c.status, '') not in ('cancelled', 'merged', 'completed');

  select coalesce(jsonb_agg(jsonb_build_object(
           'key', b.key, 'label', b.label, 'kind', b.kind, 'note', b.note,
           'in_plan', v_plan_benefits ? b.key,
           'active', case b.kind
               when 'tier'    then v_tier_idx >= array_position(tiers, b.min_tier) - 1
               when 'package' then v_valid and coalesce(array_length(v_m.granted_course_codes, 1), 0) > 0
               when 'class'   then v_valid and jsonb_array_length(v_classes) > 0
               when 'plan'    then v_valid and v_plan_benefits ? b.key
             end,
           'reason', b.kind)
         order by b.sort_order), '[]')
    into v_benefits
    from public.membership_benefits b;

  select coalesce(jsonb_agg(jsonb_build_object(
           'package_code', p.package_code, 'plan', p.config->>'plan',
           'label', coalesce(p.config->>'plan_label', p.name), 'status', sp.status,
           'starts_at', sp.starts_at, 'ends_at', sp.renews_at, 'source', sp.source)
         order by sp.starts_at desc), '[]')
    into v_history
    from (select * from public.student_packages where student_id = v_sid and entitlement_id is null
          order by starts_at desc limit 12) sp
    join public.packages p on p.id = sp.package_id
   where p.config ? 'plan';

  return jsonb_build_object(
    'student_id', v_sid,
    'membership', v_membership,
    'classes', v_classes,
    'app_tier', v_tier,
    'benefits', v_benefits,
    'history', v_history,
    'generated_at', now());
end $$;

-- ── 11) Consumer: bảng xếp hạng lớp (bạn cùng LỚP canonical, gộp nhiều lớp) ─────────────────────────
create or replace function public.my_class_leaderboard()
 returns table(student_id uuid, name text, avatar_url text, xp bigint) language sql stable security definer set search_path to '' as $$
  with my_classes as (
    select m.class_id from tva_private.class_memberships m where m.user_id = auth.uid()
  ),
  classmates as (
    select distinct m.user_id
    from tva_private.class_memberships m
    join my_classes mc on mc.class_id = m.class_id
    union
    select auth.uid()                      -- luôn gồm chính mình (kể cả chưa vào lớp nào)
  ),
  cm_students as (
    select s.id,
           coalesce(nullif(trim(s.display_name), ''), s.full_name, 'Học viên') as name,
           s.avatar_url
    from public.edu_students s
    join classmates c on c.user_id = s.user_id
  )
  select cs.id, cs.name, cs.avatar_url,
         coalesce((select sum(x.xp) from public.student_xp_log x where x.student_id = cs.id), 0)::bigint as xp
  from cm_students cs
  order by xp desc;
$$;

-- ── 12) RPC mới: App + Admin đọc CÙNG nguồn ──────────────────────────────────────────────────────
-- App "Lớp đang học" / Social: lớp của tôi (canonical), bỏ lớp huỷ/gộp/nháp — cùng bộ lọc social_my_classes.
create or replace function public.my_class_memberships()
 returns table(class_id uuid, joined_at timestamptz) language sql stable security definer set search_path to '' as $$
  select m.class_id, m.joined_at
  from tva_private.class_memberships m
  join public.class_schedule cs on cs.id = m.class_id
  where m.user_id = auth.uid() and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft');
$$;

-- Admin → Lịch lớp: nhóm canonical + sĩ số + số người bật Giáo trình của MỌI lớp.
create or replace function public.admin_class_member_summary()
 returns table(class_id uuid, group_id uuid, group_name text, group_code text, group_type text, group_active boolean,
               zalo_url text, member_count int, curriculum_access_count int)
 language plpgsql stable security definer set search_path to '' as $$
begin
  if auth.uid() is null or not public.is_teacher() then raise exception 'teacher/admin required' using errcode = '42501'; end if;
  return query
  select cs.id, g.id, g.name, g.code, g.group_type, g.is_active, g.zalo_url,
         tva_private.class_student_count(cs.id),
         (select count(*)::int from public.class_curriculum_access a
           where a.class_id = cs.id and a.status = 'active'
             and exists (select 1 from tva_private.class_memberships m where m.class_id = cs.id and m.user_id = a.user_id))
  from public.class_schedule cs
  left join public.edu_groups g on g.id = cs.cohort_group_id;
end $$;

-- Admin → Lớp học: danh sách thành viên của nhóm canonical (cả người đã bỏ, để thêm lại) + quyền Giáo trình.
create or replace function public.class_roster(p_class uuid)
 returns table(user_id uuid, status text, source text, joined_at timestamptz, updated_at timestamptz,
               student_id uuid, name text, email text, student_active boolean, is_staff boolean, curriculum text)
 language plpgsql stable security definer set search_path to '' as $$
begin
  if auth.uid() is null or not public.is_teacher() then raise exception 'teacher/admin required' using errcode = '42501'; end if;
  return query
  select gm.user_id, gm.status, gm.source, gm.created_at, gm.updated_at,
         s.id, coalesce(nullif(btrim(s.display_name), ''), nullif(btrim(s.full_name), ''), s.email, 'Học viên'), s.email, s.is_active,
         exists (select 1 from public.app_users a where a.id = gm.user_id and a.role in ('teacher', 'admin')),
         coalesce((select a.status from public.class_curriculum_access a where a.class_id = cs.id and a.user_id = gm.user_id), 'not_granted')
  from public.class_schedule cs
  join public.edu_group_members gm on gm.group_id = cs.cohort_group_id
  left join lateral (select es.* from public.edu_students es where es.user_id = gm.user_id
                     order by es.is_active desc, es.enrolled_at desc nulls last limit 1) s on true
  where cs.id = p_class
  order by (gm.status = 'active') desc, 7;
end $$;

-- ── 13) Quyền thực thi: RPC mới chỉ cho authenticated (default privileges Supabase mở cho anon) ───────
revoke all on function public.my_class_memberships() from public, anon;
revoke all on function public.admin_class_member_summary() from public, anon;
revoke all on function public.class_roster(uuid) from public, anon;
grant execute on function public.my_class_memberships() to authenticated;
grant execute on function public.admin_class_member_summary() to authenticated;
grant execute on function public.class_roster(uuid) to authenticated;

notify pgrst, 'reload schema';
