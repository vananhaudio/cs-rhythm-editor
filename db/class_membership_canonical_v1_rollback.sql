-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK CLASS MEMBERSHIP CANONICAL V1 — phần SCHEMA + HÀM (chung). KHÔNG begin/commit (prod-db.py sở hữu transaction).
--   • Thân 12 hàm về ĐÚNG bản trước V1 (đọc từ tva_private.ccm_v1_backup, không gõ lại tay).
--   • Gỡ view/hàm/trigger/CHECK/index mới.
--   • KHÔNG đụng dữ liệu (group_id/cohort_group_id, nhóm, thành viên). Trả dữ liệu production về như cũ là phần
--     rollback DỮ LIỆU ở hạ tầng private (chạy SAU file này, cùng transaction).
--   Nếu Join Code V1 đã cài: rollback Join Code TRƯỚC (db/class_join_code_v1_rollback.sql).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $rb$
declare r record; n int;
begin
  if to_regclass('tva_private.ccm_v1_backup') is null then
    raise notice 'Canonical V1 chưa cài — không làm gì'; return;
  end if;
  if to_regprocedure('public.class_join(text)') is not null then
    raise exception 'DỪNG — Join Code V1 đang cài, rollback nó trước';
  end if;
  select count(*) into n from tva_private.ccm_v1_backup;
  if n <> 12 then raise exception 'DỪNG — bản sao lưu có % hàm (cần 12)', n; end if;
  for r in select def from tva_private.ccm_v1_backup loop
    execute r.def;
  end loop;
end $rb$;

drop function if exists public.my_class_memberships();
drop function if exists public.admin_class_member_summary();
drop function if exists public.class_roster(uuid);
drop function if exists tva_private.class_student_count(uuid);
drop view if exists tva_private.class_memberships;
drop trigger if exists class_schedule_sync_member_group on public.class_schedule;
drop function if exists tva_private.class_schedule_sync_member_group();
alter table public.class_schedule drop constraint if exists class_schedule_one_member_group;
drop index if exists public.class_schedule_cohort_group_idx;
drop index if exists public.edu_group_members_group_active_idx;
-- backfill_class: quyền thực thi về như trước V1
grant execute on function public.backfill_class(text) to public, anon, authenticated, service_role;
drop table if exists tva_private.ccm_v1_backup;
notify pgrst, 'reload schema';
