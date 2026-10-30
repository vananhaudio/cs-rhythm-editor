-- PREFLIGHT Feed Comment Notify V2 — CHỈ ĐỌC (một SELECT). Mọi dòng ok phải = true trước khi chạy setup.
select check_name, ok, detail from (values
  ('feed_comment_notify khớp thân hàm V2 đã biết (md5 7ac335a8…) hoặc đã là V2-notify',
     coalesce((select md5(p.prosrc) = '7ac335a8a38a68326037023c1bc9f18b' or position('FEED_COMMENT_NOTIFY_V2' in p.prosrc) > 0
               from pg_proc p where p.oid = to_regprocedure('public.feed_comment_notify()')), false),
     (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.feed_comment_notify()'))),
  ('class_ugc_pair_blocked(uuid,uuid) tồn tại', to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is not null, null),
  ('teamlab_publications.published_by tồn tại', exists (select 1 from information_schema.columns where table_schema='public' and table_name='teamlab_publications' and column_name='published_by'), null),
  ('ref_check hiện tại là bản chỉ-thread (hoặc đã nới)', exists (select 1 from pg_constraint where conname='class_system_notices_ref_check' and conrelid='public.class_system_notices'::regclass), (select pg_get_constraintdef(oid) from pg_constraint where conname='class_system_notices_ref_check' and conrelid='public.class_system_notices'::regclass)),
  ('mọi thông báo hiện có đều ref_type=thread (nới ràng buộc không làm hỏng dòng nào)', (select count(*) = 0 from public.class_system_notices where ref_type <> 'thread'), (select count(*)::text from public.class_system_notices where ref_type <> 'thread')),
  ('chưa có trigger class_post_comment_notify (hoặc sẽ được thay)', true, (select count(*)::text from pg_trigger where tgname='class_post_comment_notify' and not tgisinternal)),
  ('trigger hiện có trên class_post_comments (để đối chiếu, không đổi)', true, (select string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid='public.class_post_comments'::regclass and not tgisinternal))
) as t(check_name, ok, detail);
