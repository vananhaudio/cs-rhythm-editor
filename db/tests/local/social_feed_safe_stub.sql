-- Chỉ cho E2E: FE của main gọi social_feed_safe (production có từ class_ugc_safety_v1). Stub ủy quyền cho social_feed.
create or replace function public.social_feed_safe(p_before timestamptz default null, p_before_key text default null, p_limit int default 20)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql security definer set search_path = '' stable as $$ select * from public.social_feed(p_before, p_before_key, p_limit) $$;
grant execute on function public.social_feed_safe(timestamptz, text, int) to authenticated;
create or replace function public.class_comments_for_posts_safe(p_post_ids uuid[], p_per_post int default 3)
returns table(
  id uuid, post_id uuid, parent_comment_id uuid, body text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text, author_role text,
  is_mine boolean, is_hidden boolean, tags jsonb, resources jsonb,
  post_comment_count int)
language sql security definer set search_path = '' stable as $$ select * from public.class_comments_for_posts(p_post_ids, p_per_post) $$;
grant execute on function public.class_comments_for_posts_safe(uuid[], int) to authenticated;
