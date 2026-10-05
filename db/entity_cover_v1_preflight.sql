-- PREFLIGHT (read-only) cho db/entity_cover_v1_setup.sql — GATE = PASS mới được migrate. Không đọc dữ liệu cá nhân.
select section, item from (
  select 1 o, 'CHECK' section, 'band_recruitment_public md5 = ' || coalesce((select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = 'band_recruitment_public'), 'VẮNG') item
  union all select 2, 'CHECK', 'band_admin_overview md5 = ' || coalesce((select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = 'band_admin_overview'), 'VẮNG')
  union all select 3, 'CHECK', 'cột mới đã có (phải 0): ' || (select count(*) from information_schema.columns where table_schema = 'public'
     and ((table_name = 'bands' and column_name = 'cover_url') or (table_name = 'edu_tools' and column_name = 'image_url')
       or (table_name = 'class_schedule' and column_name = 'cover_url')))
  union all select 4, 'CHECK', 'band_admin_set_cover đã có (phải 0): ' || (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = 'band_admin_set_cover')
  union all select 5, 'CHECK', 'policy trên bands/edu_tools/class_schedule: ' || (select count(*) from pg_policies
     where schemaname = 'public' and tablename in ('bands', 'edu_tools', 'class_schedule'))
  union all select 6, 'CHECK', 'số dòng bands/edu_tools/class_schedule: ' || (select count(*) from public.bands) || '/'
     || (select count(*) from public.edu_tools) || '/' || (select count(*) from public.class_schedule)
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'band_recruitment_public') = '1982a3f20aa84426c6b81aa83606e0fb'
   and (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'band_admin_overview') = 'ce9d40a9db96fbc3f78fa222137c6e59'
   and exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'is_teacher')
   and not exists (select 1 from information_schema.columns where table_schema = 'public'
         and ((table_name = 'bands' and column_name = 'cover_url') or (table_name = 'edu_tools' and column_name = 'image_url')
           or (table_name = 'class_schedule' and column_name = 'cover_url')))
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'band_admin_set_cover')
   and (select count(*) from pg_policies where schemaname = 'public' and tablename in ('bands', 'edu_tools', 'class_schedule')) = 5
  then 'PASS' else 'FAIL' end
) z order by o;
