-- ═══ TEST Friends UX V2 (db/friends_ux_v2_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-friends-ux-v2-db.sh. Có chốt chặn: dừng nếu thấy user thật.
-- Mỗi identity chạy dưới ĐÚNG role (authenticated/anon) + JWT sub → GRANT/SECURITY DEFINER được kiểm thật.
-- A, B, C, D = học sinh · T = Thầy · N = tài khoản ngoài Class.
\set ON_ERROR_STOP on

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
end $$;

-- Học sinh thứ tư D (fixture chỉ có A/B/C)
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
  begin
    execute q;
  exception when others then
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % — câu lệnh lẽ ra phải bị chặn: %', msg, q;
end $$;
-- Danh sách id (theo thứ tự) mà người đang đăng nhập thấy ở từng mục trang Bạn bè
create function t.ids_out() returns text language sql as $$ select coalesce(string_agg(user_id::text, ',' order by user_id), '') from public.outgoing_friend_requests() $$;
create function t.ids_in() returns text language sql as $$ select coalesce(string_agg(user_id::text, ',' order by user_id), '') from public.incoming_friend_requests() $$;
create function t.ids_fr() returns text language sql as $$ select coalesce(string_agg(user_id::text, ',' order by user_id), '') from public.my_friends() $$;
create function t.rows() returns bigint language sql security definer as $$ select count(*) from public.friendships $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Quyền gọi + cách ly ──
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select * from public.outgoing_friend_requests()$q$, 'anon không gọi được outgoing_friend_requests');
  perform t.fails($q$select public.respond_friend_request('aaaaaaaa-0000-4000-8000-00000000000a', false)$q$, 'anon không gọi được respond_friend_request');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.outgoing_friend_requests()) = 0, 'tài khoản ngoài Class: outgoing rỗng');
  perform t.as_user('A');
  perform t.fails($q$select * from public.friendships$q$, 'authenticated vẫn KHÔNG đọc thẳng được bảng friendships');
  perform t.fails($q$delete from public.friendships$q$, 'authenticated vẫn KHÔNG xoá thẳng được bảng friendships');
  perform t.ok(t.ids_out() = '' and t.ids_in() = '' and t.ids_fr() = '', 'ban đầu: A chưa có lời mời / bạn bè');
  perform t.reset();
end $$;

-- ── 1. A → B gửi · B thấy incoming · A thấy outgoing ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(public.send_friend_request(t.u('B')) = 'outgoing', '1 A gửi lời mời cho B');
  perform t.ok(t.ids_out() = t.u('B')::text, '1 A thấy B trong "Lời mời đã gửi"');
  perform t.ok((select name = 'Bình' and role = 'student' and requested_at is not null from public.outgoing_friend_requests()),
               '1 outgoing trả tên/vai trò/thời điểm qua class_public_identity');
  perform t.ok(t.ids_in() = '' and t.ids_fr() = '', '1 A không thấy lời mời đến / bạn bè');
  perform t.ok(public.friendship_status(t.u('B')) = 'outgoing', '1 hồ sơ B nhìn từ A: OUTGOING');
  perform t.as_user('B');
  perform t.ok(t.ids_in() = t.u('A')::text, '1 B thấy A trong "Lời mời kết bạn"');
  perform t.ok(t.ids_out() = '' and t.ids_fr() = '', '1 B không có lời mời đã gửi / bạn bè (không lộ outgoing của A)');
  perform t.ok(public.friendship_status(t.u('A')) = 'incoming', '1 hồ sơ A nhìn từ B: INCOMING');
  perform t.as_user('C');
  perform t.ok(t.ids_in() = '' and t.ids_out() = '', '1 người thứ ba C không thấy lời mời A–B');
  -- pending KHÔNG phải bạn: không xem được tường của nhau
  perform t.as_user('B');
  perform t.ok(not public.can_view_wall(t.u('A')) and not public.is_friend_of(t.u('A')), '1 PENDING ≠ FRIENDS: B không xem được tường A');
  perform t.as_user('A');
  perform t.ok(not public.can_view_wall(t.u('B')), '1 PENDING ≠ FRIENDS: A không xem được tường B');
  perform t.reset();
end $$;

-- ── 2. B chấp nhận · cả hai thấy nhau trong bạn bè · lời mời biến mất hai phía ──
do $$ begin
  perform t.as_user('C');
  perform t.fails($q$select public.respond_friend_request('aaaaaaaa-0000-4000-8000-00000000000a', true)$q$, '2 người thứ ba không chấp nhận hộ được');
  perform t.as_user('A');
  perform t.fails($q$select public.respond_friend_request('bbbbbbbb-0000-4000-8000-00000000000b', true)$q$, '2 người gửi không tự chấp nhận lời mời của mình');
  perform t.as_user('B');
  perform t.ok(public.respond_friend_request(t.u('A'), true) = 'friends', '2 B chấp nhận A');
  perform t.ok(t.ids_fr() = t.u('A')::text, '2 B thấy A trong "Tất cả bạn bè"');
  perform t.ok(t.ids_in() = '', '2 incoming của B biến mất');
  perform t.ok(public.friendship_status(t.u('A')) = 'friends' and public.can_view_wall(t.u('A')), '2 B: FRIENDS + xem được tường A');
  perform t.as_user('A');
  perform t.ok(t.ids_fr() = t.u('B')::text, '2 A thấy B trong "Tất cả bạn bè"');
  perform t.ok(t.ids_out() = '', '2 outgoing của A biến mất');
  perform t.ok(public.friendship_status(t.u('B')) = 'friends', '2 A: FRIENDS');
  perform t.reset();
end $$;

-- ── 3. A → C gửi · A huỷ lời mời · C hết incoming · A gửi lại được ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(public.send_friend_request(t.u('C')) = 'outgoing', '3 A gửi lời mời cho C');
  perform t.ok(t.ids_out() = t.u('C')::text, '3 A thấy C trong "Lời mời đã gửi" (B đã là bạn, không lẫn vào)');
  perform t.as_user('C');
  perform t.ok(t.ids_in() = t.u('A')::text, '3 C thấy lời mời của A');
  perform t.as_user('A');
  perform t.ok(public.unfriend(t.u('C')) = 'none', '3 A huỷ lời mời → NONE');
  perform t.ok(t.ids_out() = '', '3 outgoing của A trống');
  perform t.ok(t.ids_fr() = t.u('B')::text, '3 huỷ lời mời C không đụng tình bạn A–B');
  perform t.as_user('C');
  perform t.ok(t.ids_in() = '' and public.friendship_status(t.u('A')) = 'none', '3 C không còn incoming; hồ sơ A: NONE');
  perform t.as_user('A');
  perform t.ok(public.send_friend_request(t.u('C')) = 'outgoing', '3 A gửi lại được cho C');
  perform t.as_user('C');
  perform t.ok(t.ids_in() = t.u('A')::text, '3 C thấy lại lời mời mới');
  perform t.fails($q$select public.respond_friend_request('bbbbbbbb-0000-4000-8000-00000000000b', false)$q$,
                  '3 C không "Xóa" được lời mời không gửi cho mình');
  perform t.as_user('A');
  perform t.ok(public.unfriend(t.u('C')) = 'none', '3 dọn: A huỷ lời mời C');
  perform t.reset();
  perform t.ok(t.rows() = 1, '3 bảng chỉ còn quan hệ A–B');
end $$;

-- ── 4. D → A gửi · A Xóa lời mời · biến mất ĐÚNG hai phía · D gửi lại được ──
do $$ begin
  perform t.as_user('D');
  perform t.ok(public.send_friend_request(t.u('A')) = 'outgoing', '4 D gửi lời mời cho A');
  perform t.as_user('A');
  perform t.ok(t.ids_in() = t.u('D')::text, '4 A thấy D trong "Lời mời kết bạn"');
  perform t.fails($q$select public.respond_friend_request('0d0d0d0d-0000-4000-8000-0000000000d4', null)$q$, '4 thiếu lựa chọn → từ chối');
  perform t.as_user('D');
  perform t.fails($q$select public.respond_friend_request('aaaaaaaa-0000-4000-8000-00000000000a', false)$q$,
                  '4 người gửi không tự "Xóa" bằng respond (dùng Huỷ lời mời)');
  perform t.as_user('A');
  perform t.ok(public.respond_friend_request(t.u('D'), false) = 'none', '4 A Xóa lời mời của D → NONE');
  perform t.ok(t.ids_in() = '' and public.friendship_status(t.u('D')) = 'none', '4 A: lời mời biến mất, hồ sơ D: NONE');
  perform t.fails($q$select public.respond_friend_request('0d0d0d0d-0000-4000-8000-0000000000d4', false)$q$, '4 Xóa lần hai → "Không có lời mời"');
  perform t.as_user('D');
  perform t.ok(t.ids_out() = '' and public.friendship_status(t.u('A')) = 'none', '4 D: "Lời mời đã gửi" trống, hồ sơ A: NONE (như Facebook)');
  perform t.ok(not public.can_view_wall(t.u('A')), '4 Xóa lời mời: D không xem được tường A');
  perform t.reset();
  perform t.ok(t.rows() = 1 and not exists (select 1 from public.friendships where status = 'declined'),
               '4 Xóa = xoá hàng pending; không còn hàng declined');
  perform t.as_user('D');
  perform t.ok(public.send_friend_request(t.u('A')) = 'outgoing', '4 D gửi lại được sau khi bị Xóa');
  perform t.as_user('A');
  perform t.ok(t.ids_in() = t.u('D')::text, '4 A thấy lại lời mời của D');
  perform t.ok(public.send_friend_request(t.u('D')) = 'friends', '4 A bấm Kết bạn với người đã mời mình → thành bạn (luật cũ giữ nguyên)');
  perform t.ok(t.ids_in() = '' and t.ids_fr() = t.u('D')::text || ',' || t.u('B')::text, '4 A: D vào bạn bè, hết lời mời');
  perform t.as_user('D');
  perform t.ok(t.ids_out() = '' and t.ids_fr() = t.u('A')::text, '4 D: A vào bạn bè, hết lời mời đã gửi');
  perform t.reset();
end $$;

-- ── 5. Huỷ kết bạn: hai phía hết bạn · quyền tường mất ngay · gửi lại được ──
do $$ begin
  perform t.as_user('C');
  perform t.ok(public.unfriend(t.u('A')) = 'none', '5 người ngoài gọi unfriend: không có quan hệ → NONE');
  perform t.reset();
  perform t.ok(t.rows() = 2, '5 người ngoài không xoá được tình bạn của người khác');
  perform t.as_user('B');   -- phía ADDRESSEE huỷ (A là người gửi ban đầu)
  perform t.ok(public.unfriend(t.u('A')) = 'none', '5 B (người nhận lời mời ban đầu) huỷ kết bạn A');
  perform t.ok(t.ids_fr() = '' and not public.can_view_wall(t.u('A')), '5 B: hết bạn, mất quyền xem tường A');
  perform t.as_user('A');
  perform t.ok(t.ids_fr() = t.u('D')::text and public.friendship_status(t.u('B')) = 'none', '5 A: B biến mất, D còn; hồ sơ B: NONE');
  perform t.as_user('A');   -- phía REQUESTER huỷ
  perform t.ok(public.unfriend(t.u('D')) = 'none', '5 A huỷ kết bạn D (A là người nhận lời mời ban đầu của D)');
  perform t.as_user('D');
  perform t.ok(t.ids_fr() = '' and t.ids_in() = '' and t.ids_out() = '', '5 D: không còn gì với A');
  perform t.ok(public.send_friend_request(t.u('A')) = 'outgoing', '5 sau khi huỷ kết bạn vẫn gửi lại được');
  perform t.as_user('A');
  perform t.ok(public.unfriend(t.u('D')) = 'incoming', '5 unfriend KHÔNG xoá lời mời người khác gửi đến (chỉ người gửi rút được)');
  perform t.ok(t.ids_in() = t.u('D')::text, '5 lời mời đến của D vẫn còn (unfriend không xoá lời mời người khác gửi)');
  perform t.ok(public.respond_friend_request(t.u('D'), false) = 'none', '5 dọn: A Xóa lời mời D');
  perform t.reset();
  perform t.ok(t.rows() = 0, '5 bảng trống');
end $$;

-- ── 6. Hàng 'declined' cũ (trước V2): danh sách khớp nút hồ sơ, Huỷ lời mời xoá được ──
do $$ begin
  perform t.reset();
  insert into public.friendships (requester_id, addressee_id, status, responded_at) values (t.u('C'), t.u('B'), 'declined', now());
  perform t.as_user('C');
  perform t.ok(public.friendship_status(t.u('B')) = 'outgoing' and t.ids_out() = t.u('B')::text,
               '6 declined cũ: C thấy "Đã gửi lời mời" ở CẢ hồ sơ lẫn danh sách (không mơ hồ)');
  perform t.as_user('B');
  perform t.ok(t.ids_in() = '' and public.friendship_status(t.u('C')) = 'none', '6 declined cũ: B không thấy lời mời, hồ sơ C: NONE');
  perform t.as_user('C');
  perform t.ok(public.unfriend(t.u('B')) = 'none' and t.ids_out() = '', '6 C Huỷ lời mời → xoá hàng declined cũ');
  perform t.reset();
  perform t.ok(t.rows() = 0, '6 bảng trống');
end $$;

-- ── 7. Đọc lại ở phiên/transaction mới (tương đương refresh / đăng nhập lại): trạng thái lấy từ DB ──
do $$ begin
  perform t.as_user('A');
  perform public.send_friend_request(t.u('B'));
  perform t.as_user('B');
  perform public.respond_friend_request(t.u('A'), true);
  perform t.as_user('A');
  perform public.send_friend_request(t.u('C'));
  perform t.reset();
end $$;
do $$ begin   -- transaction riêng
  perform t.as_user('A');
  perform t.ok(t.ids_fr() = t.u('B')::text and t.ids_out() = t.u('C')::text and t.ids_in() = '',
               '7 phiên mới: A thấy B là bạn, C trong "đã gửi"');
  perform t.as_user('B');
  perform t.ok(t.ids_fr() = t.u('A')::text, '7 phiên mới: B thấy A là bạn');
  perform t.as_user('C');
  perform t.ok(t.ids_in() = t.u('A')::text, '7 phiên mới: C thấy lời mời của A');
  perform t.as_user('T');   -- Thầy: quyền kiểm duyệt tường giữ nguyên, nhưng KHÔNG thành bạn
  perform t.ok(public.can_view_wall(t.u('A')) and public.friendship_status(t.u('A')) = 'none' and t.ids_out() = '',
               '7 Thầy xem được tường (kiểm duyệt) nhưng quan hệ vẫn NONE');
  perform t.reset();
end $$;

set client_min_messages = warning;
drop schema t cascade;
delete from public.friendships;
delete from public.edu_students where user_id = '0d0d0d0d-0000-4000-8000-0000000000d4';
delete from public.app_users where id = '0d0d0d0d-0000-4000-8000-0000000000d4';
delete from auth.users where id = '0d0d0d0d-0000-4000-8000-0000000000d4';
