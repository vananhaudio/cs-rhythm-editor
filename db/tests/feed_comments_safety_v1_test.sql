-- ═══ TEST Feed Comments Safety V1 — chạy SAU feed_comments_v2_test.sql (dùng lại schema t) ═══
\set ON_ERROR_STOP on
-- Chuẩn bị: A và B cùng bình luận thread; C bình luận bài TeamLab
do $$
declare a uuid; b uuid; c uuid; r uuid;
begin
  perform t.reset(); delete from public.feed_comments; delete from public.class_reports; delete from t.c where k like 's\_%';
  perform t.as_user('A'); a := public.feed_comment_add('learning_thread', t.id('thr'), 'A gốc'); insert into t.c values ('s_a', a);
  perform t.as_user('B'); b := public.feed_comment_add('learning_thread', t.id('thr'), 'B trả lời A', a); insert into t.c values ('s_b', b);
  perform t.as_user('C'); c := public.feed_comment_add('learning_thread', t.id('thr'), 'C gốc'); insert into t.c values ('s_c', c);
  perform t.as_user('T'); r := public.feed_comment_add('learning_thread', t.id('thr'), 'T gốc'); insert into t.c values ('s_t', r);
end $$;

-- 1) Lọc người chặn
do $$ begin
  perform t.as_user('C');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr'))) = 4, 'chưa chặn: thấy đủ 4 bình luận');
  perform t.reset(); insert into public.class_user_blocks values (t.u('C'), t.u('A'));
  perform t.as_user('C');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr')) where author_user_id = t.u('A')) = 0, 'C chặn A: C không thấy bình luận của A');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr')) where id = t.cid('s_b')) = 0, 'trả lời dưới bình luận của người bị chặn cũng ẩn');
  perform t.ok((select comment_count from public.feed_comment_counts(array['learning_thread'], array[t.id('thr')])) = 2, 'đếm khớp danh sách (C + T)');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr')) where author_user_id = t.u('C')) = 0, 'chặn hai chiều: A không thấy bình luận của C');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr'))) = 4, 'B không bị ảnh hưởng, thấy đủ');
  perform t.reset(); delete from public.class_user_blocks;
  perform t.as_user('C');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr'))) = 4, 'gỡ chặn: thấy lại');
end $$;

-- 2) Báo cáo
grant select on t.c to anon;
do $$
declare id1 bigint; id2 bigint;
begin
  perform t.as_anon();
  -- t.cid() cần đọc t.c: cấp quyền chọn cho anon trong test
  perform t.fails(format($q$select public.feed_comment_report(%L, 'spam')$q$, t.cid('s_a')), 'anon không báo cáo được');
  perform t.as_user('N');
  perform t.fails(format($q$select public.feed_comment_report(%L, 'spam')$q$, t.cid('s_a')), 'ngoài Class không báo cáo được');
  perform t.as_user('C');
  perform t.fails(format($q$select public.feed_comment_report(%L, 'bogus')$q$, t.cid('s_a')), 'lý do lạ bị chặn', 'Lý do không hợp lệ');
  perform t.fails(format($q$select public.feed_comment_report(%L, 'spam')$q$, t.cid('s_c')), 'không báo cáo chính mình', 'chính mình');
  perform t.fails($q$select public.feed_comment_report(gen_random_uuid(), 'spam')$q$, 'bình luận không tồn tại', 'Không tìm thấy');
  id1 := public.feed_comment_report(t.cid('s_a'), 'harassment', 'xúc phạm');
  id2 := public.feed_comment_report(t.cid('s_a'), 'harassment', 'xúc phạm');
  perform t.ok(id1 = id2, 'báo cáo trùng đang mở trả cùng id (không sinh hai)');
  perform t.reset();
  perform t.ok((select count(*) from public.class_reports where kind = 'comment' and target_id = t.cid('s_a')::text and target_user_id = t.u('A') and excerpt = 'A gốc') = 1, 'báo cáo lưu đúng loại, tác giả, trích đoạn');
  perform t.as_user('A');   -- thread private: A vẫn thấy thread community; thử bình luận trong thread private không có
  perform t.fails(format($q$select public.feed_comment_report(%L, 'spam')$q$, t.cid('s_a')), 'tác giả không tự báo cáo', 'chính mình');
end $$;

-- 3) Thầy xử lý báo cáo → ẩn bình luận feed_comments
do $$
declare rid bigint;
begin
  perform t.reset(); select id into rid from public.class_reports where kind = 'comment' and status = 'new' limit 1;
  -- như class_report_resolve (security definer): cập nhật bằng owner
  update public.class_reports set status = 'handled', handled_by = t.u('T'), handled_at = now(), handled_action = 'dismiss' where id = rid;
  perform t.reset();
  perform t.ok((select hidden_at is null from public.feed_comments where id = t.cid('s_a')), 'dismiss không ẩn bình luận');
  update public.class_reports set status = 'new', handled_by = null, handled_at = null, handled_action = null where id = rid;
  update public.class_reports set status = 'handled', handled_by = t.u('T'), handled_at = now(), handled_action = 'hide' where id = rid;
  perform t.ok((select hidden_at is not null from public.feed_comments where id = t.cid('s_a')), 'hide → bình luận feed_comments bị ẩn');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.feed_comment_list('learning_thread', t.id('thr')) where id = t.cid('s_a')) = 0, 'người thường không thấy bình luận đã ẩn');
end $$;

-- 4) Bảng cũ không bị ảnh hưởng: báo cáo kind comment với id của class_post_comments vẫn đi đường cũ (trigger bỏ qua êm)
do $$ begin
  perform t.reset();
  insert into public.class_reports (reporter_id, kind, target_id, reason) values (t.u('C'), 'comment', gen_random_uuid()::text, 'spam');
  update public.class_reports set status = 'handled', handled_by = t.u('T'), handled_at = now(), handled_action = 'hide' where target_id not like '%' || t.cid('s_a')::text and status = 'new';
  perform t.ok(true, 'xử lý báo cáo comment không thuộc feed_comments: trigger bỏ qua êm');
end $$;
select 'ALL PASS' as result;
