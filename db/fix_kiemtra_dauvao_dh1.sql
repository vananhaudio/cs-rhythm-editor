-- Fix 2 bài "Kiểm tra đầu vào" của khoá DH1 (Khởi đầu đam mê - Đệm hát cơ bản)
-- Lỗi: tạo nhầm lesson_type='quiz' nhưng content NULL → app học sinh hiện
-- "JSON quiz không hợp lệ hoặc chưa có dữ liệu" (mất chữ, màn trống).
-- Bản chất 2 bài này là bước TỰ XÁC NHẬN điều kiện tiên quyết (DH1 ← NM + NL1)
-- → chuyển về lesson_type='text' + nội dung hướng dẫn; học sinh đọc xong bấm
-- "✓ Đánh dấu đã học". Idempotent — chạy lại vô hại.

-- Bài 1: "Tôi đã hoàn thành khoá Nhập môn guitar"
update public.edu_course_lessons set
  lesson_type = 'text',
  content = '<h3>✅ Xác nhận: bạn đã học xong <b>Nhập môn Guitar</b> chưa?</h3>'
    || '<p>Khoá <b>Đệm hát 1</b> được thiết kế tiếp nối khoá <b>Nhập môn Guitar</b> (miễn phí). '
    || 'Trước khi đi tiếp, bạn cần nắm được: tư thế ôm đàn, tay phải gảy dây, bấm phím kêu rõ tiếng '
    || 'và đọc được sơ đồ hợp âm đơn giản.</p>'
    || '<p><b>Nếu đã hoàn thành:</b> bấm nút <b>“✓ Đánh dấu đã học”</b> bên dưới để xác nhận và học tiếp.</p>'
    || '<p><b>Nếu chưa:</b> quay lại mục <b>Học</b> → khoá <b>Nhập môn Guitar</b> và hoàn thành trước nhé — '
    || 'vào Đệm hát 1 sẽ nhẹ nhàng hơn rất nhiều.</p>'
where id = '5ed2409d-e7b0-4279-8451-c03b7f6983cb';

-- Bài 2: "Tôi đã hoàn thành khoá học Chìa khoá nhạc lý cơ bản"
update public.edu_course_lessons set
  lesson_type = 'text',
  content = '<h3>✅ Xác nhận: bạn đã học xong <b>Chìa khoá nhạc lý cơ bản</b> chưa?</h3>'
    || '<p>Đệm hát cần nền nhạc lý căn bản: tên nốt, nhịp phách và cách đọc ký hiệu hợp âm. '
    || 'Những kiến thức này nằm trong khoá <b>Chìa khoá nhạc lý cơ bản</b>.</p>'
    || '<p><b>Nếu đã hoàn thành:</b> bấm nút <b>“✓ Đánh dấu đã học”</b> bên dưới để xác nhận và học tiếp.</p>'
    || '<p><b>Nếu chưa:</b> quay lại mục <b>Học</b> → khoá <b>Chìa khoá nhạc lý cơ bản</b> và học trước nhé — '
    || 'các bài đệm hát sẽ dễ hiểu hơn hẳn khi bạn nắm phần nhạc lý này.</p>'
where id = '96055827-23e9-4dba-baa4-79d088a0c883';

-- Kiểm tra sau khi chạy:
--   select id, title, lesson_type, left(content, 60) from public.edu_course_lessons
--   where module_id = 'd28f5327-d7d6-41fe-aa35-d5dd1ca1747d';
