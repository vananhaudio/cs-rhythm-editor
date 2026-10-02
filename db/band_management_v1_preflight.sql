-- PREFLIGHT (read-only) cho db/band_management_v1_setup.sql — GATE = PASS mới được migrate. Không đọc dữ liệu ứng viên.
select section, item from (
  select 1 o, 'CHECK' section, 'is_teacher md5 = ' || coalesce((select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = 'is_teacher'), 'VẮNG') item
  union all select 2, 'CHECK', 'bảng Recruit V1 (đúng chủ): ' || (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')
       and obj_description(c.oid, 'pg_class') like 'band_recruit_v1:%')
  union all select 3, 'CHECK', 'bảng band_members/band_member_roles hiện có: ' || (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relname in ('band_members', 'band_member_roles'))
  union all select 4, 'CHECK', 'hàm band_* lạ: ' || (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname like 'band\_%'
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_recruit_v1:%'
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_management_v1:%')
  union all select 5, 'CHECK', 'đơn theo trạng thái: ' || coalesce((select string_agg(status || '=' || n, ', ' order by status)
     from (select status, count(*) n from public.band_applications group by status) x), '0')
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'is_teacher') = '19b164504b4ce59b9bbdb4b0b64e48ad'
   and (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
         where s.nspname = 'public' and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')
           and obj_description(c.oid, 'pg_class') like 'band_recruit_v1:%') = 4
   and not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
         where s.nspname = 'public' and c.relname in ('band_members', 'band_member_roles')
           and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'band_management_v1:%')
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname like 'band\_%'
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_recruit_v1:%'
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_management_v1:%')
   and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bands'
         and column_name in ('position_catalog', 'role_catalog')
         and coalesce(col_description('public.bands'::regclass, ordinal_position::int), '') not like 'band_management_v1:%')
  then 'PASS' else 'FAIL' end
) z order by o;
