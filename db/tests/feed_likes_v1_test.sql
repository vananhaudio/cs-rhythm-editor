-- ═══ TEST Class Social — FEED LIKES V1 — cluster PostgreSQL TẠM (scripts/test-feed-likes-db.sh). KHÔNG chạy production. ═══
-- Người: A, B (bạn của A), C (KHÔNG phải bạn A) · T (Thầy) · N (ngoài Class)
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
delete from public.edu_students where user_id = 'eeeeeeee-0000-4000-8000-00000000000e';
create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg;
end $$;
create function t.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute q; exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then raise exception 'FAIL: % — sai lý do: %', msg, sqlerrm; end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
grant execute on all functions in schema t to anon, authenticated;

insert into public.friendships (requester_id, addressee_id, status) values (t.u('A'), t.u('B'), 'accepted');
create table t.ids (k text primary key, id uuid not null);
grant select on t.ids to anon, authenticated;
create function t.id(k text) returns uuid language sql stable as $$ select id from t.ids where k = $1 $$;
grant execute on function t.id(text) to anon, authenticated;
do $$
declare v uuid;
begin
  -- bài Social
  v := gen_random_uuid(); insert into public.class_posts (id, author_user_id, type, audience, body) values (v, t.u('B'), 'assignment', 'class', 'bai lop');   insert into t.ids values ('post_class', v);
  v := gen_random_uuid(); insert into public.class_posts (id, author_user_id, type, audience, body) values (v, t.u('B'), 'status', 'friends', 'tuong ban');   insert into t.ids values ('post_friends', v);
  v := gen_random_uuid(); insert into public.class_posts (id, author_user_id, type, audience, body, hidden_at) values (v, t.u('B'), 'assignment', 'class', 'bi an', now()); insert into t.ids values ('post_hidden', v);
  -- learning thread
  v := gen_random_uuid(); insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, status, last_event_at, last_student_event_at, event_count)
    values (v, t.u('B'), 'L:' || gen_random_uuid(), '{"lesson":{"title":"x"}}', 'community', 'waiting_teacher', now(), now(), 1); insert into t.ids values ('thr_comm', v);
  v := gen_random_uuid(); insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, status, last_event_at, last_student_event_at, event_count)
    values (v, t.u('B'), 'L:' || gen_random_uuid(), '{"lesson":{"title":"y"}}', 'private', 'waiting_teacher', now(), now(), 1); insert into t.ids values ('thr_priv', v);
  v := gen_random_uuid(); insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, status, last_event_at, last_student_event_at, event_count, hidden_at)
    values (v, t.u('B'), 'L:' || gen_random_uuid(), '{"lesson":{"title":"z"}}', 'community', 'waiting_teacher', now(), now(), 1, now()); insert into t.ids values ('thr_hidden', v);
  -- publication
  insert into t.ids values ('pub_pub', 'd1111111-0000-4000-8000-000000000001'), ('pub_unpub', 'd1111111-0000-4000-8000-000000000003');
end $$;

do $$
declare r jsonb; n int; s record;
begin
  -- Chưa đăng nhập / ngoài Class
  perform t.as_anon();
  perform t.fails($q$select public.feed_like_set('post', t.id('post_class'), true)$q$, 'anon không gọi được feed_like_set');
  perform t.fails($q$select * from public.feed_likes$q$, 'anon không đọc thẳng bảng');
  perform t.as_user('N');
  perform t.fails($q$select public.feed_like_set('post', t.id('post_class'), true)$q$, 'người ngoài Class không thích được', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select * from public.feed_likes$q$, 'authenticated không đọc thẳng bảng');
  perform t.fails($q$insert into public.feed_likes (target_kind, target_id, user_id) values ('post', gen_random_uuid(), auth.uid())$q$, 'authenticated không ghi thẳng bảng');

  -- Thích / bỏ thích / idempotent
  perform t.as_user('A');
  r := public.feed_like_set('post', t.id('post_class'), true);
  perform t.ok((r->>'liked')::boolean and (r->>'count')::int = 1, 'A thích bài lớp → count 1');
  r := public.feed_like_set('post', t.id('post_class'), true);
  perform t.ok((r->>'count')::int = 1, 'thích lại (bấm đúp/retry) vẫn count 1 — không trùng');
  perform t.as_user('B');
  r := public.feed_like_set('post', t.id('post_class'), true);
  perform t.ok((r->>'count')::int = 2, 'B thích → count 2 (mỗi người một lượt)');
  r := public.feed_like_set('post', t.id('post_class'), false);
  perform t.ok(not (r->>'liked')::boolean and (r->>'count')::int = 1, 'B bỏ thích → count 1');
  r := public.feed_like_set('post', t.id('post_class'), false);
  perform t.ok((r->>'count')::int = 1, 'bỏ thích lần 2 idempotent');
end $$;

do $$ begin
  perform t.reset();
  perform t.ok((select count(*) from public.feed_likes) = 1, 'bảng có đúng 1 hàng sau chuỗi thích/bỏ thích');
end $$;

do $$
declare r jsonb; s record; n int;
begin
  -- Quyền thấy từng loại
  perform t.as_user('C');   -- C: thành viên, KHÔNG là bạn của A/B? (C không có friendship)
  perform t.fails($q$select public.feed_like_set('post', t.id('post_friends'), true)$q$, 'không bạn → không thích được bài chỉ-bạn-bè', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_like_set('post', t.id('post_hidden'), true)$q$, 'bài bị ẩn → không thích được (học viên)', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_like_set('learning_thread', t.id('thr_priv'), true)$q$, 'thread private → không thích được', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_like_set('learning_thread', t.id('thr_hidden'), true)$q$, 'thread bị ẩn → không thích được', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_like_set('teamlab_publication', t.id('pub_unpub'), true)$q$, 'publication đã gỡ → không thích được', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_like_set('post', gen_random_uuid(), true)$q$, 'id không tồn tại → bị chặn', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_like_set('nonsense', t.id('post_class'), true)$q$, 'loại lạ → bị chặn', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_like_set('post', t.id('post_class'), null)$q$, 'trạng thái null → bị chặn', 'FEED_BAD_ARGS');
  r := public.feed_like_set('learning_thread', t.id('thr_comm'), true);
  perform t.ok((r->>'count')::int = 1, 'thích thread community');
  r := public.feed_like_set('teamlab_publication', t.id('pub_pub'), true);
  perform t.ok((r->>'count')::int = 1, 'thích bài TeamLab đã xuất bản (không loại trừ tài nguyên chia sẻ)');
  perform t.as_user('A');
  perform t.ok(public.feed_like_set('post', t.id('post_friends'), true)->>'count' = '1', 'bạn của tác giả thích được bài chỉ-bạn-bè');
  perform t.as_user('T');
  perform t.ok(public.feed_like_set('post', t.id('post_hidden'), true)->>'count' = '1', 'Thầy thích được bài bị ẩn (Thầy vẫn thấy)');
  perform public.feed_like_set('post', t.id('post_hidden'), false);

  -- Tóm tắt theo lô
  perform t.as_user('C');
  select count(*) into n from public.feed_like_summary(
    array['post','post','post','learning_thread','learning_thread','teamlab_publication','teamlab_publication','bogus'],
    array[t.id('post_class'), t.id('post_friends'), t.id('post_hidden'), t.id('thr_comm'), t.id('thr_priv'), t.id('pub_pub'), t.id('pub_unpub'), t.id('post_class')]);
  perform t.ok(n = 3, 'summary chỉ trả mục THẤY ĐƯỢC (post_class, thr_comm, pub_pub) — không lộ mục chặn/loại lạ');
  select * into s from public.feed_like_summary(array['post'], array[t.id('post_class')]);
  perform t.ok(s.like_count = 1 and s.liked = false, 'C chưa thích post_class: count 1, liked=false');
  select * into s from public.feed_like_summary(array['teamlab_publication'], array[t.id('pub_pub')]);
  perform t.ok(s.like_count = 1 and s.liked = true, 'C đã thích pub_pub: liked=true');
  perform t.ok((select count(*) from public.feed_like_summary(array['post','post'], array[t.id('post_class')])) = 1, 'mảng lệch độ dài: chỉ ghép theo vị trí');
  perform t.ok((select count(*) from public.feed_like_summary(array['post','post'], array[t.id('post_class'), t.id('post_class')])) = 1, 'trùng khoá được gộp (distinct)');
  perform t.ok((select count(*) from public.feed_like_summary(null, null)) = 0, 'null → rỗng');
  perform t.as_anon();
  perform t.fails($q$select * from public.feed_like_summary(array['post'], array[t.id('post_class')])$q$, 'anon không gọi được summary');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.feed_like_summary(array['post'], array[t.id('post_class')])) = 0, 'người ngoài Class: summary rỗng');

  -- Mục bị ẩn sau khi đã thích → biến mất khỏi summary, thích lại được khi hiện
  perform t.as_user('T'); perform public.class_moderate('post', t.id('post_class'), true);
  perform t.as_user('A');
  perform t.ok((select count(*) from public.feed_like_summary(array['post'], array[t.id('post_class')])) = 0, 'bài bị ẩn → summary không trả');
  perform t.as_user('T'); perform public.class_moderate('post', t.id('post_class'), false);
  perform t.as_user('A');
  select * into s from public.feed_like_summary(array['post'], array[t.id('post_class')]);
  perform t.ok(s.like_count = 1 and s.liked, 'hiện lại → lượt thích của A còn nguyên');

  -- Xoá tài khoản → lượt thích đi theo (FK cascade)
  perform t.reset();
  perform t.ok((select count(*) from public.feed_likes where user_id = t.u('A')) >= 1, 'A có lượt thích trước khi xoá');
end $$;
select 'ALL PASS' as result;
