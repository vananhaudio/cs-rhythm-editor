-- Preflight Student 360 P2 — CHỈ ĐỌC (prod-db.py query). GATE = PASS mới dryrun/migrate.
with checks(item, ok) as (
  select 'P1 có student_360_facts', to_regclass('public.student_360_facts') is not null
  union all select 'P1 có student_360_log()', to_regprocedure('public.student_360_log(uuid, uuid, text, jsonb, jsonb)') is not null
  union all select 'P1 có student_360_fact_json()', to_regprocedure('public.student_360_fact_json(public.student_360_facts, boolean)') is not null
  union all select 'P1 có student_360_need_uid()', to_regprocedure('public.student_360_need_uid()') is not null
  union all select 'is_teacher() tồn tại', to_regprocedure('public.is_teacher()') is not null
  union all select 'chưa có student_360_set_visibility (tên trống)',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'student_360_set_visibility')
  union all select 'P1 có đủ 7 RPC + 2 hàm nội bộ', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname in ('student_360_get','student_360_add_fact','student_360_edit_fact',
                      'student_360_set_verification','student_360_revoke_fact','student_360_revoke_by_source','student_360_fact_history',
                      'student_360_log','student_360_need_uid')) = 9
  union all select 'RLS bật trên 2 bảng P1', (select count(*) from pg_class where oid in ('public.student_360_facts'::regclass,'public.student_360_fact_log'::regclass) and relrowsecurity) = 2
  union all select 'anon/authenticated KHÔNG có quyền bảng P1', not exists (select 1 from (values ('anon'),('authenticated')) r(role),
                      (values ('public.student_360_facts'),('public.student_360_fact_log')) t(tbl),
                      (values ('select'),('insert'),('update'),('delete')) pr(priv) where has_table_privilege(r.role, t.tbl, pr.priv))
  union all select 'hàm nội bộ (log, need_uid) không gọi được bởi anon/authenticated', not exists (select 1 from (values ('anon'),('authenticated')) r(role),
                      (values ('public.student_360_log(uuid, uuid, text, jsonb, jsonb)'),('public.student_360_need_uid()')) f(fn)
                      where has_function_privilege(r.role, f.fn, 'execute'))
  union all select 'anon KHÔNG gọi được get/add (RPC P1)', not has_function_privilege('anon', 'public.student_360_get(uuid, boolean)', 'execute')
  union all select 'trigger bất biến nhật ký tồn tại', exists (select 1 from pg_trigger where tgrelid = 'public.student_360_fact_log'::regclass and not tgisinternal))
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(ok) from checks) then 'PASS' else 'STOP' end;
