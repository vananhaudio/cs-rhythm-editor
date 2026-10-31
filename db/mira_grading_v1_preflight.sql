-- Preflight MIRA CẠNH MÀN CHẤM BÀI V1 — CHỈ ĐỌC (prod-db.py query). GATE = PASS mới dryrun/migrate.
with checks(item, ok) as (
  select 'có learning_threads + learning_thread_events', to_regclass('public.learning_threads') is not null and to_regclass('public.learning_thread_events') is not null
  union all select 'có class_lesson_content + class_sessions', to_regclass('public.class_lesson_content') is not null and to_regclass('public.class_sessions') is not null
  union all select 'có student_360_facts', to_regclass('public.student_360_facts') is not null
  union all select 'có class_public_identity(uuid)', to_regprocedure('public.class_public_identity(uuid)') is not null
  union all select 'có is_teacher()', to_regprocedure('public.is_teacher()') is not null
  union all select 'chưa có bảng mira_grading_*', to_regclass('public.mira_grading_keys') is null and to_regclass('public.mira_grading_tickets') is null
  union all select 'chưa có hàm mira_grading_*', not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname like 'mira\_grading\_%')
)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(ok) from checks) then 'PASS' else 'STOP' end;
