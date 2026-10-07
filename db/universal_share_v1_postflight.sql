-- POSTFLIGHT (read-only) cho db/universal_share_v1_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung bài/hội thoại.
select section, item from (
  select 1 o, 'CHECK' section, 'ref check: ' || (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.dm_messages'::regclass and conname = 'dm_messages_ref_valid_check') item
  union all select 2, 'CHECK', 'md5 hàm: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('tool_artifact_save_for_share', 'bms_save_for_share', 'social_publish_tool_artifact', 'social_unpublish_tool_artifact', 'dm_share'))
  union all select 3, 'CHECK', 'quyền bảng dm_*/tool_artifacts (anon/PUBLIC phải 0): ' || (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in ('dm_conversations', 'dm_participants', 'dm_messages', 'tool_artifacts') and grantee in ('anon', 'PUBLIC'))
  union all select 9, 'GATE', case when
       (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.dm_messages'::regclass and conname = 'dm_messages_ref_valid_check') like '%class_session%'
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('tool_artifact_save_for_share', 'bms_save_for_share', 'social_publish_tool_artifact', 'social_unpublish_tool_artifact', 'dm_share') and p.prosecdef and p.proconfig @> array['search_path=""']
           and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
           and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)) = 5
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in ('dm_conversations', 'dm_participants', 'dm_messages') and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename like 'dm\_%') = 0
   and (select count(*) from pg_policies where tablename = 'tool_artifacts') = 1
   and (select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.tool_artifacts'::regclass and polname = 'tool_artifacts_read') like '%dm_artifact_granted%'
   and (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('tool_artifact_save_for_share', 'bms_save_for_share', 'social_publish_tool_artifact', 'social_unpublish_tool_artifact', 'dm_share', 'dm_artifact_granted', 'tool_artifact_demote_or_delete', 'dm_append', 'dm_messages', 'dm_open', 'dm_rule', 'social_delete_tool_artifact', 'social_share_tool_result', 'tool_artifacts_cleanup_on_post_delete'))
       = 'bms_save_for_share=3ae2542b3179b836a1e3bf7b498bd53e,dm_append=00aefca46863797b950d494711ff9c08,dm_artifact_granted=493924c77fb6f204f1772e5227d62d84,'
         || 'dm_messages=0605c7996031d2f1c5ad438703da1134,dm_open=7cdcea4854c330d7298e0ac0a7404f1b,dm_rule=763d62ac7dc770931aa9a422701d21df,dm_share=512d95a7b6d3e82977b37958080bba9f,'
         || 'social_delete_tool_artifact=cbcac72830a72003d414863d1aee8806,social_publish_tool_artifact=1b45711ca20c3e2550ae9b64241c52aa,social_share_tool_result=932a8b041487bd5a75d72884485d2c35,'
         || 'social_unpublish_tool_artifact=02dde8ef411e8117a6c99088acfa1193,tool_artifact_demote_or_delete=07145b4a951f1d4609578e5cd75b6366,'
         || 'tool_artifact_save_for_share=bb6267d8626a746dee857767549b3e60,tool_artifacts_cleanup_on_post_delete=d2e889aee70e6fd0bb17b9167f2c8fb9'
  then 'PASS' else 'FAIL' end
) z order by o;
