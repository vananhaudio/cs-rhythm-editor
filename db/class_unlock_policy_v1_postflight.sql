/*
POSTFLIGHT CLASS_UNLOCK_POLICY_V1 — READ-ONLY (một câu SELECT). Chạy SAU db/class_unlock_policy_v1_setup.sql.
GATE PASS = cột + ràng buộc có · 2 hàm là bản POLICY_V1 · anon không EXECUTE RPC · KHÔNG lớp nào bị đổi sang 'open' ngoài ý muốn
(mục 'counts' liệt kê số lớp 'open' để Owner đối chiếu với danh sách đã duyệt).
*/
with checks as (
  select 'schema'::text as section, 'cột unlock_policy' as item,
         coalesce((select data_type || ' default ' || coalesce(column_default, '-') from information_schema.columns
                   where table_schema = 'public' and table_name = 'class_schedule' and column_name = 'unlock_policy'), 'absent') as detail,
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_schedule'
                             and column_name = 'unlock_policy' and is_nullable = 'NO' and column_default like '%sequential%') then 'OK' else 'STOP' end as status
  union all
  select 'schema', 'ràng buộc unlock_policy', coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'class_schedule_unlock_policy_check' and conrelid = 'public.class_schedule'::regclass), 'absent'),
         case when exists (select 1 from pg_constraint where conname = 'class_schedule_unlock_policy_check' and conrelid = 'public.class_schedule'::regclass) then 'OK' else 'STOP' end
  union all
  select 'function', x.name, coalesce((select case when position('CLASS_UNLOCK_POLICY_V1' in p.prosrc) > 0 then 'POLICY_V1' else 'md5 ' || md5(p.prosrc) end
                                       from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name), 'absent'),
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name and position('CLASS_UNLOCK_POLICY_V1' in p.prosrc) > 0) then 'OK' else 'STOP' end
  from (values ('lsp_sync'), ('class_learning_state')) x(name)
  union all
  select 'privilege', 'anon/PUBLIC EXECUTE class_learning_state + lsp_sync',
         (select count(*) from information_schema.routine_privileges where routine_name in ('class_learning_state', 'lsp_sync') and grantee in ('anon', 'PUBLIC'))::text,
         case when (select count(*) from information_schema.routine_privileges where routine_name in ('class_learning_state', 'lsp_sync') and grantee in ('anon', 'PUBLIC')) = 0 then 'OK' else 'STOP' end
  union all
  select 'privilege', 'authenticated/anon EXECUTE lsp_sync (hàm nội bộ)',
         (select count(*) from information_schema.routine_privileges where routine_name = 'lsp_sync' and grantee in ('anon', 'authenticated', 'PUBLIC'))::text,
         case when (select count(*) from information_schema.routine_privileges where routine_name = 'lsp_sync' and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0 then 'OK' else 'STOP' end
  union all
  select 'counts', 'lớp theo chính sách', coalesce((select string_agg(unlock_policy || '=' || n, ' ' order by unlock_policy) from (select unlock_policy, count(*) n from public.class_schedule group by 1) z), '-'), 'INFO'
  union all
  select 'counts', 'lớp đang open (mã)', coalesce((select string_agg(code, ', ' order by code) from public.class_schedule where unlock_policy = 'open'), '(không có)'), 'INFO'
)
select section, item, detail, status from checks
union all
select 'GATE', case when exists (select 1 from checks where status = 'STOP') then 'STOP - DO NOT USE' else 'PASS' end, '', ''
order by 1, 2;
