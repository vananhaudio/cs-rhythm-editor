-- ROLLBACK cho db/class_social_learning_loop_setup.sql — gỡ bình luận/tag/đính kèm/kiểm duyệt,
-- trả class_feed + policy đọc bài về đúng bản P1 (db/class_social_posts_setup.sql).
-- ⚠ XOÁ mọi bình luận, tag, đính kèm. Sao lưu trước nếu đã có dữ liệu thật.
-- Code: revert phần bình luận/nhận xét trước hoặc cùng lúc.
begin;
drop function if exists public.class_comments_for_posts(uuid[], int);
drop function if exists public.class_add_comment(uuid, text, bigint[], jsonb, uuid);
drop function if exists public.class_moderate(text, uuid, boolean);
drop table if exists public.class_comment_resources;
drop table if exists public.class_comment_tags;
drop table if exists public.class_tags;
drop table if exists public.class_post_comments;
drop function if exists public.class_post_comments_before_write();
drop function if exists public.class_post_visible(uuid);
drop function if exists public.class_feed(timestamptz, uuid, int);

drop policy if exists class_posts_member_read on public.class_posts;
create policy class_posts_member_read on public.class_posts
  for select to authenticated using (public.is_class_member());

create or replace function public.class_posts_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.author_user_id := old.author_user_id;
  new.created_at     := old.created_at;
  new.updated_at     := now();
  return new;
end $$;

alter table public.class_posts drop column if exists hidden_by;
alter table public.class_posts drop column if exists hidden_at;
drop function if exists public.class_public_identity(uuid);

-- class_feed về đúng bản P1 (chép từ db/class_social_posts_setup.sql mục 5)
create or replace function public.class_feed(
  p_before    timestamptz default null,
  p_before_id uuid        default null,
  p_limit     int         default 20
)
returns table(
  id uuid, type text, body text,
  media_type text, media_provider text, media_url text, external_media_id text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text,
  author_role text, author_ht_member boolean, is_mine boolean
)
language sql security definer set search_path = '' stable as $$
  select p.id, p.type, p.body,
         p.media_type, p.media_provider, p.media_url, p.external_media_id,
         p.created_at, p.updated_at,
         p.author_user_id,
         coalesce(
           nullif(split_part(trim(s.display_name), '@', 1), ''),
           nullif(split_part(trim(s.full_name), '@', 1), ''),
           nullif(split_part(trim(au.name), '@', 1), ''),
           'Thành viên Class'
         ) as author_name,
         s.avatar_url as author_avatar_url,
         case when au.role in ('teacher', 'admin') then 'teacher' else 'student' end as author_role,
         coalesce(s.ht_member, false) as author_ht_member,
         p.author_user_id = auth.uid() as is_mine
  from public.class_posts p
  left join lateral (
    select es.display_name, es.full_name, es.avatar_url, es.ht_member
    from public.edu_students es
    where es.user_id = p.author_user_id
    order by es.enrolled_at desc nulls last
    limit 1
  ) s on true
  left join public.app_users au on au.id = p.author_user_id
  where public.is_class_member()
    and (
      p_before is null
      or p.created_at < p_before
      or (p.created_at = p_before and p_before_id is not null and p.id < p_before_id)
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.class_feed(timestamptz, uuid, int) from public, anon;
grant execute on function public.class_feed(timestamptz, uuid, int) to authenticated;
commit;
notify pgrst, 'reload schema';
