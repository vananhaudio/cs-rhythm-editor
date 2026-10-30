-- POSTFLIGHT Feed Comment Notify V2 — CHỈ ĐỌC. Mọi dòng ok phải = true.
select check_name, ok, detail from (values
  ('feed_comment_notify là V2-notify', coalesce((select position('FEED_COMMENT_NOTIFY_V2' in p.prosrc) > 0 from pg_proc p where p.oid = to_regprocedure('public.feed_comment_notify()')), false), null),
  ('trigger class_post_comment_notify bật, đúng một', (select count(*) = 1 and bool_and(tgenabled = 'O') from pg_trigger where tgname='class_post_comment_notify' and tgrelid='public.class_post_comments'::regclass and not tgisinternal), null),
  ('trigger feed_comment_notify còn nguyên trên feed_comments', exists (select 1 from pg_trigger where tgname='feed_comment_notify' and tgrelid='public.feed_comments'::regclass and not tgisinternal), null),
  ('ref_check đã nới đúng', (select pg_get_constraintdef(oid) like '%teamlab_publication%' and pg_get_constraintdef(oid) like '%feed_comment%' from pg_constraint where conname='class_system_notices_ref_check' and conrelid='public.class_system_notices'::regclass), (select pg_get_constraintdef(oid) from pg_constraint where conname='class_system_notices_ref_check' and conrelid='public.class_system_notices'::regclass)),
  ('hàm trigger không gọi được bởi anon/authenticated', not has_function_privilege('anon','public.class_post_comment_notify()','execute') and not has_function_privilege('authenticated','public.class_post_comment_notify()','execute') and not has_function_privilege('authenticated','public.feed_comment_notify()','execute'), null),
  ('class_system_notices vẫn RLS bật, 0 policy', (select relrowsecurity from pg_class where oid='public.class_system_notices'::regclass) and not exists (select 1 from pg_policies where tablename='class_system_notices'), null),
  ('class_add_comment không đổi (md5 production 6bf7f734…)', coalesce((select md5(prosrc) = '6bf7f734ee46554b7f443d82a25f3d35' from pg_proc where proname='class_add_comment' and pronamespace='public'::regnamespace limit 1), false), null),
  ('số bình luận class_post_comments không đổi (đối chiếu tay với trước khi chạy)', true, (select count(*)::text from public.class_post_comments))
) as t(check_name, ok, detail);
