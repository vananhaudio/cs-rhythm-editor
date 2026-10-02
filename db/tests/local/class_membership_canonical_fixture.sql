-- Fixture CLASS MEMBERSHIP CANONICAL V1 cho cluster PostgreSQL TẠM. KHÔNG chạy production.
-- Nạp SAU social_fixture + Social + learning_threads_fixture + P1/P2/Lớp học V1/Feed V1 + Lớp của tôi V1 + Identity V1.
-- Bổ sung bảng tối thiểu (gói, đăng ký, quyền khoá, XP) và bản TRƯỚC V1 của các hàm membership chưa có trong repo
-- (thân hàm mô phỏng đúng LUẬT production 02/10: cohort CLASS.<mã> / trùng mã / group_id). md5 cổng được thay khi test.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

-- production: authenticated có USAGE trên tva_private (hàm can_read_class_curriculum gọi từ policy)
grant usage on schema tva_private to authenticated;

create table if not exists public.edu_enrollments (
  id bigserial primary key, student_id uuid not null, course_id uuid not null, is_active boolean default true, enrolled_by uuid,
  unique (student_id, course_id));
create table if not exists public.edu_course_access (
  id bigserial primary key, student_id uuid not null, course_id uuid not null, active boolean default true, note text,
  unique (student_id, course_id));
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(), package_code text unique, name text, status text default 'active', config jsonb default '{}');
create table if not exists public.student_packages (
  id bigserial primary key, student_id uuid, package_id uuid, status text, starts_at timestamptz default now(), renews_at timestamptz,
  source text, auto_renew boolean, external_transaction_id text, granted_course_codes text[], entitlement_id uuid);
create table if not exists public.leads (
  id bigserial primary key, student_id uuid, note text, class_name text, status text);
create table if not exists public.membership_benefits (
  key text primary key, label text, kind text, note text, min_tier text, sort_order int default 0);
create table if not exists public.student_xp_log (id bigserial primary key, student_id uuid, xp int);
alter table public.class_schedule add column if not exists public_product text;
-- production: edu_group_members có updated_at/updated_by (trigger touch)
alter table public.edu_group_members add column if not exists updated_at timestamptz default now(),
  add column if not exists updated_by uuid;

create or replace function public.has_course_access(p_student uuid, p_course uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.edu_course_access a where a.student_id = p_student and a.course_id = p_course and a.active) $$;
create or replace function public.class_current_course(p_class uuid) returns uuid language sql stable as $$
  select main_course_id from public.class_schedule where id = p_class $$;
create or replace function public.package_term_valid(p_status text, p_start timestamptz, p_end timestamptz) returns boolean
  language sql immutable as $$ select p_status = 'active' and (p_end is null or p_end > now()) $$;
create or replace function public.get_effective_student_entitlement(p_student uuid) returns table(effective_tier text)
  language sql stable as $$ select 'free'::text $$;
create or replace function public.manage_student_package(p_student uuid, p_action text, p_package_id uuid default null, p_record_id bigint default null,
  p_months integer default null, p_source text default 'admin', p_course_codes text[] default null, p_request_id uuid default null)
  returns bigint language plpgsql as $$
declare v bigint; begin
  insert into public.student_packages (student_id, package_id, status, source, external_transaction_id, granted_course_codes, renews_at)
  values (p_student, p_package_id, 'active', p_source, 'admin-request:' || p_request_id, p_course_codes, now() + interval '30 days') returning id into v;
  return v; end $$;

-- ── Bản TRƯỚC V1 (luật cũ) ──
CREATE OR REPLACE FUNCTION public.manage_class_membership(p_class_id uuid, p_user_id uuid, p_action text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_group uuid; v_code text; v_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_teacher() THEN RAISE EXCEPTION 'teacher/admin required' USING ERRCODE='42501'; END IF;
 SELECT c.cohort_group_id,c.code INTO v_group,v_code FROM public.class_schedule c WHERE c.id=p_class_id FOR SHARE;
 IF NOT FOUND OR v_code NOT IN ('SOLO01.TH01','HT2027.TH01') OR v_group IS NULL OR
    NOT EXISTS (SELECT 1 FROM public.edu_groups g WHERE g.id=v_group AND g.code='CLASS.' || v_code AND g.group_type='class') THEN
   RAISE EXCEPTION 'approved class/cohort mapping required';
 END IF;
 IF p_action='add' THEN
   INSERT INTO public.edu_group_members(group_id,user_id,source,status) VALUES (v_group,p_user_id,'admin','active')
   ON CONFLICT (user_id,group_id) DO UPDATE SET status='active',source='admin' WHERE edu_group_members.status <> 'active';
   RETURN 'active';
 END IF;
 UPDATE public.edu_group_members SET status='removed' WHERE group_id=v_group AND user_id=p_user_id AND status='active';
 SELECT status INTO v_status FROM public.edu_group_members WHERE group_id=v_group AND user_id=p_user_id;
 RETURN coalesce(v_status,'not_member');
END $function$;
CREATE OR REPLACE FUNCTION public.manage_class_curriculum_access(p_class_id uuid, p_user_id uuid, p_action text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_group uuid; v_code text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_teacher() THEN RAISE EXCEPTION 'teacher/admin required' USING ERRCODE='42501'; END IF;
 SELECT cohort_group_id,code INTO v_group,v_code FROM public.class_schedule WHERE id=p_class_id FOR SHARE;
 IF p_action='grant' THEN
   IF v_group IS NULL OR NOT EXISTS (SELECT 1 FROM public.edu_groups g WHERE g.id=v_group AND g.group_type='class' AND g.code='CLASS.' || v_code) THEN
     RAISE EXCEPTION 'active class membership required';
   END IF;
   INSERT INTO public.class_curriculum_access (class_id,user_id,status) VALUES (p_class_id,p_user_id,'active')
   ON CONFLICT (class_id,user_id) DO UPDATE SET status='active';
   RETURN 'active';
 END IF;
 UPDATE public.class_curriculum_access SET status='revoked' WHERE class_id=p_class_id AND user_id=p_user_id;
 RETURN 'revoked';
END $function$;
CREATE OR REPLACE FUNCTION public.grant_class_courses_on_join() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare sid uuid; gcode text; cids uuid[]; cid uuid;
begin
  if new.status <> 'active' then return new; end if;
  select code into gcode from public.edu_groups where id = new.group_id;
  if gcode is null then return new; end if;
  select course_ids into cids from public.class_schedule where code = gcode limit 1;
  if cids is null or array_length(cids, 1) is null then return new; end if;
  select id into sid from public.edu_students where user_id = new.user_id limit 1;
  if sid is null then return new; end if;
  foreach cid in array cids loop
    insert into public.edu_enrollments (student_id, course_id, is_active, enrolled_by) values (sid, cid, true, new.user_id)
      on conflict (student_id, course_id) do update set is_active = true;
    insert into public.edu_course_access (student_id, course_id, active, note) values (sid, cid, true, 'Vào lớp ' || gcode)
      on conflict (student_id, course_id) do update set active = true;
  end loop;
  return new;
end; $function$;
drop trigger if exists tg_grant_class_courses on public.edu_group_members;
create trigger tg_grant_class_courses after insert or update of status on public.edu_group_members
  for each row execute function public.grant_class_courses_on_join();
CREATE OR REPLACE FUNCTION public.backfill_class(p_code text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin return 0; end; $function$;
CREATE OR REPLACE FUNCTION public.my_membership(p_student uuid DEFAULT NULL::uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
begin return jsonb_build_object('classes', '[]'::jsonb); end $function$;
CREATE OR REPLACE FUNCTION public.activate_class_membership(p_lead bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin raise exception 'luật cũ: ghi vào group_id'; end $function$;
CREATE OR REPLACE FUNCTION public.my_class_leaderboard() RETURNS TABLE(student_id uuid, name text, avatar_url text, xp bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select s.id, s.full_name, s.avatar_url, 0::bigint from public.edu_students s where s.user_id = auth.uid() $function$;
grant execute on function public.manage_class_membership(uuid, uuid, text), public.manage_class_curriculum_access(uuid, uuid, text),
  public.my_membership(uuid), public.activate_class_membership(bigint), public.my_class_leaderboard(), public.backfill_class(text) to authenticated;
