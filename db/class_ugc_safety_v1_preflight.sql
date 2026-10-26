-- PREFLIGHT (read-only) cho db/class_ugc_safety_v1_setup.sql — GATE = PASS mới được migrate.
-- Chỉ số đếm gộp + md5, không đọc nội dung bài/bình luận/tin nhắn/dữ liệu cá nhân.
-- Thứ tự chạy trên production: (đã có) story_reports.sql · dm_v1 · dm_share_v1 · band_chat_v1 · learning_threads_p1 → PREFLIGHT này → setup → POSTFLIGHT.
select section, item from (
  select 1 o, 'CHECK' section, 'bảng UGC đã có: ' || coalesce((select string_agg(c.relname, ', ' order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')), 'chưa') item
  union all select 2, 'CHECK', 'bảng nền thiếu (phải rỗng): ' || coalesce((select string_agg(t, ', ') from unnest(array['class_posts', 'class_post_comments', 'friendships',
      'dm_messages', 'dm_conversations', 'dm_participants', 'bandchat_messages', 'learning_thread_events', 'learning_threads', 'edu_students', 'app_users']) t
      where to_regclass('public.' || t) is null), '')
  union all select 3, 'CHECK', 'edu_students.blocked_at / blocked_reason (cần db/story_reports.sql, phải 2): ' || (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'edu_students' and column_name in ('blocked_at', 'blocked_reason'))
  union all select 4, 'CHECK', 'hàm nền thiếu (phải rỗng): ' || coalesce((select string_agg(f, ', ') from unnest(array[
      'public.is_teacher()', 'public.is_class_member()', 'public.is_class_member_user(uuid)', 'public.class_public_identity(uuid)',
      'public.class_post_visible(uuid)', 'public.class_moderate(text,uuid,boolean)', 'public.lt_moderate(text,uuid,boolean)',
      'public.lt_can_view(uuid,text,timestamp with time zone)', 'public.bandchat_access(uuid)',
      'public.class_feed(timestamp with time zone,uuid,integer)', 'public.class_comments_for_posts(uuid[],integer)',
      'public.dm_messages(uuid,bigint,bigint,integer)', 'public.dm_conversations(integer)', 'public.bandchat_messages(uuid,bigint,bigint,integer)',
      'public.social_feed(timestamp with time zone,text,integer)', 'public.social_feed_scoped(text,timestamp with time zone,text,integer)']) f
      where to_regprocedure(f) is null), '')
  union all select 5, 'CHECK', 'md5 hàm sẽ được GỌI/bọc (không được đổi sau migrate): ' || coalesce((select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in
       ('class_feed', 'class_comments_for_posts', 'class_moderate', 'lt_moderate', 'dm_messages', 'dm_conversations', 'bandchat_messages', 'bandchat_access', 'social_feed', 'social_feed_scoped',
        'send_friend_request', 'class_public_identity', 'is_class_member', 'is_teacher')), '')
  union all select 6, 'CHECK', 'trigger người dùng hiện có trên bảng sẽ gắn thêm: ' || coalesce((select string_agg(t.tgrelid::regclass::text || '.' || t.tgname, ', ' order by t.tgrelid::regclass::text, t.tgname)
     from pg_trigger t where not t.tgisinternal and t.tgrelid in (to_regclass('public.class_posts'), to_regclass('public.class_post_comments'), to_regclass('public.friendships'),
       to_regclass('public.dm_messages'), to_regclass('public.bandchat_messages'), to_regclass('public.learning_thread_events'), to_regclass('public.edu_students'))), '(không)')
  union all select 7, 'CHECK', 'đã đình chỉ (edu_students.blocked_at not null): ' || (select count(*)::text from public.edu_students s where to_jsonb(s) ->> 'blocked_at' is not null)
  union all select 9, 'GATE', case when
       -- hàm nền đủ
       (select count(*) from unnest(array[
          'public.is_teacher()', 'public.is_class_member()', 'public.is_class_member_user(uuid)', 'public.class_public_identity(uuid)',
          'public.class_post_visible(uuid)', 'public.class_moderate(text,uuid,boolean)', 'public.lt_moderate(text,uuid,boolean)',
          'public.lt_can_view(uuid,text,timestamp with time zone)', 'public.bandchat_access(uuid)',
          'public.class_feed(timestamp with time zone,uuid,integer)', 'public.class_comments_for_posts(uuid[],integer)',
          'public.dm_messages(uuid,bigint,bigint,integer)', 'public.dm_conversations(integer)', 'public.bandchat_messages(uuid,bigint,bigint,integer)',
          'public.social_feed(timestamp with time zone,text,integer)', 'public.social_feed_scoped(text,timestamp with time zone,text,integer)']) f
        where to_regprocedure(f) is not null) = 16
       -- kiểu trả về của 5 hàm sẽ bọc *_safe đúng như repo (md5 của pg_get_function_result)
   and (select string_agg(left(md5(pg_get_function_result(to_regprocedure(f))), 12), ',' order by f) from unnest(array[
          'public.class_feed(timestamp with time zone,uuid,integer)', 'public.class_comments_for_posts(uuid[],integer)',
          'public.dm_messages(uuid,bigint,bigint,integer)', 'public.dm_conversations(integer)', 'public.bandchat_messages(uuid,bigint,bigint,integer)',
          'public.social_feed(timestamp with time zone,text,integer)', 'public.social_feed_scoped(text,timestamp with time zone,text,integer)']) f)
       = (select string_agg(left(md5(v), 12), ',' order by k) from (values
          ('public.bandchat_messages(uuid,bigint,bigint,integer)', 'TABLE(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamp with time zone)'),
          ('public.class_comments_for_posts(uuid[],integer)', 'TABLE(id uuid, post_id uuid, parent_comment_id uuid, body text, created_at timestamp with time zone, updated_at timestamp with time zone, author_user_id uuid, author_name text, author_avatar_url text, author_role text, is_mine boolean, is_hidden boolean, tags jsonb, resources jsonb, post_comment_count integer)'),
          ('public.class_feed(timestamp with time zone,uuid,integer)', 'TABLE(id uuid, type text, body text, media_type text, media_provider text, media_url text, external_media_id text, created_at timestamp with time zone, updated_at timestamp with time zone, author_user_id uuid, author_name text, author_avatar_url text, author_role text, author_ht_member boolean, is_mine boolean, is_hidden boolean, comment_count integer)'),
          ('public.dm_conversations(integer)', 'TABLE(conversation_id uuid, peer_id uuid, peer_name text, peer_avatar_url text, peer_role text, last_seq bigint, last_body text, last_mine boolean, last_at timestamp with time zone, unread integer, can_send boolean)'),
          ('public.dm_messages(uuid,bigint,bigint,integer)', 'TABLE(seq bigint, sender_id uuid, mine boolean, body text, created_at timestamp with time zone, ref_type text, ref_key text)'),
          ('public.social_feed(timestamp with time zone,text,integer)', 'TABLE(kind text, sort_at timestamp with time zone, sort_key text, post jsonb, thread jsonb)'),
          ('public.social_feed_scoped(text,timestamp with time zone,text,integer)', 'TABLE(kind text, sort_at timestamp with time zone, sort_key text, post jsonb, thread jsonb)')
        ) x(k, v))
       -- cột nền đủ (41)
   and (select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in (
    ('class_posts', 'id'), ('class_posts', 'author_user_id'), ('class_posts', 'body'), ('class_posts', 'hidden_at'),
    ('class_post_comments', 'id'), ('class_post_comments', 'post_id'), ('class_post_comments', 'author_user_id'), ('class_post_comments', 'body'), ('class_post_comments', 'hidden_at'),
    ('friendships', 'requester_id'), ('friendships', 'addressee_id'), ('friendships', 'status'),
    ('dm_messages', 'conversation_id'), ('dm_messages', 'seq'), ('dm_messages', 'sender_kind'), ('dm_messages', 'sender_id'), ('dm_messages', 'body'), ('dm_messages', 'ref_type'),
    ('dm_conversations', 'id'), ('dm_conversations', 'user_lo'), ('dm_conversations', 'user_hi'),
    ('dm_participants', 'conversation_id'), ('dm_participants', 'user_id'),
    ('bandchat_messages', 'band_id'), ('bandchat_messages', 'seq'), ('bandchat_messages', 'sender_id'), ('bandchat_messages', 'body'),
    ('learning_thread_events', 'id'), ('learning_thread_events', 'thread_id'), ('learning_thread_events', 'author_user_id'), ('learning_thread_events', 'body'), ('learning_thread_events', 'hidden_at'),
    ('learning_threads', 'id'), ('learning_threads', 'learner_user_id'), ('learning_threads', 'visibility'), ('learning_threads', 'hidden_at'),
    ('edu_students', 'user_id'), ('edu_students', 'blocked_at'), ('edu_students', 'blocked_reason'),
    ('app_users', 'id'), ('app_users', 'role'))) = 41
       -- không va chạm tên: đối tượng cùng tên phải thuộc UGC Safety V1
   and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')
           and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'class_ugc_safety_v1:%')
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('class_report_submit', 'class_block_user', 'class_unblock_user', 'class_my_blocks', 'class_is_blocked_pair',
           'class_ugc_status', 'class_ugc_accept', 'class_ugc_required_version', 'class_ugc_pair_blocked', 'class_ugc_text_blocked',
           'class_ugc_guard_write', 'class_ugc_guard_friend', 'class_ugc_guard_student', 'class_feed_safe', 'class_comments_for_posts_safe',
           'dm_messages_safe', 'dm_conversations_safe', 'bandchat_messages_safe', 'social_feed_safe', 'social_feed_scoped_safe', 'class_reports_list', 'class_report_resolve')
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'class_ugc_safety_v1:%')
   and not exists (select 1 from pg_trigger t join pg_proc f on f.oid = t.tgfoid
         where not t.tgisinternal and t.tgname in ('class_ugc_guard_ins', 'class_ugc_guard_upd', 'class_ugc_guard_friend', 'class_ugc_guard_student')
           and coalesce(obj_description(f.oid, 'pg_proc'), '') not like 'class_ugc_safety_v1:%')
  then 'PASS' else 'FAIL' end
) z order by o;
