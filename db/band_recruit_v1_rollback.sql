-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK Band — Tuyển thành viên V1 (gỡ đúng những gì db/band_recruit_v1_setup.sql tạo).
-- Gỡ FRONTEND trước (trang /band/<slug> và /me/bands tự báo lỗi tải khi RPC vắng).
-- AN TOÀN DỮ LIỆU: đã có đơn ứng tuyển thật → DỪNG (không xoá đơn của học viên). Muốn gỡ hẳn thì
-- export đơn trước rồi tự xoá band_applications có chủ đích.
-- CHẠY bằng scripts/prod-db.py (file KHÔNG có begin/commit). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
do $$ declare has_rows boolean := false; begin
  if to_regclass('public.band_applications') is not null then
    execute 'select exists (select 1 from public.band_applications)' into has_rows;
  end if;
  if has_rows then
    raise exception 'ROLLBACK DỪNG: band_applications đang có đơn thật — export và xoá có chủ đích trước';
  end if;
end $$;
drop function if exists public.band_admin_set_status(uuid, text);
drop function if exists public.band_admin_applications(text);
drop function if exists public.band_admin_bands();
drop function if exists public.band_apply(uuid, jsonb);
drop function if exists public.band_recruitment_public(text);
drop function if exists public.band_can_manage(uuid);
drop table if exists public.band_applications;
drop table if exists public.band_recruitments;
drop table if exists public.band_rule_versions;
drop table if exists public.bands;
drop function if exists public.band_recruitments_check();
drop function if exists public.band_rule_versions_immutable();
notify pgrst, 'reload schema';
