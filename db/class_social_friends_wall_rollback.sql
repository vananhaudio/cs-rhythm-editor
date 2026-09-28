-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK db/class_social_friends_wall_setup.sql — đưa Social về như trước Bạn bè/Tường.
-- ⚠ XOÁ mọi quan hệ bạn bè và mọi bài viết trên tường (type='status'). Trả bài giữ nguyên.
-- ⚠ Mục 6 mở lại policy rộng cho edu_students (email/SĐT đọc được lẫn nhau) — chỉ chạy nếu
--   thật sự cần quay về trạng thái cũ; nhớ bỏ 'friendships','edu_students' khỏi self_managed.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) RPC + helper mới
drop function if exists public.get_user_wall(uuid, timestamptz, uuid, int);
drop function if exists public.get_user_profile(uuid);
drop function if exists public.incoming_friend_requests();
drop function if exists public.my_friends();
drop function if exists public.unfriend(uuid);
drop function if exists public.respond_friend_request(uuid, boolean);
drop function if exists public.send_friend_request(uuid);
drop function if exists public.friendship_status(uuid);

-- 2) Bài: bỏ bài tường, trả policy/feed/bình luận về bản learning loop
delete from public.class_posts where type = 'status' or audience = 'friends';

drop policy if exists class_posts_member_read on public.class_posts;
create policy class_posts_member_read on public.class_posts
  for select to authenticated
  using (public.is_class_member() and (hidden_at is null or public.is_teacher()));
drop policy if exists class_posts_own_insert on public.class_posts;
create policy class_posts_own_insert on public.class_posts
  for insert to authenticated
  with check (author_user_id = auth.uid() and public.is_class_member() and type = 'assignment'
              and media_type = 'external_video' and media_url is not null);
drop policy if exists class_posts_own_update on public.class_posts;
create policy class_posts_own_update on public.class_posts
  for update to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid() and type = 'assignment'
              and media_type = 'external_video' and media_url is not null);

create or replace function public.class_posts_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.author_user_id := old.author_user_id;
  new.created_at     := old.created_at;
  new.updated_at     := now();
  if not public.is_teacher() then
    new.hidden_at := old.hidden_at;
    new.hidden_by := old.hidden_by;
  end if;
  return new;
end $$;

create or replace function public.class_post_visible(p_post_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_class_member() and exists (
    select 1 from public.class_posts p
    where p.id = p_post_id and (p.hidden_at is null or public.is_teacher())
  );
$$;

drop policy if exists cct_member_read on public.class_comment_tags;
create policy cct_member_read on public.class_comment_tags
  for select to authenticated using (public.is_class_member());
drop policy if exists ccr_member_read on public.class_comment_resources;
create policy ccr_member_read on public.class_comment_resources
  for select to authenticated using (public.is_class_member());

create or replace function public.class_feed(
  p_before timestamptz default null, p_before_id uuid default null, p_limit int default 20
)
returns table(
  id uuid, type text, body text,
  media_type text, media_provider text, media_url text, external_media_id text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text,
  author_role text, author_ht_member boolean, is_mine boolean,
  is_hidden boolean, comment_count int
)
language sql security definer set search_path = '' stable as $$
  select p.id, p.type, p.body,
         p.media_type, p.media_provider, p.media_url, p.external_media_id,
         p.created_at, p.updated_at,
         p.author_user_id, idn.name, idn.avatar_url, idn.role, idn.ht_member,
         p.author_user_id = auth.uid(),
         p.hidden_at is not null,
         (select count(*)::int from public.class_post_comments c
           where c.post_id = p.id and (c.hidden_at is null or public.is_teacher()))
  from public.class_posts p
  cross join lateral public.class_public_identity(p.author_user_id) idn
  where public.is_class_member()
    and (p.hidden_at is null or public.is_teacher())
    and (p_before is null or p.created_at < p_before
         or (p.created_at = p_before and p_before_id is not null and p.id < p_before_id))
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.class_comments_for_posts(p_post_ids uuid[], p_per_post int default 3)
returns table(
  id uuid, post_id uuid, parent_comment_id uuid, body text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text, author_role text,
  is_mine boolean, is_hidden boolean, tags jsonb, resources jsonb,
  post_comment_count int
)
language sql security definer set search_path = '' stable as $$
  select c.id, c.post_id, c.parent_comment_id, c.body, c.created_at, c.updated_at,
         c.author_user_id, idn.name, idn.avatar_url, idn.role,
         c.author_user_id = auth.uid(), c.hidden_at is not null,
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
                     from public.class_comment_tags ct join public.class_tags t on t.id = ct.tag_id
                    where ct.comment_id = c.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object(
                      'id', r.id, 'resource_type', r.resource_type, 'resource_id', r.resource_id, 'title', r.title_snapshot,
                      'start_seconds', r.start_seconds, 'end_seconds', r.end_seconds, 'excerpt', r.excerpt)
                    order by r.sort_order)
                     from public.class_comment_resources r where r.comment_id = c.id), '[]'::jsonb),
         (select count(*)::int from public.class_post_comments c2
           where c2.post_id = p.id and (c2.hidden_at is null or public.is_teacher()))
  from (select unnest(p_post_ids[1:50]) as pid) ids
  join public.class_posts p on p.id = ids.pid
  cross join lateral (
    select * from public.class_post_comments c0
    where c0.post_id = p.id and (c0.hidden_at is null or public.is_teacher())
    order by c0.seq desc
    limit least(greatest(coalesce(p_per_post, 3), 1), 200)
  ) c
  cross join lateral public.class_public_identity(c.author_user_id) idn
  where public.is_class_member()
    and (p.hidden_at is null or public.is_teacher())
  order by c.post_id, c.seq;
$$;

drop index if exists public.class_posts_wall_idx;
alter table public.class_posts drop constraint if exists class_posts_status_content_check;
alter table public.class_posts drop constraint if exists class_posts_audience_type_check;
alter table public.class_posts drop constraint if exists class_posts_type_check;
alter table public.class_posts add constraint class_posts_type_check
  check (type in ('assignment', 'question', 'practice'));
alter table public.class_posts drop constraint if exists class_posts_audience_check;
alter table public.class_posts drop column if exists audience;

-- 3) Helper + bảng bạn bè (sau khi không còn policy/hàm nào dùng)
drop function if exists public.can_view_wall(uuid);
drop function if exists public.is_friend_of(uuid);
drop function if exists public.is_class_member_user(uuid);
drop table if exists public.friendships;

-- 4) edu_students: về policy rộng cũ của rls_setup.sql (xem cảnh báo đầu file)
drop policy if exists edu_students_own_or_teacher_read on public.edu_students;
drop policy if exists edu_students_own_or_teacher_update on public.edu_students;
drop policy if exists edu_students_teacher_insert on public.edu_students;
drop policy if exists edu_students_teacher_delete on public.edu_students;
drop policy if exists rls_authenticated_all on public.edu_students;
create policy rls_authenticated_all on public.edu_students
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
