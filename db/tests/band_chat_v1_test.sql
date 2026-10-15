-- ═══ TEST Band Chat V1 (db/band_chat_v1_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-band-chat-v1-db.sh (có chốt chặn user thật).
-- Mỗi identity chạy dưới ĐÚNG role (authenticated/anon) + JWT sub. Teamlab: bảng giả tối thiểu do runner tạo.
-- A, B = học sinh cùng Band X · C = học sinh Band Y (cùng Team với X) · D = học sinh (vào X sau) · E = Band Z (Team khác)
-- T = Thầy (KHÔNG thuộc Band nào) · N = tài khoản ngoài Class.
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
                when 'D' then '0d0d0d0d-0000-4000-8000-0000000000d4'::uuid
                when 'E' then '0e0e0e0e-0000-4000-8000-0000000000e5'::uuid
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
create function t.err(q text) returns text language plpgsql as $$ begin
  execute q; return 'OK';
exception when others then return sqlstate || ':' || sqlerrm;
end $$;
-- Đếm thô (bỏ qua RLS: security definer) để chứng minh "tin cũ vẫn còn"
create function t.rows() returns text language sql security definer as $$
  select (select count(*) from public.bandchat_rooms) || '/' || (select count(*) from public.bandchat_messages) || '/' || (select count(*) from public.bandchat_reads)
$$;
create function t.msgs(p_band uuid) returns bigint language sql security definer as $$
  select count(*) from public.bandchat_messages where band_id = p_band
$$;
grant execute on all functions in schema t to anon, authenticated;

-- Band/Team giả (production: bảng của TeamLab). X, Y cùng Team P1; Z ở Team P2.
create function t.band(k text) returns uuid language sql immutable as $$
  select case k when 'X' then '11111111-0000-4000-8000-0000000000a1'::uuid
                when 'Y' then '11111111-0000-4000-8000-0000000000a2'::uuid
                when 'Z' then '11111111-0000-4000-8000-0000000000a3'::uuid end
$$;
grant execute on function t.band(text) to anon, authenticated;

-- ── 0. Bảng khoá hẳn + quyền gọi ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select * from public.bandchat_messages$q$, '0 KHÔNG đọc thẳng bandchat_messages');
  perform t.fails($q$select * from public.bandchat_rooms$q$, '0 KHÔNG đọc thẳng bandchat_rooms');
  perform t.fails($q$select * from public.bandchat_reads$q$, '0 KHÔNG đọc thẳng bandchat_reads');
  perform t.fails($q$insert into public.bandchat_messages (band_id, seq, sender_id, body) values (gen_random_uuid(), 1, 'aaaaaaaa-0000-4000-8000-00000000000a', 'x')$q$, '0 KHÔNG chèn thẳng bandchat_messages');
  perform t.fails($q$update public.bandchat_reads set last_read_seq = 99$q$, '0 KHÔNG sửa thẳng bandchat_reads');
  perform t.fails($q$select public.bandchat_access(t.band('X'))$q$, '0 bandchat_access là hàm nội bộ');
  perform t.fails($q$select * from public.bandchat_frozen$q$, '0 KHÔNG đọc thẳng bandchat_frozen');
  perform t.fails($q$select public.bandchat_set_archived(t.band('X'), true)$q$, '0 học sinh KHÔNG lưu trữ được nhóm');
  perform t.fails($q$select public.bandchat_append(t.band('X'), t.u('A'), 'x')$q$, '0 bandchat_append là hàm nội bộ (không gửi vòng qua kiểm quyền)');
  perform t.as_anon();
  perform t.fails($q$select * from public.bandchat_rooms()$q$, '0 anon không gọi được bandchat_rooms');
  perform t.fails($q$select public.bandchat_send(t.band('X'), 'x')$q$, '0 anon không gửi được');
  perform t.fails($q$select public.bandchat_set_archived(t.band('X'), true)$q$, '0 anon không lưu trữ được');
  perform t.reset();
end $$;

-- ── a. Hai thành viên cùng Band thấy cùng một nhóm và trao đổi được ──
do $$ declare ra record; rb record; s bigint; n int; begin
  perform t.as_user('A');
  select * into ra from public.bandchat_rooms() where band_id = t.band('X');
  perform t.ok(ra.band_name = 'Band X' and ra.project_name = 'Team Một' and ra.last_seq = 0 and ra.unread = 0 and ra.member_count = 2,
               'a1 A thấy nhóm Band X (chưa có tin) với tên Band + số thành viên');
  perform t.ok(ra.cover_path is null and ra.project_avatar_path = 'p1/avatar.jpg', 'a2 ảnh: Band chưa có bìa → trả ảnh Team làm dự phòng');
  s := public.bandchat_send(t.band('X'), '  Chào cả nhóm  ');
  perform t.ok(s = 1, 'a3 A gửi tin đầu (seq 1, cắt khoảng trắng)');
  perform t.as_user('B');
  select * into rb from public.bandchat_rooms() where band_id = t.band('X');
  perform t.ok(rb.last_seq = 1 and rb.unread = 1 and rb.last_body = 'Chào cả nhóm' and rb.last_sender_name = 'An' and rb.last_mine = false,
               'a4 B thấy cùng nhóm, 1 tin chưa đọc, người gửi = An');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 1, 'a5 B đọc được tin của A');
  perform t.ok((select m.sender_name from public.bandchat_messages(t.band('X')) m limit 1) = 'An'
               and (select m.mine from public.bandchat_messages(t.band('X')) m limit 1) = false, 'a6 tin có tên người gửi, mine=false với B');
  s := public.bandchat_send(t.band('X'), 'Mai tập lúc 7h nhé');
  perform t.ok(s = 2, 'a7 B trả lời (seq 2)');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 2, 'a8 A thấy cả hai tin');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'), 1)) = 1
               and (select seq from public.bandchat_messages(t.band('X'), 1)) = 2, 'a9 polling after_seq chỉ trả tin mới');
  perform t.ok((select array_agg(m.user_id order by m.name) from public.bandchat_members(t.band('X')) m) = array[t.u('A'), t.u('B')], 'a10 danh sách thành viên đúng');
  perform t.reset();
  perform t.ok(t.rows() = '1/2/2', 'a11 đúng 1 phòng, 2 tin, 2 trạng thái đọc');
end $$;

-- ── b. Hai Band khác nhau (kể cả cùng Team) không đọc được tin của nhau ──
do $$ declare s bigint; begin
  perform t.as_user('C');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 1 and (select band_name from public.bandchat_rooms()) = 'Band Y',
               'b1 C (Band Y cùng Team) chỉ thấy nhóm của Band Y');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'b2 C KHÔNG đọc được Band X (cùng Team vẫn không)');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'chen ngang')$q$) like 'P0002:%', 'b3 C KHÔNG gửi được vào Band X');
  perform t.ok(t.err($q$select public.bandchat_mark_read(t.band('X'), 2)$q$) like 'P0002:%', 'b4 C KHÔNG đánh dấu đọc nhóm khác');
  perform t.ok(t.err($q$select * from public.bandchat_members(t.band('X'))$q$) like 'P0002:%', 'b5 C KHÔNG xem thành viên nhóm khác');
  s := public.bandchat_send(t.band('Y'), 'Nhóm Y xin chào');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 1, 'b6 A không thấy nhóm Y');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('Y'))$q$) like 'P0002:%', 'b7 A KHÔNG đọc được Band Y');
  perform t.reset();
end $$;

-- ── c. Người ngoài bị chặn ở backend; Thầy/Admin chỉ ĐỌC (không gửi, không đổi trạng thái đọc) ──
do $$ begin
  perform t.as_user('N');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 0, 'c1 N (ngoài Band) không thấy nhóm nào');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'c2 N KHÔNG đọc được dù biết ID Band');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like 'P0002:%', 'c3 N KHÔNG gửi được');
  perform t.ok(t.err($q$select * from public.bandchat_members(t.band('X'))$q$) like 'P0002:%', 'c3b N KHÔNG xem thành viên');
  perform t.ok(public.bandchat_unread_count() = 0, 'c4 N badge = 0');
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.bandchat_messages(gen_random_uuid())$q$) like 'P0002:%'
               and t.err($q$select public.bandchat_send(gen_random_uuid(), 'x')$q$) like 'P0002:%', 'c5 ID Band không tồn tại → cùng lỗi (không lộ sự tồn tại)');
  perform t.reset();
  perform t.ok(t.rows() = '2/3/3', 'c6 chặn không tạo phòng/tin rác (2 phòng, 3 tin)');
  -- Thầy/Admin (nguồn quyền chuẩn is_teacher)
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_rooms() where band_id in (t.band('X'), t.band('Y')) and support and not can_send and unread = 0) = 2,
               'c7 Thầy thấy 2 nhóm đã có tin của Band khác: support, không gửi được, không chưa đọc');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 2, 'c8 nhóm chưa có tin (Z) không xuất hiện ở danh sách hỗ trợ');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 2, 'c9 Thầy đọc được lịch sử nhóm X (hỗ trợ/quản lý)');
  perform t.ok((select count(*) from public.bandchat_members(t.band('X'))) = 2, 'c10 Thầy xem được thành viên');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'Thầy nhắn thay')$q$) like '42501:%', 'c11 Thầy KHÔNG gửi được vào nhóm không thuộc (không gửi thay/giả danh)');
  perform t.ok(public.bandchat_mark_read(t.band('X'), 2) = 0 and public.bandchat_unread_count() = 0, 'c12 Thầy xem không tạo trạng thái đọc');
  perform t.reset();
  perform t.ok(t.rows() = '2/3/3', 'c13 Thầy xem không đổi dữ liệu (rooms/messages/reads)');
  perform t.as_user('A');
  perform t.ok((select unread from public.bandchat_rooms() where band_id = t.band('X')) = 1, 'c14 Thầy xem không làm đổi chưa đọc của thành viên (B gửi → A còn 1)');
  perform t.reset();
end $$;

-- ── d. Rời Band bị thu hồi quyền; tin cũ vẫn còn ──
do $$ declare s bigint; begin
  perform t.reset();
  delete from public.teamlab_band_members where band_id = t.band('X') and user_id = t.u('B');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.bandchat_rooms() where band_id = t.band('X')) = 0, 'd1 B rời Band → không còn thấy nhóm');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'd2 B không đọc được nữa');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'vẫn còn gửi?')$q$) like 'P0002:%', 'd3 B không gửi được nữa');
  perform t.ok(public.bandchat_unread_count() = 0, 'd4 B badge về 0');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 2
               and (select count(*) from public.bandchat_messages(t.band('X')) where sender_name = 'Bình') = 1,
               'd5 tin cũ của B vẫn còn, vẫn hiện tên Bình với người còn lại');
  perform t.ok((select member_count from public.bandchat_rooms() where band_id = t.band('X')) = 1, 'd6 số thành viên cập nhật');
  perform t.reset();
  perform t.ok(t.msgs(t.band('X')) = 2, 'd7 DB còn nguyên 2 tin');
  -- B được thêm lại → thấy lại lịch sử
  insert into public.teamlab_band_members (band_id, user_id) values (t.band('X'), t.u('B'));
  perform t.as_user('B');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 2, 'd8 vào lại Band → đọc lại được lịch sử');
  perform t.reset();
end $$;

-- ── e. Thành viên mới đọc được lịch sử; tin cũ không bị tính là chưa đọc ──
do $$ begin
  perform t.reset();
  insert into public.teamlab_band_members (band_id, user_id) values (t.band('X'), t.u('D'));
end $$;
do $$ begin
  perform t.as_user('D');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 2, 'e1 D (mới vào) đọc được toàn bộ lịch sử');
  perform t.ok((select unread from public.bandchat_rooms() where band_id = t.band('X')) = 0 and public.bandchat_unread_count() = 0,
               'e2 lịch sử có trước lúc vào Band không tính chưa đọc');
  perform t.reset();
end $$;
do $$ declare s bigint; begin
  perform t.as_user('A');
  s := public.bandchat_send(t.band('X'), 'Chào D, chào mừng bạn');
  perform t.as_user('D');
  perform t.ok((select unread from public.bandchat_rooms() where band_id = t.band('X')) = 1 and public.bandchat_unread_count() = 1,
               'e3 tin mới sau khi vào → D có 1 chưa đọc, badge 1');
  perform t.reset();
end $$;

-- ── g. Chưa đọc / badge theo từng người; mở nhóm = đã đọc ──
do $$ declare s bigint; begin
  perform t.as_user('B');
  perform t.ok((select unread from public.bandchat_rooms() where band_id = t.band('X')) = 1 and public.bandchat_unread_count() = 1, 'g1 B chưa đọc 1 (tin của A)');
  perform t.ok(public.bandchat_mark_read(t.band('X'), 3) = 3, 'g2 B đánh dấu đã đọc tới tin 3');
  perform t.ok(public.bandchat_mark_read(t.band('X'), 1) = 3, 'g3 đánh dấu không lùi');
  perform t.ok(public.bandchat_mark_read(t.band('X'), 999) = 3, 'g4 đánh dấu không vượt tin cuối');
  perform t.ok(public.bandchat_unread_count() = 0, 'g5 B badge 0');
  perform t.as_user('D');
  perform t.ok(public.bandchat_unread_count() = 1, 'g6 trạng thái của D độc lập (vẫn 1)');
  perform t.as_user('A');
  perform t.ok((select unread from public.bandchat_rooms() where band_id = t.band('X')) = 0, 'g7 người gửi không tự có chưa đọc');
  perform t.reset();
end $$;

-- ── i. Một người nhiều Band thấy các nhóm tương ứng; tên/ảnh Band đổi thì nhóm đổi theo ──
do $$ begin
  perform t.reset();
  insert into public.teamlab_band_members (band_id, user_id) values (t.band('Z'), t.u('A'));
  perform t.as_user('A');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 2, 'i1 A thuộc 2 Band → thấy 2 nhóm riêng');
  perform t.reset();
  update public.teamlab_bands set name = 'Band X mới', cover_path = '11111111-0000-4000-8000-0000000000b1/cover-band-x.jpg' where id = t.band('X');
  perform t.as_user('A');
  perform t.ok((select band_name from public.bandchat_rooms() where band_id = t.band('X')) = 'Band X mới'
               and (select cover_path from public.bandchat_rooms() where band_id = t.band('X')) like '%cover-band-x.jpg', 'i2 đổi tên/ảnh Band → nhóm phản ánh ngay');
  perform t.reset();
end $$;

-- ── l. Giới hạn: rỗng / quá dài / quá nhanh ──
do $$ declare i int; begin
  perform t.as_user('C');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('Y'), '   ')$q$) like '22023:%', 'l1 tin rỗng bị từ chối');
  perform t.ok(t.err(format('select public.bandchat_send(t.band(%L), %L)', 'Y', repeat('x', 2001))) like '22023:%', 'l2 tin > 2000 ký tự bị từ chối');
  perform t.ok(public.bandchat_send(t.band('Y'), repeat('x', 2000)) > 0, 'l3 đúng 2000 ký tự được');
  for i in 1..28 loop perform public.bandchat_send(t.band('Y'), 'm' || i); end loop;
  perform t.ok(t.err($q$select public.bandchat_send(t.band('Y'), 'quá nhanh')$q$) like '54000:%', 'l4 vượt 30 tin/phút bị chặn');
  perform t.reset();
end $$;

-- ── m. Lưu trữ Band: giữ lịch sử, chỉ đọc cho người có quyền lúc lưu trữ; khôi phục → theo thành viên hiện hành ──
do $$ begin
  perform t.reset();
  -- trạng thái trước: X có A, B, D (đều thành viên). Z chưa có phòng.
  perform t.as_user('A');
  perform t.ok(t.err($q$select public.bandchat_set_archived(t.band('X'), true)$q$) like '42501:%', 'm0 thành viên thường KHÔNG lưu trữ được');
  perform t.as_user('T');
  perform t.ok(public.bandchat_set_archived(t.band('X'), true) is not null, 'm1 Thầy lưu trữ Band X');
  perform t.ok(public.bandchat_set_archived(t.band('X'), true) is not null, 'm1b lưu trữ lần hai idempotent');
  perform t.as_user('A');
  perform t.ok((select can_send from public.bandchat_rooms() where band_id = t.band('X')) = false
               and (select archived from public.bandchat_rooms() where band_id = t.band('X')) = true
               and (select support from public.bandchat_rooms() where band_id = t.band('X')) = false, 'm2 A thấy nhóm: lưu trữ, chỉ đọc, KHÔNG phải nhóm hỗ trợ');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 3, 'm3 A vẫn đọc toàn bộ lịch sử');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'gửi khi lưu trữ')$q$) like '42501:%', 'm4 A KHÔNG gửi được khi Band lưu trữ');
  perform t.ok(public.bandchat_mark_read(t.band('X'), 3) = 3, 'm5 A vẫn đánh dấu đã đọc được');
  perform t.reset();
  -- B (đang là thành viên) rời Band SAU khi lưu trữ → vẫn đọc (có quyền tại thời điểm lưu trữ)
  delete from public.teamlab_band_members where band_id = t.band('X') and user_id = t.u('B');
  -- E vào Band SAU khi lưu trữ → không có quyền
  insert into public.teamlab_band_members (band_id, user_id) values (t.band('X'), t.u('E'));
  perform t.as_user('B');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 3 and (select can_send from public.bandchat_rooms() where band_id = t.band('X')) = false,
               'm6 B rời Band sau lưu trữ vẫn đọc (chỉ đọc)');
  perform t.as_user('E');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%' and (select count(*) from public.bandchat_rooms()) = 0,
               'm7 người vào Band sau lưu trữ KHÔNG có quyền (cho tới khi khôi phục)');
  perform t.as_user('C');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'm8 người ngoài vẫn bị chặn khi nhóm lưu trữ');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 3
               and (select array_length(array_agg(user_id), 1) from public.bandchat_members(t.band('X'))) = 3, 'm9 Thầy vẫn đọc; danh sách thành viên = ảnh chụp lúc lưu trữ (A, B, D)');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like '42501:%', 'm10 Thầy không gửi được');
  perform t.reset();
  perform t.ok(t.msgs(t.band('X')) = 3, 'm11 lưu trữ không xoá tin nào');
  -- Khôi phục
  perform t.as_user('T');
  perform t.ok(public.bandchat_set_archived(t.band('X'), false) is null, 'm12 Thầy khôi phục');
  perform t.as_user('A');
  perform t.ok((select can_send from public.bandchat_rooms() where band_id = t.band('X')) = true and public.bandchat_send(t.band('X'), 'Band đã khôi phục') = 4,
               'm13 khôi phục → A gửi lại được');
  perform t.as_user('B');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'm14 khôi phục → quyền theo thành viên HIỆN HÀNH (B đã rời nên mất quyền)');
  perform t.as_user('E');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 4, 'm15 khôi phục → E (thành viên hiện hành) đọc được toàn bộ lịch sử');
  perform t.reset();
  perform t.ok((select count(*) from public.bandchat_frozen) = 0, 'm16 khôi phục xoá ảnh chụp');
end $$;

-- ── k. Xoá Band KHÔNG xoá lịch sử chat; thành viên cũ không đọc được, Thầy/Admin vẫn đọc ──
do $$ begin
  perform t.reset();
  perform t.ok(t.msgs(t.band('X')) = 4, 'k0 X có 4 tin trước khi xoá Band');
  delete from public.teamlab_band_members where band_id = t.band('X');
  delete from public.teamlab_bands where id = t.band('X');
  perform t.ok(t.msgs(t.band('X')) = 4, 'k1 xoá Band → 4 tin chat vẫn còn trong DB');
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'k2 thành viên cũ không đọc được nhóm của Band đã xoá');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) = 4
               and (select band_name from public.bandchat_rooms() where band_id = t.band('X')) = 'Band X mới', 'k3 Thầy vẫn đọc; nhóm hiện bằng tên Band đã lưu');
  perform t.reset();
end $$;
