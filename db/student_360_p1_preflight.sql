-- Preflight Student 360 P1 — CHỈ ĐỌC (chạy qua prod-db.py query). GATE = PASS mới được dryrun/migrate.
-- Không SELECT dữ liệu cá nhân: chỉ danh mục (bảng/cột/hàm/quyền) và số đếm.
with need_cols(tbl, col) as (values
  ('app_users','id'),('app_users','role'),
  ('edu_students','id'),('edu_students','user_id'),('edu_students','display_name'),('edu_students','level'),
  ('edu_students','enrolled_at'),('edu_students','is_active')),
missing as (
  select n.tbl || '.' || n.col as item from need_cols n
   where not exists (select 1 from information_schema.columns c
                      where c.table_schema = 'public' and c.table_name = n.tbl and c.column_name = n.col)),
fn as (select proname, md5(prosrc) as h from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
        where ns.nspname = 'public' and proname = 'is_teacher'),
checks(section, item, ok) as (
  select 'CHECK', 'auth.users tồn tại', to_regclass('auth.users') is not null
  union all select 'CHECK', 'public.app_users tồn tại', to_regclass('public.app_users') is not null
  union all select 'CHECK', 'public.edu_students tồn tại', to_regclass('public.edu_students') is not null
  union all select 'CHECK', 'is_teacher() tồn tại', to_regprocedure('public.is_teacher()') is not null
  union all select 'CHECK', 'is_teacher md5 = bản repo (' || coalesce((select h from fn), '-') || ')',
         coalesce((select h from fn), '') = '19b164504b4ce59b9bbdb4b0b64e48ad'
  union all select 'CHECK', 'cột cần dùng đủ (thiếu: ' || coalesce((select string_agg(item, ',') from missing), 'không') || ')',
         not exists (select 1 from missing)
  union all select 'CHECK', 'chưa có bảng student_360_* (tên trống)',
         to_regclass('public.student_360_facts') is null and to_regclass('public.student_360_fact_log') is null
  union all select 'CHECK', 'chưa có hàm student_360_* (tên trống)',
         not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                      where ns.nspname = 'public' and p.proname like 'student\_360\_%')
  union all select 'CHECK', 'auth.uid() tồn tại', to_regprocedure('auth.uid()') is not null
)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'INFO', 'edu_students: ' || (select count(*) from public.edu_students) || ' hàng, '
          || (select count(*) from public.edu_students where user_id is not null) || ' có user_id'
union all select 'INFO', 'app_users role=teacher/admin: ' || (select count(*) from public.app_users where role in ('teacher','admin'))
union all select 'INFO', 'rls_setup self_managed phải chứa student_360_* trước khi chạy lại rls_setup.sql (đã sửa trong repo)'
union all select 'GATE', case when (select bool_and(ok) from checks) then 'PASS' else 'STOP' end;
