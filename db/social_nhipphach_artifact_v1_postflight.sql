-- NHỊP & PHÁCH ARTIFACT SHARE V1 — POSTFLIGHT production (CHỈ ĐỌC).
select 'column' as section, column_name as item, data_type as detail from information_schema.columns
 where table_schema = 'public' and table_name = 'tool_artifacts' and column_name in ('content', 'content_sha256') order by 2;
select 'constraint' as section, conname as item, pg_get_constraintdef(oid) as detail from pg_constraint
 where conrelid = 'public.tool_artifacts'::regclass and conname in ('tool_artifacts_tool_kind_check', 'tool_artifacts_content_check') order by 2;
select 'grant' as section, grantee as item, string_agg(privilege_type, ',' order by privilege_type) as detail
  from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tool_artifacts'
   and grantee in ('anon', 'authenticated', 'PUBLIC') group by grantee order by 2;
select 'policy' as section, policyname as item, cmd as detail from pg_policies where schemaname = 'public' and tablename = 'tool_artifacts';
select 'function' as section, p.proname as item,
       'secdef=' || p.prosecdef || ' anon=' || has_function_privilege('anon', p.oid, 'execute') || ' auth=' || has_function_privilege('authenticated', p.oid, 'execute') as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('social_share_tool_result', 'social_delete_tool_artifact', 'nhipphach_musicxml_check', 'nhipphach_settings_normalize', 'bms_song_normalize') order by 2;
select 'rpc' as section, 'markers' as item,
       'bms=' || (position('BMS_ARTIFACT_V1' in prosrc) > 0) || ' nhipphach=' || (position('NHIPPHACH_ARTIFACT_V1' in prosrc) > 0)
       || ' touches_master=' || (position('musicxml_library' in prosrc) > 0 or position('nhipphach_score' in prosrc) > 0) as detail
  from pg_proc where proname = 'social_share_tool_result';
select 'counts' as section, 'artifacts · ' || tool as item, count(*)::text as detail from public.tool_artifacts group by tool
union all select 'counts', 'tool_share · ' || coalesce(tool_share ->> 'tool', '-'), count(*)::text from public.class_posts where type = 'tool_share' group by 2
union all select 'counts', 'master musicxml_library', count(*)::text from public.musicxml_library
union all select 'counts', 'posts total', count(*)::text from public.class_posts;
