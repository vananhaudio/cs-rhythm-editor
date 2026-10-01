/*
POSTFLIGHT LỚP CỦA TÔI V1 — READ-ONLY (một câu SELECT). Chạy SAU db/class_checkpoints_v1_setup.sql.
GATE PASS = đủ object · 3 hàm đã là bản V1 · quyền đúng (anon không EXECUTE, bảng tiến độ không cấp cho ai, không policy)
· trigger hoàn thành buổi đã gắn · ràng buộc mới đã có. Mục 'counts' = thống kê gộp.
*/
with checks as (
  select 'object'::text as section, x.name as item,
         case when to_regprocedure(x.name) is not null then 'present' else 'absent' end as detail,
         case when to_regprocedure(x.name) is not null then 'OK' else 'STOP' end as status
  from (values ('public.class_learning_state(uuid)'), ('public.lt_submit_checkpoint(uuid,integer,text,text,text,text,text,text)'),
               ('public.lsp_sync(uuid,uuid,text)'), ('public.lsp_try_complete(uuid,text,integer,uuid)'),
               ('public.cl_session_checkpoints(uuid,integer)'), ('public.cl_next_session(uuid,integer)')) x(name)
  union all
  select 'object', 'table learning_session_progress', coalesce(to_regclass('public.learning_session_progress')::text, 'absent'),
         case when to_regclass('public.learning_session_progress') is null then 'STOP' else 'OK' end
  union all
  select 'v1', p.proname, case when position('CHECKPOINT_V1' in p.prosrc) > 0 then 'V1' else 'OLD md5 ' || md5(p.prosrc) end,
         case when position('CHECKPOINT_V1' in p.prosrc) > 0 then 'OK' else 'STOP' end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('lt_detail', 'lt_set_visibility', 'social_class_activity')
  union all
  select 'grant', 'anon EXECUTE RPC V1',
         (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('class_learning_state', 'lt_submit_checkpoint', 'lt_detail', 'lt_set_visibility', 'social_class_activity')
            and has_function_privilege('anon', p.oid, 'execute'))::text,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('class_learning_state', 'lt_submit_checkpoint', 'lt_detail', 'lt_set_visibility', 'social_class_activity')
            and has_function_privilege('anon', p.oid, 'execute')) then 'STOP' else 'OK' end
  union all
  select 'grant', 'authenticated EXECUTE RPC V1',
         (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('class_learning_state', 'lt_submit_checkpoint') and has_function_privilege('authenticated', p.oid, 'execute'))::text,
         case when (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('class_learning_state', 'lt_submit_checkpoint') and has_function_privilege('authenticated', p.oid, 'execute')) = 2 then 'OK' else 'STOP' end
  union all
  select 'grant', 'hàm nội bộ cấp cho anon/authenticated',
         (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('lsp_sync', 'lsp_try_complete', 'cl_session_checkpoints', 'cl_next_session', 'lsp_on_checkpoint_passed', 'lsp_guard_history')
            and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))::text,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('lsp_sync', 'lsp_try_complete', 'cl_session_checkpoints', 'cl_next_session', 'lsp_on_checkpoint_passed', 'lsp_guard_history')
            and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) then 'STOP' else 'OK' end
  union all
  select 'grant', 'quyền bảng learning_session_progress cho anon/authenticated',
         (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'learning_session_progress'
            and grantee in ('anon', 'authenticated', 'PUBLIC'))::text,
         case when exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'learning_session_progress'
            and grantee in ('anon', 'authenticated', 'PUBLIC')) then 'STOP' else 'OK' end
  union all
  select 'grant', 'policy trên learning_session_progress', (select count(*) from pg_policies where tablename = 'learning_session_progress')::text,
         case when exists (select 1 from pg_policies where tablename = 'learning_session_progress') then 'STOP' else 'OK' end
  union all
  select 'trigger', t.name, case when exists (select 1 from pg_trigger where tgname = t.name and not tgisinternal) then 'present' else 'absent' end,
         case when exists (select 1 from pg_trigger where tgname = t.name and not tgisinternal) then 'OK' else 'STOP' end
  from (values ('learning_threads_checkpoint_passed'), ('learning_session_progress_guard')) t(name)
  union all
  select 'constraint', c.conname, pg_get_constraintdef(c.oid),
         case when pg_get_constraintdef(c.oid) like '%program_checkpoint%' then 'OK' else 'STOP' end
  from pg_constraint c where c.conrelid = 'public.learning_threads'::regclass
    and c.conname in ('learning_threads_kind_check', 'learning_threads_key_check', 'learning_threads_visibility_check')
  union all
  select 'counts', 'checkpoint threads · tiến độ',
         (select count(*) from public.learning_threads where content_kind = 'program_checkpoint')::text || ' · ' ||
         (select count(*) from public.learning_session_progress)::text, 'OK'
  union all
  select 'counts', 'thread cũ (course_lesson) theo visibility',
         coalesce((select string_agg(v || '=' || n, ', ') from (select visibility v, count(*)::text n from public.learning_threads
                   where content_kind <> 'program_checkpoint' group by 1) x), '0'), 'OK'
)
select section, item, detail, status from (
  select 1 as ord, section, item, detail, status from checks
  union all
  select 2, 'GATE', case when exists (select 1 from checks where status = 'STOP') then 'STOP' else 'PASS' end,
         (select count(*) filter (where status = 'STOP') from checks)::text || ' STOP', ''
) z order by ord, section, item;
