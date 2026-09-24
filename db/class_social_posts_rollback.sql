-- ROLLBACK cho db/class_social_posts_setup.sql — gỡ bài đăng cộng đồng Class Social P1.
-- ⚠ XOÁ bảng class_posts cùng MỌI bài đã đăng. Trước khi chạy: sao lưu nếu đã có dữ liệu thật
--   (vd: create table public._backup_class_posts as table public.class_posts;).
-- Code: revert phần Class Social P1 (feed + composer Trả bài) trước hoặc cùng lúc.
begin;
drop function if exists public.class_feed(timestamptz, uuid, int);
drop table if exists public.class_posts;              -- kéo theo policy, index, trigger
drop function if exists public.class_posts_before_update();
drop function if exists public.is_class_member();
commit;
notify pgrst, 'reload schema';
