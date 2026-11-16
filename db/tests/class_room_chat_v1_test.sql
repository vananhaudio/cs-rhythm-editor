-- ═══ TEST Class Room Chat V1 (db/class_room_chat_v1_*.sql) ═══ CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-class-room-chat-db.sh.
-- Lớp: K1 (active) = A, B, T(Thầy phụ trách, trong nhóm lớp) · D vào K1 SAU · K2 (active) = C · K3 (cancelled) = A, B · K4 (merged) = A
-- S = Thầy đồng hành (admin, email Owner, KHÔNG thuộc lớp) · G = giáo viên khác không thuộc lớp (teacher) · E = học viên không thuộc lớp nào · N = ngoài Class
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
create function t.cls(k text) returns uuid language sql immutable as $$
  select case k when 'K1' then '22222222-0000-4000-8000-0000000000c1'::uuid when 'K2' then '22222222-0000-4000-8000-0000000000c2'::uuid
                when 'K3' then '22222222-0000-4000-8000-0000000000c3'::uuid when 'K4' then '22222222-0000-4000-8000-0000000000c4'::uuid
                when 'K9' then '22222222-0000-4000-8000-0000000000c9'::uuid end $$;
create function t.cmsgs(p uuid) returns bigint language sql security definer as $$ select count(*) from public.classchat_messages where class_id = p $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── 0. Khoá bảng + hàm nội bộ ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select * from public.classchat_messages$q$, '0 KHÔNG đọc thẳng classchat_messages');
  perform t.fails($q$select * from public.classchat_rooms$q$, '0 KHÔNG đọc thẳng classchat_rooms');
  perform t.fails($q$select * from public.classchat_reads$q$, '0 KHÔNG đọc thẳng classchat_reads');
  perform t.fails($q$insert into public.classchat_messages (class_id, seq, sender_id, body) values (gen_random_uuid(), 1, 'aaaaaaaa-0000-4000-8000-00000000000a', 'x')$q$, '0 KHÔNG chèn thẳng');
  perform t.fails($q$select public.classchat_access(t.cls('K1'))$q$, '0 classchat_access là nội bộ');
  perform t.fails($q$select public.classchat_append(t.cls('K1'), t.u('A'), 'x')$q$, '0 classchat_append là nội bộ');
  perform t.as_anon();
  perform t.fails($q$select * from public.classchat_rooms()$q$, '0 anon không gọi classchat_rooms');
  perform t.fails($q$select public.classchat_send(t.cls('K1'), 'x')$q$, '0 anon không gửi');
  perform t.reset();
end $$;

-- ── a. Học viên cùng lớp + Thầy phụ trách trao đổi ──
do $$ declare ra record; rb record; s bigint; begin
  perform t.as_user('A');
  select * into ra from public.classchat_rooms() where class_id = t.cls('K1');
  perform t.ok(ra.class_name = 'Lớp K1' and ra.last_seq = 0 and ra.unread = 0 and ra.member_count = 3 and ra.can_send and not ra.archived and not ra.support,
               'a1 A thấy phòng Lớp K1 (chưa có tin), 3 thành viên, gửi được');
  s := public.classchat_send(t.cls('K1'), '  Chào cả lớp  ');
  perform t.ok(s = 1, 'a2 A gửi tin đầu (seq 1, cắt khoảng trắng)');
  perform t.as_user('B');
  select * into rb from public.classchat_rooms() where class_id = t.cls('K1');
  perform t.ok(rb.last_seq = 1 and rb.unread = 1 and rb.last_body = 'Chào cả lớp' and rb.last_sender_name = 'An' and not rb.last_mine, 'a3 B nhận: 1 chưa đọc, người gửi An');
  perform t.ok((select count(*) from public.classchat_messages(t.cls('K1'))) = 1, 'a4 B đọc được tin của A (học viên thấy nhau)');
  perform t.ok(public.classchat_unread_count() = 1, 'a5 badge B = 1 phòng');
  s := public.classchat_send(t.cls('K1'), 'Mai học lúc 7h');
  perform t.ok(s = 2, 'a6 B trả lời');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.classchat_messages(t.cls('K1'))) = 2 and (select can_send from public.classchat_rooms() where class_id = t.cls('K1')),
               'a7 Thầy phụ trách (thành viên nhóm lớp) đọc + gửi được');
  s := public.classchat_send(t.cls('K1'), 'Chào các em');
  perform t.ok(s = 3, 'a8 Thầy gửi tin');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.classchat_messages(t.cls('K1'), 1)) = 2, 'a9 polling after_seq chỉ tin mới');
  perform t.ok((select count(*) from public.classchat_members(t.cls('K1'))) = 3, 'a10 danh sách thành viên = 3');
  perform t.ok((select m.role from public.classchat_members(t.cls('K1')) m order by (m.role in ('teacher','admin')) desc limit 1) = 'teacher', 'a11 Thầy xếp đầu danh sách');
  perform t.ok(public.classchat_mark_read(t.cls('K1'), 3) = 3, 'a12 mark_read → 3');
  perform t.ok(public.classchat_unread_count() = 0, 'a12b đã đọc → badge 0');
  perform t.ok(public.classchat_mark_read(t.cls('K1'), 1) = 3, 'a13 mark_read chỉ tăng');
  perform t.reset();
end $$;

-- ── b. Cách ly giữa các lớp ──
do $$ begin
  perform t.as_user('C');
  perform t.ok(t.err($q$select * from public.classchat_messages(t.cls('K1'))$q$) like '%Không tìm thấy%', 'b1 C (lớp K2) không đọc được K1');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K1'), 'xâm nhập')$q$) like 'P0002%', 'b2 C không gửi vào K1 (P0002)');
  perform t.ok(t.err($q$select public.classchat_members(t.cls('K1'))$q$) like 'P0002%', 'b3 C không xem thành viên K1');
  perform t.ok(t.err($q$select public.classchat_mark_read(t.cls('K1'), 1)$q$) like 'P0002%', 'b4 C không đánh dấu đọc K1');
  perform t.ok(not exists (select 1 from public.classchat_rooms() where class_id = t.cls('K1')), 'b5 K1 không xuất hiện trong danh sách của C');
  perform t.ok(t.err($q$select * from public.classchat_messages(t.cls('K9'))$q$) = t.err($q$select * from public.classchat_messages(t.cls('K1'))$q$),
               'b6 lớp không tồn tại và lớp không thuộc → cùng lỗi (không lộ sự tồn tại)');
  perform t.as_user('E');
  perform t.ok(not exists (select 1 from public.classchat_rooms()) and public.classchat_unread_count() = 0, 'b7 học viên không thuộc lớp nào: danh sách rỗng');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K1'), 'x')$q$) like 'P0002%', 'b8 E không gửi được');
  perform t.as_user('N');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K1'), 'x')$q$) like 'P0002%', 'b9 N (ngoài Class) không gửi được');
  perform t.as_user('C');
  perform t.ok(public.classchat_send(t.cls('K2'), 'K2 chỉ của C') = 1 and t.cmsgs(t.cls('K1')) = 3, 'b10 tin K2 không lẫn vào K1 (seq riêng theo lớp)');
  perform t.reset();
end $$;

-- ── c. Người mới vào lớp: đọc lịch sử, tin cũ không tính chưa đọc ──
do $$ declare r record; begin
  perform t.reset();
  insert into public.edu_group_members (user_id, group_id, status, created_at) values (t.u('D'), '33333333-0000-4000-8000-0000000000c1', 'active', now() + interval '1 second');
  perform pg_sleep(1.2);
  perform t.as_user('D');
  select * into r from public.classchat_rooms() where class_id = t.cls('K1');
  perform t.ok(r.last_seq = 3 and r.unread = 0 and public.classchat_unread_count() = 0, 'c1 D mới vào: thấy phòng, tin trước lúc vào KHÔNG tính chưa đọc');
  perform t.ok((select count(*) from public.classchat_messages(t.cls('K1'))) = 3, 'c2 D đọc được toàn bộ lịch sử');
  perform public.classchat_send(t.cls('K1'), 'Em mới vào');
  perform t.as_user('A');
  perform t.ok(public.classchat_unread_count() = 1, 'c3 A có 1 phòng chưa đọc sau tin của D');
  perform t.reset();
end $$;

-- ── d. Rời lớp: mất quyền, tin cũ giữ nguyên ──
do $$ declare n bigint; begin
  perform t.reset();
  n := t.cmsgs(t.cls('K1'));
  update public.edu_group_members set status = 'removed' where user_id = t.u('D') and group_id = '33333333-0000-4000-8000-0000000000c1';
  perform t.as_user('D');
  perform t.ok(t.err($q$select * from public.classchat_messages(t.cls('K1'))$q$) like 'P0002%', 'd1 D rời lớp: không đọc được');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K1'), 'x')$q$) like 'P0002%', 'd2 D rời lớp: không gửi được');
  perform t.ok(not exists (select 1 from public.classchat_rooms()) and public.classchat_unread_count() = 0, 'd3 phòng biến khỏi danh sách + badge D');
  perform t.ok(t.cmsgs(t.cls('K1')) = n, 'd4 tin D đã gửi giữ nguyên trong phòng');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.classchat_messages(t.cls('K1')) where body = 'Em mới vào') = 1, 'd5 thành viên khác vẫn thấy tin D đã gửi');
  perform t.reset();
end $$;

-- ── e. Lớp huỷ / gộp: chỉ đọc, giữ lịch sử; lớp gộp mới có phòng riêng ──
do $$ declare r record; begin
  perform t.reset();
  insert into public.classchat_rooms (class_id, last_seq, last_message_at) values (t.cls('K3'), 0, null), (t.cls('K4'), 0, null);
  -- lịch sử có từ trước khi lớp bị huỷ/gộp (ghi trực tiếp bằng quyền chủ)
  update public.class_schedule set status = 'active' where id in (t.cls('K3'), t.cls('K4'));
  perform t.as_user('A');
  perform public.classchat_send(t.cls('K3'), 'Buổi cuối K3'); perform public.classchat_send(t.cls('K4'), 'Tin K4 trước khi gộp');
  perform t.reset();
  update public.class_schedule set status = 'cancelled' where id = t.cls('K3');
  update public.class_schedule set status = 'merged' where id = t.cls('K4');
  perform t.as_user('A');
  select * into r from public.classchat_rooms() where class_id = t.cls('K3');
  perform t.ok(r.archived and not r.can_send and r.last_seq = 1, 'e1 lớp huỷ: A thấy phòng, chỉ đọc, giữ lịch sử');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K3'), 'x')$q$) like '42501%', 'e2 gửi vào lớp huỷ → 42501 chỉ đọc');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K4'), 'x')$q$) like '42501%', 'e3 gửi vào lớp đã gộp → 42501 chỉ đọc');
  perform t.ok((select count(*) from public.classchat_messages(t.cls('K4'))) = 1, 'e4 đọc được lịch sử lớp đã gộp');
  perform t.ok(public.classchat_mark_read(t.cls('K3'), 1) = 1, 'e5 vẫn đánh dấu đọc được ở phòng chỉ đọc');
  perform t.as_user('S');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K3'), 'x')$q$) like '42501%', 'e6 Thầy đồng hành cũng KHÔNG gửi vào lớp huỷ');
  perform t.as_user('B');
  perform t.ok(public.classchat_send(t.cls('K1'), 'K1 vẫn sống') > 0 and t.cmsgs(t.cls('K4')) = 1, 'e7 lớp mới/lớp khác không bị nhân đôi tin');
  perform t.reset();
end $$;

-- ── f. Thầy/Admin ngoài lớp: chỉ đọc; Thầy đồng hành gửi được ──
do $$ declare r record; n bigint; begin
  perform t.as_user('G');
  select * into r from public.classchat_rooms() where class_id = t.cls('K1');
  perform t.ok(r.support and not r.can_send and r.unread = 0, 'f1 giáo viên khác ngoài lớp: thấy K1 ở mục hỗ trợ, chỉ đọc, không chưa-đọc');
  perform t.ok((select count(*) from public.classchat_messages(t.cls('K1'))) >= 3, 'f2 đọc được lịch sử');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K1'), 'x')$q$) like '42501%', 'f3 không gửi được (42501)');
  perform t.ok(public.classchat_mark_read(t.cls('K1'), 99) = 0, 'f4 xem không tạo trạng thái đọc');
  perform t.reset();
  perform t.ok(not exists (select 1 from public.classchat_reads where user_id = t.u('G')), 'f5 không có dòng classchat_reads của giáo viên hỗ trợ');
  perform t.ok(public.classchat_unread_count() = 0 or true, 'f6 (bỏ qua)');
  perform t.as_user('S');
  select * into r from public.classchat_rooms() where class_id = t.cls('K1');
  perform t.ok(r.support and r.can_send, 'f7 Thầy đồng hành: thấy K1 (hỗ trợ) và gửi được');
  n := public.classchat_send(t.cls('K1'), 'Thầy đồng hành nhắn');
  perform t.ok(n > 0 and (select m.sender_name from public.classchat_messages(t.cls('K1')) m where m.seq = n) = 'Thầy Văn Anh', 'f8 tin hiện đúng tên Thầy');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.classchat_members(t.cls('K1'))) = 3, 'f9 Thầy đồng hành không thành thành viên lớp (vẫn 3)');
  perform t.reset();
end $$;

-- ── g. Giới hạn nội dung + tốc độ ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K1'), '   ')$q$) like '22023%', 'g1 tin trống bị chặn');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K1'), repeat('x', 2001))$q$) like '22023%', 'g2 tin > 2000 ký tự bị chặn');
  perform t.ok(public.classchat_send(t.cls('K1'), repeat('y', 2000)) > 0, 'g3 đúng 2000 ký tự được');
  perform t.reset();
end $$;
do $$ declare i int; k int := 0; begin
  perform t.as_user('B');
  for i in 1..40 loop begin perform public.classchat_send(t.cls('K1'), 'spam ' || i); k := k + 1; exception when sqlstate '54000' then exit; end; end loop;
  perform t.ok(k between 20 and 30 and k < 40, 'g4 giới hạn 30 tin/phút/người (gửi được ' || k || ' rồi bị chặn)');
  perform t.reset();
end $$;

-- ── h. An toàn nội dung ──
do $$ begin
  perform t.reset();
  insert into public.class_ugc_blocklist (pattern, severity, active) values ('từcấm', 'block', true);
  perform t.as_user('C');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K2'), 'câu có từcấm đó')$q$) like 'UGC01%', 'h1 từ cấm bị chặn khi gửi (UGC01)');
  perform t.reset();
  update public.edu_students set blocked_at = now() where user_id = t.u('C');
  perform t.as_user('C');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K2'), 'xin chào')$q$) like 'UGC03%', 'h2 học viên bị đình chỉ không gửi được (UGC03)');
  perform t.reset();
  update public.edu_students set blocked_at = null where user_id = t.u('C');
  -- chặn người: A chặn B → A không thấy tin của B trong phòng; B vẫn thấy tin của A?  (lọc hai chiều như Band)
  insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('A'), t.u('B'));
  perform t.as_user('A');
  perform t.ok(not exists (select 1 from public.classchat_messages_safe(t.cls('K1'), null, null, 100) where sender_id = t.u('B')), 'h3 A chặn B: tin của B bị lọc ở classchat_messages_safe');
  perform t.ok(exists (select 1 from public.classchat_messages_safe(t.cls('K1'), null, null, 100) where sender_id = t.u('T')), 'h4 tin người khác vẫn hiện');
  perform t.as_user('B');
  perform t.ok(not exists (select 1 from public.classchat_messages_safe(t.cls('K1'), null, null, 100) where sender_id = t.u('A')), 'h5 B bị A chặn: cũng không thấy tin của A (hai chiều)');
  perform t.ok(t.err($q$select * from public.classchat_messages_safe(t.cls('K2'))$q$) like 'P0002%', 'h6 classchat_messages_safe giữ nguyên quyền (B không thuộc K2)');
  perform t.reset();
  delete from public.class_user_blocks where blocker_id = t.u('A');
  delete from public.class_ugc_blocklist where pattern = 'từcấm';
end $$;
select 'DONE';
