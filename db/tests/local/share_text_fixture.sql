-- TEST-ONLY (DB tạm): khối VĂN BẢN thêm vào cuối Buổi 1 (lớp TH01) cho E2E/DB test Contextual Share V2. KHÔNG dùng cho production.
-- Phủ cả 6 loại khối MVP + tiếng Việt NFC/NFD + emoji + ô '___' + đoạn lặp.
update public.class_lesson_content
   set blocks = blocks || jsonb_build_array(
     jsonb_build_object('kind', 'study', 'tag', 'ÔN TẬP', 'title', 'Ôn tập 7 ngày', 'blocks', jsonb_build_array(
       jsonb_build_object('b', 'h', 'text', 'Ngày 1 — Nghe nhịp chùm ba'),
       jsonb_build_object('b', 'p', 'text', 'Giữ nhịp thật đều. Hãy nghe kỹ nhịp chùm ba ở ô 2 và ô 3 trong cả bài, đếm một-và-a hai-và-a trước khi thêm lời hát.'),
       jsonb_build_object('b', 'ul', 'items', jsonb_build_array('Khởi động ngón cái chậm rãi', 'Đếm nhịp chùm ba thật to', 'Đàn 🎸 từng ô một, đừng vội')),
       jsonb_build_object('b', 'table', 'rows', jsonb_build_array(jsonb_build_array('Ô', 'Việc cần làm'), jsonb_build_array('1', 'Đếm chậm cùng máy nhịp'), jsonb_build_array('2', '___'))),
       jsonb_build_object('b', 'callout', 'label', 'LỖI DỄ MẮC', 'text', 'Vội nhịp ở ô thứ ba, nên hãy nghe kỹ giai điệu trước khi đàn nhé.'),
       jsonb_build_object('b', 'p', 'text', 'Ghi chú cuối ngày: giữ ngón cái đều tay, đừng để cổ tay gồng cứng.'))),
     jsonb_build_object('kind', 'note', 'title', 'Ghi chú của Thầy', 'text', 'Đàn 🎸 hay lắm! Hãy giữ đều tay và nghe kỹ nhịp chùm ba mỗi ngày nhé.'),
     jsonb_build_object('kind', 'note', 'text', normalize('Tiếng Việt tổ hợp: giữ đều tay, nghe kỹ nhịp chùm ba ở ô ba.', NFD)),
     jsonb_build_object('kind', 'objectives', 'title', 'Mục tiêu tuần này', 'items', jsonb_build_array('Đàn đều tay ở tốc độ chậm', 'Nghe được nhịp chùm ba')),
     jsonb_build_object('kind', 'recap', 'title', 'Ôn lại', 'steps', jsonb_build_array(jsonb_build_object('label', 'Tuần trước', 'items', jsonb_build_array('Đã học nốt C và Am', 'Đã tập chuyển hợp âm chậm')))),
     jsonb_build_object('kind', 'assignment', 'title', 'Bài tập về nhà', 'items', jsonb_build_array(jsonb_build_object('label', 'Bài 1', 'text', 'Quay một đoạn ngắn đàn chậm đều tay rồi gửi cho Thầy.'))),
     jsonb_build_object('kind', 'checklist', 'title', 'Kiểm tra nhanh', 'items', jsonb_build_array('Tay phải thả lỏng', 'Tay trái bấm gọn đúng ô'))
   )
 where session_id = '51000000-0000-4000-8000-000000000001';
