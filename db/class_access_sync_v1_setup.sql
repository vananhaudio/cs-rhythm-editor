-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS_ACCESS_SYNC_V1 (Owner 27/11/2026) — hai lỗ cấp quyền:
--   (1) thêm học viên khi lớp còn nháp/huỷ/gộp → lúc lớp mở KHÔNG được cấp bù;
--   (2) học viên bị thu hồi quyền, Thầy thêm lại vào lớp → quyền không tự có lại.
-- Cấp bù KHÔNG ghi đè quyền đã thu hồi. KHÔNG sửa dữ liệu hiện có. Không policy. Hoàn tác: class_access_sync_v1_rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  replaced constant jsonb := '{"auto_class_curriculum_access": "32138aa50f5cc5fc300a054d6053ee3a"}';
  k text; v text; src text; drift text[] := '{}';
begin
  for k, v in select key, value from jsonb_each_text(replaced) loop
    select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = k and n.nspname = 'public';
    if src is null then drift := drift || format('thiếu hàm %s', k);
    elsif position('CLASS_ACCESS_SYNC_V1' in src) = 0 and md5(src) <> v then drift := drift || format('hàm %s khác bản đã kiểm (md5 %s)', k, md5(src));
    end if;
  end loop;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác bản đã kiểm: %', array_to_string(drift, '; '); end if;
end $gate$;

CREATE OR REPLACE FUNCTION public.auto_class_curriculum_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status is distinct from 'active' then return new; end if;
  if exists (select 1 from public.edu_students s where s.user_id = new.user_id and s.is_active = false) then return new; end if;
  insert into public.class_curriculum_access (class_id, user_id, status, granted_at)
  select cs.id, new.user_id, 'active', now()
    from public.class_schedule cs
   where cs.cohort_group_id = new.group_id and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
  on conflict (class_id, user_id) do nothing;
   -- CLASS_ACCESS_SYNC_V1: THẦY thêm lại người đã rời lớp → bật lại quyền giáo trình từng bị thu hồi.
   -- Học viên tự vào lại (mã lớp / link) KHÔNG đi vòng được quyết định thu hồi của Thầy.
   if coalesce(public.is_teacher(), false) and (tg_op = 'INSERT' or old.status is distinct from 'active') then
     update public.class_curriculum_access a
        set status = 'active', granted_at = now(), granted_by = auth.uid(), revoked_at = null, revoked_by = null, updated_at = now()
       from public.class_schedule cs
      where cs.cohort_group_id = new.group_id and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
        and a.class_id = cs.id and a.user_id = new.user_id and a.status = 'revoked';
   end if;
  return new;
end $function$;

create or replace function tva_private.grant_curriculum_on_class_open()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- CLASS_ACCESS_SYNC_V1
  if new.cohort_group_id is null or coalesce(new.status, '') in ('cancelled', 'merged', 'draft') then return new; end if;
  if tg_op = 'UPDATE' then
    if old.cohort_group_id is not distinct from new.cohort_group_id
       and coalesce(old.status, '') not in ('cancelled', 'merged', 'draft') then return new; end if;
  end if;
  insert into public.class_curriculum_access (class_id, user_id, status, granted_at)
  select new.id, m.user_id, 'active', now() from public.edu_group_members m
   where m.group_id = new.cohort_group_id and m.status = 'active'
     and not exists (select 1 from public.edu_students s where s.user_id = m.user_id and s.is_active = false)
  on conflict (class_id, user_id) do nothing;
  return new;
end $$;
revoke all on function tva_private.grant_curriculum_on_class_open() from public, anon, authenticated;
drop trigger if exists class_schedule_grant_curriculum on public.class_schedule;
create trigger class_schedule_grant_curriculum after insert or update of status, cohort_group_id on public.class_schedule
  for each row execute function tva_private.grant_curriculum_on_class_open();
