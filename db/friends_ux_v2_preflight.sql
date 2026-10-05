-- PREFLIGHT (read-only) cho db/friends_ux_v2_setup.sql — GATE = PASS mới được migrate.
-- Chỉ số đếm gộp + md5, không đọc dữ liệu cá nhân. Dấu vân tay friendships: so với POSTFLIGHT (phải giống hệt).
select section, item from (
  select 1 o, 'CHECK' section, 'friendships theo status: ' || coalesce((select string_agg(status || '=' || n, ', ' order by status)
     from (select status, count(*) n from public.friendships group by status) z), 'trống') item
  union all select 2, 'CHECK', 'friendships dấu vân tay: ' || (select count(*)::text || ':' || md5(coalesce(string_agg(
       f.id::text || f.requester_id::text || f.addressee_id::text || f.status || f.created_at::text || coalesce(f.responded_at::text, '-'),
       ',' order by f.id), '')) from public.friendships f)
  union all select 3, 'CHECK', 'md5 hàm: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in
       ('friendship_status', 'send_friend_request', 'respond_friend_request', 'unfriend', 'my_friends', 'incoming_friend_requests',
        'is_friend_of', 'can_view_wall', 'is_class_member', 'outgoing_friend_requests'))
  union all select 4, 'CHECK', 'quyền bảng friendships cho anon/authenticated (phải 0): ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'friendships' and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 5, 'CHECK', 'policy trên friendships (phải 0): ' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'friendships')
  union all select 6, 'CHECK', 'trigger trên friendships (phải 0): ' || (select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.friendships'::regclass)
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc where oid = 'public.respond_friend_request(uuid,boolean)'::regprocedure)
         in ('a09b7ad5f7f402a2a35a7b262f3dd40a', '8f03c840dc8ab3607851c824d40d566e')
   and (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('friendship_status', 'send_friend_request', 'unfriend', 'my_friends',
           'incoming_friend_requests', 'is_friend_of', 'is_class_member'))
       = 'friendship_status=9f653ba0b1fbcb58c69acaba880906fc,incoming_friend_requests=861e1bd1b3c3086f2b462bc1731b4689,'
      || 'is_class_member=459786921eb5bbd4ff07c83bdb4db480,is_friend_of=c5281e64105ae14e008445ba7fb5c354,'
      || 'my_friends=6f637084496eba57c0a1ec3ac31c2c80,send_friend_request=885956b746b8359b9c528f9132c12f6d,'
      || 'unfriend=40a11c11605014200b3ab9c106d6018e'
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'friendships'
         and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'friendships') = 0
   and (select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.friendships'::regclass) = 0
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'outgoing_friend_requests'
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'friends_ux_v2:%')
  then 'PASS' else 'FAIL' end
) z order by o;
