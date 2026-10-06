-- ── Giáo trình tự động bật cho người vào nhóm lớp (10/2026) ──
-- Trước: Thầy bật quyền giáo trình (class_curriculum_access) từng người qua manage_class_curriculum_access.
-- Nay: thành viên ACTIVE của nhóm lớp (class_schedule.cohort_group_id) tự được bật 'active'.
-- Tôn trọng tắt tay: dòng đã có (kể cả 'revoked') KHÔNG bị bật lại — ON CONFLICT DO NOTHING.
-- Bỏ qua lớp huỷ/gộp/nháp (cùng luật my_class_memberships) và học sinh đã khoá (edu_students.is_active = false).
-- Idempotent: chạy lại vô hại. Rollback: drop trigger tg_auto_class_curriculum_access; (các dòng đã bật giữ nguyên, thu hồi bằng manage_class_curriculum_access).
create or replace function public.auto_class_curriculum_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from 'active' then return new; end if;
  if exists (select 1 from public.edu_students s where s.user_id = new.user_id and s.is_active = false) then return new; end if;
  insert into public.class_curriculum_access (class_id, user_id, status, granted_at)
  select cs.id, new.user_id, 'active', now()
    from public.class_schedule cs
   where cs.cohort_group_id = new.group_id and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
  on conflict (class_id, user_id) do nothing;
  return new;
end $$;
revoke all on function public.auto_class_curriculum_access() from public, anon, authenticated;

drop trigger if exists tg_auto_class_curriculum_access on public.edu_group_members;
create trigger tg_auto_class_curriculum_access
  after insert or update of status on public.edu_group_members
  for each row execute function public.auto_class_curriculum_access();

-- Backfill: thành viên hiện có
insert into public.class_curriculum_access (class_id, user_id, status, granted_at)
select m.class_id, m.user_id, 'active', now()
  from tva_private.class_memberships m
  join public.class_schedule cs on cs.id = m.class_id
 where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
   and not exists (select 1 from public.edu_students s where s.user_id = m.user_id and s.is_active = false)
on conflict (class_id, user_id) do nothing;
