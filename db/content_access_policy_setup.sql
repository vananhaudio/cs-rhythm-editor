-- =====================================================================
-- CONTENT ACCESS POLICY — Admin-managed course/lesson access
-- Project: Thay Van Anh Guitar / Class 2.0
--
-- MUC DICH
--   Admin la source of truth cho:
--   - noi dung hien/an
--   - trang thai dang mo/sap co
--   - tier can co de hoc
--   - bai hoc inherit tu khoa hay override rieng
--
-- NGUYEN TAC AN TOAN
--   - Additive + idempotent.
--   - KHONG tu phan loai khoa/bai production vao tier nao.
--   - access_policy_enabled default false => app tiep tuc dung behavior cu
--     (edu_courses.status/is_free + edu_course_lessons.tier) cho den khi Admin
--     bat policy moi tren tung khoa.
--   - KHONG dung gia tien lam logic.
-- =====================================================================

alter table public.edu_courses
  add column if not exists access_policy_enabled boolean not null default false,
  add column if not exists required_tier text not null default 'free',
  add column if not exists visibility text not null default 'visible',
  add column if not exists availability text not null default 'available',
  add column if not exists allow_preview boolean not null default false;

alter table public.edu_course_lessons
  add column if not exists access_policy_mode text not null default 'inherit',
  add column if not exists required_tier text,
  add column if not exists visibility text,
  add column if not exists availability text,
  add column if not exists allow_preview boolean;

do $$
begin
  alter table public.edu_courses
    add constraint edu_courses_required_tier_chk
    check (required_tier in ('free','khoi_dau_99','can_ban_396','nang_cao_499'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.edu_courses
    add constraint edu_courses_visibility_chk
    check (visibility in ('visible','hidden'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.edu_courses
    add constraint edu_courses_availability_chk
    check (availability in ('available','coming_soon'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.edu_course_lessons
    add constraint edu_course_lessons_policy_mode_chk
    check (access_policy_mode in ('inherit','override'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.edu_course_lessons
    add constraint edu_course_lessons_required_tier_chk
    check (required_tier is null or required_tier in ('free','khoi_dau_99','can_ban_396','nang_cao_499'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.edu_course_lessons
    add constraint edu_course_lessons_visibility_chk
    check (visibility is null or visibility in ('visible','hidden'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.edu_course_lessons
    add constraint edu_course_lessons_availability_chk
    check (availability is null or availability in ('available','coming_soon'));
exception when duplicate_object then null;
end $$;

create index if not exists edu_courses_content_policy_idx
  on public.edu_courses (access_policy_enabled, visibility, availability, required_tier, sort_order);

create index if not exists edu_course_lessons_content_policy_idx
  on public.edu_course_lessons (access_policy_mode, visibility, availability, required_tier, order_index);

-- ---------------------------------------------------------------------
-- RLS hardening cho bang noi dung hoc.
--
-- Truoc day db/rls_setup.sql cho authenticated FOR ALL tren cac bang noi dung.
-- Dieu do du de hoc vien tu sua policy neu biet API. Tu buoc nay:
--   - anon/authenticated duoc SELECT noi dung visible theo policy.
--   - teacher/admin doc tat ca va ghi.
--   - behavior cu van giu: course chua bat policy moi thi status='off' an,
--     coming_soon van doc de hien card sap co, is_free/tier cu van do app resolve.
-- ---------------------------------------------------------------------

alter table public.edu_courses enable row level security;
alter table public.edu_modules enable row level security;
alter table public.edu_course_lessons enable row level security;

revoke insert, update, delete on public.edu_courses from anon;
revoke insert, update, delete on public.edu_modules from anon;
revoke insert, update, delete on public.edu_course_lessons from anon;
grant select on public.edu_courses to anon, authenticated;
grant select on public.edu_modules to anon, authenticated;
grant select on public.edu_course_lessons to anon, authenticated;
grant insert, update, delete on public.edu_courses to authenticated;
grant insert, update, delete on public.edu_modules to authenticated;
grant insert, update, delete on public.edu_course_lessons to authenticated;

drop policy if exists rls_anon_select on public.edu_courses;
drop policy if exists rls_authenticated_all on public.edu_courses;
drop policy if exists content_courses_anon_select on public.edu_courses;
drop policy if exists content_courses_auth_select on public.edu_courses;
drop policy if exists content_courses_select on public.edu_courses;
drop policy if exists content_courses_teacher_write on public.edu_courses;

create policy content_courses_anon_select on public.edu_courses
  for select to anon
  using (
    case
      when access_policy_enabled then visibility = 'visible'
      else coalesce(status, 'on') <> 'off'
    end
  );

create policy content_courses_auth_select on public.edu_courses
  for select to authenticated
  using (
    public.is_teacher()
    or (
      case
        when access_policy_enabled then visibility = 'visible'
        else coalesce(status, 'on') <> 'off'
      end
    )
  );

create policy content_courses_teacher_write on public.edu_courses
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists rls_anon_select on public.edu_modules;
drop policy if exists rls_authenticated_all on public.edu_modules;
drop policy if exists content_modules_anon_select on public.edu_modules;
drop policy if exists content_modules_auth_select on public.edu_modules;
drop policy if exists content_modules_select on public.edu_modules;
drop policy if exists content_modules_teacher_write on public.edu_modules;

create policy content_modules_anon_select on public.edu_modules
  for select to anon
  using (
    exists (
      select 1 from public.edu_courses c
      where c.id = edu_modules.course_id
        and (
          case
            when c.access_policy_enabled then c.visibility = 'visible'
            else coalesce(c.status, 'on') <> 'off'
          end
        )
    )
  );

create policy content_modules_auth_select on public.edu_modules
  for select to authenticated
  using (
    public.is_teacher()
    or exists (
      select 1 from public.edu_courses c
      where c.id = edu_modules.course_id
        and (
          case
            when c.access_policy_enabled then c.visibility = 'visible'
            else coalesce(c.status, 'on') <> 'off'
          end
        )
    )
  );

create policy content_modules_teacher_write on public.edu_modules
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists rls_anon_select on public.edu_course_lessons;
drop policy if exists rls_authenticated_all on public.edu_course_lessons;
drop policy if exists content_lessons_anon_select on public.edu_course_lessons;
drop policy if exists content_lessons_auth_select on public.edu_course_lessons;
drop policy if exists content_lessons_select on public.edu_course_lessons;
drop policy if exists content_lessons_teacher_write on public.edu_course_lessons;

create policy content_lessons_anon_select on public.edu_course_lessons
  for select to anon
  using (
    exists (
      select 1
      from public.edu_modules m
      join public.edu_courses c on c.id = m.course_id
      where m.id = edu_course_lessons.module_id
        and (
          case
            when c.access_policy_enabled then
              c.visibility = 'visible'
              and (
                edu_course_lessons.access_policy_mode <> 'override'
                or coalesce(edu_course_lessons.visibility, 'visible') = 'visible'
              )
            else coalesce(c.status, 'on') <> 'off'
          end
        )
    )
  );

create policy content_lessons_auth_select on public.edu_course_lessons
  for select to authenticated
  using (
    public.is_teacher()
    or exists (
      select 1
      from public.edu_modules m
      join public.edu_courses c on c.id = m.course_id
      where m.id = edu_course_lessons.module_id
        and (
          case
            when c.access_policy_enabled then
              c.visibility = 'visible'
              and (
                edu_course_lessons.access_policy_mode <> 'override'
                or coalesce(edu_course_lessons.visibility, 'visible') = 'visible'
              )
            else coalesce(c.status, 'on') <> 'off'
          end
        )
    )
  );

create policy content_lessons_teacher_write on public.edu_course_lessons
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

notify pgrst, 'reload schema';
