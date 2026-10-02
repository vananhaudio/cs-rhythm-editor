-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK Band — Quản lý V1 (gỡ đúng những gì db/band_management_v1_setup.sql thêm; Recruit V1 còn nguyên).
-- Gỡ FRONTEND trước. Thứ tự gỡ hẳn Band: file này → db/band_recruit_v1_rollback.sql.
-- AN TOÀN DỮ LIỆU: đã có thành viên thật → DỪNG (không xoá hồ sơ thành viên/vai trò). Muốn gỡ thì export rồi
-- tự xoá band_member_roles + band_members có chủ đích. Đơn ứng tuyển KHÔNG bị đụng (đơn ACCEPTED giữ trạng thái).
-- Trả band_can_manage + band_admin_set_status về NGUYÊN VĂN bản Recruit V1.
-- CHẠY bằng scripts/prod-db.py (file KHÔNG có begin/commit). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
do $$ declare has_rows boolean := false; begin
  if to_regclass('public.band_members') is not null then
    execute 'select exists (select 1 from public.band_members)' into has_rows;
  end if;
  if has_rows then
    raise exception 'ROLLBACK DỪNG: band_members đang có thành viên thật — export và xoá có chủ đích trước';
  end if;
end $$;

-- Bản Recruit V1 (nguyên văn db/band_recruit_v1_setup.sql §4, §7)
create or replace function public.band_can_manage(p_band_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and (
    public.is_teacher()
    or exists (select 1 from public.bands b where b.id = p_band_id and b.leader_user_id = auth.uid()))
$$;
comment on function public.band_can_manage(uuid) is 'band_recruit_v1: Thầy/admin hoặc Leader của Band';

create or replace function public.band_admin_set_status(p_application_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.band_applications;
begin
  select * into a from public.band_applications where id = p_application_id;
  if a.id is null or not public.band_can_manage(a.band_id) then
    raise exception 'Không có quyền duyệt đơn này' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('NEW', 'REVIEWING', 'ACCEPTED', 'REJECTED') then
    raise exception 'Trạng thái không hợp lệ' using errcode = '22023';
  end if;
  if a.status <> p_status then
    update public.band_applications set status = p_status, status_changed_at = now(), status_changed_by = auth.uid()
     where id = a.id;
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;
comment on function public.band_admin_set_status(uuid, text) is 'band_recruit_v1: đổi trạng thái đơn NEW/REVIEWING/ACCEPTED/REJECTED';
revoke all on function public.band_can_manage(uuid), public.band_admin_set_status(uuid, text) from public, anon, authenticated;
grant execute on function public.band_admin_set_status(uuid, text) to authenticated;

drop function if exists public.band_admin_set_role(uuid, text, boolean);
drop function if exists public.band_admin_update_member(uuid, jsonb);
drop function if exists public.band_admin_add_member(text, jsonb);
drop function if exists public.band_positions_from(uuid, jsonb);
drop function if exists public.band_admin_accept(uuid);
drop function if exists public.band_admin_overview(text);
drop table if exists public.band_member_roles;
drop table if exists public.band_members;
drop function if exists public.band_member_roles_check();
drop function if exists public.band_members_check();
alter table public.bands drop column if exists role_catalog;
alter table public.bands drop column if exists position_catalog;
notify pgrst, 'reload schema';
