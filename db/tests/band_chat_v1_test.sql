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
  perform t.fails($q$select public.bandchat_is_member(t.band('X'), t.u('A'))$q$, '0 bandchat_is_member là hàm nội bộ');
  perform t.fails($q$select public.bandchat_append(t.band('X'), t.u('A'), 'x')$q$, '0 bandchat_append là hàm nội bộ (không gửi vòng qua kiểm quyền)');
  perform t.as_anon();
  perform t.fails($q$select * from public.bandchat_rooms()$q$, '0 anon không gọi được bandchat_rooms');
  perform t.fails($q$select public.bandchat_send(t.band('X'), 'x')$q$, '0 anon không gửi được');
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

-- ── c. Người ngoài (kể cả Thầy/Admin không thuộc Band, tài khoản ngoài Class, ID giả) bị chặn ở backend ──
do $$ declare k text; begin
  foreach k in array array['N', 'T'] loop
    perform t.as_user(k);
    perform t.ok((select count(*) from public.bandchat_rooms()) = 0, 'c1 ' || k || ' không thấy nhóm nào');
    perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'c2 ' || k || ' KHÔNG đọc được dù biết ID Band');
    perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like 'P0002:%', 'c3 ' || k || ' KHÔNG gửi được');
    perform t.ok(public.bandchat_unread_count() = 0, 'c4 ' || k || ' badge = 0');
  end loop;
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.bandchat_messages(gen_random_uuid())$q$) like 'P0002:%'
               and t.err($q$select public.bandchat_send(gen_random_uuid(), 'x')$q$) like 'P0002:%', 'c5 ID Band không tồn tại → cùng lỗi (không lộ sự tồn tại)');
  perform t.reset();
  perform t.ok(t.rows() = '2/3/3', 'c6 chặn không tạo phòng/tin rác (2 phòng, 3 tin)');
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

-- ── k. Xoá Band KHÔNG xoá lịch sử chat; không ai còn đọc được ──
do $$ begin
  perform t.reset();
  perform t.ok(t.msgs(t.band('X')) = 3, 'k0 X có 3 tin trước khi xoá Band');
  delete from public.teamlab_band_members where band_id = t.band('X');
  delete from public.teamlab_bands where id = t.band('X');
  perform t.ok(t.msgs(t.band('X')) = 3, 'k1 xoá Band → 3 tin chat vẫn còn trong DB');
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.bandchat_messages(t.band('X'))$q$) like 'P0002:%', 'k2 không ai đọc được nhóm của Band đã xoá');
  perform t.reset();
end $$;
