-- POSTFLIGHT (read-only) cho db/dm_v1_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung hội thoại.
select section, item from (
  select 1 o, 'CHECK' section, 'bảng dm_*: ' || (select string_agg(c.relname || '(rls=' || c.relrowsecurity || ')', ', ' order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('dm_conversations', 'dm_participants', 'dm_messages')) item
  union all select 2, 'CHECK', 'quyền bảng dm_* cho anon/authenticated/PUBLIC (phải 0): ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('dm_conversations', 'dm_participants', 'dm_messages') and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 3, 'CHECK', 'policy trên bảng dm_* (phải 0): ' || (select count(*) from pg_policies
     where schemaname = 'public' and tablename in ('dm_conversations', 'dm_participants', 'dm_messages'))
  union all select 4, 'CHECK', 'md5 hàm dm_*: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'dm\_%')
  union all select 5, 'CHECK', 'bảng/hàm Friends + identity không đổi: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in
       ('class_public_identity', 'is_class_member', 'is_class_member_user', 'is_friend_of', 'friendship_status'))
  union all select 9, 'GATE', case when
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('dm_conversations', 'dm_participants', 'dm_messages')
           and c.relrowsecurity and not c.relforcerowsecurity and obj_description(c.oid, 'pg_class') like 'dm_v1:%') = 3
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public'
         and table_name in ('dm_conversations', 'dm_participants', 'dm_messages') and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename in ('dm_conversations', 'dm_participants', 'dm_messages')) = 0
   -- 8 RPC client: SECURITY DEFINER, search_path rỗng, EXECUTE chỉ cho authenticated (không PUBLIC/anon)
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_can_message', 'dm_find', 'dm_start', 'dm_send', 'dm_conversations', 'dm_messages', 'dm_mark_read', 'dm_unread_count')
           and p.prosecdef and p.proconfig @> array['search_path=""'] and obj_description(p.oid, 'pg_proc') like 'dm_v1:%'
           and has_function_privilege('authenticated', p.oid, 'execute')
           and not has_function_privilege('anon', p.oid, 'execute')
           and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)) = 8
   -- 2 hàm nội bộ: không ai ngoài owner/service gọi được
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_rule', 'dm_append') and p.prosecdef
           and not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) = 2
   and (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('class_public_identity', 'is_class_member', 'is_class_member_user', 'is_friend_of', 'friendship_status'))
       = 'class_public_identity=c1129bf0314c9ee6954a177059368562,friendship_status=9f653ba0b1fbcb58c69acaba880906fc,'
      || 'is_class_member=459786921eb5bbd4ff07c83bdb4db480,is_class_member_user=09b747d3ec6be35cc8e9f77c5c4e0b8a,'
      || 'is_friend_of=c5281e64105ae14e008445ba7fb5c354'
   and (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname like 'dm\_%') = 'dm_append=07e8750b2391ef413f8c7ee258031241,dm_can_message=05d8157fabb5e6f2da69c1b98c01aa7c,dm_conversations=aaaaae7481c7c569cbce0ace968b643e,dm_find=eca4bcd25d5241e9e9f800642761206c,dm_mark_read=a38c5348c98e51e6f94fb31b73eacc6d,dm_messages=e01f291a572f31eb103d9d963e28cf4b,dm_rule=763d62ac7dc770931aa9a422701d21df,dm_send=28ea5818ec92c40cb3e98948a7644b7e,dm_start=8481b089af50d1c3b3d6b156e75ee5e8,dm_unread_count=4490dabacd28d12f4a0179f7baa39b16'
  then 'PASS' else 'FAIL' end
) z order by o;
