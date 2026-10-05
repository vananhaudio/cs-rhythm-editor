-- POSTFLIGHT (read-only) sau db/friends_ux_v2_setup.sql. Không đọc dữ liệu cá nhân.
-- Dấu vân tay friendships phải GIỐNG HỆT dòng tương ứng của preflight (migration không đụng hàng nào).
select section, item from (
  select 1 o, 'CHECK' section, 'friendships theo status: ' || coalesce((select string_agg(status || '=' || n, ', ' order by status)
     from (select status, count(*) n from public.friendships group by status) z), 'trống') item
  union all select 2, 'CHECK', 'friendships dấu vân tay: ' || (select count(*)::text || ':' || md5(coalesce(string_agg(
       f.id::text || f.requester_id::text || f.addressee_id::text || f.status || f.created_at::text || coalesce(f.responded_at::text, '-'),
       ',' order by f.id), '')) from public.friendships f)
  union all select 3, 'CHECK', 'respond_friend_request md5 = ' || (select md5(prosrc) from pg_proc where oid = 'public.respond_friend_request(uuid,boolean)'::regprocedure)
  union all select 4, 'CHECK', 'EXECUTE outgoing_friend_requests: ' || coalesce((select string_agg(distinct grantee, ',' order by grantee)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'outgoing_friend_requests'
       and grantee not in ('postgres', 'supabase_admin')), '-')
  union all select 5, 'CHECK', 'EXECUTE respond_friend_request: ' || coalesce((select string_agg(distinct grantee, ',' order by grantee)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'respond_friend_request'
       and grantee not in ('postgres', 'supabase_admin')), '-')
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc where oid = 'public.respond_friend_request(uuid,boolean)'::regprocedure) = '8f03c840dc8ab3607851c824d40d566e'
   and (select md5(prosrc) from pg_proc where oid = 'public.outgoing_friend_requests()'::regprocedure) = '7b2e12aa4c3bf8c54877f9256dd984fe'
   and (select prosecdef from pg_proc where oid = 'public.outgoing_friend_requests()'::regprocedure)
   and (select proconfig from pg_proc where oid = 'public.outgoing_friend_requests()'::regprocedure) = array['search_path=""']
   and coalesce((select string_agg(distinct grantee, ',' order by grantee) from information_schema.routine_privileges
         where routine_schema = 'public' and routine_name in ('outgoing_friend_requests', 'respond_friend_request')
           and grantee in ('anon', 'authenticated', 'PUBLIC')), '') = 'authenticated'
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'friendships'
         and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'friendships') = 0
  then 'PASS' else 'FAIL' end
) z order by o;
