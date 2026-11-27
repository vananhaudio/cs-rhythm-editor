-- Hoàn tác CLASS_ACCESS_SYNC_V1 (quyền đã cấp giữ nguyên).
set local lock_timeout = '5s';
drop trigger if exists class_schedule_grant_curriculum on public.class_schedule;
drop function if exists tva_private.grant_curriculum_on_class_open();
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
  return new;
end $function$;
