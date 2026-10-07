-- PREFLIGHT (read-only) cho db/bms_share_lifecycle_v1_setup.sql — GATE = PASS mới được dryrun/migrate. Không đọc nội dung bài/hội thoại.
select section, item from (
  select 1 o, 'INFO' section, 'tool_artifacts: ' || (select coalesce(string_agg(tool || '/' || visibility || '=' || n, ', '), '(trống)') from (select tool, visibility, count(*) n from public.tool_artifacts group by 1, 2) z) item
  union all select 9, 'GATE', case when
       to_regclass('public.tool_artifacts') is not null and to_regprocedure('public.dm_share(uuid,text,text)') is not null
   and (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.social_share_tool_result(text,jsonb,uuid)')) = '932a8b041487bd5a75d72884485d2c35'
   and (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_append', 'dm_messages', 'dm_open', 'dm_share', 'dm_rule'))
       = 'dm_append=00aefca4,dm_messages=0605c799,dm_open=7cdcea48,dm_rule=763d62ac,dm_share=120fe4b6'
   and (   (to_regprocedure('public.dm_artifact_granted(uuid)') is null
            and (select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.tool_artifacts'::regclass and polname = 'tool_artifacts_read')
                = '((owner_id = auth.uid()) OR ((visibility = ''class''::text) AND is_class_member()))'
            and (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.tool_artifacts'::regclass and conname = 'tool_artifacts_visibility_check')
                = 'CHECK ((visibility = ''class''::text))')
        or to_regprocedure('public.dm_artifact_granted(uuid)') is not null)   -- baseline, hoặc đã có lifecycle (chạy lại)
  then 'PASS' else 'FAIL' end
) z order by o;
