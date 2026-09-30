-- BMS ARTIFACT SHARE V1 — POSTFLIGHT production (CHỈ ĐỌC).
select 'table' as section, c.relname as item, 'rls=' || c.relrowsecurity || ' force=' || c.relforcerowsecurity as detail
  from pg_class c where c.oid = to_regclass('public.tool_artifacts');
select 'grant' as section, grantee as item, string_agg(privilege_type, ',' order by privilege_type) as detail
  from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tool_artifacts'
   and grantee in ('anon', 'authenticated', 'PUBLIC') group by grantee order by 2;
select 'policy' as section, policyname as item, cmd || ' ' || roles::text || ' ' || coalesce(qual, '') as detail
  from pg_policies where schemaname = 'public' and tablename = 'tool_artifacts' order by 2;
select 'function' as section, p.proname as item,
       'secdef=' || p.prosecdef || ' anon_exec=' || has_function_privilege('anon', p.oid, 'execute')
       || ' auth_exec=' || has_function_privilege('authenticated', p.oid, 'execute') as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('social_share_tool_result', 'social_delete_tool_artifact', 'bms_song_normalize', 'tool_artifacts_cleanup_on_post_delete') order by 2;
select 'rpc_has_bms' as section, 'social_share_tool_result' as item, (position('BMS_ARTIFACT_V1' in p.prosrc) > 0)::text as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_share_tool_result';
select 'trigger' as section, tgname as item, tgenabled::text as detail from pg_trigger
 where tgrelid = 'public.class_posts'::regclass and tgname = 'class_posts_tool_artifact_cleanup';
select 'counts' as section, 'artifacts' as item, count(*)::text as detail from public.tool_artifacts
union all select 'counts', 'tool_share · ' || coalesce(tool_share ->> 'tool', '-'), count(*)::text from public.class_posts where type = 'tool_share' group by 2
union all select 'counts', 'posts total', count(*)::text from public.class_posts;
