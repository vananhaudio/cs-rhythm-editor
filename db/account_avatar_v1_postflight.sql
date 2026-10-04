-- POSTFLIGHT (read-only) sau db/account_avatar_v1_setup.sql. Không đọc dữ liệu cá nhân.
select section, item from (
  select 1 o, 'CHECK' section, 'class_public_identity md5 = ' || coalesce((select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = 'class_public_identity'), 'VẮNG') item
  union all select 2, 'CHECK', 'EXECUTE class_set_my_avatar: ' || coalesce((select string_agg(distinct grantee, ',' order by grantee)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'class_set_my_avatar'), '-')
  union all select 3, 'CHECK', 'EXECUTE class_public_identity (ngoài postgres): ' || coalesce((select string_agg(distinct grantee, ',' order by grantee)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'class_public_identity'
       and grantee not in ('postgres', 'supabase_admin')), '-')
  union all select 4, 'CHECK', 'app_users có avatar_url: ' || (select count(*) from public.app_users where avatar_url is not null)
  union all select 5, 'CHECK', 'policy ghi trên app_users (phải 0): ' || (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'app_users' and cmd <> 'SELECT')
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'class_public_identity') = 'c1129bf0314c9ee6954a177059368562'
   and (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'app_users'
         and column_name = 'avatar_url') = 'text'
   and exists (select 1 from pg_constraint where conname = 'app_users_avatar_url_check')
   and coalesce((select string_agg(distinct grantee, ',' order by grantee) from information_schema.routine_privileges
         where routine_schema = 'public' and routine_name = 'class_set_my_avatar'
           and grantee in ('anon', 'authenticated', 'PUBLIC')), '') = 'authenticated'
   and not exists (select 1 from information_schema.routine_privileges where routine_schema = 'public'
         and routine_name = 'class_public_identity' and grantee in ('anon', 'authenticated', 'PUBLIC'))
   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'app_users' and cmd <> 'SELECT') = 0
  then 'PASS' else 'FAIL' end
) z order by o;
