-- PREFLIGHT (read-only) cho db/dm_v1_setup.sql — GATE = PASS mới được migrate.
-- Chỉ số đếm gộp + md5, không đọc nội dung hội thoại/dữ liệu cá nhân.
select section, item from (
  select 1 o, 'CHECK' section, 'bảng dm_* đã có: ' || coalesce((select string_agg(c.relname, ', ' order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('dm_conversations', 'dm_participants', 'dm_messages')), 'chưa') item
  union all select 2, 'CHECK', 'hàm dm_* đã có: ' || coalesce((select string_agg(p.proname, ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('dm_rule', 'dm_append', 'dm_can_message', 'dm_find', 'dm_start', 'dm_send',
      'dm_conversations', 'dm_messages', 'dm_mark_read', 'dm_unread_count')), 'chưa')
  union all select 3, 'CHECK', 'md5 hàm nền: ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in
       ('class_public_identity', 'is_class_member', 'is_class_member_user', 'is_friend_of', 'friendship_status'))
  union all select 4, 'CHECK', 'friendships: policy=' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'friendships')
     || ' grant=' || (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'friendships'
         and grantee in ('anon', 'authenticated', 'PUBLIC')) || ' (phải 0/0)'
  union all select 5, 'CHECK', 'friendships dấu vân tay: ' || (select count(*)::text || ':' || md5(coalesce(string_agg(
       f.id::text || f.requester_id::text || f.addressee_id::text || f.status || f.created_at::text || coalesce(f.responded_at::text, '-'),
       ',' order by f.id), '')) from public.friendships f)
  union all select 9, 'GATE', case when
       (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('class_public_identity', 'is_class_member', 'is_class_member_user', 'is_friend_of', 'friendship_status'))
       = 'class_public_identity=c1129bf0314c9ee6954a177059368562,friendship_status=9f653ba0b1fbcb58c69acaba880906fc,'
      || 'is_class_member=459786921eb5bbd4ff07c83bdb4db480,is_class_member_user=09b747d3ec6be35cc8e9f77c5c4e0b8a,'
      || 'is_friend_of=c5281e64105ae14e008445ba7fb5c354'
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'friendships'
         and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'friendships') = 0
   and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('dm_conversations', 'dm_participants', 'dm_messages')
           and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'dm_v1:%')
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('dm_rule', 'dm_append', 'dm_can_message', 'dm_find', 'dm_start', 'dm_send',
           'dm_conversations', 'dm_messages', 'dm_mark_read', 'dm_unread_count')
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'dm_v1:%')
  then 'PASS' else 'FAIL' end
) z order by o;
