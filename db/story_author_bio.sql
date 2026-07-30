-- =====================================================================
-- 1001 CÂU CHUYỆN — "ĐÔI NÉT VỀ NGƯỜI KỂ"
-- Project Supabase: wojmdilyflffvdtpovmq · chạy trong SQL Editor
--
-- Phần giới thiệu TÁC GIẢ của tác phẩm, in ở cuối bài viết.
-- KHÔNG phải hồ sơ người dùng → lưu THEO TỪNG CÂU CHUYỆN, không lưu
-- vào edu_students. Mỗi bài người kể tự quyết định chia sẻ gì.
--
-- AN TOÀN: chỉ THÊM cột. Idempotent — chạy lại nhiều lần vô hại.
-- Ảnh chân dung dùng lại bucket 'story-photos' sẵn có (thư mục {uid}/).
-- =====================================================================

alter table public.stories
  -- Thông tin cơ bản (người kể tự nhập, có thể bỏ trống)
  add column if not exists author_full_name   text,
  add column if not exists author_age         int,
  add column if not exists author_hometown    text,   -- quê quán
  add column if not exists author_living_in   text,   -- nơi đang sinh sống
  add column if not exists author_job         text,   -- nghề nghiệp
  -- Đoạn giới thiệu (Ban biên tập được sửa câu chữ, KHÔNG đổi nội dung)
  add column if not exists author_bio         text,
  -- Ảnh chân dung — 1 ảnh, để Ban biên tập dùng ở cuối bài
  add column if not exists author_portrait_url text,
  -- Hai xác nhận riêng cho phần này (bắt buộc trước khi gửi)
  add column if not exists consent_bio_edit    boolean not null default false,
  add column if not exists consent_bio_publish boolean not null default false;

NOTIFY pgrst, 'reload schema';
