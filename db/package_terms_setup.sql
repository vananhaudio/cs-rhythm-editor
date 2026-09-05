-- Class + TVA: kế thừa packages/student_packages và Store verification.
-- Chạy trong transaction sau backup. Không thay giá, tiến độ hoặc quyền legacy.
begin;
alter table public.student_packages add column if not exists source text not null default 'admin';
alter table public.student_packages add column if not exists auto_renew boolean;
alter table public.student_packages add column if not exists external_transaction_id text;
alter table public.student_packages add column if not exists entitlement_id bigint references public.student_entitlements(id);
alter table public.student_packages add column if not exists legacy_unclassified boolean not null default false;
-- renews_at là field thời hạn sẵn có; không tạo expires_at trùng nghĩa.
update public.student_packages set legacy_unclassified=true where renews_at is null and entitlement_id is null;
drop index if exists public.sp_active_uq;
-- Không lộ mã giao dịch của học sinh khác qua policy SELECT rộng cũ.
drop policy if exists sp_read on public.student_packages;
create policy sp_read on public.student_packages for select to authenticated using(public.is_teacher());
create unique index if not exists sp_store_entitlement_uq on public.student_packages(entitlement_id) where entitlement_id is not null;
create unique index if not exists sp_manual_active_uq on public.student_packages(student_id,package_id)
 where status='active' and entitlement_id is null;

-- Catalog Store: chỉ định danh các tier đang bán, không thêm giá/SKU mới.
insert into public.packages(package_code,name,config,status) values
 ('APP_KHOI_DAU','Khởi đầu','{"entitlement_tier":"khoi_dau_99","store_only":true}','active'),
 ('APP_CAN_BAN','Căn bản','{"entitlement_tier":"can_ban_396","store_only":true}','active'),
 ('APP_NANG_CAO','Nâng cao','{"entitlement_tier":"nang_cao_499","store_only":true}','active')
on conflict(package_code) do nothing;

create table if not exists public.student_package_history (
 id bigint generated always as identity primary key,
 student_id uuid not null references public.edu_students(id),
 student_package_id bigint not null references public.student_packages(id),
 action text not null, before_state jsonb, after_state jsonb not null,
 actor_id uuid, created_at timestamptz not null default now()
);
alter table public.student_package_history enable row level security;
drop policy if exists sph_read on public.student_package_history;
create policy sph_read on public.student_package_history for select to authenticated using(public.is_teacher());
grant select on public.student_package_history to authenticated;
revoke insert,update,delete on public.student_package_history from authenticated,anon;

create or replace function public.package_term_valid(p_status text,p_start timestamptz,p_end timestamptz,p_now timestamptz default now())
returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_status in ('active','trialing') and p_start<=p_now and (p_end is null or p_end>p_now),false);
$$;

create or replace function public.audit_student_package() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.updated_at:=now();
 if TG_OP='UPDATE' and new.student_id<>old.student_id then raise exception 'Không chuyển quyền giữa học sinh'; end if;
 -- Store records chỉ do service_role/provider cập nhật, kể cả gọi RPC admin cũ.
 if coalesce(auth.role(),'')='authenticated' and
    (new.entitlement_id is not null or new.source in ('apple','google_play') or
      (TG_OP='UPDATE' and old.entitlement_id is not null)) then
   raise exception 'Quyền do Store quản lý';
 end if;
 if new.source not in ('apple','google_play','web','admin') then raise exception 'Nguồn không hợp lệ'; end if;
 insert into public.student_package_history(student_id,student_package_id,action,before_state,after_state,actor_id)
 values(new.student_id,new.id,case when TG_OP='INSERT' then 'grant' when new.status<>old.status then new.status else 'update' end,
 case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
 return new;
end $$;
-- AFTER để FK history nhìn thấy row mới.
drop trigger if exists package_history on public.student_packages;
create trigger package_history after insert or update on public.student_packages for each row execute function public.audit_student_package();

create or replace function public.sync_store_package() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_pkg uuid;
begin
 if TG_OP='UPDATE' and (old.source in ('apple_subscription','google_subscription')) and
 (new.student_id<>old.student_id or new.source<>old.source or new.source_ref is distinct from old.source_ref) then
 raise exception 'Không chuyển chủ sở hữu giao dịch Store'; end if;
 if new.source not in ('apple_subscription','google_subscription') then return new; end if;
 if auth.role()='authenticated' then raise exception 'Quyền Store chỉ cập nhật từ máy chủ xác minh'; end if;
 if new.status in ('active','trialing') and (new.ends_at is null or new.is_lifetime) then
 raise exception 'Subscription Store phải có thời hạn xác minh'; end if;
 select id into strict v_pkg from public.packages where config->>'entitlement_tier'=new.tier and config->>'store_only'='true';
 insert into public.student_packages(student_id,package_id,status,starts_at,renews_at,source,auto_renew,external_transaction_id,entitlement_id,updated_at)
 values(new.student_id,v_pkg,new.status,new.starts_at,new.ends_at,
 case new.source when 'apple_subscription' then 'apple' else 'google_play' end,
 (new.metadata->>'auto_renew')::boolean,new.source_ref,new.id,now())
 on conflict(entitlement_id) where entitlement_id is not null do update set
 package_id=excluded.package_id,status=excluded.status,starts_at=excluded.starts_at,renews_at=excluded.renews_at,
 auto_renew=excluded.auto_renew,external_transaction_id=excluded.external_transaction_id,updated_at=now()
 where (student_packages.package_id,student_packages.status,student_packages.starts_at,student_packages.renews_at,student_packages.auto_renew)
 is distinct from (excluded.package_id,excluded.status,excluded.starts_at,excluded.renews_at,excluded.auto_renew);
 return new;
end $$;
drop trigger if exists store_package_sync on public.student_entitlements;
create trigger store_package_sync after insert or update on public.student_entitlements for each row execute function public.sync_store_package();
-- Backfill đã xác minh, giữ nguyên mọi thời điểm/status.
update public.student_entitlements set updated_at=updated_at where source in ('apple_subscription','google_subscription');

-- Một nguồn đọc; Store lấy bản ghi nguồn, manual lấy student_packages, không đếm mirror hai lần.
create or replace view public.student_entitlement_sources as
 select id,student_id,tier,source,source_ref,starts_at,ends_at,is_lifetime,status from public.student_entitlements
 union all
 select -sp.id,sp.student_id,p.config->>'entitlement_tier',
 case sp.source when 'web' then 'future_web_provider' else 'manual_admin' end,
 sp.external_transaction_id,sp.starts_at,sp.renews_at,sp.renews_at is null,sp.status
 from public.student_packages sp join public.packages p on p.id=sp.package_id
 where sp.entitlement_id is null and p.config->>'entitlement_tier' in ('free','khoi_dau_99','can_ban_396','nang_cao_499');
revoke all on public.student_entitlement_sources from public,anon,authenticated;

-- Quyền khoá trực tiếp giữ nguyên. Chỉ note PKG đã xác định nguồn mới phụ thuộc thời hạn.
create or replace function public.has_course_access(p_student uuid,p_course uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_packages sp join public.edu_courses c on c.id=p_course
   where sp.student_id=p_student and c.code=any(sp.granted_course_codes)
   and public.package_term_valid(sp.status,sp.starts_at,sp.renews_at))
 or exists(select 1 from public.edu_course_access a where a.student_id=p_student and a.course_id=p_course and a.active
   and coalesce(a.note,'') not like 'PKG %')
 or exists(select 1 from public.edu_enrollments e where e.student_id=p_student and e.course_id=p_course and e.is_active and e.access_granted
   and not exists(select 1 from public.edu_course_access a where a.student_id=p_student and a.course_id=p_course and a.note like 'PKG %'));
$$;
revoke all on function public.has_course_access(uuid,uuid) from public,anon,authenticated;

-- Thao tác trong transaction, lịch sử chỉ thêm mới. Khóa theo HS để tránh gia hạn đồng thời mất ngày.
create or replace function public.manage_student_package(
 p_student uuid,p_action text,p_package_id uuid default null,p_record_id bigint default null,
 p_months int default null,p_source text default 'admin',p_course_codes text[] default null,
 p_request_id uuid default gen_random_uuid()
) returns bigint language plpgsql security definer set search_path='' as $$
declare v_old public.student_packages; v_pkg public.packages; v_id bigint; v_months int; v_base timestamptz;
 v_codes text[]; v_gid uuid; v_uid uuid;
begin
 if not coalesce(public.is_teacher(),false) then raise exception 'Chỉ Thầy/Admin được quản lý gói'; end if;
 if p_action not in ('grant','renew','change','end') then raise exception 'Thao tác không hợp lệ'; end if;
 if p_source not in ('web','admin') then raise exception 'Store tự quản lý subscription'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_student::text,0));
 select id into v_id from public.student_packages where student_id=p_student and external_transaction_id='admin-request:'||p_request_id;
 if v_id is not null then return v_id; end if;
 if p_record_id is not null then
   select * into strict v_old from public.student_packages where id=p_record_id and student_id=p_student for update;
   if v_old.entitlement_id is not null or v_old.source in ('apple','google_play') then raise exception 'Quyền do Store quản lý'; end if;
 end if;
 if p_action in ('renew','change','end') and v_old.id is null then raise exception 'Chọn gói cần thao tác'; end if;
 if p_action='end' then
   update public.student_packages set status='cancelled',updated_at=now() where id=v_old.id;
   return v_old.id;
 end if;
 select * into strict v_pkg from public.packages where id=case when p_action='renew' then v_old.package_id else p_package_id end and status='active';
 if v_pkg.config->>'store_only'='true' then raise exception 'Gói này chỉ cấp qua Store'; end if;
 v_months:=coalesce(p_months,(v_pkg.config->>'renew_months')::int);
 if v_months is null or v_months<1 or v_months>120 then raise exception 'Chọn thời hạn 1–120 tháng; gói chưa có chu kỳ mặc định'; end if;
 if p_action='renew' and v_old.renews_at is null then raise exception 'Gói legacy/vĩnh viễn cần xác minh trước khi gia hạn'; end if;
 if p_action='renew' and v_old.status not in ('active','expired') then raise exception 'Gói đã kết thúc: dùng Cấp gói mới'; end if;
 if p_action='grant' and exists(select 1 from public.student_packages where student_id=p_student and package_id=v_pkg.id and status='active' and entitlement_id is null) then
   raise exception 'Gói đã tồn tại: dùng Gia hạn'; end if;
 v_base:=case when p_action='renew' then greatest(now(),v_old.renews_at) else now() end;
 v_codes:=coalesce(p_course_codes,case when p_action='renew' then v_old.granted_course_codes end,
 array(select jsonb_array_elements_text(v_pkg.config->'default_course_codes')));
 if p_action in ('renew','change') then update public.student_packages set status=case when p_action='renew' then 'superseded' else 'cancelled' end,updated_at=now() where id=v_old.id; end if;
 insert into public.student_packages(student_id,package_id,status,starts_at,renews_at,source,auto_renew,external_transaction_id,granted_course_codes)
 values(p_student,v_pkg.id,'active',case when p_action='renew' and v_old.renews_at>now() then v_old.starts_at else now() end,
 ((v_base at time zone 'Asia/Ho_Chi_Minh')+make_interval(months=>v_months)) at time zone 'Asia/Ho_Chi_Minh',
 case when p_action='renew' then v_old.source else p_source end,false,'admin-request:'||p_request_id,v_codes) returning id into v_id;
 -- Kế thừa nhóm gói không mã lớp; không sinh enrollment vô hạn.
 v_gid:=nullif(v_pkg.config->>'zalo_group_id','')::uuid;
 if exists(select 1 from public.edu_groups where id=v_gid and is_active and code is null) then
 select user_id into v_uid from public.edu_students where id=p_student;
 if v_uid is not null then insert into public.edu_group_members(user_id,group_id,source,status) values(v_uid,v_gid,'package','active')
 on conflict(user_id,group_id) do update set status='active'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.manage_student_package(uuid,text,uuid,bigint,int,text,text[],uuid) from public,anon;
grant execute on function public.manage_student_package(uuid,text,uuid,bigint,int,text,text[],uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.get_effective_student_entitlement(p_student_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(student_id uuid, effective_tier text, source text, source_ref text, entitlement_id bigint, starts_at timestamp with time zone, ends_at timestamp with time zone, is_lifetime boolean, active_entitlements jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_student_id uuid;
  v_row record;
begin
  if p_student_id is null then
    select s.id into v_student_id
      from public.edu_students s
      where s.user_id = auth.uid()
      limit 1;
  else
    v_student_id := p_student_id;
  end if;

  if v_student_id is null then
    raise exception 'student_id khong ton tai';
  end if;

  if not public.is_teacher() and not exists (
    select 1 from public.edu_students s
    where s.id = v_student_id and s.user_id = auth.uid()
  ) then
    raise exception 'Khong duoc doc entitlement cua hoc vien khac';
  end if;

  with valid_entitlements as (
    select
      e.*,
      case e.tier
        when 'nang_cao_499' then 4
        when 'can_ban_396' then 3
        when 'khoi_dau_99' then 2
        else 1
      end as tier_rank,
      case e.source
        when 'apple_subscription' then 50
        when 'google_subscription' then 50
        when 'future_web_provider' then 45
        when 'manual_admin' then 40
        when 'legacy_99_lifetime' then 30
        when 'free' then 10
        else 0
      end as source_rank
    from public.student_entitlement_sources e
    where e.student_id = v_student_id
      and public.package_term_valid(e.status,e.starts_at,e.ends_at)
  )
  select *
    into v_row
    from valid_entitlements
    order by tier_rank desc, source_rank desc, starts_at desc, id desc
    limit 1;

  if v_row.id is null then
    student_id := v_student_id;
    effective_tier := 'free';
    source := 'free';
    source_ref := null;
    entitlement_id := null;
    starts_at := null;
    ends_at := null;
    is_lifetime := false;
    active_entitlements := '[]'::jsonb;
    return next;
    return;
  end if;

  student_id := v_student_id;
  effective_tier := v_row.tier;
  source := v_row.source;
  source_ref := case when public.is_teacher() then v_row.source_ref else null end;
  entitlement_id := v_row.id;
  starts_at := v_row.starts_at;
  ends_at := v_row.ends_at;
  is_lifetime := v_row.is_lifetime;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'tier', e.tier,
    'source', e.source,
    'source_ref', case when public.is_teacher() then e.source_ref else null end,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'is_lifetime', e.is_lifetime,
    'status', e.status
  ) order by
    case e.tier
      when 'nang_cao_499' then 4
      when 'can_ban_396' then 3
      when 'khoi_dau_99' then 2
      else 1
    end desc, e.starts_at desc), '[]'::jsonb)
    into active_entitlements
    from public.student_entitlement_sources e
    where e.student_id = v_student_id
      and public.package_term_valid(e.status,e.starts_at,e.ends_at);

  return next;
end; $function$
;

CREATE OR REPLACE FUNCTION public.my_learning_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_student record;
  v_student_id uuid := null;
  v_is_teacher boolean := false;
  v_tier text := 'free';           -- entitlement tier: free|khoi_dau_99|can_ban_396|nang_cao_499
  v_tier_idx int := 0;
  v_ht_member boolean := false;
  v_mode text := coalesce((select value from app_config where key = 'learning_state_mode'), 'server');
  v_completed uuid[] := '{}';
  v_completed_codes text[] := '{}';
  v_courses jsonb;
  v_tracks jsonb;
  v_tools jsonb;
begin
  -- ── Danh tính ──
  if v_uid is not null then
    v_is_teacher := coalesce(public.is_teacher(), false);
    select s.* into v_student from edu_students s
      where s.user_id = v_uid
         or (s.email is not null and lower(s.email) = lower(coalesce((select u.email from auth.users u where u.id = v_uid), '')))
      order by (s.user_id = v_uid) desc limit 1;
    if v_student.id is not null then
      v_student_id := v_student.id;
      v_ht_member := coalesce(v_student.ht_member, false);
      -- effective tier = max(entitlement RPC, level legacy) — y hệt client cũ
      select coalesce(
        (select case e.effective_tier
           when 'khoi_dau_99' then 'khoi_dau_99' when 'can_ban_396' then 'can_ban_396'
           when 'nang_cao_499' then 'nang_cao_499'
           when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
           else 'free' end
         from public.get_effective_student_entitlement(v_student.id) e limit 1), 'free')
      into v_tier;
      v_tier_idx := array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'], v_tier) - 1;
      select coalesce(array_agg(lesson_id), '{}') into v_completed
        from edu_lesson_progress where student_id = v_student.id and status = 'completed';
    end if;
  end if;

  -- ── Mã năng lực đã hoàn thành (mọi bài của khoá xong) — cho prereq hành trình ──
  select coalesce(array_agg(x.code), '{}') into v_completed_codes from (
    select upper(trim(c.code)) as code
    from edu_courses c
    join edu_modules m on m.course_id = c.id
    join edu_course_lessons l on l.module_id = m.id
    where c.code is not null and trim(c.code) <> ''
    group by c.id, c.code
    having count(*) > 0 and count(*) = count(*) filter (where l.id = any(v_completed))
  ) x;

  -- ── Courses + modules + lessons: quyết định visible/access/reason từng cấp ──
  with course_src as (
    select c.*,
      jc.subject, jc.level as j_level, jc.sort_order as j_order,
      public.has_course_access(v_student_id,c.id) as enrolled,
      public.has_course_access(v_student_id,c.id) as granted
    from edu_courses c
    left join journey_curriculum jc on jc.course_id = c.id
  ),
  course_resolved as (
    select cs.*,
      -- policy mới (access_policy_enabled) ưu tiên; không thì luật legacy — port từ resolveCourseAccess
      case when coalesce(cs.access_policy_enabled, false)
           then coalesce(cs.visibility, 'visible') = 'visible'
           else coalesce(cs.status, 'on') <> 'off' end as r_visible,
      case when coalesce(cs.access_policy_enabled, false)
           then coalesce(cs.availability, 'available') = 'available'
           else coalesce(cs.status, 'on') <> 'coming_soon' end as r_available,
      case when coalesce(cs.access_policy_enabled, false)
           then greatest(coalesce(array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'],
                  case coalesce(cs.required_tier, 'free')
                    when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
                    when 'khoi_dau_99' then 'khoi_dau_99' when 'can_ban_396' then 'can_ban_396' when 'nang_cao_499' then 'nang_cao_499'
                    else 'free' end), 1) - 1, 0)
           else case when cs.is_free = false then 1 else 0 end end as req_idx,
      (v_is_teacher or cs.enrolled or cs.granted or coalesce(cs.is_free, true) is not false) as legacy_unlocked,
      -- prereq hành trình (chỉ áp cho học viên HT). QUAN TRỌNG: tiên quyết chỉ chặn
      -- BƯỚC VÀO khoá mới — KHÔNG chặn khoá học viên đã ghi danh / được cấp quyền /
      -- ĐÃ HỌC DỞ (có bài hoàn thành trong khoá). Fix bug "đã học xong bài trước
      -- vẫn bị đòi hoàn thành" (học viên lớp HT học DH2 trực tiếp khi DH1 chưa xong).
      case when v_ht_member and cs.code is not null
                and not (cs.enrolled or cs.granted)
                and not exists (
                  select 1 from edu_lesson_progress p
                  join edu_course_lessons l2 on l2.id = p.lesson_id
                  join edu_modules m2 on m2.id = l2.module_id
                  where m2.course_id = cs.id and p.student_id = v_student_id and p.status = 'completed')
           then
        coalesce((select array(select r from unnest(p.requires) r where r <> 'NM' and not (r = any(v_completed_codes)))
                  from course_prereqs p where p.code = upper(trim(cs.code))), '{}')
      else '{}' end as missing_prereqs
    from course_src cs
  )
  select jsonb_agg(
    jsonb_build_object(
      'id', cr.id, 'name', cr.name, 'code', cr.code, 'track', cr.track,
      'type', cr.type, 'icon', cr.icon, 'image_url', cr.image_url,
      'sort_order', cr.sort_order, 'status', cr.status, 'is_free', cr.is_free,
      'subject', cr.subject, 'level', cr.j_level, 'journey_order', cr.j_order,
      'enrolled', cr.enrolled, 'granted', cr.granted,
      'source', case when v_is_teacher then 'teacher' when cr.enrolled then 'enrollment'
                     when cr.granted then 'grant' when coalesce(cr.is_free, true) then 'free' else 'public' end,
      'visible', cr.r_visible,
      'access', case
        when not cr.r_visible then 'hidden'
        when not cr.r_available then 'coming_soon'
        when array_length(cr.missing_prereqs, 1) > 0 then 'prereq'
        when v_is_teacher or cr.legacy_unlocked or v_tier_idx >= cr.req_idx then 'open'
        else 'upgrade' end,
      'missing_prereqs', to_jsonb(cr.missing_prereqs),
      'completed', (cr.code is not null and upper(trim(cr.code)) = any(v_completed_codes)),
      'modules', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'order_index', m.order_index, 'level', m.level,
                                            'is_free', coalesce(m.is_free, false))
               order by m.order_index)
        from edu_modules m where m.course_id = cr.id), '[]'::jsonb),
      'lessons', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', l.id, 'module_id', l.module_id, 'title', l.title,
            'order_index', l.order_index, 'lesson_type', l.lesson_type, 'content_url', l.content_url,
            'visible', case when coalesce(cr.access_policy_enabled, false) and coalesce(l.access_policy_mode, 'inherit') = 'override'
                            then coalesce(l.visibility, 'visible') = 'visible' else cr.r_visible end,
            'completed', (l.id = any(v_completed)),
            -- Cờ FREE cho UI badge "MIỄN PHÍ" (chương free / bài free / khoá free)
            'free', (coalesce(m.is_free, false)
              or case when coalesce(cr.access_policy_enabled, false)
                   then case when coalesce(l.access_policy_mode, 'inherit') = 'override'
                          then coalesce(l.required_tier, 'free') = 'free'
                               and coalesce(l.visibility, 'visible') = 'visible'
                               and coalesce(l.availability, 'available') = 'available'
                          else coalesce(cr.required_tier, 'free') = 'free' end
                   else coalesce(cr.is_free, true) or coalesce(l.tier, 'free') = 'free' end),
            'access', case
              when not cr.r_visible then 'hidden'
              when not cr.r_available then 'coming_soon'
              when array_length(cr.missing_prereqs, 1) > 0 then 'prereq'
              when v_is_teacher then 'open'
              -- CHƯƠNG FREE (edu_modules.is_free) → mở mọi bài trong chương (Admin quyết,
              -- db/free_content_setup.sql) — TRỪ bài Admin đã override ẩn/sắp có.
              when coalesce(m.is_free, false)
                   and not (coalesce(cr.access_policy_enabled, false)
                            and coalesce(l.access_policy_mode, 'inherit') = 'override'
                            and (coalesce(l.visibility, 'visible') <> 'visible'
                                 or coalesce(l.availability, 'available') <> 'available'))
                then 'open'
              -- lesson override policy
              when coalesce(cr.access_policy_enabled, false) and coalesce(l.access_policy_mode, 'inherit') = 'override' then
                case when coalesce(l.visibility, 'visible') <> 'visible' then 'hidden'
                     when coalesce(l.availability, 'available') <> 'available' then 'coming_soon'
                     when v_tier_idx >= greatest(coalesce(array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'],
                            case coalesce(l.required_tier, 'free')
                              when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
                              when 'khoi_dau_99' then 'khoi_dau_99' when 'can_ban_396' then 'can_ban_396' when 'nang_cao_499' then 'nang_cao_499'
                              else 'free' end), 1) - 1, 0)
                          or cr.legacy_unlocked then 'open'
                     else 'upgrade' end
              -- kế thừa: luật legacy theo lesson.tier — port từ resolveLessonAccess nhánh legacy
              when not coalesce(cr.access_policy_enabled, false) then
                case when cr.legacy_unlocked
                          or v_tier_idx >= greatest(coalesce(array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'],
                               case coalesce(l.tier, case when cr.is_free = false then 'basic' else 'free' end)
                                 when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
                                 else 'free' end), 1) - 1, 0)
                     then 'open' else 'upgrade' end
              when cr.legacy_unlocked or v_tier_idx >= cr.req_idx then 'open'
              else 'upgrade' end
          ) order by m.order_index, l.order_index)
        from edu_course_lessons l join edu_modules m on m.id = l.module_id
        where m.course_id = cr.id), '[]'::jsonb)
    ) order by coalesce(cr.j_order, 9000 + coalesce(cr.sort_order, 99)))
  into v_courses
  from course_resolved cr
  where cr.r_visible or v_is_teacher;

  select jsonb_agg(jsonb_build_object('key', t.key, 'title', t.title, 'hint', t.hint) order by t.sort_order)
    into v_tracks from journey_tracks t;

  select jsonb_object_agg(t.id, coalesce(t.enabled, true) and (v_is_teacher or v_tier_idx >= case coalesce(t.tier,'free') when 'basic' then 1 when 'standard' then 2 when 'pro' then 3 else 0 end)) into v_tools from edu_tools t;

  -- Không gửi URL nội dung của bài đang khóa trong metadata công khai.
  select coalesce(jsonb_agg(jsonb_set(c,'{lessons}',
    (select coalesce(jsonb_agg(case when l->>'access'='open' then l else jsonb_set(l,'{content_url}','null'::jsonb) end),'[]'::jsonb)
     from jsonb_array_elements(c->'lessons') l))),'[]'::jsonb)
  into v_courses from jsonb_array_elements(coalesce(v_courses,'[]'::jsonb)) c;

  return jsonb_build_object(
    'enabled', v_mode = 'server',
    'mode', case when v_is_teacher then 'teacher' when v_student_id is not null then 'student' else 'guest' end,
    'student_id', v_student_id,
    'effective_tier', v_tier,
    'ht_member', v_ht_member,
    'tracks', coalesce(v_tracks, '[]'::jsonb),
    'courses', coalesce(v_courses, '[]'::jsonb),
    'completed_lesson_ids', to_jsonb(v_completed),
    'flags', jsonb_build_object('tools', coalesce(v_tools, '{}'::jsonb)),
    'valid_until', (select min(boundary) from (select ends_at as boundary from public.student_entitlement_sources where student_id=v_student_id and ends_at>now() union all select renews_at from public.student_packages where student_id=v_student_id and renews_at>now() union all select starts_at from public.student_packages where student_id=v_student_id and starts_at>now()) b),
    'generated_at', now()
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.lead_entitlement_ok(p_lead bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_student uuid;
  v_mode   text;
  v_class_ok  boolean;
  v_practice_ok boolean;
begin
  select student_id, coalesce((regexp_match(coalesce(note, ''), '\[reg-mode:([a-z]+)\]'))[1], 'class')
    into v_student, v_mode
    from public.leads where id = p_lead;
  if v_student is null then
    return false;  -- chưa có tài khoản học sinh → chưa thể kích hoạt
  end if;
  select exists(
    select 1 from public.edu_course_access a
    where a.student_id = v_student and public.has_course_access(v_student,a.course_id)
  ) into v_class_ok;
  select exists(
    select 1 from public.student_packages p
    where p.student_id = v_student and public.package_term_valid(p.status,p.starts_at,p.renews_at)
  ) into v_practice_ok;
  if v_mode = 'practice' then return v_practice_ok; end if;
  if v_mode = 'both' then return v_class_ok and v_practice_ok; end if;
  return v_class_ok;
end;
$function$
;
-- Nút kích hoạt cũ gọi cùng service.
create or replace function public.activate_student_package(p_student uuid,p_package_code text,p_course_codes text[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pkg public.packages; v_old bigint; v_id bigint;
begin
 if not coalesce(public.is_teacher(),false) then raise exception 'Chỉ Thầy được cấp gói'; end if;
 select * into strict v_pkg from public.packages where package_code=p_package_code and status='active';
 perform pg_advisory_xact_lock(hashtextextended(p_student::text,0));
 select id into v_old from public.student_packages where student_id=p_student and package_id=v_pkg.id and status='active' and entitlement_id is null;
 v_id:=public.manage_student_package(p_student,case when v_old is null then 'grant' else 'renew' end,v_pkg.id,v_old,null,'admin',p_course_codes);
 return jsonb_build_object('student_package_id',v_id,'renews_at',(select renews_at from public.student_packages where id=v_id),
 'granted_codes',(select to_jsonb(granted_course_codes) from public.student_packages where id=v_id),'skipped_codes','[]'::jsonb,
 'zalo_url',(select zalo_url from public.edu_groups where id=nullif(v_pkg.config->>'zalo_group_id','')::uuid and is_active and code is null),
 'zalo_teacher_url',v_pkg.config->>'zalo_teacher_url','practice_schedule',v_pkg.config->>'practice_schedule');
end $$;

create or replace function public.admin_student_packages(p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.is_teacher(),false) then raise exception 'Chỉ Thầy/Admin'; end if;
 return jsonb_build_object('now',now(),
 'packages',(select coalesce(jsonb_agg(to_jsonb(p) order by p.name),'[]'::jsonb) from public.packages p where p.status='active'),
 'records',(select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at desc),'[]'::jsonb) from (
 select sp.*,p.name,p.package_code,
 public.package_term_valid(sp.status,sp.starts_at,sp.renews_at) as is_active,
 case when sp.status not in ('active','trialing') then sp.status
 when sp.starts_at>now() then 'scheduled' when sp.renews_at<=now() then 'expired'
 when sp.renews_at<=now()+interval '7 days' then 'expiring' else 'active' end as display_status
 from public.student_packages sp join public.packages p on p.id=sp.package_id
 where p_student is null or sp.student_id=p_student
 union all
 select -e.id,e.student_id,null::uuid,e.status,e.starts_at,e.ends_at,'{}'::text[],e.created_at,e.updated_at,
 'admin',false,e.source_ref,e.id,false,
 case when e.source='legacy_99_lifetime' then 'Khởi đầu — quyền legacy vĩnh viễn' else e.tier end,e.source,
 public.package_term_valid(e.status,e.starts_at,e.ends_at),
 case when not public.package_term_valid(e.status,e.starts_at,e.ends_at) then 'expired' else 'active' end
 from public.student_entitlements e where e.source not in ('apple_subscription','google_subscription','free')
 and (p_student is null or e.student_id=p_student)
 ) r),
 'history',case when p_student is null then '[]'::jsonb else
 (select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc),'[]'::jsonb) from public.student_package_history h where h.student_id=p_student) end);
end $$;
revoke all on function public.admin_student_packages(uuid) from public,anon;
grant execute on function public.admin_student_packages(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
