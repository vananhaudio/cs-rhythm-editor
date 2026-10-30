-- Preflight Student 360 P2b — CHỈ ĐỌC (prod-db.py query). GATE = PASS mới dryrun/migrate.
with fn as (select p.oid, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'student_360_add_fact'),
checks(item, ok) as (
  select 'đúng 1 bản student_360_add_fact (không overload)', (select count(*) from fn) = 1
  union all select 'thân hàm = bản P1 đã biết (md5 a42fa039…), chưa áp P2b', (select bool_and(md5(prosrc) = 'a42fa03906e06e2cb3c49331701edd05') from fn)
  union all select 'authenticated có EXECUTE, anon KHÔNG', (select has_function_privilege('authenticated', oid, 'execute') and not has_function_privilege('anon', oid, 'execute') from fn limit 1)
  union all select 'RLS bật trên 2 bảng P1', (select count(*) from pg_class where oid in ('public.student_360_facts'::regclass, 'public.student_360_fact_log'::regclass) and relrowsecurity) = 2
  union all select 'anon/authenticated KHÔNG có quyền bảng P1', not exists (select 1 from (values ('anon'),('authenticated')) r(role), (values ('public.student_360_facts'),('public.student_360_fact_log')) t(tbl),
        (values ('select'),('insert'),('update'),('delete')) pr(priv) where has_table_privilege(r.role, t.tbl, pr.priv))
  union all select 'is_teacher() tồn tại', to_regprocedure('public.is_teacher()') is not null)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(ok) from checks) then 'PASS' else 'STOP' end;
