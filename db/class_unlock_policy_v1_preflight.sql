/*
PREFLIGHT CLASS_UNLOCK_POLICY_V1 — READ-ONLY (một câu SELECT). Chạy TRƯỚC db/class_unlock_policy_v1_setup.sql.
GATE PASS = 2 hàm bị thay đúng md5 đã kiểm (hoặc đã là bản CLASS_UNLOCK_POLICY_V1) · đủ hàm/bảng phụ thuộc.
Mục 'counts' = thống kê gộp (không dữ liệu cá nhân).
*/
with checks as (
  select 'replace'::text as section, x.name as item,
         coalesce((select case when position('CLASS_UNLOCK_POLICY_V1' in p.prosrc) > 0 then 'POLICY_V1' else 'md5 ' || md5(p.prosrc) end
                   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name), 'absent') as detail,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name
                             and (position('CLASS_UNLOCK_POLICY_V1' in p.prosrc) > 0 or md5(p.prosrc) = x.md5)) then 'OK' else 'STOP' end as status
  from (values ('lsp_sync', '85655a791d24a9a0997d94bcbe6687a3'), ('class_learning_state', 'db9015ea8a462af44a7750a5bbc26f86')) x(name, md5)
  union all
  select 'needed', x.name, case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name) then 'present' else 'absent' end,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name) then 'OK' else 'STOP' end
  from (values ('is_teacher'), ('cl_session_checkpoints'), ('cl_next_session'), ('lsp_try_complete'), ('lsp_on_checkpoint_passed'), ('lt_submit_checkpoint'), ('lt_answer_checkpoint')) x(name)
  union all
  select 'needed', 'table ' || x.t, coalesce(to_regclass('public.' || x.t)::text, 'absent'), case when to_regclass('public.' || x.t) is null then 'STOP' else 'OK' end
  from (values ('class_schedule'), ('learning_session_progress')) x(t)
  union all
  select 'counts', 'cột unlock_policy', case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_schedule' and column_name = 'unlock_policy') then 'đã có' else 'chưa có' end, 'INFO'
  union all
  select 'counts', 'lớp có program_code hợp lệ', (select count(*) from public.class_schedule where coalesce(program_code, '') ~ '^[A-Z0-9_]{1,32}$')::text, 'INFO'
)
select section, item, detail, status from checks
union all
select 'GATE', case when exists (select 1 from checks where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end, '', ''
order by 1, 2;
