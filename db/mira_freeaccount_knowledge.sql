-- Thêm 1 thẻ kiến thức cho Mira: hướng dẫn khách tự tạo tài khoản miễn phí.
-- Mira CHỈ DẪN tới nút trên trang, KHÔNG tự nhập hộ email/mật khẩu.
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent.

insert into public.class_ai_knowledge (title, content, enabled, order_index)
select
  'Tài khoản miễn phí (học thử trên app)',
  'Khách có thể TẠO TÀI KHOẢN MIỄN PHÍ để học thử ngay trên app, không cần đóng phí. '
  || 'Tài khoản miễn phí được học trọn khoá Nhập Môn và Nhạc lý cơ bản; các khoá còn lại cần đăng ký học với thầy mới mở. '
  || 'Khi khách muốn thử app, hãy mời khách bấm nút "Tạo tài khoản miễn phí" ngay trên trang này (mục đầu trang). '
  || 'MIRA KHÔNG tự hỏi hay tự nhập email/mật khẩu giúp khách — chỉ hướng dẫn khách tự bấm nút và điền. '
  || 'Sau khi tạo xong, khách đăng nhập trên app tại timming.vananhaudio.com để học.',
  true, 50
where not exists (
  select 1 from public.class_ai_knowledge where title = 'Tài khoản miễn phí (học thử trên app)'
);

notify pgrst, 'reload schema';
