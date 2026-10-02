-- POSTFLIGHT (read-only) sau db/band_recruit_v1_setup.sql (+ seed). Không đọc dữ liệu ứng viên.
select section, item from (
  select 1 o, 'CHECK' section, 'bảng: ' || (select string_agg(c.relname || (case when c.relrowsecurity then '(RLS)' else '(KHÔNG RLS!)' end), ', ' order by c.relname)
     from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')) item
  union all select 2, 'CHECK', 'policy trên 4 bảng: ' || (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications'))
  union all select 3, 'CHECK', 'quyền bảng anon/authenticated: ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')
       and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 4, 'CHECK', 'anon EXECUTE: ' || coalesce((select string_agg(distinct routine_name, ',' order by routine_name)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name like 'band\_%' and grantee = 'anon'), '-')
  union all select 5, 'CHECK', 'band active: ' || coalesce((select string_agg(slug, ',') from public.bands where status = 'active'), '-')
  union all select 6, 'CHECK', 'đợt tuyển mở: ' || (select count(*) from public.band_recruitments where status = 'open')
  union all select 7, 'CHECK', 'số đơn: ' || (select count(*) from public.band_applications)
  union all select 9, 'GATE', case when
        (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public'
          and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications') and c.relrowsecurity) = 4
    and (select count(*) from pg_policies where schemaname = 'public'
          and tablename in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')) = 0
    and (select count(*) from information_schema.role_table_grants where table_schema = 'public'
          and table_name in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')
          and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
    and coalesce((select string_agg(distinct routine_name, ',' order by routine_name) from information_schema.routine_privileges
          where routine_schema = 'public' and routine_name like 'band\_%' and grantee in ('anon', 'PUBLIC')), '') = 'band_apply,band_recruitment_public'
    and public.band_recruitment_public('la-mua-thu')->'recruitment' is not null
  then 'PASS' else 'FAIL' end
) z order by o;
