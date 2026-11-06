-- Rollback Feed Comments Paging V1: gỡ hai hàm đọc mới. Không đụng bảng/hàm cũ. Frontend mới tự lùi về hàm cũ khi hàm mới vắng.
drop function if exists public.class_comments_page_safe(uuid, bigint, int);
drop function if exists public.feed_comment_page(text, uuid, bigint, int);
notify pgrst, 'reload schema';
