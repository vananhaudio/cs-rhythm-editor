-- ═══ TEST Class Social — FEED COMMENTS PAGING V1 — cluster PostgreSQL TẠM (scripts/test-feed-comments-paging-db.sh). KHÔNG chạy production. ═══
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

-- ═══ Dữ liệu: thread 'thr' có 45 gốc (A viết; mỗi 5 gốc có 3 trả lời của B) · bài Social 'post' có 30 gốc + trả lời lồng ═══
do $$
declare i int; r uuid; n int := 0;
begin
  perform t.as_user('A');
  for i in 1..45 loop
    r := public.feed_comment_add('learning_thread', t.id('thr'), 'gốc ' || i); insert into t.c values ('g' || i, r);
  end loop;
  perform t.as_user('B');
  for i in 5..45 by 5 loop
    perform public.feed_comment_add('learning_thread', t.id('thr'), 'tl1 ' || i, t.cid('g' || i));
    perform public.feed_comment_add('learning_thread', t.id('thr'), 'tl2 ' || i, t.cid('g' || i));
    perform public.feed_comment_add('learning_thread', t.id('thr'), 'tl3 ' || i, t.cid('g' || i));
  end loop;
end $$;

-- 1) feed_comment_page: trang, con trỏ, không trùng/mất, trả lời đi theo gốc
do $$
declare p1 record; c1 bigint; c2 bigint; n int; ids1 uuid[]; ids2 uuid[]; ids3 uuid[]; allids uuid[];
begin
  perform t.as_user('C');
  perform t.ok((select count(*) from public.feed_comment_page('learning_thread', t.id('thr'))) > 0, 'C (cùng Class) đọc được trang đầu');
  perform t.ok((select count(distinct root_seq) from public.feed_comment_page('learning_thread', t.id('thr'))) = 20, 'trang đầu: đúng 20 gốc (mặc định)');
  perform t.ok((select max(older_roots) from public.feed_comment_page('learning_thread', t.id('thr'))) = 25, 'older_roots = 25 sau trang đầu');
  perform t.ok((select max(total_count) from public.feed_comment_page('learning_thread', t.id('thr'))) = 45 + 27, 'total_count = 72 (45 gốc + 27 trả lời)');
  select array_agg(id), min(root_seq) into ids1, c1 from public.feed_comment_page('learning_thread', t.id('thr'));
  select array_agg(id), min(root_seq) into ids2, c2 from public.feed_comment_page('learning_thread', t.id('thr'), c1);
  perform t.ok((select count(distinct root_seq) from public.feed_comment_page('learning_thread', t.id('thr'), c1)) = 20, 'trang 2: 20 gốc cũ hơn con trỏ');
  perform t.ok(not (ids1 && ids2), 'trang 1 và 2 KHÔNG trùng bình luận');
  select array_agg(id) into ids3 from public.feed_comment_page('learning_thread', t.id('thr'), c2, 20);
  perform t.ok((select count(distinct root_seq) from public.feed_comment_page('learning_thread', t.id('thr'), c2, 20)) = 5, 'trang 3: nốt 5 gốc còn lại');
  perform t.ok((select max(older_roots) from public.feed_comment_page('learning_thread', t.id('thr'), c2, 20)) = 0, 'trang cuối: older_roots = 0');
  allids := ids1 || ids2 || ids3;
  perform t.ok(cardinality(allids) = 72 and (select count(distinct x) from unnest(allids) x) = 72, 'ba trang gộp đủ 72 bình luận, không trùng, không mất');
  perform t.ok(not exists (select 1 from public.feed_comment_page('learning_thread', t.id('thr')) c
                           where c.parent_comment_id is not null and not exists (select 1 from public.feed_comment_page('learning_thread', t.id('thr')) g where g.id = c.parent_comment_id)),
               'mọi trả lời trong trang đi cùng gốc của nó');
  perform t.ok((select count(*) from public.feed_comment_page('learning_thread', t.id('thr'), 0)) = 0, 'con trỏ ≤ gốc cũ nhất → rỗng');
  perform t.ok((select count(distinct root_seq) from public.feed_comment_page('learning_thread', t.id('thr'), null, 9999)) = 45 and
               (select count(distinct root_seq) from public.feed_comment_page('learning_thread', t.id('thr'), null, 50)) = 45, 'limit kẹp trần 50 (vượt 200 cũ: 45 gốc/1 trang)');
  perform t.ok((select count(distinct root_seq) from public.feed_comment_page('learning_thread', t.id('thr'), null, 0)) = 1, 'limit ≤ 0 → 1');
  perform t.ok((select array_agg(seq order by ord) = array_agg(seq order by seq) from (select seq, row_number() over () ord from public.feed_comment_page('learning_thread', t.id('thr'))) z), 'đầu ra theo thứ tự ghi (seq tăng)');
end $$;

-- 2) Quyền & riêng tư
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select * from public.feed_comment_page('learning_thread', t.id('thr'))$q$, 'anon không gọi được feed_comment_page');
  perform t.fails($q$select * from public.class_comments_page_safe(t.id('post'))$q$, 'anon không gọi được class_comments_page_safe');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.feed_comment_page('learning_thread', t.id('thr'))) = 0, 'ngoài Class: trang rỗng');
  perform t.ok((select count(*) from public.class_comments_page_safe(t.id('post'))) = 0, 'ngoài Class: Social rỗng');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.feed_comment_page('learning_thread', t.id('thr_priv'))) = 0, 'thread private: rỗng');
  perform t.ok((select count(*) from public.feed_comment_page('post', t.id('post'))) = 0, 'kind post không đi đường này');
end $$;

-- 3) Ẩn và chặn: giống feed_comment_list (Safety V1)
do $$
declare hid uuid := t.cid('g40');
begin
  perform t.as_user('T');
  perform public.feed_comment_hide(hid, true);
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.feed_comment_page('learning_thread', t.id('thr'), null, 50) where id = hid), 'bình luận bị Thầy ẩn: học viên không thấy (kể cả trả lời của nó)');
  perform t.ok(not exists (select 1 from public.feed_comment_page('learning_thread', t.id('thr'), null, 50) where parent_comment_id = hid), 'trả lời dưới bình luận ẩn cũng không hiện');
  perform t.as_user('T');
  perform t.ok(exists (select 1 from public.feed_comment_page('learning_thread', t.id('thr'), null, 50) where id = hid and is_hidden), 'Thầy vẫn thấy bình luận ẩn');
  perform public.feed_comment_hide(hid, false);
  perform t.reset();
  insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('C'), t.u('B'));
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.feed_comment_page('learning_thread', t.id('thr'), null, 50) where author_user_id = t.u('B')), 'C chặn B: không thấy bình luận của B');
  perform t.ok((select count(*) from public.feed_comment_page('learning_thread', t.id('thr'), null, 50)) = 45, 'C chặn B: còn đúng 45 gốc của A');
  perform t.as_user('A');
  perform t.ok(not exists (select 1 from public.feed_comment_page('learning_thread', t.id('thr'), null, 50) where author_user_id = t.u('C')) , 'chặn hai chiều không làm lộ gì thêm');
  perform t.reset();
  delete from public.class_user_blocks where blocker_id = t.u('C');
end $$;

-- 4) Social: 30 gốc, trả lời, trả lời lồng; chặn
do $$
declare i int; r uuid; a1 uuid; b1 uuid; nested uuid;
begin
  perform t.as_user('A');
  for i in 1..30 loop r := public.class_add_comment(t.id('post'), 'sg' || i); insert into t.c values ('sg' || i, r); end loop;
  perform t.as_user('B');
  a1 := public.class_add_comment(t.id('post'), 'tl của B', '{}', '[]', t.cid('sg3')); insert into t.c values ('sa1', a1);
  perform t.as_user('C');
  nested := public.class_add_comment(t.id('post'), 'trả lời lồng của C', '{}', '[]', a1); insert into t.c values ('snest', nested);
  perform t.as_user('A');
  perform t.ok((select count(distinct root_seq) from public.class_comments_page_safe(t.id('post'))) = 20, 'Social trang đầu: 20 gốc');
  perform t.ok((select max(older_roots) from public.class_comments_page_safe(t.id('post'))) = 10, 'Social older_roots = 10');
  perform t.ok((select max(post_comment_count) from public.class_comments_page_safe(t.id('post'))) = 32, 'post_comment_count = 32');
  perform t.ok(not exists (select 1 from public.class_comments_page_safe(t.id('post')) where id in (a1, nested)), 'trả lời của gốc cũ (sg3) không có trong trang đầu (gốc nằm ngoài trang)');
  perform t.ok((select count(*) from public.class_comments_page_safe(t.id('post'), (select min(root_seq) from public.class_comments_page_safe(t.id('post'))))) = 12, 'Social trang 2: 10 gốc + 2 trả lời (gồm trả lời lồng) đi cùng gốc');
  perform t.ok(exists (select 1 from public.class_comments_page_safe(t.id('post'), (select min(root_seq) from public.class_comments_page_safe(t.id('post')))) where id = nested and root_seq = (select seq from public.class_post_comments where id = t.cid('sg3'))), 'trả lời lồng thuộc đúng gốc (root_seq)');
  perform t.ok((select max(older_roots) from public.class_comments_page_safe(t.id('post'), (select min(root_seq) from public.class_comments_page_safe(t.id('post'))))) = 0, 'Social trang cuối: older_roots = 0');
  perform t.ok(not exists (select 1 from public.class_comments_page_safe(t.id('post'), null, 50) g where g.parent_comment_id is not null and not exists (select 1 from public.class_comments_page_safe(t.id('post'), null, 50) q where q.id = g.parent_comment_id)), 'trang 50 gốc: mọi trả lời có đủ cha');
  perform t.reset(); insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('A'), t.u('B'));
  perform t.as_user('A');
  perform t.ok(not exists (select 1 from public.class_comments_page_safe(t.id('post'), null, 50) where author_user_id = t.u('B')), 'Social: A chặn B → không thấy dòng của B');
  perform t.ok(exists (select 1 from public.class_comments_page_safe(t.id('post'), null, 50) where id = nested), 'Social: trả lời của C dưới nhánh của B (bị chặn) KHÔNG mất');
  perform t.reset(); delete from public.class_user_blocks;
  perform t.as_user('N');
  perform t.ok((select count(*) from public.class_comments_page_safe(t.id('post'))) = 0, 'Social: ngoài Class rỗng');
  perform t.as_user('T');
  perform public.class_moderate('comment', t.cid('sg30'), true);
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.class_comments_page_safe(t.id('post'), null, 50) where id = t.cid('sg30')), 'Social: bình luận bị ẩn, học viên không thấy');
  perform t.as_user('T');
  perform t.ok(exists (select 1 from public.class_comments_page_safe(t.id('post'), null, 50) where id = t.cid('sg30') and is_hidden), 'Social: Thầy vẫn thấy');
  -- Tích hợp A–D: xoá cascade theo quan hệ cha–con THẬT (không dựa vào số đang hiển thị)
  perform t.reset();
  perform t.ok((select count(*) from public.class_post_comments where id in (t.cid('sg3'), a1, nested)) = 3, 'cascade: trước khi xoá có gốc + trả lời + trả lời lồng');
  delete from public.class_post_comments where id = t.cid('sg3');
  perform t.ok((select count(*) from public.class_post_comments where id in (t.cid('sg3'), a1, nested)) = 0, 'cascade: xoá gốc kéo theo CẢ trả lời và trả lời của trả lời (3 dòng)');
  perform t.ok(not exists (select 1 from public.class_post_comments c where c.parent_comment_id is not null and not exists (select 1 from public.class_post_comments p where p.id = c.parent_comment_id)), 'cascade: không còn trả lời mồ côi');
  perform t.ok((select count(*) from public.class_post_comments where post_id = t.id('post')) = 29, 'cascade: chỉ mất đúng 3 dòng (32 → 29)');
end $$;
