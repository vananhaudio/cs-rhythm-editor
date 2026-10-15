-- Kiểm chứng social_feed + teamlab_publication (chạy SAU migration, trong giao dịch dryrun ROLLBACK — có UPDATE tạm).
-- Dùng: cat db/social_feed_teamlab_publications_v2_setup.sql db/tests/social_feed_teamlab_publications_v2_check.sql > /tmp/x.sql
--       prod-db.py dryrun /tmp/x.sql   (không commit gì). Kỳ vọng: A2 có đúng N published; B1 total = distinct = page50;
--       C1 = 0 sau gỡ xuất bản; D1 = teamlab_publication đứng đầu sau phát hành lại.
-- ── KIỂM TRA TRONG GIAO DỊCH DRYRUN (ROLLBACK) ──
select set_config('request.jwt.claim.sub', (select user_id::text from public.edu_students where user_id is not null limit 1), true) as _sub;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true) as _claims;
select 'A1 member_gate' chk, public.is_class_member() ok;
select 'A2 kinds_page50' chk, kind, count(*) from public.social_feed(null, null, 50) group by kind order by kind;
select 'A3 top3' chk, kind, sort_at, sort_key, (post->>'title') title, (post->>'band_name') band, (post->>'slug') slug, (post->>'project_slug') project_slug, (post ? 'user_id' or post ? 'take_id' or post ? 'author_user_id') leaks_user_fields from public.social_feed(null, null, 3);
select 'A4 expected_published_now' chk, count(*) from public.teamlab_publications where status = 'published';
-- keyset: duyệt từng 1 mục, phải đủ và không trùng
with recursive walk as (
  select 1 n, f.kind, f.sort_at, f.sort_key from public.social_feed(null, null, 1) f
  union all
  select w.n + 1, f.kind, f.sort_at, f.sort_key from walk w, lateral public.social_feed(w.sort_at, w.sort_key, 1) f where w.n < 200
) select 'B1 keyset_walk' chk, count(*) total, count(distinct sort_key) distinct_keys, (select count(*) from public.social_feed(null, null, 50)) page50 from walk;
-- gỡ xuất bản → biến mất
update public.teamlab_publications set status = 'unpublished', unpublished_at = now() where status = 'published';
select 'C1 after_unpublish_pub_cards' chk, count(*) from public.social_feed(null, null, 50) where kind = 'teamlab_publication';
-- phát hành lại với published_at mới → lên đầu
update public.teamlab_publications set status = 'published', published_at = now() + interval '1 minute', unpublished_at = null
 where id = (select id from public.teamlab_publications order by created_at limit 1);
select 'D1 republish_top' chk, kind, sort_key from public.social_feed(null, null, 1);
-- EXPLAIN thời gian
explain (analyze, timing off, summary on) select * from public.social_feed(null, null, 20);

-- v2: mọi thẻ có project_slug đúng dạng (hoặc null) và khớp projects.public_slug
select 'E1 project_slug' chk, count(*) cards, count(*) filter (where post->>'project_slug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$') with_slug from public.social_feed(null, null, 50) where kind = 'teamlab_publication';
