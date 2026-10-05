-- POSTFLIGHT (read-only) sau db/entity_cover_v1_setup.sql. Không đọc dữ liệu cá nhân.
select section, item from (
  select 1 o, 'CHECK' section, 'cột mới: ' || coalesce((select string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable, ', ' order by table_name)
     from information_schema.columns where table_schema = 'public'
       and ((table_name = 'bands' and column_name = 'cover_url') or (table_name = 'edu_tools' and column_name = 'image_url')
         or (table_name = 'class_schedule' and column_name = 'cover_url'))), '-') item
  union all select 2, 'CHECK', 'check constraint: ' || (select count(*) from pg_constraint
     where conname in ('bands_cover_url_check', 'edu_tools_image_url_check', 'class_schedule_cover_url_check'))
  union all select 3, 'CHECK', 'EXECUTE band_admin_set_cover: ' || coalesce((select string_agg(distinct grantee, ',' order by grantee)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'band_admin_set_cover'
       and grantee in ('anon', 'authenticated', 'PUBLIC')), '-')
  union all select 4, 'CHECK', 'EXECUTE band_recruitment_public: ' || coalesce((select string_agg(distinct grantee, ',' order by grantee)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'band_recruitment_public'
       and grantee in ('anon', 'authenticated', 'PUBLIC')), '-')
  union all select 5, 'CHECK', 'public trả cover_url: ' || coalesce((select (public.band_recruitment_public(slug)->'band') ? 'cover_url'
     from public.bands where status = 'active' order by created_at limit 1)::text, 'không có Band active')
  union all select 6, 'CHECK', 'policy trên bands/edu_tools/class_schedule: ' || (select count(*) from pg_policies
     where schemaname = 'public' and tablename in ('bands', 'edu_tools', 'class_schedule'))
  union all select 7, 'CHECK', 'số dòng bands/edu_tools/class_schedule: ' || (select count(*) from public.bands) || '/'
     || (select count(*) from public.edu_tools) || '/' || (select count(*) from public.class_schedule)
  union all select 9, 'GATE', case when
       (select count(*) from information_schema.columns where table_schema = 'public' and data_type = 'text' and is_nullable = 'YES'
         and ((table_name = 'bands' and column_name = 'cover_url') or (table_name = 'edu_tools' and column_name = 'image_url')
           or (table_name = 'class_schedule' and column_name = 'cover_url'))) = 3
   and (select count(*) from pg_constraint
         where conname in ('bands_cover_url_check', 'edu_tools_image_url_check', 'class_schedule_cover_url_check')) = 3
   and coalesce((select string_agg(distinct grantee, ',' order by grantee) from information_schema.routine_privileges
         where routine_schema = 'public' and routine_name = 'band_admin_set_cover'
           and grantee in ('anon', 'authenticated', 'PUBLIC')), '') = 'authenticated'
   and coalesce((select string_agg(distinct grantee, ',' order by grantee) from information_schema.routine_privileges
         where routine_schema = 'public' and routine_name = 'band_recruitment_public'
           and grantee in ('anon', 'authenticated', 'PUBLIC')), '') = 'anon,authenticated'
   and (select prosrc like '%''cover_url'', b.cover_url%' from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'band_recruitment_public')
   and (select prosrc like '%can_edit_cover%' from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'band_admin_overview')
   and (select count(*) from pg_policies where schemaname = 'public' and tablename in ('bands', 'edu_tools', 'class_schedule')) = 5
  then 'PASS' else 'FAIL' end
) z order by o;
