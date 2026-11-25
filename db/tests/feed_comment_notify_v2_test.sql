-- ═══ TEST Feed Comment Notify V2 — chạy SAU feed_comments_v2_test.sql / safety test (dùng lại schema t). KHÔNG production. ═══
-- Người: A, C (người bình luận) · B = chủ bài (thread, bài Social, bài TeamLab) · T = Thầy
\set ON_ERROR_STOP on
do $$
declare v uuid; p_unpub uuid := t.id('pub_unpub');
begin
  perform t.reset();
  delete from public.class_system_notices; delete from public.feed_comments; delete from public.class_user_blocks;
  update public.teamlab_publications set published_by = t.u('B') where id in (t.id('pub'), p_unpub);
  v := gen_random_uuid(); insert into public.class_posts (id, author_user_id, type, audience, body, hidden_at) values (v, t.u('B'), 'assignment', 'class', 'ẩn', now()); insert into t.ids values ('post_hidden', v) on conflict (k) do update set id = excluded.id;
  v := gen_random_uuid(); insert into public.class_posts (id, author_user_id, type, audience, body) values (v, t.u('A'), 'assignment', 'class', 'của A'); insert into t.ids values ('post_a', v) on conflict (k) do update set id = excluded.id;
end $$;
create or replace function t.nn(p_user text, p_ref text, p_key uuid) returns int language sql stable as $$
  select count(*)::int from public.class_system_notices where user_id = t.u(p_user) and kind = 'feed_comment' and ref_type = p_ref and ref_key = p_key::text $$;

-- 1) Bài Social
do $$
begin
  perform t.as_user('A'); perform public.class_add_comment(t.id('post'), 'A bình luận bài của B'); perform t.reset();
  perform t.ok(t.nn('B', 'post', t.id('post')) = 1, 'Social: chủ bài nhận 1 thông báo khi người khác bình luận');
  perform t.ok((select body from public.class_system_notices where user_id = t.u('B') and ref_type = 'post') = 'Có bình luận mới trên bài của bạn.', 'Social: nội dung cố định, không chứa bình luận');
  perform t.as_user('A'); perform public.class_add_comment(t.id('post'), 'A bình luận lần 2'); perform t.reset();
  perform t.ok(t.nn('B', 'post', t.id('post')) = 1, 'Social: cùng người, cùng bài, cùng ngày → GỘP (không trùng)');
  perform t.as_user('C'); perform public.class_add_comment(t.id('post'), 'C bình luận'); perform t.reset();
  perform t.ok(t.nn('B', 'post', t.id('post')) = 2, 'Social: người khác bình luận → thông báo riêng');
  perform t.as_user('B'); perform public.class_add_comment(t.id('post'), 'B tự bình luận bài mình'); perform t.reset();
  perform t.ok((select count(*) from public.class_system_notices where user_id = t.u('B')) = 2, 'Social: KHÔNG tự báo cho chính mình');
  perform t.ok((select count(*) from public.class_system_notices where user_id in (t.u('A'), t.u('C'))) = 0, 'Social: người bình luận không nhận gì');
  -- chặn
  insert into public.class_user_blocks values (t.u('B'), t.u('T'));
  perform t.as_user('T'); perform public.class_add_comment(t.id('post'), 'T bị B chặn'); perform t.reset();
  perform t.ok(t.nn('B', 'post', t.id('post')) = 2, 'Social: B đã chặn T → không thông báo');
  delete from public.class_user_blocks;
  -- bài của A, B bình luận → A nhận; bài ẩn
  perform t.as_user('B'); perform public.class_add_comment(t.id('post_a'), 'B bình luận bài A'); perform t.reset();
  perform t.ok(t.nn('A', 'post', t.id('post_a')) = 1, 'Social: tác giả khác cũng nhận (A nhận từ B)');
  alter table public.class_posts disable trigger class_posts_before_update; update public.class_posts set hidden_at = now() where id = t.id('post_a'); alter table public.class_posts enable trigger class_posts_before_update;   -- test: mô phỏng Thầy ẩn bài
  perform t.ok((select hidden_at from public.class_posts where id = t.id('post_a')) is not null, 'bài đã ẩn (chuẩn bị ca bài ẩn)');
  begin perform t.as_user('C'); perform public.class_add_comment(t.id('post_a'), 'C bình luận bài đã ẩn'); exception when others then null; end;
  perform t.reset();
  perform t.ok(t.nn('A', 'post', t.id('post_a')) = 1, 'Social: bài đã ẩn → KHÔNG thêm thông báo (dù bình luận có lưu được hay không)');
  -- trigger lỗi không làm hỏng bình luận: ép lỗi INSERT thông báo bằng ràng buộc tạm (NOT VALID: chỉ chặn dòng mới)
  alter table public.class_system_notices add constraint tmp_force_fail check (kind <> 'feed_comment') not valid;
  perform t.as_user('C'); perform public.class_add_comment(t.id('post'), 'C lần 2 khi tạo thông báo lỗi'); perform t.reset();
  perform t.ok((select count(*) from public.class_post_comments where post_id = t.id('post') and body = 'C lần 2 khi tạo thông báo lỗi') = 1, 'Social: lỗi tạo thông báo KHÔNG làm hỏng việc lưu bình luận');
  alter table public.class_system_notices drop constraint tmp_force_fail;
end $$;

-- 2) Bài TeamLab đã xuất bản
do $$
begin
  perform t.as_user('A'); perform public.feed_comment_add('teamlab_publication', t.id('pub'), 'A khen bài');
  perform t.reset();
  perform t.ok(t.nn('B', 'teamlab_publication', t.id('pub')) = 1, 'TeamLab: người xuất bản nhận 1 thông báo');
  perform t.as_user('A'); perform public.feed_comment_add('teamlab_publication', t.id('pub'), 'A thêm'); perform t.reset();
  perform t.ok(t.nn('B', 'teamlab_publication', t.id('pub')) = 1, 'TeamLab: cùng người/ngày → GỘP');
  perform t.as_user('C'); perform public.feed_comment_add('teamlab_publication', t.id('pub'), 'C khen'); perform t.reset();
  perform t.ok(t.nn('B', 'teamlab_publication', t.id('pub')) = 2, 'TeamLab: người khác → thông báo riêng');
  perform t.as_user('B'); perform public.feed_comment_add('teamlab_publication', t.id('pub'), 'B tự trả lời'); perform t.reset();
  perform t.ok(t.nn('B', 'teamlab_publication', t.id('pub')) = 2, 'TeamLab: KHÔNG tự báo cho chính mình');
  insert into public.class_user_blocks values (t.u('B'), t.u('T'));
  perform t.as_user('T'); perform public.feed_comment_add('teamlab_publication', t.id('pub'), 'T bị chặn'); perform t.reset();
  perform t.ok(t.nn('B', 'teamlab_publication', t.id('pub')) = 2, 'TeamLab: người bị chặn (một trong hai chiều) → không báo');
  delete from public.class_user_blocks;
  -- published_by NULL → không ai nhận, bình luận vẫn lưu
  update public.teamlab_publications set published_by = null where id = t.id('pub');
  perform t.as_user('C'); perform public.feed_comment_add('teamlab_publication', t.id('pub'), 'C khi published_by NULL'); perform t.reset();
  perform t.ok((select count(*) from public.class_system_notices where ref_type = 'teamlab_publication') = 2, 'TeamLab: published_by NULL → không thông báo, không lỗi');
  update public.teamlab_publications set published_by = t.u('B') where id = t.id('pub');
  -- bài đã gỡ: không bình luận được (không thấy) → không thông báo
  perform t.as_user('A'); perform t.fails(format($q$select public.feed_comment_add('teamlab_publication', %L, 'x')$q$, t.id('pub_unpub')), 'TeamLab: bài đã gỡ không bình luận được', 'FEED_NOT_VISIBLE'); perform t.reset();
  perform t.ok(t.nn('B', 'teamlab_publication', t.id('pub_unpub')) = 0, 'TeamLab: bài đã gỡ → 0 thông báo');
end $$;

-- 3) Thread GIỮ NGUYÊN
do $$
begin
  perform t.as_user('A'); perform public.feed_comment_add('learning_thread', t.id('thr'), 'A bình luận thread'); perform t.reset();
  perform t.ok(t.nn('B', 'thread', t.id('thr')) = 1, 'Thread: vẫn thông báo chủ thread (hành vi V2 giữ nguyên)');
  perform t.as_user('A'); perform public.feed_comment_add('learning_thread', t.id('thr'), 'A lần 2'); perform t.reset();
  perform t.ok(t.nn('B', 'thread', t.id('thr')) = 1, 'Thread: gộp như cũ');
  perform t.as_user('B'); perform public.feed_comment_add('learning_thread', t.id('thr'), 'B tự'); perform t.reset();
  perform t.ok(t.nn('B', 'thread', t.id('thr')) = 1, 'Thread: không tự báo');
  perform t.as_user('C');
  perform t.fails(format($q$select public.feed_comment_add('learning_thread', %L, 'x')$q$, t.id('thr_priv')), 'Thread riêng tư vẫn không bình luận được', 'FEED_NOT_VISIBLE');
  perform t.reset();
end $$;

-- 4) Ràng buộc + quyền + hiển thị qua RPC thật của chủ bài
do $$
begin
  perform t.reset();
  perform t.fails($q$insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key) values ((select t.u('B')), 'checkpoint_graded', 'x', 'post', gen_random_uuid()::text, 'z1')$q$, 'ref_type post CHỈ đi với kind feed_comment');
  perform t.fails($q$insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key) values ((select t.u('B')), 'feed_comment', 'x', 'bogus', gen_random_uuid()::text, 'z2')$q$, 'ref_type lạ bị chặn');
  perform t.fails($q$insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key) values ((select t.u('B')), 'feed_comment', 'x', 'post', 'not-a-uuid', 'z3')$q$, 'ref_key sai dạng bị chặn');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.class_system_notices(null, 50) where kind = 'feed_comment' and ref_type in ('post', 'teamlab_publication', 'thread')) >= 5, 'RPC class_system_notices của chủ bài trả đủ thông báo mới');
  perform t.ok((select unread from public.class_system_notice_summary() limit 1) >= 5, 'class_system_notice_summary đếm chưa đọc (ting dựa vào đây)');
  perform t.fails($q$select public.class_post_comment_notify()$q$, 'authenticated không gọi hàm trigger');
  perform t.fails($q$select * from public.class_system_notices$q$, 'authenticated không đọc thẳng bảng thông báo');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.class_system_notices(null, 50)) = 1, 'A chỉ thấy thông báo của MÌNH (1 từ bài của A)');
  perform t.reset();
end $$;
select 'NOTIFY V2 ALL PASS' as result;
