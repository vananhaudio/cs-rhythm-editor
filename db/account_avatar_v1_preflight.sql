-- PREFLIGHT (read-only) cho db/account_avatar_v1_setup.sql — GATE = PASS mới được migrate.
-- Chỉ số đếm gộp, không đọc dữ liệu cá nhân.
select section, item from (
  select 1 o, 'CHECK' section, 'class_public_identity md5 = ' || coalesce((select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = 'class_public_identity'), 'VẮNG') item
  union all select 2, 'CHECK', 'app_users.avatar_url: ' || coalesce((select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'app_users' and column_name = 'avatar_url'), 'chưa có')
  union all select 3, 'CHECK', 'policy ghi trên app_users (phải 0): ' || (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'app_users' and cmd <> 'SELECT')
  union all select 4, 'CHECK', 'app_users không có edu_students theo role: ' || coalesce((select string_agg(r || '=' || n, ', ' order by r) from (
     select coalesce(au.role, '-') r, count(*) n from public.app_users au
     where not exists (select 1 from public.edu_students es where es.user_id = au.id) group by 1) z), '-')
  union all select 5, 'CHECK', 'hàm class_set_my_avatar: ' || coalesce((select coalesce(obj_description(p.oid, 'pg_proc'), 'KHÔNG comment')
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'class_set_my_avatar'), 'chưa có')
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'class_public_identity')
         in ('9bda0938889c533040fb52f3301f3152', 'c1129bf0314c9ee6954a177059368562')
   and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'app_users'
         and column_name in ('id', 'role', 'name')) = 3
   and coalesce((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'app_users'
         and column_name = 'avatar_url'), 'text') = 'text'
   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'app_users' and cmd <> 'SELECT') = 0
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'class_set_my_avatar'
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'account_avatar_v1:%')
  then 'PASS' else 'FAIL' end
) z order by o;
