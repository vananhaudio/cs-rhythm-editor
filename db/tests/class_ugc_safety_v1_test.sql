-- ═══ TEST Class UGC Safety V1 (db/class_ugc_safety_v1_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM, SAU khi nạp nền (Social + Learning Threads + dm_v1 + dm_share_v1 + Band Chat) và class_ugc_safety_v1_setup.sql.
-- Có chốt chặn: dừng nếu thấy user thật. TOÀN BỘ test chạy trong MỘT transaction và ROLLBACK ở cuối → không để lại dữ liệu.
-- Mỗi identity chạy dưới ĐÚNG role (authenticated/anon) + JWT sub → GRANT/SECURITY DEFINER/trigger được kiểm thật.
-- A, B, C, D = học viên · T = Thầy · N = tài khoản ngoài Class. Band a1 có A, B (C thêm sau).
-- Mỗi kiểm tra in "PASS: …"; lỗi → raise exception 'FAIL: …' (dừng ngay).
\set ON_ERROR_STOP on
begin;

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
  if to_regclass('public.class_reports') is null then raise exception 'DỪNG: chưa chạy class_ugc_safety_v1_setup.sql'; end if;
end $$;

-- Học viên thứ tư D
insert into auth.users (id, email) values ('0d0d0d0d-0000-4000-8000-0000000000d4', 'd@test.local');
insert into public.app_users (id, role, name, email) values ('0d0d0d0d-0000-4000-8000-0000000000d4', 'student', 'Dũng', 'd@test.local');
insert into public.edu_students (user_id, full_name, display_name, email, level)
  values ('0d0d0d0d-0000-4000-8000-0000000000d4', 'Phạm Dũng', 'Dũng', 'd@test.local', 'beginner');

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
                when 'D' then '0d0d0d0d-0000-4000-8000-0000000000d4'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end
$$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
create function t.fails(q text, msg text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — câu lệnh lẽ ra phải bị chặn: %', msg, q;
end $$;
-- phải lỗi VÀ thông báo chứa p_msg (kiểm đúng mã ugc_blocked / user_blocked / account_suspended)
create function t.fails_with(q text, p_msg text, msg text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then
    if sqlerrm like '%' || p_msg || '%' then raise notice 'PASS: % (lỗi "%")', msg, sqlerrm; return; end if;
    raise exception 'FAIL: % — lỗi sai: "%" (cần chứa "%")', msg, sqlerrm, p_msg;
  end;
  raise exception 'FAIL: % — câu lệnh lẽ ra phải bị chặn: %', msg, q;
end $$;
create function t.err(q text) returns text language plpgsql as $$ begin
  execute q; return 'OK';
exception when others then return sqlstate || ':' || sqlerrm;
end $$;
-- kho giá trị trung gian
create table t.kv (k text primary key, v text);
grant all on t.kv to anon, authenticated;
create function t.set(k text, v text) returns void language sql security definer as $$
  insert into t.kv values (k, v) on conflict (k) do update set v = excluded.v $$;
create function t.get(p text) returns text language sql security definer as $$ select v from t.kv where k = p $$;
create function t.friends(x text, y text, st text) returns void language sql security definer as $$
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  values (t.u(x), t.u(y), st, case when st = 'pending' then null else now() end)
$$;
create function t.nfriend(x text, y text) returns int language sql security definer as $$
  select count(*)::int from public.friendships where least(requester_id, addressee_id) = least(t.u(x), t.u(y)) and greatest(requester_id, addressee_id) = greatest(t.u(x), t.u(y)) $$;
create function t.mkpost(author text, body text, mins int default 0) returns uuid language sql security definer as $$
  insert into public.class_posts (author_user_id, type, body, media_type, media_provider, media_url, external_media_id, created_at)
  values (t.u(author), 'assignment', body, 'external_video', 'youtube', 'https://youtu.be/abc123', 'abc123', now() - make_interval(mins => mins)) returning id $$;
create function t.mkcomment(post uuid, author text, body text) returns uuid language sql security definer as $$
  insert into public.class_post_comments (post_id, author_user_id, body) values (post, t.u(author), body) returning id $$;
create function t.rep(p_id bigint) returns jsonb language sql security definer as $$ select to_jsonb(r) from public.class_reports r where r.id = p_id $$;
create function t.nrep(p_where text) returns int language plpgsql security definer as $$ declare n int; begin
  execute 'select count(*) from public.class_reports where ' || p_where into n; return n; end $$;
create function t.sql1(p_q text) returns text language plpgsql security definer as $$ declare r text; begin execute p_q into r; return r; end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Nền dữ liệu (chạy bằng owner) ──
select t.friends('A', 'B', 'accepted');
insert into public.teamlab_band_members (band_id, user_id) values
  ('11111111-0000-4000-8000-0000000000a1', t.u('A')), ('11111111-0000-4000-8000-0000000000a1', t.u('B'));
-- STUB-an toàn: thread/event tạo thẳng (lt_submit cần giáo trình)
insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility)
  values ('77777777-0000-4000-8000-000000000001', t.u('A'), 'L:00000000-0000-4000-8000-000000000001', '{}', 'community'),
         ('77777777-0000-4000-8000-000000000002', t.u('A'), 'L:00000000-0000-4000-8000-000000000002', '{}', 'private');
insert into public.learning_thread_events (id, thread_id, author_user_id, author_role, kind, body) values
  ('88888888-0000-4000-8000-000000000001', '77777777-0000-4000-8000-000000000001', t.u('A'), 'student', 'submission', 'Em nộp bài buổi 1'),
  ('88888888-0000-4000-8000-000000000002', '77777777-0000-4000-8000-000000000002', t.u('A'), 'student', 'submission', 'Em nộp bài riêng tư');

-- ── 0. Bảng khoá hẳn + quyền gọi ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select * from public.class_reports$q$, '0 authenticated KHÔNG đọc thẳng class_reports');
  perform t.fails($q$insert into public.class_reports (reporter_id, kind, target_id, reason) values (t.u('A'), 'post', 'x', 'spam')$q$, '0 KHÔNG chèn thẳng class_reports');
  perform t.fails($q$update public.class_reports set status = 'handled'$q$, '0 KHÔNG sửa thẳng trạng thái báo cáo');
  perform t.fails($q$select * from public.class_user_blocks$q$, '0 KHÔNG đọc thẳng class_user_blocks');
  perform t.fails($q$insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('A'), t.u('C'))$q$, '0 KHÔNG tự chèn chặn');
  perform t.fails($q$select * from public.class_ugc_consent$q$, '0 KHÔNG đọc thẳng class_ugc_consent');
  perform t.fails($q$insert into public.class_ugc_consent (user_id, version) values (t.u('A'), 1)$q$, '0 KHÔNG tự ghi đồng ý');
  perform t.fails($q$select * from public.class_ugc_blocklist$q$, '0 KHÔNG đọc danh sách từ cấm');
  perform t.fails($q$delete from public.class_ugc_blocklist$q$, '0 KHÔNG xoá từ cấm');
  perform t.fails($q$select public.class_ugc_pair_blocked(t.u('A'), t.u('B'))$q$, '0 class_ugc_pair_blocked là nội bộ');
  perform t.fails($q$select public.class_ugc_text_blocked('x')$q$, '0 class_ugc_text_blocked là nội bộ');
  perform t.as_anon();
  perform t.fails($q$select public.class_report_submit('post', 'x', 'spam')$q$, '0 anon không gọi class_report_submit');
  perform t.fails($q$select public.class_block_user(t.u('A'))$q$, '0 anon không gọi class_block_user');
  perform t.fails($q$select * from public.class_feed_safe()$q$, '0 anon không gọi class_feed_safe');
  perform t.fails($q$select * from public.class_reports_list()$q$, '0 anon không gọi class_reports_list');
  perform t.fails($q$select * from public.class_ugc_status()$q$, '0 anon không gọi class_ugc_status');
  perform t.reset();
  perform t.ok((select count(*) from pg_policies where schemaname = 'public' and tablename in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')) = 0, '0 4 bảng UGC không có policy');
  perform t.ok((select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
                  and table_name in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')) = 0, '0 4 bảng UGC không grant cho anon/authenticated');
end $$;

-- ── 1. Gửi báo cáo ──
do $$
declare p1 uuid; cm uuid; r1 bigint; r2 bigint; r3 bigint; j jsonb; conv text;
begin
  perform t.reset();
  p1 := t.mkpost('A', 'Bài tập guitar của An', 0);  perform t.set('p1', p1::text);
  insert into public.class_posts (id, author_user_id, type, audience, body) values ('99999999-0000-4000-8000-000000000001', t.u('A'), 'status', 'friends', 'Tường riêng của An');
  cm := t.mkcomment(p1, 'A', 'Bình luận của An'); perform t.set('cm', cm::text);
  perform t.as_user('A');
  perform t.set('conv', (select conversation_id::text from public.dm_start(t.u('B'), 'Chào Bình')));
  perform public.bandchat_send('11111111-0000-4000-8000-0000000000a1', 'Chào cả Band');
  conv := t.get('conv');

  perform t.as_user('B');
  r1 := public.class_report_submit('post', p1::text, 'spam', 'quảng cáo lạ');
  perform t.set('r_post', r1::text);
  perform t.reset(); j := t.rep(r1);
  perform t.ok(j ->> 'reporter_id' = t.u('B')::text and j ->> 'target_user_id' = t.u('A')::text and j ->> 'status' = 'new'
               and j ->> 'excerpt' = 'Bài tập guitar của An' and j ->> 'kind' = 'post',
               '1 gửi báo cáo: reporter = auth.uid() (B), target_user suy từ bài (A), trạng thái new, có trích đoạn');
  perform t.as_user('B');
  r2 := public.class_report_submit('POST', upper(p1::text), 'hate', null);
  perform t.ok(r2 = r1, '1 trùng báo cáo đang mở (kể cả viết hoa/đổi lý do) → trả id cũ');
  perform t.reset();
  perform t.ok(t.nrep(format('reporter_id = %L and kind = ''post'' and target_id = %L', t.u('B'), p1::text)) = 1, '1 chỉ MỘT hàng báo cáo cho (B, post, p1)');
  perform t.as_user('C');
  r3 := public.class_report_submit('post', p1::text, 'harassment');
  perform t.set('r_post_c', r3::text);
  perform t.ok(r3 <> r1, '1 người khác (C) báo cáo cùng bài → hàng riêng');

  -- đầu vào sai
  perform t.as_user('B');
  perform t.fails(format($q$select public.class_report_submit('bogus', %L, 'spam')$q$, p1::text), '1 kind sai bị từ chối');
  perform t.fails(format($q$select public.class_report_submit('post', %L, 'bogus')$q$, p1::text), '1 lý do sai bị từ chối');
  perform t.fails(format($q$select public.class_report_submit('post', %L, 'spam', %L)$q$, p1::text, repeat('x', 501)), '1 ghi chú > 500 ký tự bị từ chối');
  perform t.fails($q$select public.class_report_submit('post', 'khong-phai-uuid', 'spam')$q$, '1 target_id không phải uuid bị từ chối');
  perform t.fails($q$select public.class_report_submit('post', gen_random_uuid()::text, 'spam')$q$, '1 bài không tồn tại bị từ chối');
  perform t.as_user('N');
  perform t.fails(format($q$select public.class_report_submit('post', %L, 'spam')$q$, p1::text), '1 người ngoài Class không báo cáo được');

  -- không tự báo cáo
  perform t.as_user('A');
  perform t.fails_with(format($q$select public.class_report_submit('post', %L, 'spam')$q$, p1::text), 'chính mình', '1 KHÔNG tự báo cáo bài của mình');
  perform t.fails(format($q$select public.class_report_submit('comment', %L, 'spam')$q$, t.get('cm')), '1 KHÔNG tự báo cáo bình luận của mình');
  perform t.fails(format($q$select public.class_report_submit('profile', %L, 'spam')$q$, t.u('A')::text), '1 KHÔNG tự báo cáo hồ sơ mình');
  perform t.fails(format($q$select public.class_report_submit('dm_message', %L, 'spam')$q$, conv || ':1'), '1 KHÔNG tự báo cáo tin DM của mình');

  -- chỉ báo cáo được cái mình THẤY: bài tường bạn bè
  perform t.as_user('C');
  perform t.fails($q$select public.class_report_submit('post', '99999999-0000-4000-8000-000000000001', 'spam')$q$, '1 C (không phải bạn) không báo cáo được bài tường riêng của A');
  perform t.as_user('B');
  perform t.ok(public.class_report_submit('post', '99999999-0000-4000-8000-000000000001', 'spam') > 0, '1 B (bạn của A) báo cáo được bài tường');

  -- bình luận, hồ sơ
  perform t.set('r_comment', public.class_report_submit('comment', t.get('cm'), 'harassment', 'xúc phạm')::text);
  perform t.ok(t.get('r_comment') is not null, '1 báo cáo bình luận');
  perform t.set('r_profile', public.class_report_submit('profile', t.u('A')::text, 'inappropriate')::text);
  perform t.ok(t.get('r_profile') is not null, '1 báo cáo hồ sơ');
  perform t.fails(format($q$select public.class_report_submit('profile', %L, 'spam')$q$, t.u('N')::text), '1 hồ sơ người ngoài Class: không tìm thấy');

  -- DM: định dạng '<conversationId>:<seq>'
  perform t.set('r_dm', public.class_report_submit('dm_message', conv || ':1', 'harassment')::text);
  perform t.reset(); j := t.rep(t.get('r_dm')::bigint);
  perform t.ok(j ->> 'target_user_id' = t.u('A')::text and j ->> 'excerpt' = 'Chào Bình', '1 báo cáo tin DM: target_user = người gửi, có trích đoạn');
  perform t.as_user('C');
  perform t.fails(format($q$select public.class_report_submit('dm_message', %L, 'spam')$q$, conv || ':1'), '1 người KHÔNG ở trong hội thoại không báo cáo được tin DM');
  perform t.as_user('B');
  perform t.fails(format($q$select public.class_report_submit('dm_message', %L, 'spam')$q$, conv || ':999'), '1 tin DM không tồn tại bị từ chối');
  perform t.fails($q$select public.class_report_submit('dm_message', 'khongphaidinhdang', 'spam')$q$, '1 dm_message sai định dạng bị từ chối');

  -- Band: định dạng 'band:<id>:<seq>' (client) và '<id>:<seq>'
  perform t.set('r_band', public.class_report_submit('band_message', 'band:11111111-0000-4000-8000-0000000000a1:1', 'spam')::text);
  perform t.reset(); j := t.rep(t.get('r_band')::bigint);
  perform t.ok(j ->> 'target_id' = 'band:11111111-0000-4000-8000-0000000000a1:1' and j ->> 'target_user_id' = t.u('A')::text, '1 báo cáo tin Band (band:<id>:<seq>): lưu dạng chuẩn, target_user = người gửi');
  perform t.as_user('B');
  perform t.ok(public.class_report_submit('band_message', '11111111-0000-4000-8000-0000000000a1:1', 'spam') = t.get('r_band')::bigint, '1 dạng không tiền tố cũng khớp và trùng báo cáo trên');
  perform t.as_user('C');
  perform t.fails($q$select public.class_report_submit('band_message', 'band:11111111-0000-4000-8000-0000000000a1:1', 'spam')$q$, '1 C chưa là thành viên Band: không báo cáo được tin Band');

  -- Thread: event.id (và thread.id)
  perform t.as_user('B');
  perform t.set('r_thread', public.class_report_submit('thread', '88888888-0000-4000-8000-000000000001', 'inappropriate')::text);
  perform t.reset(); j := t.rep(t.get('r_thread')::bigint);
  perform t.ok(j ->> 'target_user_id' = t.u('A')::text and j ->> 'excerpt' = 'Em nộp bài buổi 1', '1 báo cáo lượt thread (event.id): target_user = tác giả');
  perform t.as_user('B');
  perform t.ok(public.class_report_submit('thread', '77777777-0000-4000-8000-000000000001', 'other') > 0, '1 báo cáo cả thread (thread.id) cũng được');
  perform t.fails($q$select public.class_report_submit('thread', '88888888-0000-4000-8000-000000000002', 'spam')$q$, '1 lượt thread RIÊNG TƯ của người khác: không báo cáo được');
end $$;

-- ── 2. Giới hạn tần suất (20 báo cáo / giờ / người) ──
do $$
declare i int; ids uuid[] := '{}'; rid bigint;
begin
  perform t.reset();
  for i in 1..22 loop ids := ids || t.mkpost('A', 'Bài rate ' || i, 0); end loop;
  perform t.as_user('D');
  for i in 1..20 loop rid := public.class_report_submit('post', ids[i]::text, 'spam'); end loop;
  perform t.ok(true, '2 D gửi đủ 20 báo cáo trong giờ');
  perform t.fails_with(format($q$select public.class_report_submit('post', %L, 'spam')$q$, ids[21]::text), 'quá nhanh', '2 báo cáo thứ 21 trong giờ bị giới hạn tần suất');
  perform t.ok(public.class_report_submit('post', ids[3]::text, 'spam') is not null, '2 gửi lại báo cáo đã mở (trùng) KHÔNG bị tính giới hạn, trả id cũ');
  perform t.as_user('B');
  perform t.ok(public.class_report_submit('post', ids[21]::text, 'spam') > 0, '2 giới hạn tính theo từng người (B vẫn gửi được)');
end $$;

-- ── 3. Người thường không đọc/sửa/xử lý báo cáo ──
do $$
begin
  perform t.as_user('B');
  perform t.fails($q$select * from public.class_reports$q$, '3 B không SELECT báo cáo');
  perform t.fails($q$update public.class_reports set status = 'dismissed'$q$, '3 B không UPDATE báo cáo của mình');
  perform t.fails($q$delete from public.class_reports$q$, '3 B không DELETE báo cáo');
  perform t.fails($q$select * from public.class_reports_list()$q$, '3 B không gọi class_reports_list');
  perform t.fails_with(format($q$select public.class_report_resolve(%s, 'dismiss')$q$, t.get('r_post')), 'Không có quyền', '3 B không tự đóng báo cáo');
  perform t.as_user('A');
  perform t.fails($q$select * from public.class_reports_list()$q$, '3 A (bị báo cáo) không xem được báo cáo về mình');
  perform t.fails_with(format($q$select public.class_report_resolve(%s, 'dismiss')$q$, t.get('r_post')), 'Không có quyền', '3 A không xoá báo cáo về mình');
  perform t.as_user('D');
  perform t.fails(format($q$select public.class_report_resolve(%s, 'hide')$q$, t.get('r_post')), '3 D không hide');
end $$;

-- ── 4. Thầy xem / xử lý ──
do $$
declare n int; j jsonb; rows jsonb; p1 uuid := t.get('p1')::uuid;
begin
  perform t.as_user('T');
  select count(*) into n from public.class_reports_list('new', 200);
  perform t.ok(n >= 10, '4 Thầy xem được danh sách báo cáo mới (' || n || ' dòng)');
  select to_jsonb(l) into j from public.class_reports_list('new', 200) l where l.id = t.get('r_dm')::bigint;
  perform t.ok(j ->> 'reporter_name' = 'Bình' and j ->> 'target_user_name' = 'An' and j ->> 'excerpt' = 'Chào Bình' and j ->> 'kind' = 'dm_message',
               '4 dòng báo cáo có tên người báo (Bình), người bị báo (An), trích đoạn, kind');
  perform t.fails($q$select * from public.class_reports_list('bogus')$q$, '4 trạng thái lọc sai bị từ chối');
  perform t.fails_with($q$select public.class_report_resolve(-1, 'dismiss')$q$, 'Không tìm thấy', '4 báo cáo không tồn tại');
  perform t.fails_with(format($q$select public.class_report_resolve(%s, 'xoa')$q$, t.get('r_post')), 'không hợp lệ', '4 action sai bị từ chối');

  -- dismiss
  perform public.class_report_resolve(t.get('r_comment')::bigint, 'dismiss', 'không vi phạm');
  perform t.reset(); j := t.rep(t.get('r_comment')::bigint);
  perform t.ok(j ->> 'status' = 'dismissed' and j ->> 'handled_by' = t.u('T')::text and j ->> 'handled_action' = 'dismiss' and j ->> 'handled_note' = 'không vi phạm' and j ->> 'handled_at' is not null,
               '4 dismiss: status=dismissed, ghi handled_by/at/action/note');
  perform t.as_user('T');
  perform t.fails_with(format($q$select public.class_report_resolve(%s, 'handled')$q$, t.get('r_comment')), 'đã được xử lý', '4 xử lý lại báo cáo đã đóng bị từ chối');
  select count(*) into n from public.class_reports_list('dismissed', 200); perform t.ok(n = 1, '4 lọc theo trạng thái dismissed');

  -- hide bài: ẩn qua class_moderate, đóng cả báo cáo của C cùng đối tượng
  perform public.class_report_resolve(t.get('r_post')::bigint, 'hide', 'quảng cáo');
  perform t.reset();
  perform t.ok((select hidden_at is not null and hidden_by = t.u('T') from public.class_posts where id = p1), '4 hide: bài bị ẩn (hidden_at/hidden_by qua class_moderate)');
  perform t.ok(t.rep(t.get('r_post_c')::bigint) ->> 'status' = 'handled' and t.rep(t.get('r_post_c')::bigint) ->> 'handled_action' = 'hide', '4 hide: báo cáo mở khác của C về cùng bài cũng được đóng');
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.class_feed(null, null, 50) f where f.id = p1), '4 bài đã ẩn không còn trong class_feed của học viên');

  -- hide trên loại không ẩn được; handled; hide thread event qua lt_moderate
  perform t.as_user('T');
  perform t.fails_with(format($q$select public.class_report_resolve(%s, 'hide')$q$, t.get('r_profile')), 'không có chức năng ẩn', '4 hide trên báo cáo hồ sơ bị từ chối (dùng handled/hide_and_block)');
  perform public.class_report_resolve(t.get('r_profile')::bigint, 'handled');
  perform t.reset(); perform t.ok(t.rep(t.get('r_profile')::bigint) ->> 'status' = 'handled', '4 handled: đóng báo cáo, không đụng nội dung');
  perform t.as_user('T');
  perform public.class_report_resolve(t.get('r_thread')::bigint, 'hide');
  perform t.reset();
  perform t.ok((select hidden_at is not null from public.learning_thread_events where id = '88888888-0000-4000-8000-000000000001'), '4 hide lượt thread: ẩn qua lt_moderate');

  -- hide_and_block trên tin DM (không ẩn được) → đình chỉ người gửi; không được đình chỉ Thầy
  perform t.as_user('A');
  perform t.set('r_tprof', public.class_report_submit('profile', t.u('T')::text, 'other')::text);
  perform t.as_user('T');
  perform t.fails_with(format($q$select public.class_report_resolve(%s, 'hide_and_block')$q$, t.get('r_tprof')), 'Thầy/Admin', '4 không đình chỉ được Thầy/Admin');
  perform public.class_report_resolve(t.get('r_tprof')::bigint, 'dismiss');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.class_my_blocks()) = 0, '4 (dọn) A chưa chặn ai');
end $$;

-- ── 5. Chặn / bỏ chặn + huỷ bạn bè + kết bạn bị từ chối ──
do $$
declare ne_before int; nm_before int; nb_before int; st text;
begin
  perform t.reset();
  select count(*) into ne_before from public.edu_students;
  select count(*) into nm_before from public.teamlab_band_members;
  perform t.ok(t.nfriend('A', 'B') = 1, '5 trước: A-B là bạn');
  perform t.as_user('A');
  perform t.fails($q$select public.class_block_user(t.u('A'))$q$, '5 không chặn chính mình');
  perform t.fails($q$select public.class_block_user(t.u('N'))$q$, '5 không chặn người ngoài Class');
  perform t.fails_with($q$select public.class_block_user(t.u('T'))$q$, 'Thầy/Admin', '5 không chặn Thầy/Admin');
  perform t.fails($q$select public.class_block_user(null)$q$, '5 không chặn null');
  perform public.class_block_user(t.u('B'));
  perform public.class_block_user(t.u('B'));   -- idempotent
  perform t.ok((select count(*) from public.class_my_blocks()) = 1 and (select name from public.class_my_blocks()) = 'Bình', '5 chặn (idempotent): class_my_blocks có B (kèm tên)');
  perform t.reset();
  perform t.ok(t.nfriend('A', 'B') = 0, '5 chặn đã HUỶ quan hệ bạn bè');
  perform t.ok((select count(*) from public.edu_students) = ne_before and (select count(*) from public.teamlab_band_members) = nm_before, '5 chặn KHÔNG đụng edu_students / thành viên Band');
  perform t.ok(public.is_class_member_user(t.u('A')) and public.is_class_member_user(t.u('B')), '5 cả hai vẫn là thành viên Class');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.class_my_blocks()) = 0, '5 B KHÔNG thấy mình bị chặn trong class_my_blocks');
  perform t.ok(public.is_class_member(), '5 B vẫn là thành viên Class');
  perform t.ok(public.class_is_blocked_pair(t.u('A'), t.u('B')) and public.class_is_blocked_pair(t.u('B'), t.u('A')), '5 class_is_blocked_pair đúng hai chiều (gọi bởi B)');
  perform t.as_user('C');
  perform t.ok(not public.class_is_blocked_pair(t.u('A'), t.u('B')), '5 C hỏi về cặp A-B: luôn false (không dò quan hệ người khác)');
  perform t.as_user('T');
  perform t.ok(public.class_is_blocked_pair(t.u('A'), t.u('B')), '5 Thầy hỏi được');

  -- kết bạn bị từ chối hai chiều
  perform t.as_user('B');
  perform t.fails_with($q$select public.send_friend_request(t.u('A'))$q$, 'user_blocked', '5 B (bị chặn) gửi kết bạn cho A: user_blocked');
  perform t.as_user('A');
  perform t.fails_with($q$select public.send_friend_request(t.u('B'))$q$, 'user_blocked', '5 A (người chặn) gửi kết bạn cho B: user_blocked');
  perform t.reset();
  perform t.fails_with($q$select t.friends('A', 'B', 'pending')$q$, 'user_blocked', '5 trigger friendships chặn cả chèn trực tiếp');
  perform t.ok(t.nfriend('A', 'B') = 0, '5 không có quan hệ nào được tạo');

  -- bỏ chặn
  perform t.as_user('A');
  perform public.class_unblock_user(t.u('B'));
  perform public.class_unblock_user(t.u('B'));   -- idempotent
  perform t.ok((select count(*) from public.class_my_blocks()) = 0, '5 bỏ chặn (idempotent)');
  perform t.reset(); perform t.ok(t.nfriend('A', 'B') = 0, '5 bỏ chặn KHÔNG khôi phục bạn bè');
  perform t.as_user('A');
  st := public.send_friend_request(t.u('B'));
  perform t.ok(st = 'outgoing', '5 sau bỏ chặn kết bạn lại được (' || st || ')');
  perform t.as_user('B');
  perform public.respond_friend_request(t.u('A'), true);
  perform t.reset(); perform t.ok(t.nfriend('A', 'B') = 1, '5 kết bạn lại thành công');
  perform t.as_user('A');
  perform t.ok(not public.class_is_blocked_pair(t.u('A'), t.u('B')), '5 hết chặn');
end $$;

-- ── 6. DM: chặn → ẩn đọc, từ chối gửi; lịch sử còn nguyên ──
do $$
declare conv uuid := t.get('conv')::uuid; n int;
begin
  perform t.as_user('B');
  perform public.dm_send(conv, 'Bình trả lời');
  perform t.ok((select count(*) from public.dm_messages_safe(conv)) = 2, '6 chưa chặn: dm_messages_safe trả đủ 2 tin');
  perform t.ok((select count(*) from public.dm_conversations_safe()) = 1, '6 chưa chặn: dm_conversations_safe có hội thoại');
  perform t.as_user('A');
  perform public.class_block_user(t.u('B'));
  perform t.ok((select count(*) from public.dm_messages_safe(conv)) = 0, '6 A chặn B: A không thấy tin nào');
  perform t.ok((select count(*) from public.dm_conversations_safe()) = 0, '6 A chặn B: hội thoại biến khỏi danh sách của A');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.dm_messages_safe(conv)) = 0, '6 B (bị chặn) cũng không thấy tin nào (hai chiều)');
  perform t.ok((select count(*) from public.dm_conversations_safe()) = 0, '6 hội thoại biến khỏi danh sách của B');
  perform t.ok((select count(*) from public.dm_messages(conv)) = 2, '6 hàm GỐC dm_messages không đổi (còn 2 tin)');
  perform t.fails('select public.dm_send(''' || conv || ''', ''thử nhắn lại'')', '6 B không gửi được cho người đã chặn mình (dm_send)');
  perform t.as_user('A');
  perform t.fails('select public.dm_send(''' || conv || ''', ''thử nhắn lại'')', '6 A không gửi được cho người mình chặn');
  perform t.reset();
  perform t.fails_with(format($q$insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body) values (%L, 99, 'user', %L, 'xin chào')$q$, conv, t.u('B')::text),
                       'user_blocked', '6 trigger DM chặn cả chèn trực tiếp khi hai bên chặn nhau');
  perform t.as_user('C');
  perform t.fails_with('select * from public.dm_messages_safe(''' || conv || ''')', 'Không tìm thấy', '6 người ngoài hội thoại vẫn nhận lỗi P0002 như bản gốc');
  perform t.as_user('A');
  perform public.class_unblock_user(t.u('B'));
  perform t.ok((select count(*) from public.dm_messages_safe(conv)) = 2, '6 bỏ chặn: lịch sử hiện lại đủ');
  perform t.fails('select public.dm_send(''' || conv || ''', ''chưa là bạn'')', '6 bỏ chặn không khôi phục bạn bè → chưa nhắn được cho tới khi kết bạn lại');
  perform public.send_friend_request(t.u('B'));
  perform t.as_user('B'); perform public.respond_friend_request(t.u('A'), true);
  perform t.as_user('A'); perform public.dm_send(conv, 'Làm lành nhé');
  perform t.ok((select count(*) from public.dm_messages_safe(conv)) = 3, '6 kết bạn lại: gửi được và đọc được 3 tin');
end $$;
-- Báo cáo lại sau khi bị bác bỏ → hàng MỚI (chỉ chặn trùng khi báo cáo cũ còn mở)
do $$
declare rid bigint; cid uuid;
begin
  perform t.reset();
  cid := t.mkcomment(t.mkpost('C', 'Bài cho 4b', 0), 'A', 'bình luận 4b');
  perform t.as_user('B');
  rid := public.class_report_submit('comment', cid::text, 'harassment', 'lần 1');
  perform t.as_user('T');
  perform public.class_report_resolve(rid, 'dismiss');
  perform t.as_user('B');
  perform t.ok(public.class_report_submit('comment', cid::text, 'harassment', 'báo lại') <> rid, '4b báo cáo lại sau khi báo cáo cũ đã bị bác bỏ → hàng mới');
end $$;

-- ── Helper phân trang (chạy bằng CHÍNH người gọi, không security definer) ──
select t.reset();
create function t.feed_all(p_fn text, p_lim int, p_excl uuid) returns jsonb language plpgsql as $$
declare ids uuid[] := '{}'; pages int[] := '{}'; bt timestamptz; bid uuid; n int; r record; guard int := 0;
begin
  loop
    n := 0;
    for r in execute format('select id, created_at, author_user_id from public.%I(%L::timestamptz, %L::uuid, %s)', p_fn, bt, bid, p_lim) loop
      n := n + 1; bt := r.created_at; bid := r.id;
      if p_excl is null or r.author_user_id <> p_excl then ids := ids || r.id; end if;
    end loop;
    exit when n = 0;
    pages := pages || n;
    guard := guard + 1; if guard > 300 then raise exception 'FAIL: vòng lặp phân trang không dừng'; end if;
  end loop;
  return jsonb_build_object('ids', to_jsonb(ids), 'pages', to_jsonb(pages));
end $$;
create function t.sfeed_all(p_fn text, p_scope text, p_lim int, p_excl uuid) returns jsonb language plpgsql as $$
declare keys text[] := '{}'; pages int[] := '{}'; bt timestamptz; bk text; n int; r record; guard int := 0; v_q text; v_who uuid;
begin
  loop
    n := 0;
    if p_scope is null then v_q := format('select sort_at, sort_key, post, thread from public.%I(%L::timestamptz, %L::text, %s)', p_fn, bt, bk, p_lim);
    else v_q := format('select sort_at, sort_key, post, thread from public.%I(%L::text, %L::timestamptz, %L::text, %s)', p_fn, p_scope, bt, bk, p_lim);
    end if;
    for r in execute v_q loop
      n := n + 1; bt := r.sort_at; bk := r.sort_key;
      v_who := coalesce(nullif(r.post ->> 'author_user_id', ''), nullif(r.thread -> 'learner' ->> 'user_id', ''))::uuid;
      if p_excl is null or v_who is distinct from p_excl then keys := keys || r.sort_key; end if;
    end loop;
    exit when n = 0;
    pages := pages || n;
    guard := guard + 1; if guard > 300 then raise exception 'FAIL: vòng lặp phân trang không dừng'; end if;
  end loop;
  return jsonb_build_object('keys', to_jsonb(keys), 'pages', to_jsonb(pages));
end $$;
create function t.pages_full(p_pages jsonb, p_lim int) returns boolean language sql immutable as $$
  -- mọi trang trừ trang cuối phải đủ p_lim
  select coalesce(bool_and(v::int = p_lim) filter (where ord < jsonb_array_length(p_pages)), true)
    from jsonb_array_elements_text(p_pages) with ordinality x(v, ord) $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── 7. Band chat: lọc tin của người chặn / bị chặn, không phá phòng, phân trang đủ trang ──
do $$
declare bnd uuid := '11111111-0000-4000-8000-0000000000a1'; i int; u text; page bigint[]; allv bigint[]; cur bigint; expn int; pg int[]; ok boolean; nm int;
begin
  perform t.reset();
  insert into public.teamlab_band_members (band_id, user_id) values (bnd, t.u('C'));
  select count(*) into nm from public.teamlab_band_members;
  for i in 1..40 loop
    u := (array['A', 'B', 'C'])[i % 3 + 1];
    perform t.as_user(u);
    perform public.bandchat_send(bnd, 'BAND-' || i);
  end loop;
  perform t.as_user('A');
  perform public.class_block_user(t.u('B'));
  perform t.ok((select count(*) from public.bandchat_messages(bnd, null, null, 100)) = 41, '7 hàm GỐC bandchat_messages vẫn trả đủ 41 tin cho A');
  expn := t.sql1(format('select count(*) from public.bandchat_messages where band_id = %L and sender_id <> %L', bnd, t.u('B')))::int;

  -- lùi (mới nhất trước), limit 7
  allv := '{}'; cur := null; pg := '{}';
  loop
    select array_agg(m.seq order by m.seq) into page from public.bandchat_messages_safe(bnd, null, cur, 7) m;
    exit when page is null;
    pg := pg || cardinality(page); allv := page || allv; cur := page[1];
  end loop;
  perform t.ok(cardinality(allv) = expn and (select count(distinct x) from unnest(allv) x) = expn, '7 A: phân trang LÙI gom đủ ' || expn || ' tin của người không bị chặn, không trùng');
  perform t.ok((select bool_and(p = 7) from unnest(pg[1:cardinality(pg) - 1]) p) is not false, '7 A: mọi trang (trừ cuối) đủ 7 tin dù có tin bị lọc');
  perform t.ok(t.sql1(format('select count(*) from public.bandchat_messages where band_id = %L and sender_id = %L and seq = any(%L::bigint[])', bnd, t.u('B'), allv::text)) = '0', '7 A: không tin nào của B lọt qua');
  perform t.ok(allv = (select array_agg(s.x order by s.x) from unnest(allv) as s(x)), '7 A: thứ tự tăng dần');
  -- tiến (p_after_seq)
  allv := '{}'; cur := 0;
  loop
    select array_agg(m.seq order by m.seq) into page from public.bandchat_messages_safe(bnd, cur, null, 7) m;
    exit when page is null;
    allv := allv || page; cur := page[cardinality(page)];
  end loop;
  perform t.ok(cardinality(allv) = expn and (select count(distinct x) from unnest(allv) x) = expn, '7 A: phân trang TIẾN gom đủ ' || expn || ' tin');
  -- B (bị chặn) cũng không thấy tin của A
  perform t.as_user('B');
  expn := t.sql1(format('select count(*) from public.bandchat_messages where band_id = %L and sender_id <> %L', bnd, t.u('A')))::int;
  select array_agg(m.seq) into allv from public.bandchat_messages_safe(bnd, null, null, 100) m;
  perform t.ok(cardinality(allv) = expn and t.sql1(format('select count(*) from public.bandchat_messages where band_id = %L and sender_id = %L and seq = any(%L::bigint[])', bnd, t.u('A'), allv::text)) = '0', '7 B (bị chặn): không thấy tin của A (hai chiều)');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.bandchat_messages_safe(bnd, null, null, 100)) = 41, '7 C (không liên quan): thấy đủ 41 tin');
  -- không phá phòng
  perform t.as_user('B');
  perform t.ok(public.bandchat_send(bnd, 'B vẫn nhắn trong Band') > 0, '7 B vẫn GỬI được trong phòng Band (chặn không phá phòng)');
  perform t.reset();
  perform t.ok((select count(*) from public.teamlab_band_members) = nm, '7 thành viên Band không đổi');
  perform t.as_user('A');
  perform t.fails_with('select * from public.bandchat_messages_safe(''eeeeeeee-0000-4000-8000-00000000eeee'')', 'Không tìm thấy', '7 Band không có quyền: lỗi như bản gốc');
end $$;

-- ── 8. Feed: class_feed_safe lọc hai chiều + đủ trang; bình luận ──
do $$
declare i int; a jsonb; r jsonb; pc uuid; bodies text[];
begin
  perform t.reset();
  for i in 1..12 loop perform t.mkpost('B', 'FEED-B1-' || i, 100 + i); end loop;
  for i in 1..9 loop perform t.mkpost((array['A', 'C', 'D'])[i % 3 + 1], 'FEED-X-' || i, 120 + i); end loop;
  for i in 1..12 loop perform t.mkpost('B', 'FEED-B2-' || i, 140 + i); end loop;
  for i in 1..5 loop perform t.mkpost('C', 'FEED-C-' || i, 160 + i); end loop;

  perform t.as_user('A');
  a := t.feed_all('class_feed_safe', 5, null);
  r := t.feed_all('class_feed', 5, t.u('B'));
  perform t.ok(a -> 'ids' = r -> 'ids', '8 A (chặn B): class_feed_safe = class_feed bỏ bài của B, cùng thứ tự (' || jsonb_array_length(a -> 'ids') || ' bài)');
  perform t.ok(t.pages_full(a -> 'pages', 5), '8 A: mọi trang (trừ cuối) đủ 5 bài dù có cả chuỗi 12 bài bị lọc liền nhau');
  perform t.ok((select count(*) from public.class_feed_safe(null, null, 50) f where f.author_user_id = t.u('B')) = 0, '8 A: không còn bài của B');
  perform t.ok((select count(*) from public.class_feed(null, null, 50) f where f.author_user_id = t.u('B')) > 0, '8 hàm GỐC class_feed vẫn trả bài của B (chưa bị sửa)');
  perform t.ok((select count(*) from public.class_feed_safe(null, null, 5)) = 5, '8 A: trang đầu đủ 5');
  perform t.ok((select count(distinct id) from public.class_feed_safe(null, null, 50)) = (select count(*) from public.class_feed_safe(null, null, 50)), '8 không trùng bài trong một trang');
  perform t.ok((select count(*) from public.class_feed_safe(null, null, 1000)) <= 50, '8 giới hạn tối đa 50 giữ nguyên');

  perform t.as_user('B');
  a := t.feed_all('class_feed_safe', 5, null);
  r := t.feed_all('class_feed', 5, t.u('A'));
  perform t.ok(a -> 'ids' = r -> 'ids', '8 B (bị chặn): class_feed_safe bỏ bài của A (hai chiều)');
  perform t.as_user('C');
  a := t.feed_all('class_feed_safe', 5, null);
  r := t.feed_all('class_feed', 5, null);
  perform t.ok(a -> 'ids' = r -> 'ids', '8 C (không liên quan): class_feed_safe = class_feed');

  -- bình luận
  perform t.reset();
  pc := t.mkpost('C', 'Bài có bình luận', 0);
  perform t.mkcomment(pc, 'D', 'cm-1'); perform t.mkcomment(pc, 'C', 'cm-2'); perform t.mkcomment(pc, 'D', 'cm-3');
  perform t.mkcomment(pc, 'B', 'cm-4'); perform t.mkcomment(pc, 'B', 'cm-5'); perform t.mkcomment(pc, 'B', 'cm-6'); perform t.mkcomment(pc, 'A', 'cm-7');
  perform t.set('pc', pc::text);
  perform t.as_user('A');
  select array_agg(c.body order by c.created_at) into bodies from public.class_comments_for_posts(array[pc], 3) c;
  perform t.ok(bodies = array['cm-5', 'cm-6', 'cm-7'], '8 hàm GỐC lấy 3 bình luận mới nhất (có của B): ' || array_to_string(bodies, ','));
  select array_agg(c.body order by c.created_at) into bodies from public.class_comments_for_posts_safe(array[pc], 3) c;
  perform t.ok(bodies = array['cm-2', 'cm-3', 'cm-7'], '8 A (chặn B): *_safe lấy đủ 3 bình luận không của B (cm-2,cm-3,cm-7) nhờ lặp: ' || array_to_string(bodies, ','));
  perform t.as_user('B');
  select array_agg(c.body order by c.created_at) into bodies from public.class_comments_for_posts_safe(array[pc], 3) c;
  perform t.ok(bodies = array['cm-4', 'cm-5', 'cm-6'], '8 B (bị chặn): không thấy bình luận của A (hai chiều): ' || array_to_string(bodies, ','));
  perform t.as_user('C');
  select array_agg(c.body order by c.created_at) into bodies from public.class_comments_for_posts_safe(array[pc], 3) c;
  perform t.ok(bodies = array['cm-5', 'cm-6', 'cm-7'], '8 C: không lọc gì');
  perform t.ok((select count(*) from public.class_comments_for_posts_safe(array[pc], 200)) = 7 - 0, '8 C: p_per_post lớn lấy đủ 7');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.class_comments_for_posts_safe(array[pc], 200)) = 4, '8 A: lấy hết thì còn 4 bình luận (bỏ 3 của B)');
end $$;

-- ── 8b. Feed /me: social_feed_safe, social_feed_scoped_safe ──
do $$
declare a jsonb; r jsonb; tb uuid := '77777777-0000-4000-8000-0000000000b1'; n_raw int; n_safe int;
begin
  perform t.reset();
  -- thread community của B (hiện trong feed /me) và của C
  insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, last_event_at)
    values (tb, t.u('B'), 'L:00000000-0000-4000-8000-0000000000b1', '{}', 'community', now() - interval '1 minute'),
           ('77777777-0000-4000-8000-0000000000c1', t.u('C'), 'L:00000000-0000-4000-8000-0000000000c1', '{}', 'community', now() - interval '2 minutes');
  perform t.as_user('A');
  perform t.ok(exists (select 1 from public.social_feed(null, null, 50) f where f.kind = 'learning_thread' and f.thread -> 'learner' ->> 'user_id' = t.u('B')::text), '8b hàm GỐC social_feed vẫn có thread của B');
  perform t.ok(not exists (select 1 from public.social_feed_safe(null, null, 50) f where f.kind = 'learning_thread' and f.thread -> 'learner' ->> 'user_id' = t.u('B')::text), '8b A (chặn B): social_feed_safe bỏ thread của B');
  perform t.ok(exists (select 1 from public.social_feed_safe(null, null, 50) f where f.kind = 'learning_thread' and f.thread -> 'learner' ->> 'user_id' = t.u('C')::text), '8b thread của C vẫn có');
  a := t.sfeed_all('social_feed_safe', null, 5, null);
  r := t.sfeed_all('social_feed', null, 5, t.u('B'));
  perform t.ok(a -> 'keys' = r -> 'keys' and jsonb_array_length(a -> 'keys') > 20, '8b A: social_feed_safe = social_feed bỏ bài+thread của B, cùng thứ tự (' || jsonb_array_length(a -> 'keys') || ' mục)');
  perform t.ok(t.pages_full(a -> 'pages', 5), '8b A: mọi trang (trừ cuối) đủ 5 mục');
  a := t.sfeed_all('social_feed_scoped_safe', 'for_you', 5, null);
  r := t.sfeed_all('social_feed_scoped', 'for_you', 5, t.u('B'));
  perform t.ok(a -> 'keys' = r -> 'keys', '8b social_feed_scoped_safe(for_you) lọc đúng');
  perform t.fails_with($q$select * from public.social_feed_scoped_safe('bogus')$q$, 'SF_BAD_SCOPE', '8b scope sai: lỗi như bản gốc');
  perform t.as_user('B');
  a := t.sfeed_all('social_feed_safe', null, 5, null);
  r := t.sfeed_all('social_feed', null, 5, t.u('A'));
  perform t.ok(a -> 'keys' = r -> 'keys', '8b B (bị chặn): social_feed_safe bỏ bài/thread của A (hai chiều)');
  perform t.as_user('C');
  a := t.sfeed_all('social_feed_safe', null, 5, null);
  r := t.sfeed_all('social_feed', null, 5, null);
  perform t.ok(a -> 'keys' = r -> 'keys', '8b C: không lọc');

  -- scope 'friends': A là bạn của D (dữ liệu dựng thẳng + chặn dựng thẳng để kiểm đường lọc của scope)
  perform t.reset();
  perform t.friends('A', 'D', 'accepted');
  insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('A'), t.u('D'));
  perform t.as_user('A');
  select count(*) into n_raw from public.social_feed_scoped('friends', null, null, 50) f where f.post ->> 'author_user_id' = t.u('D')::text;
  select count(*) into n_safe from public.social_feed_scoped_safe('friends', null, null, 50) f where f.post ->> 'author_user_id' = t.u('D')::text;
  perform t.ok(n_raw > 0 and n_safe = 0, '8b scope friends: gốc có ' || n_raw || ' bài của D, bản safe có ' || n_safe);
  a := t.sfeed_all('social_feed_scoped_safe', 'friends', 5, null);
  r := t.sfeed_all('social_feed_scoped', 'friends', 5, t.u('D'));
  perform t.ok(a -> 'keys' = r -> 'keys', '8b scope friends: safe = gốc bỏ D, đủ trang');
  perform t.reset();
  delete from public.class_user_blocks where blocker_id = t.u('A') and blocked_id = t.u('D');
end $$;

-- ── 9. Bộ lọc từ cấm ──
do $$
declare s text; neg text[] := array['Chặng 1', 'Hôm nay mình tập chuyển hợp âm Dm sang Am', 'Scunthorpe', 'Em của ngày hôm qua', 'Đĩa nhạc mới', 'buổi tập tối nay',
   'học đủ rồi', 'đụn cát ven biển', 'lồng tiếng phim', 'cặp đôi hoàn hảo', 'Cô Đơn Trên Sofa', 'địa chỉ lớp học', 'classic guitar', 'Dm7 - G7 - Cmaj7', 'Chặng 2: Am, Dm, E',
   'Ngày mai em đi, hoa lá bay', 'buổi sáng', 'passion and assessment', 'Cassandra'];
  pos text[] := array['địt mẹ mày', 'ĐỊT', 'what the FUCK', 'đồ   chó', 'dit me', 'Kill   yourself!', 'em là con đĩ', 'vcl quá', 'Dmm nhé', 'thằng chó'];
begin
  perform t.reset();
  foreach s in array neg loop
    perform t.ok(t.sql1(format('select public.class_ugc_text_blocked(%L)', s)) = 'false', '9 KHÔNG chặn nhầm: "' || s || '"');
  end loop;
  foreach s in array pos loop
    perform t.ok(t.sql1(format('select public.class_ugc_text_blocked(%L)', s)) = 'true', '9 chặn đúng: "' || s || '"');
  end loop;
  perform t.ok(t.sql1($q$select public.class_ugc_text_blocked(null)$q$) = 'false' and t.sql1($q$select public.class_ugc_text_blocked('')$q$) = 'false', '9 null/rỗng không chặn');
end $$;

do $$
declare pz uuid; bad text := 'địt mẹ';
begin
  perform t.reset();
  -- bài của A (A chặn B nhưng A–B không liên quan tới từ cấm); dm cần bạn bè → dựng lại A–B bạn bè sau bỏ chặn
  perform t.as_user('A'); perform public.class_unblock_user(t.u('B'));
  perform t.reset(); perform t.friends('A', 'B', 'accepted');
  perform t.as_user('A');
  perform t.fails_with(format($q$insert into public.class_posts (type, body, media_type, media_provider, media_url) values ('assignment', %L, 'external_video', 'youtube', 'https://youtu.be/abc')$q$, 'xin ' || bad),
                       'ugc_blocked', '9 bài đăng chứa từ cấm: ugc_blocked');
  perform t.ok(t.err(format($q$insert into public.class_posts (type, body, media_type, media_provider, media_url) values ('assignment', %L, 'external_video', 'youtube', 'https://youtu.be/abc')$q$, 'Chặng 1 - tập Dm')) = 'OK', '9 bài đăng bình thường ("Chặng 1 - tập Dm") không bị chặn');
  perform t.fails_with(format($q$insert into public.class_post_comments (post_id, body) values (%L, 'đồ chó')$q$, t.get('pc')), 'ugc_blocked', '9 bình luận chứa từ cấm: ugc_blocked');
  perform t.ok(t.err(format($q$insert into public.class_post_comments (post_id, body) values (%L, 'Hay quá, lời ca đẹp')$q$, t.get('pc'))) = 'OK', '9 bình luận bình thường được');
  perform t.fails_with(format($q$select public.dm_send(%L, 'fuck you')$q$, t.get('conv')), 'ugc_blocked', '9 DM chứa từ cấm: ugc_blocked');
  perform t.ok(t.err(format($q$select public.dm_send(%L, 'Chặng 1 xong rồi')$q$, t.get('conv'))) = 'OK', '9 DM bình thường được');
  perform t.fails_with($q$select public.bandchat_send('11111111-0000-4000-8000-0000000000a1', 'cút đi đồ chó')$q$, 'ugc_blocked', '9 tin Band chứa từ cấm: ugc_blocked');
  perform t.ok(t.err($q$select public.bandchat_send('11111111-0000-4000-8000-0000000000a1', 'Tập bài Dm lúc 8h')$q$) = 'OK', '9 tin Band bình thường được');
  perform t.reset();
  perform t.fails_with(format($q$insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body) values ('77777777-0000-4000-8000-000000000001', %L, 'student', 'question', 'đụ má')$q$, t.u('A')::text),
                       'ugc_blocked', '9 lượt thread chứa từ cấm: ugc_blocked');
  perform t.ok(t.err(format($q$insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body) values ('77777777-0000-4000-8000-000000000001', %L, 'student', 'question', 'Cho em hỏi Chặng 1')$q$, t.u('A')::text)) = 'OK', '9 lượt thread bình thường được');
  perform t.ok(t.err(format($q$insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body) values ('77777777-0000-4000-8000-000000000001', %L, 'teacher', 'teacher_answer', 'fuck nhầm lẫn của Thầy')$q$, t.u('T')::text)) = 'OK', '9 Thầy/Admin không bị bộ lọc (tránh chặn nhầm lời giải thích)');

  -- sửa nội dung
  pz := t.mkpost('A', 'bài trước khi có luật zorp', 5);
  perform t.as_user('A');
  perform t.fails_with(format($q$update public.class_posts set body = 'giờ sửa thành địt' where id = %L$q$, pz), 'ugc_blocked', '9 SỬA bài thành nội dung cấm cũng bị chặn');
  perform t.ok(t.err(format($q$update public.class_posts set body = 'sửa lại cho lịch sự' where id = %L$q$, pz)) = 'OK', '9 sửa bài bình thường được');
  -- luật mới thêm sau không chặn thao tác không đổi nội dung
  perform t.reset();
  insert into public.class_ugc_blocklist (pattern, kind, note) values ('zorp', 'word', 'test');
  perform t.as_user('A');
  perform t.ok(t.err(format($q$update public.class_posts set media_url = 'https://youtu.be/new1' where id = %L$q$, pz)) = 'OK', '9 sửa cột khác (không đổi body) KHÔNG bị chặn bởi luật mới');
  perform t.fails_with(format($q$insert into public.class_post_comments (post_id, body) values (%L, 'Zorp!')$q$, t.get('pc')), 'ugc_blocked', '9 từ Thầy thêm vào blocklist có hiệu lực ngay (không phân biệt hoa/thường)');
  perform t.reset();
  update public.class_ugc_blocklist set active = false where pattern = 'zorp';
  perform t.as_user('A');
  perform t.ok(t.err(format($q$insert into public.class_post_comments (post_id, body) values (%L, 'Zorp!')$q$, t.get('pc'))) = 'OK', '9 tắt active → hết chặn');
  perform t.reset();
  perform t.ok(t.sql1('select count(*) from public.class_ugc_blocklist') ::int >= 41, '9 seed blocklist >= 41 dòng');
  perform t.as_user('T');
  perform t.ok(t.err(format($q$select public.class_moderate('post', %L, true)$q$, pz)) = 'OK', '9 Thầy ẩn bài vẫn chạy bình thường (không bị trigger)');
end $$;

-- ── 10. Đồng ý quy tắc cộng đồng ──
do $$
declare n int; av int; rv int;
begin
  perform t.as_user('A');
  select count(*), max(accepted_version), max(required_version) into n, av, rv from public.class_ugc_status();
  perform t.ok(n = 1 and av is null and rv = 1, '10 chưa đồng ý: ĐÚNG MỘT hàng, accepted_version NULL, required 1');
  perform t.fails($q$select public.class_ugc_accept(0)$q$, '10 version 0 bị từ chối');
  perform t.fails($q$select public.class_ugc_accept(2)$q$, '10 version cao hơn hiện hành bị từ chối');
  perform t.fails($q$select public.class_ugc_accept(null)$q$, '10 version null bị từ chối');
  perform public.class_ugc_accept(1); perform public.class_ugc_accept(1);
  select count(*), max(accepted_version), max(required_version) into n, av, rv from public.class_ugc_status();
  perform t.ok(n = 1 and av = 1 and rv = 1, '10 đồng ý (idempotent): 1/1');
  perform t.as_user('B');
  select accepted_version into av from public.class_ugc_status();
  perform t.ok(av is null, '10 đồng ý của A không ảnh hưởng B');
  perform t.as_user('N');
  perform t.fails($q$select public.class_ugc_accept(1)$q$, '10 người ngoài Class không ghi đồng ý');
  perform t.as_anon();
  perform t.fails($q$select * from public.class_ugc_status()$q$, '10 anon không gọi class_ugc_status');
  perform t.reset();
  perform t.ok(t.sql1('select count(*) from public.class_ugc_consent') = '1', '10 chỉ 1 hàng consent trong bảng');
end $$;

-- ── 11. Đình chỉ (hide_and_block) → account_suspended, không phá quyền học ──
do $$
declare pd uuid; rid bigint; n_stud int;
begin
  perform t.reset();
  pd := t.mkpost('D', 'Bài của D bị báo cáo', 0);
  perform t.friends('C', 'D', 'accepted');
  insert into public.teamlab_band_members (band_id, user_id) values ('11111111-0000-4000-8000-0000000000a1', t.u('D'));
  select count(*) into n_stud from public.edu_students where user_id = t.u('D');
  perform t.as_user('C');
  rid := public.class_report_submit('post', pd::text, 'harassment', 'quấy rối');
  perform t.as_user('T');
  perform public.class_report_resolve(rid, 'hide_and_block', 'tái phạm');
  perform t.reset();
  perform t.ok((select blocked_at is not null and blocked_reason like 'class_ugc_safety:%' from public.edu_students where user_id = t.u('D')), '11 hide_and_block: edu_students.blocked_at + lý do');
  perform t.ok((select hidden_at is not null from public.class_posts where id = pd), '11 hide_and_block: bài bị ẩn');
  perform t.ok(t.rep(rid) ->> 'status' = 'handled' and t.rep(rid) ->> 'handled_action' = 'hide_and_block', '11 báo cáo ghi nhận hide_and_block');

  perform t.as_user('D');
  perform t.fails_with($q$insert into public.class_posts (type, body, media_type, media_provider, media_url) values ('assignment', 'bài mới', 'external_video', 'youtube', 'https://youtu.be/abc')$q$, 'account_suspended', '11 D bị đình chỉ: không đăng bài');
  perform t.fails_with(format($q$insert into public.class_post_comments (post_id, body) values (%L, 'bình luận')$q$, t.get('pc')), 'account_suspended', '11 D bị đình chỉ: không bình luận');
  perform t.fails_with($q$select * from public.dm_start(t.u('C'), 'chào')$q$, 'account_suspended', '11 D bị đình chỉ: không nhắn DM');
  perform t.fails_with($q$select public.bandchat_send('11111111-0000-4000-8000-0000000000a1', 'chào cả nhà')$q$, 'account_suspended', '11 D bị đình chỉ: không nhắn Band');
  perform t.fails_with($q$select public.send_friend_request(t.u('B'))$q$, 'account_suspended', '11 D bị đình chỉ: không gửi lời mời kết bạn');
  perform t.reset();
  perform t.fails_with(format($q$insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body) values ('77777777-0000-4000-8000-000000000001', %L, 'student', 'question', 'hỏi')$q$, t.u('D')::text),
                       'account_suspended', '11 D bị đình chỉ: không hỏi/nộp thread');
  -- quyền học / thành viên giữ nguyên
  perform t.as_user('D');
  perform t.ok(public.is_class_member(), '11 D vẫn là thành viên Class (không mất quyền học)');
  perform t.ok((select count(*) from public.class_feed(null, null, 5)) = 5, '11 D vẫn ĐỌC được feed');
  perform t.reset();
  perform t.ok((select count(*) from public.edu_students where user_id = t.u('D')) = n_stud, '11 hồ sơ học viên của D còn nguyên');
  perform t.ok((select count(*) from public.teamlab_band_members where user_id = t.u('D')) = 1, '11 D vẫn là thành viên Band');
  -- không tự gỡ
  perform t.as_user('D');
  perform t.ok(t.err(format($q$update public.edu_students set blocked_at = null, blocked_reason = null where user_id = %L$q$, t.u('D')::text)) = 'OK', '11 D thử UPDATE blocked_at = null (không lỗi nhưng vô hiệu)');
  perform t.reset();
  perform t.ok((select blocked_at is not null from public.edu_students where user_id = t.u('D')), '11 blocked_at VẪN còn: học viên không tự gỡ đình chỉ');
  perform t.as_user('D');
  perform t.ok(t.err(format($q$update public.edu_students set display_name = 'Dũng đổi tên' where user_id = %L$q$, t.u('D')::text)) = 'OK', '11 D vẫn sửa được hồ sơ của mình (cột khác)');
  -- Thầy gỡ
  perform t.as_user('T');
  perform t.ok(t.err(format($q$update public.edu_students set blocked_at = null, blocked_reason = null where user_id = %L$q$, t.u('D')::text)) = 'OK', '11 Thầy UPDATE blocked_at = null');
  perform t.reset();
  perform t.ok((select blocked_at is null from public.edu_students where user_id = t.u('D')), '11 Thầy gỡ đình chỉ được');
  perform t.as_user('D');
  perform t.ok(t.err($q$insert into public.class_posts (type, body, media_type, media_provider, media_url) values ('assignment', 'bài sau khi được gỡ', 'external_video', 'youtube', 'https://youtu.be/abc')$q$) = 'OK', '11 sau khi gỡ D đăng lại được');
end $$;

select t.reset();
do $$ begin
  perform t.ok((select count(*) from pg_policies where schemaname = 'public' and tablename in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')) = 0, '12 vẫn 0 policy trên 4 bảng UGC');
end $$;
\echo ALL UGC SAFETY V1 TESTS DONE
rollback;
