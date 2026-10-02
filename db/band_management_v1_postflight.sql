-- POSTFLIGHT (read-only) sau db/band_management_v1_setup.sql. Chỉ đếm — không đọc dữ liệu cá nhân.
select section, item from (
  select 1 o, 'CHECK' section, 'bảng: ' || (select string_agg(c.relname || (case when c.relrowsecurity then '(RLS)' else '(KHÔNG RLS!)' end), ', ' order by c.relname)
     from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public'
       and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications', 'band_members', 'band_member_roles')) item
  union all select 2, 'CHECK', 'policy trên 6 bảng: ' || (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications', 'band_members', 'band_member_roles'))
  union all select 3, 'CHECK', 'quyền bảng anon/authenticated: ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications', 'band_members', 'band_member_roles')
       and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 4, 'CHECK', 'anon EXECUTE: ' || coalesce((select string_agg(distinct routine_name, ',' order by routine_name)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name like 'band\_%' and grantee in ('anon', 'PUBLIC')), '-')
  union all select 5, 'CHECK', 'authenticated EXECUTE: ' || coalesce((select string_agg(distinct routine_name, ',' order by routine_name)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name like 'band\_%' and grantee = 'authenticated'), '-')
  union all select 6, 'CHECK', 'danh mục la-mua-thu (vị trí/vai trò): ' || coalesce((select jsonb_array_length(position_catalog) || '/' || jsonb_array_length(role_catalog)
     from public.bands where slug = 'la-mua-thu'), '-')
  union all select 7, 'CHECK', 'đơn / thành viên / vai trò: ' || (select count(*) from public.band_applications) || ' / '
     || (select count(*) from public.band_members) || ' / ' || (select count(*) from public.band_member_roles)
  union all select 9, 'GATE', case when
        (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public'
          and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications', 'band_members', 'band_member_roles') and c.relrowsecurity) = 6
    and (select count(*) from pg_policies where schemaname = 'public'
          and tablename in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications', 'band_members', 'band_member_roles')) = 0
    and (select count(*) from information_schema.role_table_grants where table_schema = 'public'
          and table_name in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications', 'band_members', 'band_member_roles')
          and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
    and coalesce((select string_agg(distinct routine_name, ',' order by routine_name) from information_schema.routine_privileges
          where routine_schema = 'public' and routine_name like 'band\_%' and grantee in ('anon', 'PUBLIC')), '') = 'band_apply,band_recruitment_public'
    and coalesce((select string_agg(distinct routine_name, ',' order by routine_name) from information_schema.routine_privileges
          where routine_schema = 'public' and routine_name like 'band\_%' and grantee = 'authenticated'), '')
        = 'band_admin_accept,band_admin_add_member,band_admin_applications,band_admin_bands,band_admin_overview,band_admin_set_role,band_admin_set_status,band_admin_update_member,band_apply,band_recruitment_public'
    and (select obj_description(p.oid, 'pg_proc') from pg_proc p join pg_namespace s on s.oid = p.pronamespace
          where s.nspname = 'public' and p.proname = 'band_can_manage') like 'band_management_v1:%'
    and (select jsonb_array_length(role_catalog) from public.bands where slug = 'la-mua-thu') = 6
    and public.band_recruitment_public('la-mua-thu')->'recruitment' is not null
  then 'PASS' else 'FAIL' end
) z order by o;
