-- ═══ TEST V1.1: Thầy/Admin thấy mọi lớp còn hoạt động ở mục Hỗ trợ (db/class_room_chat_v1_1_support_list_setup.sql). Chạy SAU inbox_test trên cùng DB tạm. ═══
\set ON_ERROR_STOP on
create function t.cls(k text) returns uuid language sql immutable as $$
  select case k when 'K1' then '22222222-0000-4000-8000-0000000000c1'::uuid when 'K2' then '22222222-0000-4000-8000-0000000000c2'::uuid
                when 'K3' then '22222222-0000-4000-8000-0000000000c3'::uuid when 'K4' then '22222222-0000-4000-8000-0000000000c4'::uuid end $$;
grant execute on function t.cls(text) to anon, authenticated;
do $$ declare r record; begin
  perform t.reset();
  insert into public.class_schedule (id, code, name, status, cohort_group_id) values
    ('22222222-0000-4000-8000-0000000000d5', 'K5', 'Lớp K5 nháp', 'draft', null),
    ('22222222-0000-4000-8000-0000000000d6', 'K6', 'Lớp K6 huỷ chưa tin', 'cancelled', null),
    ('22222222-0000-4000-8000-0000000000d7', 'K7', 'Lớp K7 chưa tin', 'upcoming', null);
  perform t.as_user('G');
  -- K2 (active) và K7 (upcoming) CHƯA từng có tin → vẫn hiện ở hỗ trợ
  perform t.ok(exists (select 1 from public.chat_inbox('support', 'class', null, false, 'any', 50) where conv_key = 'class:' || t.cls('K2') and support and not can_send), 'v1 hộp thư: lớp active chưa tin hiện ở Hỗ trợ (chỉ đọc)');
  perform t.ok(exists (select 1 from public.chat_inbox('support', 'class', null, false, 'any', 50) where conv_key = 'class:22222222-0000-4000-8000-0000000000d7'), 'v2 hộp thư: lớp upcoming chưa tin hiện ở Hỗ trợ');
  perform t.ok(not exists (select 1 from public.chat_inbox('support', 'class', null, false, 'any', 50) where conv_key in ('class:22222222-0000-4000-8000-0000000000d5', 'class:22222222-0000-4000-8000-0000000000d6')), 'v3 lớp nháp/huỷ chưa tin KHÔNG tự hiện');
  perform t.ok(exists (select 1 from public.classchat_rooms() where class_id = t.cls('K2') and support and not can_send and unread = 0), 'v4 classchat_rooms: K2 hỗ trợ, chỉ đọc, không tính chưa đọc');
  perform t.ok(not exists (select 1 from public.classchat_rooms() where class_id in ('22222222-0000-4000-8000-0000000000d5', '22222222-0000-4000-8000-0000000000d6')), 'v5 classchat_rooms: nháp/huỷ chưa tin không hiện');
  perform t.ok(not exists (select 1 from public.chat_inbox('mine', 'class', null, false, 'any', 50)), 'v6 mục chính không lẫn lớp hỗ trợ');
  perform t.ok(t.err($q$select public.classchat_send(t.cls('K2'), 'x')$q$) like '42501%', 'v7 QUYỀN KHÔNG ĐỔI: giáo viên thường vẫn chỉ đọc, không gửi được');
  perform t.ok((select count(*) from public.chat_inbox('support', 'class', null, false, 'any', 50)) >= 3 and (select support_total from public.chat_inbox_summary()) >= 3, 'v8 summary.support_total đếm cả lớp hỗ trợ (K1, K2, K7)');
  -- học viên / người ngoài KHÔNG được thêm gì
  perform t.as_user('A');
  perform t.ok(not exists (select 1 from public.chat_inbox('support', 'class', null, false, 'any', 50)), 'v9 học viên không có mục hỗ trợ');
  perform t.ok(not exists (select 1 from public.classchat_rooms() where class_id = t.cls('K2')), 'v10 học viên A không thấy lớp K2 của người khác');
  perform t.as_user('E');
  perform t.ok(not exists (select 1 from public.classchat_rooms()), 'v11 người không thuộc lớp nào: rỗng');
  perform t.reset();
end $$;
select 'DONE';
