-- POSTFLIGHT (read-only) cho db/chat_list_v2_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung tin nhắn.
select section, item from (
  select 1 o, 'CHECK' section, 'chat_pins: rls=' || (select c.relrowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'chat_pins') item
  union all select 2, 'CHECK', 'quyền bảng chat_pins cho anon/authenticated/PUBLIC (phải 0): ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'chat_pins' and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 3, 'CHECK', 'policy trên chat_pins (phải 0): ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'chat_pins')
  union all select 4, 'CHECK', 'md5 hàm dm_*/bandchat_*/identity (không đổi): ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname like 'bandchat\_%' or p.proname = 'class_public_identity'))
  union all select 9, 'GATE', case when
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'chat_pins' and c.relrowsecurity and obj_description(c.oid, 'pg_class') like 'chat_list_v2:%') = 1
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'chat_pins' and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'chat_pins') = 0
   -- 5 RPC client: SECURITY DEFINER, search_path rỗng, EXECUTE chỉ cho authenticated
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('chat_inbox', 'chat_inbox_summary', 'chat_conversation_info', 'chat_pin_set')
           and p.prosecdef and p.proconfig @> array['search_path=""'] and obj_description(p.oid, 'pg_proc') like 'chat_list_v2:%'
           and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
           and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)) = 4
   -- hàm nội bộ: client không gọi được
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'chat_inbox_base' and obj_description(p.oid, 'pg_proc') like 'chat_list_v2:%'
           and not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) = 1
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'chat_fold' and obj_description(p.oid, 'pg_proc') like 'chat_list_v2:%') = 1
  then 'PASS' else 'FAIL' end
) z order by o;
