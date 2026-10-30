-- Rollback Feed Comments V2: gỡ RPC/trigger/bảng feed_comments (XOÁ bình luận thread/publication). Revert frontend TRƯỚC.
-- KHÔNG đụng class_post_comments. Thông báo 'feed_comment' đã tạo bị xoá rồi mới thu hẹp CHECK (về bản V2 System Chat).
drop trigger if exists feed_comment_notify on public.feed_comments;
drop function if exists public.feed_comment_notify();
drop function if exists public.feed_comment_hide(uuid, boolean);
drop function if exists public.feed_comment_delete(text, uuid);
drop function if exists public.feed_comment_edit(text, uuid, text);
drop function if exists public.feed_comment_counts(text[], uuid[]);
drop function if exists public.feed_comment_list(text, uuid, int);
drop function if exists public.feed_comment_add(text, uuid, text, uuid);
drop function if exists public.feed_comment_guard(uuid, text);
drop table if exists public.feed_comments;
delete from public.class_system_notices where kind = 'feed_comment';
alter table public.class_system_notices drop constraint if exists class_system_notices_kind_check;
alter table public.class_system_notices add constraint class_system_notices_kind_check
  check (kind in ('checkpoint_graded', 'submission_received', 'question_received', 'question_answered', 'teacher_commented'));
