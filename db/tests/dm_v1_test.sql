-- ═══ TEST Class Chat V1a (db/dm_v1_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-dm-v1-db.sh. Có chốt chặn: dừng nếu thấy user thật.
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
grant execute on all functions in schema t to anon, authenticated;

-- Tiện ích riêng cho DM
create function t.friends(x text, y text, st text) returns void language sql security definer as $$
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  values (t.u(x), t.u(y), st, case when st = 'pending' then null else now() end)
$$;
create function t.unfriend_row(x text, y text) returns void language sql security definer as $$
  delete from public.friendships where least(requester_id, addressee_id) = least(t.u(x), t.u(y))
                                    and greatest(requester_id, addressee_id) = greatest(t.u(x), t.u(y))
$$;
create function t.err(q text) returns text language plpgsql as $$ begin
  execute q; return 'OK';
exception when others then return sqlstate || ':' || sqlerrm;
end $$;
create function t.dmrows() returns text language sql security definer as $$
  select (select count(*) from public.dm_conversations) || '/' || (select count(*) from public.dm_participants) || '/' || (select count(*) from public.dm_messages)
$$;
grant execute on all functions in schema t to anon, authenticated;

-- ── 0. Bảng khoá hẳn + quyền gọi ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select * from public.dm_messages$q$, '0 authenticated KHÔNG đọc thẳng dm_messages');
  perform t.fails($q$select * from public.dm_conversations$q$, '0 authenticated KHÔNG đọc thẳng dm_conversations');
  perform t.fails($q$select * from public.dm_participants$q$, '0 authenticated KHÔNG đọc thẳng dm_participants');
  perform t.fails($q$insert into public.dm_messages (conversation_id, seq, sender_id, body) values (gen_random_uuid(), 1, 'aaaaaaaa-0000-4000-8000-00000000000a', 'x')$q$, '0 KHÔNG chèn thẳng dm_messages');
  perform t.fails($q$update public.dm_participants set last_read_seq = 99$q$, '0 KHÔNG sửa thẳng dm_participants');
  perform t.fails($q$delete from public.dm_conversations$q$, '0 KHÔNG xoá thẳng dm_conversations');
  perform t.fails($q$select public.dm_rule(t.u('A'), t.u('B'))$q$, '0 dm_rule là hàm nội bộ, client không gọi được');
  perform t.fails($q$select public.dm_append(gen_random_uuid(), t.u('A'), 'x')$q$, '0 dm_append là hàm nội bộ, client không gọi được');
  perform t.as_anon();
  perform t.fails($q$select * from public.dm_conversations()$q$, '0 anon không gọi được dm_conversations');
  perform t.fails($q$select public.dm_unread_count()$q$, '0 anon không gọi được dm_unread_count');
  perform t.fails($q$select * from public.dm_start(t.u('B'), 'x')$q$, '0 anon không gọi được dm_start');
  perform t.reset();
end $$;

-- ── 1. Quyền nhắn tin: chưa là bạn / pending / declined → TỪ CHỐI ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(not public.dm_can_message(t.u('B')), '1 chưa là bạn: dm_can_message = false');
  perform t.fails($q$select * from public.dm_start(t.u('B'), 'chào')$q$, '1 chưa là bạn: dm_start bị chặn');
  perform t.ok(t.err($q$select * from public.dm_start(t.u('B'), 'chào')$q$) like '42501:%', '1 lỗi quyền là 42501 (không lộ chi tiết)');
  perform t.ok(public.dm_find(t.u('B')) is null, '1 chưa có hội thoại → dm_find = null');
  perform t.ok(not public.dm_can_message(t.u('A')), '1 không nhắn cho chính mình');
  perform t.fails($q$select * from public.dm_start(t.u('A'), 'tự nói')$q$, '1 dm_start tới chính mình bị chặn');
  perform t.ok(not public.dm_can_message(t.u('N')), '1 người ngoài Class: false');
  perform t.fails($q$select * from public.dm_start(t.u('N'), 'x')$q$, '1 dm_start tới người ngoài Class bị chặn');
  perform t.reset();
  perform t.ok(t.dmrows() = '0/0/0', '1 các lần bị chặn KHÔNG sinh hội thoại rác');
  -- cùng lớp (nếu có) không đủ: chỉ friendship accepted
  perform t.friends('A', 'B', 'pending');
  perform t.as_user('A');
  perform t.ok(not public.dm_can_message(t.u('B')), '1 PENDING: A không nhắn được B');
  perform t.fails($q$select * from public.dm_start(t.u('B'), 'chào')$q$, '1 PENDING: dm_start bị chặn');
  perform t.as_user('B');
  perform t.ok(not public.dm_can_message(t.u('A')), '1 PENDING: B không nhắn được A');
  perform t.reset();
  perform t.unfriend_row('A', 'B');
  perform t.friends('A', 'B', 'declined');
  perform t.as_user('A');
  perform t.ok(not public.dm_can_message(t.u('B')), '1 DECLINED: không nhắn được');
  perform t.reset();
  perform t.unfriend_row('A', 'B');
  perform t.ok(t.dmrows() = '0/0/0', '1 không sinh hội thoại rác ở mọi trường hợp bị chặn');
end $$;

-- ── 2. Bạn bè accepted: A↔B nhắn được; hội thoại chuẩn tắc; unread ──
do $$ declare c1 uuid; c2 uuid; r record; begin
  perform t.friends('A', 'B', 'accepted');
  perform t.as_user('A');
  perform t.ok(public.dm_can_message(t.u('B')), '2 bạn accepted: dm_can_message = true');
  select * into r from public.dm_start(t.u('B'), '  Chào Bình 👋  ');
  c1 := r.conversation_id;
  perform t.ok(r.seq = 1, '2 tin đầu có seq = 1');
  perform t.ok(public.dm_find(t.u('B')) = c1, '2 dm_find trả đúng hội thoại');
  select * into r from public.dm_start(t.u('B'), 'Dòng 1' || chr(10) || 'Dòng 2');
  perform t.ok(r.conversation_id = c1 and r.seq = 2, '2 dm_start lần hai dùng LẠI hội thoại (seq = 2)');
  perform t.ok(public.dm_send(c1, 'tin thứ ba') = 3, '2 dm_send ghi seq = 3');
  perform t.ok(public.dm_unread_count() = 0, '2 người gửi: không có chưa đọc của chính mình');
  perform t.as_user('B');
  perform t.ok(public.dm_can_message(t.u('A')), '2 B nhắn được A (hai chiều)');
  perform t.ok(public.dm_find(t.u('A')) = c1, '2 B dm_find ra CÙNG hội thoại (chuẩn tắc theo cặp)');
  select * into r from public.dm_start(t.u('A'), 'Chào An');
  perform t.ok(r.conversation_id = c1 and r.seq = 4, '2 B bắt đầu từ phía B vẫn vào CÙNG hội thoại (seq = 4)');
  perform t.reset();
  perform t.ok(t.dmrows() = '1/2/4', '2 đúng 1 hội thoại, 2 người tham gia, 4 tin');
  -- unread của B sau khi A gửi thêm
  perform t.as_user('A');
  perform public.dm_send(c1, 'A gửi tiếp');
  perform t.as_user('B');
  perform t.ok(public.dm_unread_count() = 1, '2 B có 1 hội thoại chưa đọc (badge)');
  perform t.ok((select unread = 1 and not last_mine and last_body = 'A gửi tiếp' and can_send and peer_name = 'An'
                  from public.dm_conversations()), '2 danh sách của B: unread=1, tin cuối của A, tên/identity đúng, can_send');
  perform t.as_user('A');
  perform t.ok((select unread = 0 and last_mine and peer_name = 'Bình' from public.dm_conversations()), '2 danh sách của A: unread=0, tin cuối là của mình');
  perform t.as_user('B');
  perform t.ok(public.dm_mark_read(c1, 3) = 4, '2 B đã gửi seq 4 nên mốc đọc ≥ 4: mark_read(3) không kéo lùi (= 4)');
  perform t.ok(public.dm_unread_count() = 1, '2 còn tin 5 chưa đọc → vẫn 1 hội thoại chưa đọc');
  perform t.ok(public.dm_mark_read(c1, 1) = 4, '2 mark_read KHÔNG lùi (gọi 1 vẫn 4)');
  perform t.ok(public.dm_mark_read(c1, 9999) = 5, '2 mark_read bị kẹp ở tin cuối (5)');
  perform t.ok(public.dm_unread_count() = 0, '2 đã đọc hết → badge 0');
  perform t.reset();
end $$;

-- ── 3. Phân trang theo seq + nội dung ──
do $$ declare c uuid; begin
  perform t.as_user('A');
  c := public.dm_find(t.u('B'));
  perform t.ok((select string_agg(seq::text, ',' order by seq) from public.dm_messages(c)) = '1,2,3,4,5', '3 mặc định: các tin mới nhất, TĂNG dần');
  perform t.ok((select string_agg(seq::text, ',' order by seq) from public.dm_messages(c, null, null, 2)) = '4,5', '3 limit=2 → 2 tin MỚI NHẤT (4,5)');
  perform t.ok((select string_agg(seq::text, ',' order by seq) from public.dm_messages(c, null, 4, 2)) = '2,3', '3 before=4 limit=2 → (2,3)');
  perform t.ok((select string_agg(seq::text, ',' order by seq) from public.dm_messages(c, 3)) = '4,5', '3 after=3 → chỉ tin mới (4,5) — dùng cho polling');
  perform t.ok((select count(*) from public.dm_messages(c, 5)) = 0, '3 after=seq cuối → rỗng (polling nhẹ)');
  perform t.ok((select mine from public.dm_messages(c) where seq = 1) and not (select mine from public.dm_messages(c) where seq = 4), '3 cờ mine đúng');
  perform t.ok((select body from public.dm_messages(c) where seq = 1) = 'Chào Bình 👋', '3 body được trim, emoji nguyên vẹn');
  perform t.ok((select body from public.dm_messages(c) where seq = 2) = 'Dòng 1' || chr(10) || 'Dòng 2', '3 xuống dòng được giữ');
  perform t.ok((select count(*) from public.dm_messages(c, null, null, 1000)) = 5, '3 p_limit bị kẹp tối đa 100 (không lỗi)');
  perform t.reset();
end $$;

-- ── 4. Người ngoài hội thoại: không đọc/ghi, không đoán ID, không lộ sự tồn tại ──
do $$ declare c uuid; e_real text; e_fake text; e_real2 text; e_fake2 text; e_real3 text; begin
  select id into c from public.dm_conversations limit 1;
  perform t.as_user('C');
  e_real := t.err(format($q$select * from public.dm_messages(%L)$q$, c));
  e_fake := t.err($q$select * from public.dm_messages('00000000-1111-4000-8000-000000000000')$q$);
  perform t.ok(e_real = e_fake and e_real like 'P0002:%', '4 C đọc hội thoại A–B ≡ đọc ID không tồn tại (cùng lỗi, không lộ tồn tại)');
  e_real2 := t.err(format($q$select public.dm_send(%L, 'chen ngang')$q$, c));
  e_fake2 := t.err($q$select public.dm_send('00000000-1111-4000-8000-000000000000', 'chen ngang')$q$);
  perform t.ok(e_real2 = e_fake2 and e_real2 like 'P0002:%', '4 C gửi vào hội thoại A–B ≡ ID không tồn tại');
  e_real3 := t.err(format($q$select public.dm_mark_read(%L, 1)$q$, c));
  perform t.ok(e_real3 like 'P0002:%', '4 C không đánh dấu đọc hộ được');
  perform t.ok(public.dm_unread_count() = 0 and (select count(*) from public.dm_conversations()) = 0, '4 C không thấy hội thoại nào, badge 0');
  perform t.ok(public.dm_find(t.u('A')) is null and public.dm_find(t.u('B')) is null, '4 dm_find của C không lộ hội thoại người khác');
  perform t.fails($q$select * from public.dm_messages((select id from public.dm_conversations limit 1))$q$, '4 C không đọc thẳng bảng để lấy ID');
  perform t.as_user('N');
  perform t.fails($q$select * from public.dm_conversations()$q$, '4 tài khoản ngoài Class: dm_conversations bị chặn');
  perform t.ok(public.dm_unread_count() = 0, '4 tài khoản ngoài Class: badge 0');
  perform t.reset();
end $$;

-- ── 5. Huỷ kết bạn: đọc lịch sử vẫn được, GỬI MỚI bị chặn; kết bạn lại → gửi được ──
do $$ declare c uuid; begin
  select id into c from public.dm_conversations limit 1;
  perform t.unfriend_row('A', 'B');
  perform t.as_user('A');
  perform t.ok(not public.dm_can_message(t.u('B')), '5 hết bạn: dm_can_message = false');
  perform t.fails(format($q$select public.dm_send(%L, 'còn nhắn được không')$q$, c), '5 hết bạn: dm_send bị chặn');
  perform t.fails($q$select * from public.dm_start(t.u('B'), 'qua cửa sau')$q$, '5 hết bạn: dm_start (cửa sau) cũng bị chặn');
  perform t.ok((select count(*) from public.dm_messages(c)) = 5, '5 vẫn ĐỌC được lịch sử');
  perform t.ok((select not can_send from public.dm_conversations()), '5 danh sách báo can_send = false');
  perform t.ok(public.dm_find(t.u('B')) = c, '5 dm_find vẫn thấy hội thoại cũ');
  perform t.as_user('B');
  perform t.fails(format($q$select public.dm_send(%L, 'B cũng không gửi được')$q$, c), '5 hết bạn: B cũng không gửi được');
  perform t.ok(public.dm_mark_read(c, 5) = 5, '5 vẫn đánh dấu đọc được');
  perform t.reset();
  perform t.friends('B', 'A', 'declined');
  perform t.as_user('A');
  perform t.fails(format($q$select public.dm_send(%L, 'x')$q$, c), '5 quan hệ DECLINED: không gửi được');
  perform t.reset();
  perform t.unfriend_row('A', 'B');
  perform t.friends('B', 'A', 'accepted');
  perform t.as_user('A');
  perform t.ok(public.dm_send(c, 'lại là bạn') = 6, '5 kết bạn lại → gửi được, VẪN hội thoại cũ (seq = 6)');
  perform t.reset();
  perform t.ok(t.dmrows() = '1/2/6', '5 vẫn đúng 1 hội thoại cho cặp');
end $$;

-- ── 6. Kiểm tra đầu vào + giới hạn tốc độ ──
do $$ declare c uuid; begin
  select id into c from public.dm_conversations limit 1;
  perform t.as_user('A');
  perform t.fails(format($q$select public.dm_send(%L, '')$q$, c), '6 tin rỗng bị chặn');
  perform t.fails(format($q$select public.dm_send(%L, '   ' || chr(10) || ' ')$q$, c), '6 tin chỉ khoảng trắng bị chặn');
  perform t.fails(format($q$select public.dm_send(%L, null)$q$, c), '6 tin null bị chặn');
  perform t.fails(format($q$select public.dm_send(%L, %L)$q$, c, repeat('a', 2001)), '6 tin 2001 ký tự bị chặn');
  perform t.ok(public.dm_send(c, repeat('é', 2000)) = 7, '6 tin đúng 2000 ký tự (có dấu) được nhận');
  perform t.ok((select length(body) from public.dm_messages(c) where seq = 7) = 2000, '6 lưu đủ 2000 ký tự');
  perform t.reset();
  perform t.ok(t.dmrows() = '1/2/7', '6 các tin bị từ chối không để lại dòng nào');
end $$;
do $$ declare c uuid; n int := 0; begin
  select id into c from public.dm_conversations limit 1;
  perform t.as_user('A');
  begin
    for i in 1..40 loop perform public.dm_send(c, 'spam ' || i); n := n + 1; end loop;
  exception when sqlstate '54000' then null;
  end;
  perform t.ok(n between 20 and 30, format('6 giới hạn tốc độ: dừng sau %s tin trong một phút (≤30)', n));
  perform t.reset();
end $$;

-- ── 7. Thầy ↔ học viên: nhánh quyền lớp CHƯA triển khai (chờ helper canonical) ──
do $$ declare c uuid; begin
  perform t.as_user('T');
  perform t.ok(not public.dm_can_message(t.u('C')), '7 Thầy ↔ học viên KHÔNG bạn: hiện CHƯA cho (nhánh quyền lớp đang dừng, có chủ đích)');
  perform t.fails($q$select * from public.dm_start(t.u('C'), 'chào em')$q$, '7 dm_start Thầy → học viên không bạn: bị chặn');
  perform t.as_user('C');
  perform t.fails($q$select * from public.dm_start(t.u('T'), 'chào thầy')$q$, '7 học viên → Thầy không bạn: bị chặn');
  perform t.reset();
  -- Thầy là bạn accepted như mọi thành viên Class → nhắn bình thường
  perform t.friends('T', 'C', 'accepted');
  perform t.as_user('T');
  perform t.ok(public.dm_can_message(t.u('C')), '7 Thầy đã là bạn của C: nhắn được (luật bạn bè chung)');
  select conversation_id into c from public.dm_start(t.u('C'), 'chào em');
  perform t.as_user('C');
  perform t.ok(public.dm_unread_count() = 1 and (select peer_role = 'teacher' from public.dm_conversations()), '7 C thấy tin của Thầy, vai trò teacher');
  perform t.reset();
end $$;

-- ── 8. Ràng buộc schema: chuẩn tắc theo cặp, sender_kind ──
do $$ begin
  delete from public.dm_messages where false;
  perform t.ok((select count(*) from public.dm_conversations where user_lo >= user_hi) = 0, '8 mọi hội thoại có user_lo < user_hi');
  begin
    insert into public.dm_conversations (user_lo, user_hi) values (t.u('B'), t.u('A'));
    raise exception 'FAIL: chèn cặp ngược thứ tự lại được';
  exception when check_violation then raise notice 'PASS: 8 cặp ngược thứ tự bị CHECK chặn';
  end;
  begin
    insert into public.dm_conversations (user_lo, user_hi) values (t.u('A'), t.u('B'));
    raise exception 'FAIL: chèn trùng cặp lại được';
  exception when unique_violation then raise notice 'PASS: 8 trùng cặp bị UNIQUE chặn (một hội thoại chuẩn tắc cho mỗi cặp)';
  end;
  begin
    insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body)
      values ((select id from public.dm_conversations limit 1), 999, 'user', null, 'x');
    raise exception 'FAIL: tin user không người gửi lại được';
  exception when check_violation then raise notice 'PASS: 8 sender_kind=user bắt buộc có sender_id';
  end;
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body)
    values ((select id from public.dm_conversations limit 1), 998, 'mira', null, 'chuẩn bị cho sau này');
  raise notice 'PASS: 8 schema sẵn chỗ cho sender_kind=mira (chưa dùng)';
  delete from public.dm_messages where seq = 998;
end $$;
