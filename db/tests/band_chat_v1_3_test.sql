-- ═══ TEST Band Chat V1.3 — Thầy đồng hành (db/band_chat_v1_3_companion_setup.sql) ═══
-- Chạy qua scripts/test-band-chat-v1-db.sh (helper schema t do runner nối vào đầu file; chỉ cluster TẠM).
-- Band X (A,B) · Y (C) · Z (không ai). S = tài khoản Thầy đồng hành (app_users.email khớp, role admin, KHÔNG thuộc Band nào)
-- T = giáo viên khác (KHÔNG khớp email) · D = học viên ngoài Band · N = ngoài Class.
\set ON_ERROR_STOP on
create function t.band(k text) returns uuid language sql immutable as $$
  select case k when 'X' then '11111111-0000-4000-8000-0000000000a1'::uuid
                when 'Y' then '11111111-0000-4000-8000-0000000000a2'::uuid
                when 'Z' then '11111111-0000-4000-8000-0000000000a3'::uuid
                when 'GHOST' then '99999999-0000-4000-8000-0000000000f9'::uuid end
$$;
grant execute on function t.band(text) to anon, authenticated;

do $$ declare n0 text; v_seq bigint; begin
  perform t.reset();
  perform t.as_user('A'); perform public.bandchat_send(t.band('X'), 'A chào cả nhóm');
  perform t.reset();
  n0 := t.rows();
  -- 1. Đọc + danh sách
  perform t.as_user('S');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 3, '1a Thầy đồng hành thấy CẢ 3 Band');
  perform t.ok((select bool_and(support and can_send and unread = 0) from public.bandchat_rooms()), '1b mọi nhóm: hỗ trợ + GỬI ĐƯỢC + không tính chưa đọc');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 1, '1c đọc được tin của Band không thuộc');
  perform t.reset();
  perform t.ok(t.rows() = n0, '1d xem/liệt kê không tạo phòng hay dòng đọc');
  -- 2. Gửi trong Band mình không thuộc
  perform t.as_user('S');
  v_seq := public.bandchat_send(t.band('X'), 'Thầy nhắn trong nhóm');
  perform t.ok(v_seq = 2, '2a Thầy đồng hành gửi được vào Band X (seq '||v_seq||')');
  perform t.as_user('A');
  perform t.ok((select unread from public.bandchat_rooms() where band_id = t.band('X')) = 1, '2b thành viên A có 1 tin chưa đọc từ Thầy');
  perform t.ok((select sender_id = t.u('S') and not mine and sender_name = 'Thầy Văn Anh' from public.bandchat_messages(t.band('X')) where seq = 2),
               '2c thành viên thấy ĐÚNG tên Thầy là người gửi');
  perform t.ok((select last_sender_name = 'Thầy Văn Anh' and not last_mine from public.bandchat_rooms() where band_id = t.band('X')), '2d tin cuối trong danh sách là của Thầy');
  perform public.bandchat_send(t.band('X'), 'A trả lời Thầy');
  perform t.as_user('S');
  perform t.ok((select last_mine is false from public.bandchat_rooms() where band_id = t.band('X')), '2e hai chiều: Thầy thấy A trả lời');
  -- 3. Band chưa có phòng nhưng còn tồn tại → gửi được; Band không tồn tại → không
  perform public.bandchat_send(t.band('Z'), 'Thầy chào nhóm mới');
  perform t.ok(t.msgs(t.band('Z')) = 1, '3a gửi được vào Band còn tồn tại nhưng chưa có phòng');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('GHOST'), 'x')$q$) like '42501:%', '3b Band không tồn tại → KHÔNG gửi được (chỉ phòng Band hợp lệ)');
  -- 4. Quyền KHÁC không đổi
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 3, '4a giáo viên khác vẫn thấy mọi Band');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like '42501:%', '4b giáo viên khác (không khớp email) vẫn KHÔNG gửi được');
  perform t.as_user('D');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like 'P0002:%', '4c học viên ngoài Band không gửi, không thấy nhóm');
  perform t.as_user('C');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like 'P0002:%', '4d học viên Band khác không gửi được vào X');
  perform t.as_user('N');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like 'P0002:%', '4e người ngoài Class không gửi được');
  perform t.as_anon();
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like '42501:%', '4f anon không gọi được RPC');
  perform t.as_user('A');
  perform public.bandchat_send(t.band('X'), 'A vẫn gửi bình thường');
  perform t.as_user('C');
  perform public.bandchat_send(t.band('Y'), 'C vẫn gửi bình thường');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('Y'))) = 1, '4g thành viên hiện tại hoạt động bình thường');
  -- 5. Không là thành viên / không quản trị
  perform t.reset();
  perform t.ok(not exists (select 1 from public.teamlab_band_members where user_id = t.u('S')), '5a Thầy KHÔNG nằm trong teamlab_band_members (luật một Band không đụng)');
  perform t.ok(public.bandchat_group_role(t.band('X'), t.u('S')) is null, '5b Thầy không có vai trò trong nhóm (không Chủ nhóm/Quản trị viên)');
  perform t.as_user('S');
  perform t.ok(not exists (select 1 from public.bandchat_members(t.band('X')) m where m.user_id = t.u('S')), '5c danh sách thành viên (gọi bởi Thầy) không có Thầy');
  perform t.ok(t.err($q$select public.bandchat_can_admin(t.band('X'))$q$) like '42501:%', '5d hàm quản trị nội bộ vẫn không gọi được từ client');
  perform t.ok((select member_count from public.bandchat_rooms() where band_id = t.band('X')) = 2, '5e số thành viên Band X vẫn là 2');
  -- 6. Band lưu trữ → chỉ đọc kể cả Thầy đồng hành
  perform public.bandchat_set_archived(t.band('X'), true);
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like '42501:%', '6a Band lưu trữ: Thầy đồng hành chỉ đọc');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) >= 3, '6b vẫn đọc được lịch sử');
  perform public.bandchat_set_archived(t.band('X'), false);
  perform public.bandchat_send(t.band('X'), 'Thầy nhắn lại sau khôi phục');
  perform t.ok(true, '6c khôi phục Band → gửi lại được');
  -- 7. Mất danh tính → mất quyền gửi
  perform t.reset();
  update public.app_users set email = 'khac@test.local' where id = t.u('S');
  perform t.as_user('S');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like '42501:%', '7a đổi email khác → chỉ còn quyền đọc (không mở cho cả admin)');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) >= 3, '7b vẫn đọc (admin)');
  perform t.reset();
  update public.app_users set email = 'VananhAudio@Gmail.com', role = 'student' where id = t.u('S');
  perform t.as_user('S');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like 'P0002:%', '7c mất role giáo viên/admin → không đọc, không gửi');
  perform t.reset();
  update public.app_users set role = 'admin' where id = t.u('S');
  perform t.as_user('S');
  perform public.bandchat_send(t.band('X'), 'email khác hoa/thường vẫn khớp');
  perform t.ok(true, '7d khớp email không phân biệt hoa/thường');
  perform t.reset();
end $$;

do $$ begin
  perform t.as_user('S');
  perform t.ok(t.err($q$select public.bandchat_is_companion()$q$) like '42501:%', '8b client không gọi trực tiếp hàm nội bộ');
  perform t.reset();
end $$;
