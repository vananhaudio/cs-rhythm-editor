-- ═══ TEST Hộp thư V2 có loại 'class' (db/class_room_chat_v1_inbox_setup.sql). Chạy SAU class_room_chat_v1_test.sql trên cùng DB tạm. ═══
\set ON_ERROR_STOP on
create function t.cls(k text) returns uuid language sql immutable as $$
  select case k when 'K1' then '22222222-0000-4000-8000-0000000000c1'::uuid when 'K2' then '22222222-0000-4000-8000-0000000000c2'::uuid
                when 'K3' then '22222222-0000-4000-8000-0000000000c3'::uuid when 'K4' then '22222222-0000-4000-8000-0000000000c4'::uuid end $$;
grant execute on function t.cls(text) to anon, authenticated;

do $$ declare r record; s record; n int; begin
  perform t.as_user('A');
  select * into r from public.chat_inbox('mine', 'class', null, false, 'any', 50) where conv_key = 'class:' || t.cls('K1');
  perform t.ok(r.kind = 'class' and r.name = 'Lớp K1' and r.can_send and not r.support and not r.archived and r.member_count = 3, 'i1 A thấy class:K1 trong chat_inbox (kind=class, gửi được)');
  perform t.ok((select archived and not can_send from public.chat_inbox('mine', 'class', null, false, 'any', 50) where conv_key = 'class:' || t.cls('K3')), 'i2 lớp huỷ K3: archived + chỉ đọc');
  perform t.ok((select count(*) from public.chat_inbox('mine', 'class', null, false, 'any', 50)) = 3, 'i3 lọc "Lớp học" = 3 lớp của A (K1, K3, K4)');
  perform t.ok((select count(*) from public.chat_inbox('mine', 'dm', null, false, 'any', 50) where kind <> 'dm') = 0
               and (select count(*) from public.chat_inbox('mine', 'band', null, false, 'any', 50) where kind <> 'band') = 0, 'i4 lọc dm/band không lẫn lớp');
  perform t.ok((select count(*) from public.chat_inbox('mine', 'class', 'lop k1', false, 'any', 50)) = 1, 'i5 tìm "lop k1" (không dấu) ra K1');
  select * into s from public.chat_inbox_summary();
  perform t.ok(s.class_total = 3 and s.band_total = 1 and s.unread_class >= 0, 'i6 summary: class_total=3, band_total giữ nguyên (1)');
  perform t.ok(public.chat_pin_set('class:' || t.cls('K1'), true) >= 1, 'i7 ghim lớp');
  perform t.ok((select pinned from public.chat_conversation_info('class:' || t.cls('K1'))), 'i7b conversation_info báo đã ghim');
  perform t.ok(public.chat_pin_set('class:' || t.cls('K1'), false) >= 0, 'i8 bỏ ghim');
  perform t.ok(t.err($q$select public.chat_pin_set('class:22222222-0000-4000-8000-0000000000c2', true)$q$) like 'P0002%', 'i9 không ghim được lớp không thuộc mình');
  perform t.ok(not exists (select 1 from public.chat_conversation_info('class:' || t.cls('K2'))), 'i10 conversation_info không lộ lớp khác');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.chat_inbox('mine', 'all', null, false, 'any', 50) where kind = 'class') = 1, 'i11 C chỉ thấy lớp K2');
  perform t.as_user('E');
  perform t.ok((select count(*) from public.chat_inbox('mine', 'class', null, false, 'any', 50)) = 0 and (select class_total from public.chat_inbox_summary()) = 0, 'i12 E (không lớp): rỗng');
  perform t.as_user('G');
  perform t.ok(exists (select 1 from public.chat_inbox('support', 'class', null, false, 'any', 50) where conv_key = 'class:' || t.cls('K1') and support and not can_send), 'i13 giáo viên ngoài lớp: K1 ở mục hỗ trợ, chỉ đọc');
  perform t.ok(not exists (select 1 from public.chat_inbox('mine', 'class', null, false, 'any', 50)), 'i14 mục hỗ trợ không lẫn vào danh sách chính');
  perform t.as_user('A');
  perform t.ok(not exists (select 1 from public.chat_inbox('support', 'class', null, false, 'any', 50)), 'i15 học viên không có mục hỗ trợ');
  perform t.reset();
end $$;
select 'DONE';
