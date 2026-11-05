-- TEST-ONLY (DB tạm): thêm vào cuối Buổi 1 một khối HÌNH (sơ đồ cần đàn — không có lá văn bản / bản nhạc) và một khối study ngắn,
-- để khoanh HỖN HỢP: [checklist chữ] + [sơ đồ cần đàn] + [study chữ]. Chạy SAU share_text_fixture.sql. KHÔNG dùng cho production.
update public.class_lesson_content
   set blocks = blocks || jsonb_build_array(
     jsonb_build_object('kind', 'fretboard', 'title', 'Sơ đồ vùng bấm', 'lead', 'Hình minh hoạ vị trí các nốt trên cần đàn.', 'frets', 5,
       'zones', jsonb_build_array(jsonb_build_object('no', 1, 'label', 'Vùng 1 — Đầu cần', 'fromFret', 0, 'toFret', 3, 'strings', jsonb_build_array(1, 6))),
       'dots', jsonb_build_array(jsonb_build_object('string', 2, 'fret', 1, 'name', 'C', 'zone', 1, 'root', true), jsonb_build_object('string', 4, 'fret', 2, 'name', 'E', 'zone', 1))),
     jsonb_build_object('kind', 'study', 'tag', 'THỰC HÀNH', 'title', 'Luyện tập sau sơ đồ', 'blocks', jsonb_build_array(
       jsonb_build_object('b', 'h', 'text', 'Bước 1 — Đặt tay trái'),
       jsonb_build_object('b', 'p', 'text', 'Đặt ngón trỏ ở ngăn một dây hai, giữ cổ tay thẳng và thả lỏng vai trước khi bấm.'),
       jsonb_build_object('b', 'ol', 'items', jsonb_build_array('Bấm nốt Đô thật rõ tiếng', 'Thả ra rồi bấm lại ba lần', 'Nghỉ hai nhịp rồi lặp lại'))))
   )
 where session_id = '51000000-0000-4000-8000-000000000001';
