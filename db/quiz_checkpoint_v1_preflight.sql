/*
PREFLIGHT QUIZ CHECKPOINT V1 — READ-ONLY (một câu SELECT). Chạy TRƯỚC db/quiz_checkpoint_v1_setup.sql.
GATE PASS = 2 hàm bị thay đúng md5 production đã kiểm (hoặc đã là bản QUIZ_CHECKPOINT_V1) · đủ hàm/bảng phụ thuộc.
Mục 'counts' = thống kê gộp (không dữ liệu cá nhân).
*/
with checks as (
  select 'replace'::text as section, x.name as item,
         coalesce((select case when position('QUIZ_CHECKPOINT_V1' in p.prosrc) > 0 then 'QUIZ_V1' else 'md5 ' || md5(p.prosrc) end
                   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name), 'absent') as detail,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name
                             and (position('QUIZ_CHECKPOINT_V1' in p.prosrc) > 0 or md5(p.prosrc) = x.md5)) then 'OK' else 'STOP' end as status
  from (values ('lsp_try_complete', '8feb5d0c9f16151857bf2ea625d2e83a'), ('class_learning_state', 'fd0ebe70a9674b8c1cc12c6df97d6c47')) x(name, md5)
  union all
  select 'needed', x.name, case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name) then 'present' else 'absent' end,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x.name) then 'OK' else 'STOP' end
  from (values ('is_teacher'), ('cl_session_checkpoints'), ('cl_next_session'), ('lsp_sync'), ('lsp_on_checkpoint_passed')) x(name)
  union all
  select 'needed', 'tva_private.can_read_class_curriculum(uuid)', coalesce(to_regprocedure('tva_private.can_read_class_curriculum(uuid)')::text, 'absent'),
         case when to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is null then 'STOP' else 'OK' end
  union all
  select 'needed', 'table learning_session_progress', coalesce(to_regclass('public.learning_session_progress')::text, 'absent'),
         case when to_regclass('public.learning_session_progress') is null then 'STOP' else 'OK' end
  union all
  select 'counts', 'quiz tables', coalesce(to_regclass('public.class_checkpoint_keys')::text, '-') || ' / ' || coalesce(to_regclass('public.learning_checkpoint_passes')::text, '-'), 'INFO'
)
select section, item, detail, status from checks
union all
select 'GATE', case when exists (select 1 from checks where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end, '', ''
order by 1, 2;
