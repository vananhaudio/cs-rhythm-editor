-- ═══ TEST Chat List V2 (db/chat_list_v2_setup.sql) ═══
-- Chạy qua scripts/test-chat-list-v2-db.sh trên cluster PostgreSQL TẠM (preamble schema t do runner nối vào đầu file).
-- A,B,C = học sinh · D = học sinh chưa có hội thoại · T = Thầy (không thuộc Band) · S = Admin "đồng hành" (V1.3) · N = tài khoản ngoài Class.
-- Band: X (A,B) · Y (C) · Z (không ai) · + Band hàng loạt cho giới hạn ghim.
\set ON_ERROR_STOP on

create function t.friends(x text, y text) returns void language sql security definer as $$
  insert into public.friendships (requester_id, addressee_id, status, responded_at) values (t.u(x), t.u(y), 'accepted', now())
$$;
create function t.keys(p_rows text[]) returns text language sql immutable as $$ select array_to_string(p_rows, ',') $$;
create function t.inbox_keys(p_args text) returns text language plpgsql as $$ declare r text; begin
  execute 'select coalesce(string_agg(name, '','' order by ord), '''') from (select name, row_number() over () ord from public.chat_inbox(' || p_args || ')) z' into r;
  return r;
end $$;
create function t.bc_conv() returns text language sql security definer as $$
  select id::text from public.dm_conversations where user_lo = least(t.u('B'), t.u('C')) and user_hi = greatest(t.u('B'), t.u('C'))
$$;
grant execute on all functions in schema t to anon, authenticated;

-- dữ liệu nền (bỏ qua RLS: chạy với tư cách postgres)
do $$ declare c1 uuid; c2 uuid; begin
  perform t.friends('A', 'B'); perform t.friends('A', 'C'); perform t.friends('B', 'C');
  perform t.as_user('A');
  select conversation_id into c1 from public.dm_start(t.u('B'), 'chào Bình');         -- A↔B
  select conversation_id into c2 from public.dm_start(t.u('C'), 'chào Chi');          -- A↔C
  perform public.bandchat_send(t.band('X'), 'nhóm X xin chào');
  perform t.as_user('B'); perform public.dm_send(c1, 'chào An');                       -- A có 1 tin chưa đọc từ B
  perform public.bandchat_send(t.band('X'), 'tập lúc 7h');                             -- A có tin Band chưa đọc
  perform t.as_user('C'); perform public.bandchat_send(t.band('Y'), 'Y chào');
  perform public.dm_start(t.u('B'), 'Chi gửi Bình');                                    -- B↔C (A không được thấy)
  perform t.reset();
end $$;

-- ── 0. Khoá + quyền gọi ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select * from public.chat_pins$q$, '0a KHÔNG đọc thẳng chat_pins');
  perform t.fails($q$insert into public.chat_pins (user_id, conv_key) values (t.u('A'), t.band('X')::text)$q$, '0b KHÔNG ghi thẳng chat_pins');
  perform t.fails($q$select * from public.chat_inbox_base('mine')$q$, '0c chat_inbox_base là hàm nội bộ');
  perform t.as_anon();
  perform t.fails($q$select * from public.chat_inbox()$q$, '0d anon không gọi được chat_inbox');
  perform t.fails($q$select * from public.chat_inbox_summary()$q$, '0e anon không gọi được chat_inbox_summary');
  perform t.fails($q$select public.chat_pin_set(t.band('X')::text, true)$q$, '0f anon không ghim được');
  perform t.fails($q$select * from public.chat_conversation_info(t.band('X')::text)$q$, '0g anon không gọi được chat_conversation_info');
  perform t.reset();
end $$;

-- ── a. Danh sách của A: DM + Band mình thuộc, mới nhất trước, dữ liệu khớp luật cũ ──
do $$ declare r record; legacy text; v2 text; begin
  perform t.as_user('A');
  perform t.ok((select count(*) from public.chat_inbox()) = 3, 'a1 A thấy đúng 3 hội thoại (DM Bình, DM Chi, Band X)');
  perform t.ok(not exists (select 1 from public.chat_inbox() where name in ('Band Y', 'Band Z')), 'a2 A không thấy Band Y/Z');
  select * into r from public.chat_inbox() where kind = 'band';
  perform t.ok(r.name = 'Band X' and r.conv_key = 'band:' || t.band('X')::text and r.unread = 1 and r.can_send and r.member_count = 2 and not r.support and not r.pinned,
               'a3 hàng Band X: conv_key band:<id>, 1 chưa đọc, gửi được, 2 thành viên');
  select * into r from public.chat_inbox() where name = 'Bình';
  perform t.ok(r.kind = 'dm' and r.unread = 1 and r.last_body = 'chào An' and r.last_mine = false and r.can_send and r.peer_id = t.u('B'), 'a4 hàng DM Bình: 1 chưa đọc, tin cuối của Bình');
  perform t.ok((select array_agg(name order by sort_at desc, conv_key) from public.chat_inbox()) = (select array_agg(name) from public.chat_inbox()), 'a5 thứ tự mặc định = mới nhất trước');
  -- tương thích luật cũ: cùng tập (khoá, số chưa đọc) với dm_conversations_safe + bandchat_rooms (bỏ hàng hỗ trợ)
  select string_agg(k || '=' || u, ',' order by k) into legacy from (
    select conversation_id::text k, unread u from public.dm_conversations_safe(100)
    union all select 'band:' || band_id::text, unread from public.bandchat_rooms(100) where not support) z;
  select string_agg(conv_key || '=' || unread, ',' order by conv_key) into v2 from public.chat_inbox();
  perform t.ok(legacy = v2, 'a6 TƯƠNG THÍCH: cùng hội thoại + cùng số chưa đọc với dm_conversations_safe/bandchat_rooms');
  perform t.ok((select unread_dm + unread_band from public.chat_inbox_summary()) = 2 and (select dm_total from public.chat_inbox_summary()) = 2
               and (select band_total from public.chat_inbox_summary()) = 1 and (select class_total from public.chat_inbox_summary()) = 0, 'a7 summary: 2 DM, 1 Band, 0 lớp, 2 hội thoại chưa đọc');
  perform t.as_user('D');
  perform t.ok((select count(*) from public.chat_inbox()) = 0 and (select dm_total + band_total from public.chat_inbox_summary()) = 0, 'a8 D chưa có hội thoại → danh sách rỗng, summary 0');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.chat_inbox()) = 0, 'a9 N (ngoài Class, ngoài Band) → rỗng, không lỗi');
  perform t.reset();
end $$;

-- ── b. Lọc theo loại + chưa đọc ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(t.inbox_keys($q$p_kind => 'dm'$q$) in ('Bình,Chi', 'Chi,Bình'), 'b1 lọc Cá nhân: chỉ DM');
  perform t.ok(t.inbox_keys($q$p_kind => 'band'$q$) = 'Band X', 'b2 lọc Band: chỉ Band X');
  perform t.ok(t.inbox_keys($q$p_kind => 'class'$q$) = '', 'b3 lọc Lớp học: rỗng (chưa có nhóm lớp) — không lỗi');
  perform t.ok((select count(*) from public.chat_inbox(p_unread => true)) = 2 and not exists (select 1 from public.chat_inbox(p_unread => true) where name = 'Chi'), 'b4 Chưa đọc: Bình + Band X, không có Chi (đã đọc)');
  perform t.ok(t.inbox_keys($q$p_kind => 'band', p_unread => true$q$) = 'Band X', 'b5 kết hợp Band + Chưa đọc');
  perform t.ok(t.inbox_keys($q$p_kind => 'dm', p_unread => true$q$) = 'Bình', 'b6 kết hợp Cá nhân + Chưa đọc');
  perform t.ok(t.err($q$select * from public.chat_inbox(p_kind => 'zzz')$q$) like '22023:%', 'b7 kind lạ bị từ chối');
  perform t.ok(t.err($q$select * from public.chat_inbox(p_scope => 'zzz')$q$) like '22023:%', 'b8 scope lạ bị từ chối');
  perform t.ok(t.err($q$select * from public.chat_inbox(p_pinned => 'zzz')$q$) like '22023:%', 'b9 pinned lạ bị từ chối');
  perform t.reset();
end $$;

-- ── c. Tìm kiếm: không dấu/không phân biệt hoa-thường, thoát ký tự đặc biệt, KHÔNG rò rỉ ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(t.inbox_keys($q$p_query => 'binh'$q$) = 'Bình', 'c1 "binh" tìm được "Bình" (bỏ dấu)');
  perform t.ok(t.inbox_keys($q$p_query => 'BÌNH'$q$) = 'Bình', 'c2 "BÌNH" tìm được "Bình" (hoa/thường + dấu)');
  perform t.ok(t.inbox_keys($q$p_query => '  band x '$q$) = 'Band X', 'c3 tìm Band theo tên, bỏ khoảng trắng hai đầu');
  perform t.ok(t.inbox_keys($q$p_query => '%'$q$) = '', 'c4 "%" không khớp tất cả (đã thoát ký tự đặc biệt)');
  perform t.ok(t.inbox_keys($q$p_query => '_'$q$) = '', 'c5 "_" không khớp mọi ký tự');
  perform t.ok(t.inbox_keys($q$p_query => '\'$q$) = '', 'c6 dấu \ không gây lỗi');
  perform t.ok(t.inbox_keys($q$p_query => ''$q$) <> '', 'c7 truy vấn rỗng = không lọc');
  perform t.ok(t.inbox_keys($q$p_query => 'band y'$q$) = '' and t.inbox_keys($q$p_query => 'band z'$q$) = '', 'c8 RÒ RỈ: A tìm "Band Y"/"Band Z" (không thuộc) → không thấy');
  perform t.ok(t.inbox_keys($q$p_query => 'chi'$q$) = 'Chi', 'c9 A tìm "chi" → chỉ DM của chính mình với Chi (không phải hội thoại B↔C)');
  perform t.as_user('D');
  perform t.ok(t.inbox_keys($q$p_query => 'chi'$q$) = '' and t.inbox_keys($q$p_query => 'band'$q$) = '' and t.inbox_keys($q$p_query => 'binh'$q$) = '', 'c10 RÒ RỈ: D tìm mọi tên → rỗng');
  perform t.as_user('C');
  perform t.ok(t.inbox_keys($q$p_query => 'band x'$q$) = '' and t.inbox_keys($q$p_query => 'band y'$q$) = 'Band Y', 'c11 C chỉ tìm thấy Band của mình');
  perform t.ok(not exists (select 1 from public.chat_inbox(p_query => 'an') where name = 'Bình' and last_body = 'chào An'), 'c12 C tìm "an": không thấy nội dung hội thoại A↔B');
  perform t.as_user('N');
  perform t.ok(t.inbox_keys($q$p_query => 'band'$q$) = '' and t.inbox_keys($q$p_query => 'an'$q$) = '', 'c13 RÒ RỈ: N (ngoài Class) tìm → rỗng');
  perform t.as_user('A');
  perform t.ok(t.inbox_keys($q$p_query => 'band', p_scope => 'support'$q$) = '', 'c14 RÒ RỈ: học sinh dùng scope support → rỗng (không phải Thầy)');
  perform t.reset();
end $$;

-- ── d. Phân trang con trỏ ──
do $$ declare c_at timestamptz; c_key text; seen text[] := '{}'; n int := 0; r record; total int; pg int := 0; begin
  -- hai hội thoại cùng thời điểm để thử tie-break theo conv_key
  update public.dm_conversations set last_message_at = (select max(last_message_at) from public.dm_conversations) where id in (select conversation_id from public.dm_participants where user_id = t.u('A'));
  perform t.as_user('A');
  select count(*) into total from public.chat_inbox();
  loop
    pg := pg + 1; exit when pg > 20;
    n := 0;
    for r in select * from public.chat_inbox(p_limit => 1, p_cursor_at => c_at, p_cursor_key => c_key) loop
      seen := seen || r.conv_key; c_at := r.sort_at; c_key := r.conv_key; n := n + 1;
    end loop;
    exit when n = 0;
  end loop;
  perform t.ok(array_length(seen, 1) = total and (select count(distinct x) from unnest(seen) x) = total, 'd1 duyệt từng trang 1 hàng: đủ ' || total || ' hội thoại, không lặp, không sót (kể cả cùng thời điểm)');
  perform t.ok((select count(*) from public.chat_inbox(p_limit => 0)) = 1, 'd2 p_limit 0 → ít nhất 1');
  perform t.ok((select count(*) from public.chat_inbox(p_limit => 100000)) = 3, 'd3 p_limit khổng lồ bị chặn ở 50 (ở đây chỉ có 3)');
  perform t.ok((select count(*) from public.chat_inbox(p_cursor_at => '2100-01-01', p_cursor_key => 'a')) = 3, 'd4 con trỏ tương lai → trả từ đầu');
  perform t.reset();
end $$;

-- ── e. Ghim ──
do $$ declare n int; begin
  perform t.as_user('A');
  n := public.chat_pin_set('band:' || t.band('X')::text, true);
  perform t.ok(n = 1, 'e1 A ghim Band X → 1 ghim');
  n := public.chat_pin_set('band:' || t.band('X')::text, true);
  perform t.ok(n = 1, 'e2 ghim lại = idempotent, vẫn 1');
  n := public.chat_pin_set((select conv_key from public.chat_inbox() where name = 'Bình'), true);
  perform t.ok(n = 2, 'e3 A ghim thêm DM Bình → 2 ghim');
  perform t.ok(t.inbox_keys($q$p_pinned => 'only'$q$) = 'Bình,Band X', 'e4 mục Đã ghim: ghim sau đứng trước');
  perform t.ok(t.inbox_keys($q$p_pinned => 'exclude'$q$) = 'Chi', 'e5 danh sách thường không lặp hội thoại đã ghim');
  perform t.ok((select count(*) from public.chat_inbox(p_pinned => 'any')) = 3 and (select count(*) from public.chat_inbox(p_pinned => 'any') where pinned) = 2, 'e6 tìm kiếm (any) thấy cả đã ghim, đánh dấu pinned');
  perform t.ok(t.inbox_keys($q$p_query => 'band', p_pinned => 'any'$q$) = 'Band X', 'e7 tìm kiếm trong cả hội thoại đã ghim');
  perform t.ok((select pinned_total from public.chat_inbox_summary()) = 2, 'e8 summary.pinned_total = 2');
  perform t.ok((select pinned from public.chat_conversation_info('band:' || t.band('X')::text)), 'e9 conversation_info báo pinned');
  perform t.as_user('B');
  perform t.ok(not exists (select 1 from public.chat_inbox(p_pinned => 'any') where pinned), 'e10 ghim của A không hiện với B (theo từng tài khoản)');
  perform t.ok(t.err($q$select public.chat_pin_set(t.band('Y')::text, true)$q$) like 'P0002:%', 'e11 B KHÔNG ghim được Band Y (không thuộc)');
  perform t.as_user('A');
  perform t.ok(t.err($q$select public.chat_pin_set(gen_random_uuid()::text, true)$q$) like 'P0002:%', 'e12 ghim id không tồn tại → P0002');
  perform t.ok(t.err($q$select public.chat_pin_set('band:' || t.band('Y')::text, true)$q$) like 'P0002:%', 'e13 A KHÔNG ghim được Band Y');
  perform t.ok(t.err(format($q$select public.chat_pin_set(%L, true)$q$, t.bc_conv())) like 'P0002:%', 'e14 A KHÔNG ghim được hội thoại B↔C của người khác');
  perform t.as_user('A');
  n := public.chat_pin_set('band:' || t.band('X')::text, false);
  perform t.ok(n = 1 and t.inbox_keys($q$p_pinned => 'only'$q$) = 'Bình', 'e15 bỏ ghim Band X → còn 1');
  n := public.chat_pin_set('band:' || t.band('X')::text, false);
  perform t.ok(n = 1, 'e16 bỏ ghim lần nữa = idempotent');
  perform t.reset();
  perform t.ok((select count(*) from public.chat_pins) = 1, 'e17 chỉ còn đúng 1 dòng chat_pins (của A)');
end $$;

-- ── f. Giới hạn 10 ghim + ghim cũ không còn hiệu lực khi mất quyền ──
do $$ declare i int; b uuid; n int; begin
  for i in 1..12 loop
    b := ('22222222-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    insert into public.teamlab_bands (id, project_id, name) values (b, '11111111-0000-4000-8000-0000000000b1', 'Bulk ' || lpad(i::text, 2, '0'));
    insert into public.teamlab_band_members (band_id, user_id) values (b, t.u('A'));
  end loop;
  perform t.as_user('A');
  for i in 1..9 loop n := public.chat_pin_set('band:22222222-0000-4000-8000-' || lpad(i::text, 12, '0'), true); end loop;
  perform t.ok(n = 10, 'f1 A ghim tới đúng 10');
  perform t.ok(t.err($q$select public.chat_pin_set('band:22222222-0000-4000-8000-000000000010', true)$q$) like '54000:%', 'f2 ghim thứ 11 bị từ chối (54000)');
  perform t.ok(public.chat_pin_set('band:22222222-0000-4000-8000-000000000001', true) = 10, 'f3 ghim lại cái đã ghim khi đủ 10 vẫn idempotent');
  perform t.ok(public.chat_pin_set('band:22222222-0000-4000-8000-000000000001', false) = 9 and public.chat_pin_set('band:22222222-0000-4000-8000-000000000010', true) = 10, 'f4 bỏ một cái → ghim được cái khác');
  -- A rời Bulk 10 → ghim cũ biến mất khỏi danh sách và không ghim lại được
  perform t.reset();
  delete from public.teamlab_band_members where band_id = '22222222-0000-4000-8000-000000000010' and user_id = t.u('A');
  perform t.as_user('A');
  perform t.ok(not exists (select 1 from public.chat_inbox(p_pinned => 'any') where name = 'Bulk 10'), 'f5 mất quyền → hội thoại đã ghim không còn trong danh sách');
  perform t.ok(t.err($q$select public.chat_pin_set('band:22222222-0000-4000-8000-000000000010', true)$q$) like 'P0002:%', 'f6 mất quyền → không ghim lại được');
  perform t.reset();
end $$;

-- ── g. Thầy/Admin: quản lý nhiều Band ở scope support, không tràn danh sách chính ──
do $$ declare r record; begin
  perform t.as_user('T');
  perform t.ok((select count(*) from public.chat_inbox()) = 0, 'g1 Thầy không thuộc Band nào → danh sách chính rỗng (không tràn Band)');
  perform t.ok((select count(*) from public.chat_inbox(p_scope => 'support')) = 15 and (select bool_and(support) from public.chat_inbox(p_scope => 'support')),
               'g2 scope support: đủ 15 Band (X,Y,Z + 12 bulk), tất cả support=true');
  perform t.ok((select support_total from public.chat_inbox_summary()) = 15 and (select band_total from public.chat_inbox_summary()) = 0, 'g3 summary: support_total = 15, band_total = 0');
  perform t.ok(t.inbox_keys($q$p_scope => 'support', p_query => 'bulk 07'$q$) = 'Bulk 07', 'g4 tìm trong khu quản lý Band theo tên');
  perform t.ok(t.inbox_keys($q$p_scope => 'support', p_query => 'band z'$q$) = 'Band Z', 'g5 thấy cả Band chưa có phòng/tin (Band Z)');
  perform t.ok((select count(*) from public.chat_inbox(p_scope => 'support') where unread > 0) = 0 and (select not bool_or(can_send) from public.chat_inbox(p_scope => 'support')), 'g6 Thầy thường: hỗ trợ chỉ đọc, 0 chưa đọc');
  -- phân trang khu quản lý
  perform t.ok((select count(*) from public.chat_inbox(p_scope => 'support', p_limit => 10)) = 10, 'g7 trang đầu 10 hàng');
  select * into r from (select * from public.chat_inbox(p_scope => 'support', p_limit => 10) order by sort_at desc, conv_key offset 9) z limit 1;
  perform t.ok((select count(*) from public.chat_inbox(p_scope => 'support', p_limit => 10, p_cursor_at => r.sort_at, p_cursor_key => r.conv_key)) = 5, 'g8 trang 2 = 5 hàng còn lại (tổng 15)');
  perform t.ok(exists (select 1 from public.chat_conversation_info('band:' || t.band('Y')::text) where support and not can_send), 'g9 info Band Y cho Thầy: support, chỉ đọc');
  perform t.as_user('S');
  perform t.ok((select can_send from public.chat_inbox(p_scope => 'support', p_query => 'band y')), 'g10 Admin đồng hành (V1.3) gửi được ở Band ngoài — luật bandchat_access giữ nguyên');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.chat_inbox(p_scope => 'support')) = 0 and (select support_total from public.chat_inbox_summary()) = 0, 'g11 học sinh: scope support rỗng, support_total = 0');
  perform t.reset();
end $$;

-- ── h. conversation_info: đúng quyền ──
do $$ begin
  perform t.as_user('A');
  perform t.ok((select count(*) from public.chat_conversation_info('band:' || t.band('X')::text)) = 1, 'h1 A xem info Band X');
  perform t.ok((select count(*) from public.chat_conversation_info('band:' || t.band('Y')::text)) = 0, 'h2 RÒ RỈ: A xem info Band Y → không có');
  perform t.ok((select count(*) from public.chat_conversation_info(t.bc_conv())) = 0, 'h3 RÒ RỈ: A xem info hội thoại B↔C → không có');
  perform t.ok((select count(*) from public.chat_conversation_info('rác')) = 0, 'h4 khoá rác → không có, không lỗi');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.chat_conversation_info('band:' || t.band('X')::text)) = 0, 'h5 N không xem được');
  perform t.reset();
end $$;

-- ── i. Chặn người dùng + Band lưu trữ ──
do $$ begin
  perform t.reset();
  insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('A'), t.u('C'));
  perform t.as_user('A');
  perform t.ok(t.inbox_keys($q$p_query => 'chi'$q$) = '' and not exists (select 1 from public.chat_inbox() where name = 'Chi'), 'i1 A chặn Chi → hội thoại biến mất khỏi danh sách và tìm kiếm');
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.chat_inbox() where name = 'An'), 'i2 Chi (bị chặn) cũng không thấy hội thoại với An');
  perform t.reset();
  delete from public.class_user_blocks;
  -- lưu trữ Band X bởi Thầy: A, B (đóng băng) thấy chỉ đọc; C (không thuộc X) vẫn không thấy
  perform t.as_user('T'); perform public.bandchat_set_archived(t.band('X'), true);
  perform t.as_user('A');
  perform t.ok((select archived and not can_send from public.chat_inbox(p_query => 'band x')), 'i4 Band lưu trữ: A thấy archived, không gửi được');
  perform t.as_user('C');
  perform t.ok(t.inbox_keys($q$p_query => 'band x'$q$) = '', 'i5 Band lưu trữ vẫn không lộ cho người ngoài');
  perform t.as_user('T'); perform public.bandchat_set_archived(t.band('X'), false);
  perform t.reset();
end $$;

-- ── j. Cô lập tin nhắn: chat_inbox không trả nội dung ngoài 160 ký tự, không thêm đường ghi ──
do $$ begin
  perform t.as_user('A');
  perform public.bandchat_send(t.band('X'), repeat('x', 400));
  perform t.ok((select length(last_body) from public.chat_inbox(p_query => 'band x')) = 160, 'j1 xem trước cắt 160 ký tự như luật cũ');
  perform t.reset();
  perform t.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'chat\_%' and not p.prosecdef and p.proname <> 'chat_fold') = 0,
               'j2 mọi hàm chat_* (trừ chat_fold thuần) là SECURITY DEFINER');
  perform t.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'chat\_%' and p.prosecdef
                  and not (p.proconfig @> array['search_path=""'])) = 0, 'j3 search_path rỗng ở mọi hàm SECURITY DEFINER');
end $$;
select 'DONE' as chat_list_v2_test;
