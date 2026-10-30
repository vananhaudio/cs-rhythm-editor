-- Rollback Feed Likes V1: gỡ RPC + bảng (XOÁ MỌI LƯỢT THÍCH). Revert frontend TRƯỚC (bản cũ không gọi các RPC này).
drop function if exists public.feed_like_summary(text[], uuid[]);
drop function if exists public.feed_like_set(text, uuid, boolean);
drop function if exists public.feed_target_visible(text, uuid);
drop table if exists public.feed_likes;
