-- POSTFLIGHT (read-only) cho db/bms_share_lifecycle_v1_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung bài/hội thoại.
select section, item from (
  select 1 o, 'CHECK' section, 'visibility check: ' || (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.tool_artifacts'::regclass and conname = 'tool_artifacts_visibility_check') item
  union all select 2, 'CHECK', 'policy tool_artifacts: ' || (select string_agg(polname || ' ' || pg_get_expr(polqual, polrelid), ' | ') from pg_policy where polrelid = 'public.tool_artifacts'::regclass)
  union all select 3, 'CHECK', 'quyền bảng tool_artifacts (anon/PUBLIC phải 0; authenticated chỉ SELECT): ' || (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tool_artifacts' and grantee in ('anon', 'PUBLIC'))
       || ' / ' || (select coalesce(string_agg(privilege_type, ','), '') from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tool_artifacts' and grantee = 'authenticated')
  union all select 4, 'CHECK', 'md5 hàm: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_artifact_granted', 'bms_save_for_share', 'social_publish_tool_artifact', 'social_share_tool_result', 'dm_share', 'dm_messages', 'dm_append', 'dm_rule', 'social_delete_tool_artifact'))
  union all select 5, 'CHECK', 'số artifact theo visibility: ' || (select coalesce(string_agg(visibility || '=' || n, ', '), '(trống)') from (select visibility, count(*) n from public.tool_artifacts group by 1) z)
  union all select 9, 'GATE', case when
       (select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.tool_artifacts'::regclass and polname = 'tool_artifacts_read') like '%dm_artifact_granted%'
   and (select count(*) from pg_policy where polrelid = 'public.tool_artifacts'::regclass) = 1
   and (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.tool_artifacts'::regclass and conname = 'tool_artifacts_visibility_check') like '%class%shared%'
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tool_artifacts' and grantee in ('anon', 'PUBLIC')) = 0
   and (select string_agg(privilege_type, ',') from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tool_artifacts' and grantee = 'authenticated') = 'SELECT'
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_artifact_granted', 'bms_save_for_share', 'social_publish_tool_artifact') and p.prosecdef and p.proconfig @> array['search_path=""']
           and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
           and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)) = 3
   and (select count(*) from pg_indexes where indexname in ('dm_messages_ref_idx', 'class_posts_tool_artifact_once')) = 2
   and (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_artifact_granted', 'bms_save_for_share', 'social_publish_tool_artifact', 'social_share_tool_result', 'dm_share', 'dm_messages', 'dm_append', 'dm_open', 'dm_rule'))
       = 'bms_save_for_share=fe706f70edaba2ebca04595c2aab63d4,dm_append=00aefca46863797b950d494711ff9c08,dm_artifact_granted=493924c77fb6f204f1772e5227d62d84,'
         || 'dm_messages=0605c7996031d2f1c5ad438703da1134,dm_open=7cdcea4854c330d7298e0ac0a7404f1b,dm_rule=763d62ac7dc770931aa9a422701d21df,dm_share=120fe4b6498d4176dfa93907c859c6e9,'
         || 'social_publish_tool_artifact=e64c08ef0cb62b1fcc8ae37837e6d5e8,social_share_tool_result=932a8b041487bd5a75d72884485d2c35'
  then 'PASS' else 'FAIL' end
) z order by o;
