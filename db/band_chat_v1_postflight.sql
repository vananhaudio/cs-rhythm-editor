-- POSTFLIGHT (read-only) cho db/band_chat_v1_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung tin nhắn.
select section, item from (
  select 1 o, 'CHECK' section, 'bảng bandchat_*: ' || (select string_agg(c.relname || '(rls=' || c.relrowsecurity || ')', ', ' order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads')) item
  union all select 2, 'CHECK', 'quyền bảng bandchat_* cho anon/authenticated/PUBLIC (phải 0): ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads') and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 3, 'CHECK', 'policy trên bảng bandchat_* (phải 0): ' || (select count(*) from pg_policies
     where schemaname = 'public' and tablename in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads'))
  union all select 4, 'CHECK', 'md5 hàm dm_*/identity: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname = 'class_public_identity'))
  union all select 9, 'GATE', case when
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads')
           and c.relrowsecurity and obj_description(c.oid, 'pg_class') like 'bandchat_v1:%') = 3
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public'
         and table_name in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads') and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads')) = 0
   -- 6 RPC client: SECURITY DEFINER, search_path rỗng, EXECUTE chỉ cho authenticated
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('bandchat_rooms', 'bandchat_messages', 'bandchat_send', 'bandchat_mark_read', 'bandchat_unread_count', 'bandchat_members')
           and p.prosecdef and p.proconfig @> array['search_path=""'] and obj_description(p.oid, 'pg_proc') like 'bandchat_v1:%'
           and has_function_privilege('authenticated', p.oid, 'execute')
           and not has_function_privilege('anon', p.oid, 'execute')
           and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)) = 6
   -- 2 hàm nội bộ: client không gọi được
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('bandchat_is_member', 'bandchat_append')
           and obj_description(p.oid, 'pg_proc') like 'bandchat_v1:%'
           and not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) = 2
  then 'PASS' else 'FAIL' end
) z order by o;
