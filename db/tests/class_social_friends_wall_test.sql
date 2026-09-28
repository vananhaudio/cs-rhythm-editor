-- ═══ TEST Bạn bè + Tường (db/class_social_friends_wall_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-friends-wall-db.sh (tạo user A/B/C/T/N,
-- ghi bài, kết bạn). Có chốt chặn: dừng ngay nếu thấy dữ liệu không phải @test.local.
-- Mỗi identity chạy dưới ĐÚNG role (authenticated/anon) + JWT sub → RLS/GRANT được kiểm thật.
\set ON_ERROR_STOP on

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
end $$;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
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
-- Câu lệnh PHẢI bị từ chối (lỗi quyền / ràng buộc / RPC raise)
create function t.fails(q text, msg text) returns void language plpgsql as $$ begin
  begin
    execute q;
  exception when others then
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % — câu lệnh lẽ ra phải bị chặn: %', msg, q;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Dữ liệu: mỗi người một Trả bài (class) + một bài tường (friends); Thầy nhận xét bài tường của A ──
do $$
declare v_a_status uuid; v_c uuid;
begin
  perform t.as_user('A');
  insert into public.class_posts (type, body, media_type, media_provider, media_url)
    values ('assignment', 'Trả bài của A', 'external_video', 'youtube', 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
  insert into public.class_posts (type, audience, body) values ('status', 'friends', 'Tường A: chỉ bạn bè');
  perform t.as_user('B');
  insert into public.class_posts (type, body, media_type, media_provider, media_url)
    values ('assignment', 'Trả bài của B', 'external_video', 'youtube', 'https://www.youtube.com/watch?v=bbbbbbbbbbb');
  insert into public.class_posts (type, audience, body) values ('status', 'friends', 'Tường B: chỉ bạn bè');
  perform t.as_user('C');
  insert into public.class_posts (type, audience, body) values ('status', 'friends', 'Tường C');
  perform t.as_user('A');
  select id into v_a_status from public.class_posts where body = 'Tường A: chỉ bạn bè';
  perform public.class_add_comment(v_a_status, 'A tự bình luận bài tường');
  perform t.as_user('T');
  insert into public.class_tags (name) values ('Nhịp');
  v_c := public.class_add_comment(v_a_status, 'Thầy nhận xét bài tường của A',
           array[(select id from public.class_tags where name = 'Nhịp')],
           '[{"resource_type":"kho_video","resource_id":"abcdefghijk","title_snapshot":"Bài giảng nhịp"}]'::jsonb);
  perform t.reset();
  perform t.ok((select count(*) from public.class_posts) = 5, 'dữ liệu: 5 bài được tạo đúng policy INSERT');
  perform t.ok((select count(*) from public.class_comment_tags) = 1 and (select count(*) from public.class_comment_resources) = 1,
               'dữ liệu: Thầy gắn tag + đính kèm vào nhận xét');
end $$;

-- ── Luật bài đăng (không cần bạn bè) ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$insert into public.class_posts (type, audience, body) values ('status', 'class', 'x')$q$,
                  'bài tường không thể đăng công khai cho cả Class');
  perform t.fails($q$insert into public.class_posts (type, audience, body, media_type, media_provider, media_url)
                    values ('assignment', 'friends', 'x', 'external_video', 'youtube', 'https://youtu.be/aaaaaaaaaaa')$q$,
                  'Trả bài không thể giấu khỏi Class/Thầy');
  perform t.fails($q$insert into public.class_posts (type, audience, body) values ('status', 'friends', '   ')$q$,
                  'bài tường rỗng bị từ chối');
  perform t.fails($q$insert into public.class_posts (type, audience, body, author_user_id)
                    values ('status', 'friends', 'giả danh', 'bbbbbbbb-0000-4000-8000-00000000000b')$q$,
                  'không đăng thay người khác');
  update public.class_posts set audience = 'class', type = 'assignment', body = 'Tường A: đã sửa'
   where body = 'Tường A: chỉ bạn bè';
  perform t.reset();
  perform t.ok((select audience = 'friends' and type = 'status' from public.class_posts where body = 'Tường A: đã sửa'),
               'sửa bài: nội dung đổi được, loại + quyền xem KHÔNG đổi được');
  update public.class_posts set body = 'Tường A: chỉ bạn bè' where body = 'Tường A: đã sửa';
end $$;

-- ── T11 / T12 / thành viên ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select public.send_friend_request('aaaaaaaa-0000-4000-8000-00000000000a')$q$,
                  'T11 không gửi lời mời cho chính mình');
  perform t.fails($q$select public.send_friend_request('eeeeeeee-0000-4000-8000-00000000000e')$q$,
                  'không gửi lời mời cho tài khoản ngoài Class');
  perform t.as_user('N');
  perform t.fails($q$select public.send_friend_request('aaaaaaaa-0000-4000-8000-00000000000a')$q$,
                  'tài khoản ngoài Class không gửi được lời mời');
  perform t.ok((select count(*) from public.get_user_profile(t.u('A'))) = 0, 'tài khoản ngoài Class không xem được hồ sơ');
  perform t.reset();
end $$;

-- ── T1 A gửi lời mời cho B ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(public.send_friend_request(t.u('B')) = 'outgoing', 'T1 A gửi lời mời cho B');
  perform t.ok(public.send_friend_request(t.u('B')) = 'outgoing', 'T12 gửi lại không tạo lời mời thứ hai');
  perform t.ok(public.friendship_status(t.u('B')) = 'outgoing', 'T1 A thấy trạng thái "Đã gửi lời mời"');
  perform t.reset();
  perform t.ok((select count(*) from public.friendships) = 1, 'T12 chỉ một hàng cho cặp A–B');
  perform t.fails($q$insert into public.friendships (requester_id, addressee_id, status)
                    values ('bbbbbbbb-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-00000000000a', 'pending')$q$,
                  'T12 DB chặn cặp trùng theo chiều ngược lại (unique index)');
end $$;

-- ── T2 B thấy lời mời · T3 pending KHÔNG phải bạn ──
do $$
declare v_b_status uuid; v_a_status uuid;
begin
  perform t.reset();
  select id into v_a_status from public.class_posts where body = 'Tường A: chỉ bạn bè';
  select id into v_b_status from public.class_posts where body = 'Tường B: chỉ bạn bè';

  perform t.as_user('B');
  perform t.ok((select count(*) from public.incoming_friend_requests() where user_id = t.u('A')) = 1, 'T2 B thấy lời mời của A');
  perform t.ok(public.friendship_status(t.u('A')) = 'incoming', 'T2 B thấy trạng thái "Chấp nhận / Từ chối"');
  perform t.ok((select count(*) from public.get_user_wall(t.u('A'))) = 0, 'T3 pending: B không xem được tường A (RPC)');
  perform t.ok((select count(*) from public.class_posts where id = v_a_status) = 0, 'T3 pending: B không đọc thẳng được bài tường A (bảng)');
  perform t.ok((select count(*) from public.class_comments_for_posts(array[v_a_status], 50)) = 0, 'T3 pending: B không đọc được bình luận bài tường A (RPC)');
  perform t.ok((select count(*) from public.class_post_comments where post_id = v_a_status) = 0, 'T3 pending: B không đọc thẳng được bình luận bài tường A');
  perform t.ok((select count(*) from public.class_comment_tags) = 0 and (select count(*) from public.class_comment_resources) = 0,
               'T3 pending: B không đọc được tag/đính kèm của nhận xét trên bài tường A');
  perform t.ok(not public.class_post_visible(v_a_status), 'T3 pending: class_post_visible = false');
  perform t.fails(format($q$select public.class_add_comment(%L, 'chen vao')$q$, v_a_status), 'T3 pending: B không bình luận được bài tường A');
  perform t.ok((select can_view_wall from public.get_user_profile(t.u('A'))) = false, 'T3 pending: hồ sơ A báo can_view_wall=false cho B');

  perform t.as_user('A');
  perform t.ok((select count(*) from public.get_user_wall(t.u('B'))) = 0, 'T3 pending: A không xem được tường B (RPC)');
  perform t.ok((select count(*) from public.class_posts where id = v_b_status) = 0, 'T3 pending: A không đọc thẳng được bài tường B');
  perform t.ok(not public.is_friend_of(t.u('B')), 'T3 pending KHÔNG được coi là bạn');
  perform t.ok((select count(*) from public.my_friends()) = 0, 'T3 pending: A chưa có bạn');
  -- Trả bài vẫn là của Class: A vẫn thấy Trả bài của B trong feed Cộng đồng
  perform t.ok((select count(*) from public.class_feed() where author_user_id = t.u('B') and type = 'assignment') = 1,
               'Feed Cộng đồng vẫn có Trả bài của mọi người');
  perform t.reset();
end $$;

-- ── T4 B chấp nhận · T5 hai bên thấy nhau · T6/T7 xem tường nhau ──
do $$
declare v_a_status uuid;
begin
  perform t.reset();
  select id into v_a_status from public.class_posts where body = 'Tường A: chỉ bạn bè';
  perform t.as_user('A');
  perform t.fails($q$select public.respond_friend_request('bbbbbbbb-0000-4000-8000-00000000000b', true)$q$,
                  'người gửi không tự chấp nhận lời mời của chính mình');
  perform t.as_user('B');
  perform t.ok(public.respond_friend_request(t.u('A'), true) = 'friends', 'T4 B chấp nhận lời mời');
  perform t.ok((select count(*) from public.my_friends() where user_id = t.u('A')) = 1, 'T5 B thấy A trong Bạn bè');
  perform t.ok((select count(*) from public.incoming_friend_requests()) = 0, 'T5 lời mời đã xử lý biến mất');
  perform t.ok((select count(*) from public.get_user_wall(t.u('A')) where type = 'status') = 1
               and (select count(*) from public.get_user_wall(t.u('A')) where type = 'assignment') = 1,
               'T7 B xem được tường A (bài tường + Trả bài)');
  perform t.ok((select count(*) from public.class_comments_for_posts(array[v_a_status], 50)) = 2, 'T7 B đọc được bình luận trên tường A');
  perform t.ok((select count(*) from public.class_comment_tags) = 1, 'T7 B đọc được tag nhận xét của Thầy trên tường A');
  perform public.class_add_comment(v_a_status, 'B bình luận tường A');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.my_friends() where user_id = t.u('B')) = 1, 'T5 A thấy B trong Bạn bè');
  perform t.ok(public.friendship_status(t.u('B')) = 'friends' and public.is_friend_of(t.u('B')), 'T5 trạng thái "Bạn bè"');
  perform t.ok((select count(*) from public.get_user_wall(t.u('B')) where type = 'status') = 1, 'T6 A xem được tường B');
  perform t.ok((select count(*) from public.class_posts where author_user_id = t.u('B') and audience = 'friends') = 1,
               'T6 A đọc được bài tường B qua bảng (RLS)');
  -- Bài tường KHÔNG vào feed Cộng đồng, kể cả với bạn bè
  perform t.ok((select count(*) from public.class_feed() where type = 'status') = 0, 'Feed Cộng đồng không chứa bài tường');
  perform t.reset();
end $$;

-- ── T8 C không phải bạn ──
do $$
declare v_a_status uuid; v_b_status uuid;
begin
  perform t.reset();
  select id into v_a_status from public.class_posts where body = 'Tường A: chỉ bạn bè';
  select id into v_b_status from public.class_posts where body = 'Tường B: chỉ bạn bè';
  perform t.as_user('C');
  perform t.ok((select count(*) from public.get_user_wall(t.u('A'))) = 0 and (select count(*) from public.get_user_wall(t.u('B'))) = 0,
               'T8 C không lấy được tường A/B (RPC)');
  perform t.ok((select count(*) from public.class_posts where audience = 'friends' and author_user_id <> t.u('C')) = 0,
               'T8 C không đọc thẳng được bài tường nào của người khác (bảng)');
  perform t.ok((select count(*) from public.class_comments_for_posts(array[v_a_status, v_b_status], 200)) = 0,
               'T8 C không đọc được bình luận trên tường A/B');
  perform t.ok((select count(*) from public.class_post_comments) = 0, 'T8 C không đọc thẳng được bình luận nào trên tường người khác');
  perform t.ok((select count(*) from public.class_comment_tags) = 0 and (select count(*) from public.class_comment_resources) = 0,
               'T8 C không đọc được tag/đính kèm trên tường người khác');
  perform t.ok((select count(*) from public.get_user_wall(t.u('C'))) = 1, 'Chính chủ C luôn xem được tường mình');
  perform t.ok((select relationship = 'none' and not can_view_wall and cover_url is null from public.get_user_profile(t.u('A'))),
               'T8 C chỉ thấy hồ sơ tối thiểu của A (không xem được tường)');
  perform t.fails($q$select * from public.friendships$q$, 'C không đọc thẳng được bảng friendships');
  perform t.reset();
end $$;

-- ── Thầy/admin: xem tường để kiểm duyệt (Owner chốt) · ẩn bài ──
do $$
declare v_a_status uuid;
begin
  perform t.reset();
  select id into v_a_status from public.class_posts where body = 'Tường A: chỉ bạn bè';
  perform t.as_user('T');
  perform t.ok((select count(*) from public.get_user_wall(t.u('C'))) = 1, 'Thầy xem được tường học sinh chưa kết bạn (kiểm duyệt)');
  perform t.ok((select can_view_wall from public.get_user_profile(t.u('C'))), 'hồ sơ báo Thầy được xem tường');
  perform public.class_moderate('post', v_a_status, true);
  perform t.as_user('B');
  perform t.ok((select count(*) from public.get_user_wall(t.u('A')) where type = 'status') = 0, 'bài bị Thầy ẩn biến khỏi tường với bạn bè');
  perform t.as_user('T');
  perform public.class_moderate('post', v_a_status, false);
  perform t.reset();
end $$;

-- ── Từ chối ──
do $$ begin
  perform t.as_user('C');
  perform t.ok(public.send_friend_request(t.u('B')) = 'outgoing', 'C gửi lời mời cho B');
  perform t.as_user('B');
  perform t.ok(public.respond_friend_request(t.u('C'), false) = 'none', 'B từ chối C');
  perform t.ok(public.friendship_status(t.u('C')) = 'none', 'B (người từ chối) thấy "Kết bạn"');
  perform t.ok((select count(*) from public.get_user_wall(t.u('C'))) = 0, 'từ chối: B không xem được tường C');
  perform t.as_user('C');
  perform t.ok(public.friendship_status(t.u('B')) = 'outgoing', 'từ chối không lộ: C vẫn thấy "Đã gửi"');
  perform t.ok(public.send_friend_request(t.u('B')) = 'outgoing', 'C không gửi dồn được sau khi bị từ chối');
  perform t.ok(not public.is_friend_of(t.u('B')) and (select count(*) from public.get_user_wall(t.u('B'))) = 0, 'từ chối: không thành bạn');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.incoming_friend_requests()) = 0, 'lời mời đã từ chối không hiện lại cho B');
  perform t.reset();
  perform t.ok((select count(*) from public.friendships where status = 'declined') = 1, 'từ chối: vẫn một hàng cho cặp B–C');
end $$;

-- ── T9 A huỷ kết bạn · T10 lập tức mất quyền xem ──
do $$
declare v_a_status uuid;
begin
  perform t.reset();
  select id into v_a_status from public.class_posts where body = 'Tường A: chỉ bạn bè';
  perform t.as_user('A');
  perform t.ok(public.unfriend(t.u('B')) = 'none', 'T9 A huỷ kết bạn B');
  perform t.ok((select count(*) from public.get_user_wall(t.u('B'))) = 0, 'T10 A lập tức không xem được tường B');
  perform t.ok((select count(*) from public.my_friends()) = 0, 'T10 B biến khỏi danh sách bạn của A');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.get_user_wall(t.u('A'))) = 0, 'T10 B lập tức không xem được tường A');
  perform t.ok((select count(*) from public.class_posts where id = v_a_status) = 0, 'T10 B không đọc thẳng được bài tường A');
  perform t.ok((select count(*) from public.class_post_comments where post_id = v_a_status) = 0, 'T10 B mất quyền đọc cả bình luận của chính mình trên tường A');
  -- Rút lại lời mời
  perform t.ok(public.send_friend_request(t.u('A')) = 'outgoing', 'B gửi lời mời mới cho A');
  perform t.ok(public.unfriend(t.u('A')) = 'none', 'B rút lại lời mời');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.incoming_friend_requests()) = 0, 'lời mời đã rút không còn với A');
  -- Gửi chéo: A gửi B, B bấm "Kết bạn" với A → thành bạn, không tạo hàng thứ hai
  perform public.send_friend_request(t.u('B'));
  perform t.as_user('B');
  perform t.ok(public.send_friend_request(t.u('A')) = 'friends', 'T12 hai bên cùng gửi → thành bạn, không trùng');
  perform t.reset();
  perform t.ok((select count(*) from public.friendships
                 where least(requester_id, addressee_id) = least(t.u('A'), t.u('B'))
                   and greatest(requester_id, addressee_id) = greatest(t.u('A'), t.u('B'))) = 1,
               'T12 cặp A–B vẫn đúng một hàng');
end $$;

-- ── T13 Khách (anon) ──
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select * from public.get_user_wall('aaaaaaaa-0000-4000-8000-00000000000a')$q$, 'T13 khách không gọi được get_user_wall');
  perform t.fails($q$select * from public.get_user_profile('aaaaaaaa-0000-4000-8000-00000000000a')$q$, 'T13 khách không gọi được get_user_profile');
  perform t.fails($q$select * from public.my_friends()$q$, 'T13 khách không gọi được my_friends');
  perform t.fails($q$select public.send_friend_request('aaaaaaaa-0000-4000-8000-00000000000a')$q$, 'T13 khách không gửi được lời mời');
  perform t.fails($q$select * from public.class_posts$q$, 'T13 khách không đọc được class_posts');
  perform t.fails($q$select * from public.friendships$q$, 'T13 khách không đọc được friendships');
  perform t.fails($q$select * from public.edu_students$q$, 'T13 khách không đọc được edu_students');
  perform t.reset();
end $$;

-- ── T14 Không lộ email/SĐT ──
do $$
declare n int;
begin
  perform t.reset();
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and p.proname in ('friendship_status', 'send_friend_request', 'respond_friend_request', 'unfriend', 'my_friends',
                       'incoming_friend_requests', 'get_user_profile', 'get_user_wall', 'class_feed', 'class_comments_for_posts')
     and pg_get_function_result(p.oid) ~* '(email|phone|level|xp|package)';
  perform t.ok(n = 0, 'T14 không RPC nào của Social trả cột email/phone/level/xp/package');

  perform t.as_user('A');
  perform t.ok((select count(*) from public.edu_students) = 1, 'T14 học sinh chỉ đọc được hồ sơ edu_students của CHÍNH MÌNH');
  perform t.ok((select count(*) from public.edu_students where email = 'b@test.local' or phone = '0900000002') = 0,
               'T14 A không lấy được email/SĐT của B qua bảng');
  update public.edu_students set phone = '0000000000' where user_id = t.u('B');
  perform t.reset();
  perform t.ok((select phone from public.edu_students where user_id = t.u('B')) = '0900000002', 'A không sửa được hồ sơ của B');
  perform t.as_user('A');
  update public.edu_students set display_name = 'An mới' where user_id = t.u('A');
  perform t.ok((select display_name from public.edu_students where user_id = t.u('A')) = 'An mới', 'A vẫn tự sửa được hồ sơ của mình');
  perform t.fails($q$insert into public.edu_students (user_id, full_name) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x')$q$,
                  'học sinh không tự tạo hồ sơ edu_students');
  perform t.fails($q$truncate public.edu_students$q$, 'authenticated không TRUNCATE được edu_students');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.edu_students) = 3, 'Thầy vẫn đọc được mọi hồ sơ (màn Admin)');
  update public.edu_students set level = 'elementary' where user_id = t.u('C');
  perform t.reset();
  perform t.ok((select level from public.edu_students where user_id = t.u('C')) = 'elementary', 'Thầy vẫn sửa được hồ sơ (màn Admin)');
end $$;

do $$ begin raise notice 'ALL PASS — Bạn bè + Tường'; end $$;
