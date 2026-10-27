-- Preflight Student 360 P2 — CHỈ ĐỌC (prod-db.py query). GATE = PASS mới dryrun/migrate.
with checks(item, ok) as (
  select 'P1 có student_360_facts', to_regclass('public.student_360_facts') is not null
  union all select 'P1 có student_360_log()', to_regprocedure('public.student_360_log(uuid, uuid, text, jsonb, jsonb)') is not null
  union all select 'P1 có student_360_fact_json()', to_regprocedure('public.student_360_fact_json(public.student_360_facts, boolean)') is not null
  union all select 'P1 có student_360_need_uid()', to_regprocedure('public.student_360_need_uid()') is not null
  union all select 'is_teacher() tồn tại', to_regprocedure('public.is_teacher()') is not null
  union all select 'chưa có student_360_set_visibility (tên trống)',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'student_360_set_visibility'))
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(ok) from checks) then 'PASS' else 'STOP' end;
