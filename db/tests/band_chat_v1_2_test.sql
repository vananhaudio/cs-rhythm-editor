-- ═══ TEST Band Chat V1.2 — Thầy/Admin thấy mọi Band ở mục Hỗ trợ (db/band_chat_v1_2_support_list_setup.sql) ═══
-- Chạy qua scripts/test-band-chat-v1-db.sh (helper schema t do runner nối vào đầu file; chỉ cluster TẠM).
-- Band X (A,B) · Y (C) · Z (không ai, có thể chưa có phòng). T = Thầy ngoài mọi Band.
\set ON_ERROR_STOP on
create function t.band(k text) returns uuid language sql immutable as $$
  select case k when 'X' then '11111111-0000-4000-8000-0000000000a1'::uuid
                when 'Y' then '11111111-0000-4000-8000-0000000000a2'::uuid
                when 'Z' then '11111111-0000-4000-8000-0000000000a3'::uuid end
$$;
grant execute on function t.band(text) to anon, authenticated;

do $$ declare n0 text; r record; begin
  perform t.reset();
  n0 := t.rows();
  perform t.ok(n0 = '0/0/0', '0 chưa có phòng/tin nào ('||n0||')');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 3, '1a Thầy ngoài Band thấy CẢ 3 Band dù chưa có phòng/tin');
  perform t.ok((select bool_and(support and not can_send and unread = 0 and last_seq = 0) from public.bandchat_rooms()), '1b mọi nhóm đều support, không gửi được, không chưa đọc');
  perform t.ok((select count(*) from public.bandchat_rooms() where band_id = t.band('Z')) = 1, '1c Band không có thành viên nào vẫn hiện');
  perform t.reset();
  perform t.ok(t.rows() = n0, '1d liệt kê KHÔNG tạo phòng ('||t.rows()||')');
  perform t.as_user('T');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('Z'), 'x')$q$) like '42501:%', '1e Thầy vẫn KHÔNG gửi được vào Band chưa có phòng');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('Z'))) = 0, '1f mở nhóm chưa có tin: rỗng, không lỗi');
  perform t.reset();
  perform t.ok(t.rows() = n0, '1g mở/xem không tạo phòng');
end $$;

do $$ begin
  perform t.as_user('A');
  perform t.ok((select array_agg(band_id) from public.bandchat_rooms()) = array[t.band('X')], '2a học viên chỉ thấy Band mình');
  perform t.ok((select bool_and(not support and can_send) from public.bandchat_rooms()), '2b nhóm của mình ở danh sách chính (không support)');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 0, '2c người ngoài Class không thấy gì');
  perform t.reset();
end $$;

-- Thầy là thành viên của một Band: Band đó ở danh sách chính (không trùng), các Band còn lại ở Hỗ trợ
do $$ declare r record; begin
  perform t.reset();
  insert into public.teamlab_band_members (band_id, user_id) values (t.band('Y'), t.u('T'));
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 3 and (select count(distinct band_id) from public.bandchat_rooms()) = 3, '3a Thầy là thành viên Band Y: vẫn 3 nhóm, không trùng');
  select * into r from public.bandchat_rooms() where band_id = t.band('Y');
  perform t.ok(not r.support and r.can_send, '3b Band Y (là thành viên) ở danh sách chính, gửi được');
  perform t.ok((select count(*) from public.bandchat_rooms() where support) = 2, '3c hai Band còn lại ở mục Hỗ trợ');
  perform public.bandchat_send(t.band('Y'), 'Thầy gửi trong Band của mình');
  perform t.reset();
end $$;

-- Band đã bị xoá nhưng còn tin: Thầy vẫn thấy (tên đã lưu); Band còn nguyên không bị loại
do $$ begin
  perform t.as_user('A'); perform public.bandchat_send(t.band('X'), 'tin trước khi xoá Band'); perform t.reset();
  delete from public.teamlab_band_members where band_id = t.band('X');
  delete from public.teamlab_bands where id = t.band('X');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_rooms() where band_id = t.band('X')) = 1, '4a Band đã xoá còn tin: Thầy vẫn thấy nhóm (chỉ đọc)');
  perform t.ok((select count(*) from public.bandchat_rooms()) = 3, '4b Y, Z + nhóm của Band đã xoá');
  perform t.reset();
end $$;
