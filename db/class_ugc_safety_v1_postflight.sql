-- POSTFLIGHT (read-only) cho db/class_ugc_safety_v1_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung báo cáo/tin nhắn.
-- Lưu ý: md5 hàm production (mục 5) chỉ để SO SÁNH THỦ CÔNG với dòng tương ứng của preflight — phải GIỐNG HỆT (setup không được sửa chúng).
select section, item from (
  select 1 o, 'CHECK' section, 'bảng UGC: ' || coalesce((select string_agg(c.relname || '(rls=' || c.relrowsecurity || ')', ', ' order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')), 'chưa') item
  union all select 2, 'CHECK', 'quyền bảng UGC cho anon/authenticated/PUBLIC (phải 0): ' || (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')
       and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all select 3, 'CHECK', 'policy trên bảng UGC (phải 0): ' || (select count(*) from pg_policies
     where schemaname = 'public' and tablename in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist'))
  union all select 4, 'CHECK', 'trigger UGC: ' || coalesce((select string_agg(t.tgrelid::regclass::text || '.' || t.tgname || '(' || t.tgenabled::text || ')', ', ' order by t.tgrelid::regclass::text, t.tgname)
     from pg_trigger t where not t.tgisinternal and t.tgname in ('class_ugc_guard_ins', 'class_ugc_guard_upd', 'class_ugc_guard_friend', 'class_ugc_guard_student')), 'chưa')
  union all select 5, 'CHECK', 'md5 hàm production (so với preflight): ' || coalesce((select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in
       ('class_feed', 'class_comments_for_posts', 'class_moderate', 'lt_moderate', 'dm_messages', 'dm_conversations', 'bandchat_messages', 'bandchat_access', 'social_feed', 'social_feed_scoped',
        'send_friend_request', 'class_public_identity', 'is_class_member', 'is_teacher')), '')
  union all select 6, 'CHECK', 'blocklist: ' || (select count(*) from public.class_ugc_blocklist) || ' dòng, đang bật ' || (select count(*) from public.class_ugc_blocklist where active)
  union all select 9, 'GATE', case when
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')
           and c.relrowsecurity and obj_description(c.oid, 'pg_class') like 'class_ugc_safety_v1:%') = 4
   and (select count(*) from information_schema.role_table_grants where table_schema = 'public'
         and table_name in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist') and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
   and (select count(*) from pg_policies where schemaname = 'public' and tablename in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')) = 0
   -- 17 RPC client: SECURITY DEFINER, search_path rỗng, EXECUTE chỉ cho authenticated (không PUBLIC/anon)
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('class_report_submit', 'class_block_user', 'class_unblock_user', 'class_my_blocks', 'class_is_blocked_pair',
           'class_ugc_status', 'class_ugc_accept', 'class_ugc_required_version', 'class_feed_safe', 'class_comments_for_posts_safe',
           'dm_messages_safe', 'dm_conversations_safe', 'bandchat_messages_safe', 'social_feed_safe', 'social_feed_scoped_safe', 'class_reports_list', 'class_report_resolve')
           and p.prosecdef and p.proconfig @> array['search_path=""'] and obj_description(p.oid, 'pg_proc') like 'class_ugc_safety_v1:%'
           and has_function_privilege('authenticated', p.oid, 'execute')
           and not has_function_privilege('anon', p.oid, 'execute')
           and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)) = 17
   -- 5 hàm nội bộ/trigger: không ai ngoài owner gọi được
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('class_ugc_pair_blocked', 'class_ugc_text_blocked', 'class_ugc_guard_write', 'class_ugc_guard_friend', 'class_ugc_guard_student')
           and p.prosecdef and p.proconfig @> array['search_path=""']
           and not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) = 5
   -- trigger: 5 trên bài/bình luận/DM/Band/thread (ins) + 2 upd + friendships + edu_students, đều bật
   and (select count(*) from pg_trigger t join pg_proc f on f.oid = t.tgfoid
         where not t.tgisinternal and t.tgenabled = 'O' and obj_description(f.oid, 'pg_proc') like 'class_ugc_safety_v1:%'
           and t.tgname in ('class_ugc_guard_ins', 'class_ugc_guard_upd', 'class_ugc_guard_friend', 'class_ugc_guard_student')) = 9
   and (select count(*) from public.class_ugc_blocklist where active) > 0
  then 'PASS' else 'FAIL' end
) z order by o;
