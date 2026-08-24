-- =====================================================================
-- GRANDFATHER AUDIT — READ ONLY
--
-- DUNG TRUOC KHI CHAY MIGRATION LEGACY 99 LIFETIME.
-- Sua cutoff o CTE params, chay trong Supabase SQL Editor.
-- Script nay CHI SELECT, KHONG GHI DU LIEU.
--
-- Production hien tai: edu_students khong co created_at, chi co enrolled_at.
-- Vi vay identity_created_at uu tien auth.users.created_at, fallback enrolled_at.
-- =====================================================================

with params as (
  select
    -- TODO: thay bang thoi diem cutoff da duoc Thay duyet.
    '2026-08-24 17:05:26.846028+00'::timestamptz as cutoff_at
),
base as (
  select
    s.*,
    u.created_at as auth_created_at,
    au.role,
    coalesce(u.created_at, s.enrolled_at::timestamptz) as identity_created_at
  from public.edu_students s
  left join auth.users u on u.id = s.user_id
  left join public.app_users au on au.id = s.user_id
),
flags as (
  select
    b.*,
    (
      lower(coalesce(b.email, '')) ~ '(test|example|demo|codex|entitlement|fake)'
      or lower(coalesce(b.full_name, '')) ~ '(test|demo|codex|entitlement|fake)'
      or coalesce(b.email, '') like '%@example.%'
      or coalesce(b.email, '') like '%@example.test'
    ) as looks_test
  from base b
),
eligible as (
  select f.*
  from flags f, params p
  where f.identity_created_at < p.cutoff_at
    and not f.looks_test
    and coalesce(f.role, 'student') not in ('teacher', 'admin')
)
select 'cutoff_at' as metric, cutoff_at::text as value from params
union all
select 'cutoff_at_vn', (cutoff_at at time zone 'Asia/Ho_Chi_Minh')::text from params
union all
select 'total_edu_students', count(*)::text from flags
union all
select 'students_before_cutoff', count(*)::text from flags, params where identity_created_at < cutoff_at
union all
select 'students_after_cutoff', count(*)::text from flags, params where identity_created_at >= cutoff_at
union all
select 'excluded_suspected_test', count(*)::text from flags, params where identity_created_at < cutoff_at and looks_test
union all
select 'excluded_teacher_admin', count(*)::text from flags, params where identity_created_at < cutoff_at and coalesce(role, 'student') in ('teacher', 'admin')
union all
select 'final_grandfather_cohort', count(*)::text from eligible
union all
select 'eligible_without_user_id', count(*)::text from eligible where user_id is null
union all
select 'eligible_with_existing_course_access', count(distinct e.id)::text
  from eligible e join public.edu_course_access a on a.student_id = e.id and a.active
union all
select 'eligible_with_active_enrollment', count(distinct e.id)::text
  from eligible e join public.edu_enrollments en on en.student_id = e.id and en.is_active
union all
select 'eligible_with_active_student_package', count(distinct e.id)::text
  from eligible e join public.student_packages sp on sp.student_id = e.id and sp.status = 'active';

-- Edge cases can xem bang mat:
-- 1) hoc vien truoc cutoff nhung thieu user_id.
select id, left(coalesce(full_name, ''), 2) as name_hint, enrolled_at, auth_created_at
from eligible
where user_id is null
order by identity_created_at
limit 50;

-- 2) nghi test account truoc cutoff, hash email de khong in PII.
select id, encode(sha256(coalesce(email, '')::bytea), 'hex') as email_hash,
       left(coalesce(full_name, ''), 2) as name_hint,
       enrolled_at, auth_created_at
from flags, params
where identity_created_at < cutoff_at and looks_test
order by identity_created_at
limit 50;
