-- POSTFLIGHT (read-only) cho db/dm_share_v1_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung hội thoại.
select section, item from (
  select 1 o, 'CHECK' section, 'cột ref_*: ' || (select string_agg(column_name, ',' order by column_name) from information_schema.columns
     where table_schema = 'public' and table_name = 'dm_messages' and column_name in ('ref_type', 'ref_key')) item
  union all select 2, 'CHECK', 'quyền bảng dm_* cho anon/authenticated/PUBLIC (phải 0): ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('dm_conversations', 'dm_participants', 'dm_messages') and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 3, 'CHECK', 'policy trên bảng dm_* (phải 0): ' || (select count(*) from pg_policies where schemaname = 'public' and tablename like 'dm\_%')
  union all select 4, 'CHECK', 'md5 hàm dm_*: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'dm\_%')
  union all select 9, 'GATE', case when
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
         and c.relname in ('dm_conversations', 'dm_participants', 'dm_messages') and c.relrowsecurity) = 3
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public'
         and table_name in ('dm_conversations', 'dm_participants', 'dm_messages') and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename like 'dm\_%') = 0
   and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'dm_messages' and column_name in ('ref_type', 'ref_key')) = 2
   and (select count(*) from pg_constraint where conrelid = 'public.dm_messages'::regclass and conname in ('dm_messages_ref_pair_check', 'dm_messages_ref_valid_check')) = 2
   -- client: SECURITY DEFINER, search_path rỗng, EXECUTE chỉ cho authenticated
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_can_message', 'dm_find', 'dm_start', 'dm_send', 'dm_conversations', 'dm_messages', 'dm_mark_read', 'dm_unread_count', 'dm_share')
           and p.prosecdef and p.proconfig @> array['search_path=""']
           and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
           and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)) = 9
   -- nội bộ: không ai ngoài owner/service gọi được
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_rule', 'dm_append', 'dm_open') and p.prosecdef
           and not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) = 3
   and (select count(*) from pg_proc where proname = 'dm_append' and pronargs = 3) = 0
   and (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname like 'dm\_%')
       = 'dm_append=00aefca46863797b950d494711ff9c08,dm_can_message=05d8157fabb5e6f2da69c1b98c01aa7c,dm_conversations=aaaaae7481c7c569cbce0ace968b643e,dm_find=eca4bcd25d5241e9e9f800642761206c,dm_mark_read=a38c5348c98e51e6f94fb31b73eacc6d,dm_messages=0605c7996031d2f1c5ad438703da1134,dm_open=7cdcea4854c330d7298e0ac0a7404f1b,dm_rule=763d62ac7dc770931aa9a422701d21df,dm_send=28ea5818ec92c40cb3e98948a7644b7e,dm_share=120fe4b6498d4176dfa93907c859c6e9,dm_start=8481b089af50d1c3b3d6b156e75ee5e8,dm_unread_count=4490dabacd28d12f4a0179f7baa39b16'
  then 'PASS' else 'FAIL' end
) z order by o;
