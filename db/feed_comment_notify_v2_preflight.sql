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
  ('kind_check đã có feed_comment', exists (select 1 from pg_constraint where conname='class_system_notices_kind_check' and conrelid='public.class_system_notices'::regclass and pg_get_constraintdef(oid) like '%feed_comment%'), null),
  ('chống trùng: UNIQUE (user_id, dedupe_key) tồn tại', exists (select 1 from pg_constraint where conname='class_system_notices_dedupe_uq' and contype='u' and conrelid='public.class_system_notices'::regclass), null),
  ('class_system_notices: RLS bật, 0 policy, anon/authenticated không có quyền bảng (setup không đổi điều này)',
     (select relrowsecurity from pg_class where oid='public.class_system_notices'::regclass)
       and not exists (select 1 from pg_policies where schemaname='public' and tablename='class_system_notices')
       and not exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='class_system_notices' and grantee in ('anon','authenticated','PUBLIC')), null),
  ('bài TeamLab đang published: số bài thiếu published_by (thông tin; thiếu = không ai nhận thông báo cho bài đó)', true,
     (select count(*) filter (where published_by is null)::text || ' / ' || count(*)::text from public.teamlab_publications where status='published' and unpublished_at is null)),
  ('bài TeamLab CÓ bình luận thực tế đều có published_by (FAIL nếu bài đã có bình luận mà published_by rỗng)',
     not exists (select 1 from public.teamlab_publications pb where pb.published_by is null and exists (select 1 from public.feed_comments c where c.target_kind='teamlab_publication' and c.target_id=pb.id)),
     (select coalesce(string_agg(left(pb.id::text,8)||' status='||pb.status||' published_by='||case when pb.published_by is null then 'NULL' else 'có' end, '; '), 'không có bài nào có bình luận')
        from public.teamlab_publications pb where exists (select 1 from public.feed_comments c where c.target_kind='teamlab_publication' and c.target_id=pb.id))),
  ('số thông báo hiện có theo kind (migration KHÔNG xoá/sửa dòng nào; đối chiếu sau khi chạy)', true,
     (select string_agg(kind||'='||n, ', ' order by kind) from (select kind, count(*) n from public.class_system_notices group by kind) x)),
  ('số bình luận/ bài (đối chiếu sau khi chạy)', true, (select 'class_post_comments='||(select count(*) from public.class_post_comments)||', feed_comments='||(select count(*) from public.feed_comments))),
  ('trigger hiện có trên class_post_comments (để đối chiếu, không đổi)', true, (select string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid='public.class_post_comments'::regclass and not tgisinternal))
) as t(check_name, ok, detail);
