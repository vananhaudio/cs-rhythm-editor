-- ═══ TEST Class Social — FEED COMMENTS V2 — cluster PostgreSQL TẠM (scripts/test-feed-comments-db.sh). KHÔNG chạy production. ═══
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


alter table public.edu_students add column if not exists blocked_at timestamptz;
create or replace function public.class_ugc_text_blocked(p text) returns boolean language sql immutable as $$ select p ilike '%badword%' $$;
insert into public.friendships (requester_id, addressee_id, status) values (t.u('A'), t.u('B'), 'accepted');
create table t.ids (k text primary key, id uuid not null);
grant select on t.ids to anon, authenticated;
create function t.id(k text) returns uuid language sql stable as $$ select id from t.ids where k = $1 $$;
grant execute on function t.id(text) to anon, authenticated;
create table t.c (k text primary key, id uuid not null);
grant select, insert on t.c to authenticated;
create function t.cid(k text) returns uuid language sql stable as $$ select id from t.c where k = $1 $$;
grant execute on function t.cid(text) to anon, authenticated;
do $$
declare v uuid;
begin
  v := gen_random_uuid(); insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, status, last_event_at, last_student_event_at, event_count)
    values (v, t.u('B'), 'L:' || gen_random_uuid(), '{"lesson":{"title":"x"}}', 'community', 'waiting_teacher', now(), now(), 1); insert into t.ids values ('thr', v);
  v := gen_random_uuid(); insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, status, last_event_at, last_student_event_at, event_count)
    values (v, t.u('B'), 'L:' || gen_random_uuid(), '{"lesson":{"title":"y"}}', 'private', 'waiting_teacher', now(), now(), 1); insert into t.ids values ('thr_priv', v);
  v := gen_random_uuid(); insert into public.class_posts (id, author_user_id, type, audience, body) values (v, t.u('B'), 'assignment', 'class', 'p'); insert into t.ids values ('post', v);
  insert into t.ids values ('pub', 'd1111111-0000-4000-8000-000000000001'), ('pub_unpub', 'd1111111-0000-4000-8000-000000000003');
end $$;

-- 1) Truy cập
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select public.feed_comment_add('learning_thread', t.id('thr'), 'x')$q$, 'anon không bình luận được');
  perform t.fails($q$select * from public.feed_comments$q$, 'anon không đọc thẳng bảng');
  perform t.as_user('N');
  perform t.fails($q$select public.feed_comment_add('learning_thread', t.id('thr'), 'x')$q$, 'ngoài Class không bình luận được', 'FEED_NOT_VISIBLE');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr'))) = 0, 'ngoài Class: list rỗng');
  perform t.fails($q$select * from public.feed_comments$q$, 'authenticated không đọc thẳng bảng');
  perform t.fails($q$insert into public.feed_comments (target_kind, target_id, author_user_id, body) values ('learning_thread', gen_random_uuid(), auth.uid(), 'x')$q$, 'authenticated không ghi thẳng bảng');
end $$;

-- 2) Thêm, trả lời một cấp, danh sách, đếm
do $$
declare a uuid; b uuid; r uuid; n int; s record;
begin
  perform t.as_user('A');
  a := public.feed_comment_add('learning_thread', t.id('thr'), '  Hay quá  ');   insert into t.c values ('a', a);
  perform t.ok((select body from public.feed_comment_list('learning_thread', t.id('thr')) where id = a) = 'Hay quá', 'thêm bình luận thread (bỏ khoảng trắng)');
  perform t.as_user('B');
  b := public.feed_comment_add('learning_thread', t.id('thr'), 'Cảm ơn bạn', a); insert into t.c values ('b_reply', b);
  perform t.ok((select parent_comment_id from public.feed_comment_list('learning_thread', t.id('thr')) where id = b) = a, 'trả lời một cấp gắn đúng cha');
  perform t.fails(format($q$select public.feed_comment_add('learning_thread', %L, 'sâu hơn', %L)$q$, t.id('thr'), b), 'không trả lời một trả lời (một cấp)', 'FEED_BAD_PARENT');
  perform t.fails(format($q$select public.feed_comment_add('teamlab_publication', %L, 'lạc mục', %L)$q$, t.id('pub'), a), 'cha thuộc mục khác → chặn', 'FEED_BAD_PARENT');
  perform t.fails($q$select public.feed_comment_add('learning_thread', t.id('thr'), '   ')$q$, 'rỗng → chặn', 'FEED_BAD_BODY');
  perform t.fails($q$select public.feed_comment_add('learning_thread', t.id('thr'), repeat('x', 2001))$q$, '>2000 ký tự → chặn', 'FEED_BAD_BODY');
  perform t.fails($q$select public.feed_comment_add('post', t.id('post'), 'x')$q$, 'kind post không đi đường feed_comments', 'FEED_BAD_KIND');
  perform t.fails($q$select public.feed_comment_add('learning_thread', t.id('thr_priv'), 'x')$q$, 'thread private → chặn', 'FEED_NOT_VISIBLE');
  perform t.fails($q$select public.feed_comment_add('teamlab_publication', t.id('pub_unpub'), 'x')$q$, 'publication đã gỡ → chặn', 'FEED_NOT_VISIBLE');
  r := public.feed_comment_add('teamlab_publication', t.id('pub'), 'Bài hát hay'); insert into t.c values ('pubc', r);
  perform t.ok((select count(*) from public.feed_comment_list('teamlab_publication', t.id('pub'))) = 1, 'bình luận bài TeamLab đã xuất bản (không loại trừ tài nguyên chia sẻ)');
  perform t.ok((select array_agg(id order by created_at) from public.feed_comment_list('learning_thread', t.id('thr'))) = array[a, b], 'list cũ → mới: gốc rồi trả lời');
  select count(*) into n from public.feed_comment_counts(array['learning_thread','teamlab_publication','learning_thread','post'], array[t.id('thr'), t.id('pub'), t.id('thr_priv'), t.id('post')]);
  perform t.ok(n = 2, 'counts chỉ trả mục thấy được và đúng loại');
  select comment_count into n from public.feed_comment_counts(array['learning_thread'], array[t.id('thr')]);
  perform t.ok(n = 2, 'count thread = 2 (gồm trả lời)');
  perform t.ok((select is_mine from public.feed_comment_list('learning_thread', t.id('thr')) where id = b), 'is_mine đúng');
  perform t.ok((select author_name is not null from public.feed_comment_list('learning_thread', t.id('thr')) where id = a), 'có danh tính công khai');
end $$;

-- 3) Sửa / xoá của chính mình
do $$
declare a uuid := t.cid('a'); b uuid := t.cid('b_reply');
begin
  perform t.as_user('B');
  perform t.fails(format($q$select public.feed_comment_edit('learning_thread', %L, 'sửa lén')$q$, a), 'không sửa bình luận người khác', 'FEED_NOT_FOUND');
  perform t.fails(format($q$select public.feed_comment_delete('learning_thread', %L)$q$, a), 'không xoá bình luận người khác', 'FEED_NOT_FOUND');
  perform public.feed_comment_edit('learning_thread', b, 'Cảm ơn bạn nhiều');
  perform t.ok((select body = 'Cảm ơn bạn nhiều' and edited_at is not null from public.feed_comment_list('learning_thread', t.id('thr')) where id = b), 'sửa bình luận của mình, có edited_at');
  perform t.fails(format($q$select public.feed_comment_edit('learning_thread', %L, '')$q$, b), 'sửa thành rỗng → chặn', 'FEED_BAD_BODY');
  perform t.as_user('A');
  perform public.feed_comment_delete('learning_thread', a);
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr'))) = 0, 'xoá bình luận gốc kéo theo trả lời');
  perform t.fails(format($q$select public.feed_comment_delete('learning_thread', %L)$q$, a), 'xoá lần 2 → không còn', 'FEED_NOT_FOUND');
end $$;

-- 4) Thông báo chủ thread (System Chat)
do $$
declare a uuid; n int;
begin
  perform t.reset(); delete from public.class_system_notices;
  perform t.as_user('A');
  a := public.feed_comment_add('learning_thread', t.id('thr'), 'bình luận 1');
  perform public.feed_comment_add('learning_thread', t.id('thr'), 'bình luận 2');
  perform public.feed_comment_add('teamlab_publication', t.id('pub'), 'bài hát');
  perform t.as_user('B'); perform public.feed_comment_add('learning_thread', t.id('thr'), 'tự bình luận bài mình');
  perform t.reset();
  select count(*) into n from public.class_system_notices where user_id = t.u('B') and kind = 'feed_comment' and ref_type = 'thread' and ref_key = t.id('thr')::text;
  perform t.ok(n = 1, 'chủ thread nhận ĐÚNG 1 thông báo (cùng người cùng ngày gộp; không tự thông báo mình; publication không thông báo)');
  perform t.ok((select count(*) from public.class_system_notices) = 1, 'không thông báo nào khác');
end $$;

-- 5) Kiểm duyệt
do $$
declare c uuid;
begin
  perform t.as_user('A'); c := public.feed_comment_add('learning_thread', t.id('thr'), 'sẽ bị ẩn'); insert into t.c values ('tohide', c);
  perform t.as_user('B'); perform t.fails(format($q$select public.feed_comment_hide(%L, true)$q$, c), 'học viên không ẩn được', 'Không có quyền');
  perform t.as_user('T'); perform public.feed_comment_hide(c, true);
  perform t.ok((select is_hidden from public.feed_comment_list('learning_thread', t.id('thr')) where id = c), 'Thầy thấy bình luận ẩn (is_hidden)');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr')) where id = c) = 0, 'học viên không thấy bình luận ẩn');
  perform t.as_user('T'); perform public.feed_comment_hide(c, false);
  perform t.as_user('B');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr')) where id = c) = 1, 'bỏ ẩn → hiện lại');
end $$;

-- 6) Chặn nội dung / tài khoản tạm dừng
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select public.feed_comment_add('learning_thread', t.id('thr'), 'có BADWORD ở đây')$q$, 'nội dung vi phạm bị chặn như bảng cũ', 'ugc_blocked');
  perform t.reset(); update public.edu_students set blocked_at = now() where user_id = t.u('A');
  perform t.as_user('A');
  perform t.fails($q$select public.feed_comment_add('learning_thread', t.id('thr'), 'bình thường')$q$, 'tài khoản bị tạm dừng không bình luận được', 'account_suspended');
  perform t.reset(); update public.edu_students set blocked_at = null where user_id = t.u('A');
end $$;

-- 7) Bài Social: sửa/xoá bình luận qua bảng CŨ
do $$
declare c uuid;
begin
  perform t.as_user('B');
  c := public.class_add_comment(t.id('post'), 'bình luận bài');
  perform public.feed_comment_edit('post', c, 'đã sửa');
  perform t.reset();
  perform t.ok((select body from public.class_post_comments where id = c) = 'đã sửa', 'sửa bình luận bài Social ghi đúng class_post_comments');
  perform t.as_user('A');
  perform t.fails(format($q$select public.feed_comment_edit('post', %L, 'sửa lén')$q$, c), 'không sửa bình luận bài của người khác', 'FEED_NOT_FOUND');
  perform t.fails(format($q$select public.feed_comment_delete('post', %L)$q$, c), 'không xoá bình luận bài của người khác', 'FEED_NOT_FOUND');
  perform t.as_user('B');
  perform public.feed_comment_delete('post', c);
  perform t.reset();
  perform t.ok((select count(*) from public.class_post_comments where id = c) = 0, 'xoá bình luận bài Social của mình');
  perform t.as_user('B');
  perform t.fails($q$select public.feed_comment_edit('bogus', gen_random_uuid(), 'x')$q$, 'loại lạ bị chặn', 'FEED_BAD_KIND');
end $$;
select 'ALL PASS' as result;
