-- PREFLIGHT (read-only) cho db/band_recruit_v1_setup.sql — GATE = PASS mới được migrate.
select section, item from (
  select 1 o, 'CHECK' section, 'is_teacher md5 = ' || coalesce((select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = 'is_teacher'), 'VẮNG') item
  union all select 2, 'CHECK', 'bảng bands/band_* hiện có: ' || (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relkind = 'r' and (c.relname = 'bands' or c.relname like 'band\_%'))
  union all select 3, 'CHECK', 'hàm band_* hiện có: ' || (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname like 'band\_%')
  union all select 4, 'CHECK', 'pgcrypto/gen_random_uuid: ' || (select count(*) from pg_proc where proname = 'gen_random_uuid')
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'is_teacher') = '19b164504b4ce59b9bbdb4b0b64e48ad'
   and not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
         where s.nspname = 'public' and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')
           and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'band_recruit_v1:%')
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname like 'band\_%'
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_recruit_v1:%')
   and exists (select 1 from pg_proc where proname = 'gen_random_uuid')
  then 'PASS' else 'FAIL' end
) z order by o;
