-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — BẠN BÈ + TƯỜNG CÁ NHÂN (Social V1). CHƯA CHẠY. Idempotent.
-- Chạy SAU: community_setup.sql → class_social_posts_setup.sql → class_social_learning_loop_setup.sql
--           → profile_media_setup.sql. Rollback: db/class_social_friends_wall_rollback.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-friends-wall-db.sh
--
-- Owner chốt (28/09/2026):
--   • Bạn bè kiểu Facebook: lời mời → Chấp nhận/Từ chối; pending KHÔNG phải bạn; Huỷ kết bạn.
--   • Mỗi người một tường. Tường = bài 'friends' (đăng lên tường) + Trả bài của người đó.
--     Chỉ CHÍNH CHỦ, BẠN BÈ (accepted) và THẦY/ADMIN (kiểm duyệt) xem được tường.
--   • Trả bài vẫn là bài 'class' — feed Cộng đồng + vòng nhận xét của Thầy giữ nguyên.
--   • Bài 'friends' KHÔNG vào feed Cộng đồng; người chưa là bạn KHÔNG lấy được bài 'friends'
--     qua bảng, RPC hay bình luận (thực thi ở RLS + SECURITY DEFINER, không chỉ ẩn ở React).
--
-- Định danh người = auth.users.id. Hồ sơ công khai chỉ: user_id, tên hiển thị, avatar, ảnh bìa,
-- vai trò (teacher|student). KHÔNG email/SĐT/level/XP/gói/học tập.
--
-- ⚠ Production cấp mặc định MỌI quyền bảng + EXECUTE hàm mới cho anon/authenticated
--   (default privileges) → mọi bảng/hàm dưới đây REVOKE tường minh.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Quan hệ bạn bè ──────────────────────────────────────────────────────
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
alter table public.friendships drop constraint if exists friendships_status_check;
alter table public.friendships add constraint friendships_status_check
  check (status in ('pending', 'accepted', 'declined'));
alter table public.friendships drop constraint if exists friendships_not_self;
alter table public.friendships add constraint friendships_not_self check (requester_id <> addressee_id);
-- MỘT quan hệ cho mỗi cặp, bất kể ai gửi trước
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

-- Không ai (kể cả chính chủ) đọc/ghi thẳng bảng: mọi thao tác qua RPC bên dưới.
alter table public.friendships enable row level security;
revoke all on public.friendships from public, anon, authenticated;

-- ── 2) Helper ──────────────────────────────────────────────────────────────
-- Một tài khoản bất kỳ có phải thành viên Class (có hồ sơ học sinh, hoặc là thầy/admin)
create or replace function public.is_class_member_user(p_user uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select p_user is not null and (
    exists (select 1 from public.edu_students s where s.user_id = p_user)
    or exists (select 1 from public.app_users au where au.id = p_user and au.role in ('teacher', 'admin'))
  );
$$;
revoke all on function public.is_class_member_user(uuid) from public, anon, authenticated;   -- chỉ dùng nội bộ

-- Người đang đăng nhập có là BẠN (accepted) của p_other không. Chỉ tiết lộ quan hệ CỦA CHÍNH MÌNH.
create or replace function public.is_friend_of(p_other uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and p_other is not null and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(auth.uid(), p_other)
      and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_other)
  );
$$;
revoke all on function public.is_friend_of(uuid) from public, anon;
grant execute on function public.is_friend_of(uuid) to authenticated;   -- cần cho policy của class_posts

-- Được xem tường của p_user: chính mình | bạn bè | thầy/admin (kiểm duyệt) — và phải là thành viên Class
create or replace function public.can_view_wall(p_user uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_class_member() and p_user is not null and (
    p_user = auth.uid() or public.is_teacher() or public.is_friend_of(p_user)
  );
$$;
revoke all on function public.can_view_wall(uuid) from public, anon;
grant execute on function public.can_view_wall(uuid) to authenticated;

-- ── 3) Bài đăng: quyền xem (audience) + loại "bài viết trên tường" ─────────
alter table public.class_posts add column if not exists audience text not null default 'class';
alter table public.class_posts drop constraint if exists class_posts_audience_check;
alter table public.class_posts add constraint class_posts_audience_check check (audience in ('class', 'friends'));

alter table public.class_posts drop constraint if exists class_posts_type_check;
alter table public.class_posts add constraint class_posts_type_check
  check (type in ('assignment', 'question', 'practice', 'status'));
-- Trả bài luôn thuộc Class (Thầy nhận xét); bài viết trên tường luôn chỉ bạn bè và phải có nội dung
alter table public.class_posts drop constraint if exists class_posts_audience_type_check;
alter table public.class_posts add constraint class_posts_audience_type_check
  check ((type = 'status') = (audience = 'friends'));
alter table public.class_posts drop constraint if exists class_posts_status_content_check;
alter table public.class_posts add constraint class_posts_status_content_check
  check (type <> 'status' or char_length(btrim(body)) > 0 or media_url is not null);
create index if not exists class_posts_wall_idx on public.class_posts (author_user_id, created_at desc, id desc);

-- Sửa bài: không đổi tác giả/thời điểm/loại/quyền xem; cờ ẩn chỉ thầy
create or replace function public.class_posts_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.author_user_id := old.author_user_id;
  new.created_at     := old.created_at;
  new.type           := old.type;
  new.audience       := old.audience;
  new.updated_at     := now();
  if not public.is_teacher() then
    new.hidden_at := old.hidden_at;
    new.hidden_by := old.hidden_by;
  end if;
  return new;
end $$;

-- Luật đọc MỘT bài (dùng chung cho bảng, bình luận, tag, đính kèm):
--   thành viên Class + (chưa ẩn | thầy) + (bài Class | chính chủ | thầy | bạn của tác giả)
drop policy if exists class_posts_member_read on public.class_posts;
create policy class_posts_member_read on public.class_posts
  for select to authenticated
  using (
    public.is_class_member()
    and (hidden_at is null or public.is_teacher())
    and (audience = 'class' or author_user_id = auth.uid() or public.is_teacher() or public.is_friend_of(author_user_id))
  );

drop policy if exists class_posts_own_insert on public.class_posts;
create policy class_posts_own_insert on public.class_posts
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and public.is_class_member()
    and (
      (type = 'assignment' and audience = 'class' and media_type = 'external_video' and media_url is not null)
      or (type = 'status' and audience = 'friends' and (media_type is null or media_type = 'external_video'))
    )
  );

drop policy if exists class_posts_own_update on public.class_posts;
create policy class_posts_own_update on public.class_posts
  for update to authenticated
  using (author_user_id = auth.uid())
  with check (
    author_user_id = auth.uid()
    and (
      (type = 'assignment' and audience = 'class' and media_type = 'external_video' and media_url is not null)
      or (type = 'status' and audience = 'friends' and (media_type is null or media_type = 'external_video'))
    )
  );
-- class_posts_own_delete giữ nguyên (chỉ tác giả).

create or replace function public.class_post_visible(p_post_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_class_member() and exists (
    select 1 from public.class_posts p
    where p.id = p_post_id
      and (p.hidden_at is null or public.is_teacher())
      and (p.audience = 'class' or p.author_user_id = auth.uid() or public.is_teacher() or public.is_friend_of(p.author_user_id))
  );
$$;
revoke all on function public.class_post_visible(uuid) from public, anon;
grant execute on function public.class_post_visible(uuid) to authenticated;
-- cpc_member_read / cpc_own_insert đã dùng class_post_visible → bình luận theo đúng luật bài.

-- Tag + đính kèm: chỉ đọc được khi đọc được BÌNH LUẬN chứa nó (RLS của bình luận áp trong subquery)
drop policy if exists cct_member_read on public.class_comment_tags;
create policy cct_member_read on public.class_comment_tags
  for select to authenticated
  using (exists (select 1 from public.class_post_comments c where c.id = comment_id));
drop policy if exists ccr_member_read on public.class_comment_resources;
create policy ccr_member_read on public.class_comment_resources
  for select to authenticated
  using (exists (select 1 from public.class_post_comments c where c.id = comment_id));

-- ── 4) Feed Cộng đồng: CHỈ bài 'class' (bài tường không lọt vào feed chung) ──
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
    and p.audience = 'class'
    and (p.hidden_at is null or public.is_teacher())
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

-- Bình luận theo lô: thêm luật audience (trước đây chỉ kiểm member + ẩn)
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
    and (p.audience = 'class' or p.author_user_id = auth.uid() or public.is_teacher() or public.is_friend_of(p.author_user_id))
  order by c.post_id, c.seq;
$$;
revoke all on function public.class_comments_for_posts(uuid[], int) from public, anon;
grant execute on function public.class_comments_for_posts(uuid[], int) to authenticated;

-- ── 5) RPC bạn bè ──────────────────────────────────────────────────────────
-- Trạng thái nhìn từ phía người gọi: self | none | outgoing | incoming | friends
-- Bị từ chối: người gửi vẫn thấy 'outgoing' (không lộ việc bị từ chối, không gửi dồn được);
--             người đã từ chối thấy 'none' (có thể tự gửi lời mời sau).
create or replace function public.friendship_status(p_user uuid)
returns text language sql security definer set search_path = '' stable as $$
  select case
    when auth.uid() is null or p_user is null then 'none'
    when p_user = auth.uid() then 'self'
    else coalesce((
      select case
        when f.status = 'accepted' then 'friends'
        when f.requester_id = auth.uid() then 'outgoing'                    -- pending hoặc declined
        when f.status = 'pending' then 'incoming'
        else 'none'                                                          -- mình đã từ chối
      end
      from public.friendships f
      where least(f.requester_id, f.addressee_id) = least(auth.uid(), p_user)
        and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_user)
    ), 'none')
  end;
$$;
revoke all on function public.friendship_status(uuid) from public, anon;
grant execute on function public.friendship_status(uuid) to authenticated;

create or replace function public.send_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); f public.friendships;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if p_user is null or p_user = v_me then raise exception 'Không thể kết bạn với chính mình' using errcode = '22023'; end if;
  if not public.is_class_member_user(p_user) then raise exception 'Không tìm thấy thành viên' using errcode = 'P0002'; end if;

  -- Khoá theo cặp: hai người bấm cùng lúc không tạo hai hàng
  perform pg_advisory_xact_lock(hashtextextended(least(v_me, p_user)::text || greatest(v_me, p_user)::text, 7));
  select * into f from public.friendships
   where least(requester_id, addressee_id) = least(v_me, p_user)
     and greatest(requester_id, addressee_id) = greatest(v_me, p_user)
   for update;

  if f.id is null then
    insert into public.friendships (requester_id, addressee_id, status) values (v_me, p_user, 'pending');
    return 'outgoing';
  end if;
  if f.status = 'accepted' then return 'friends'; end if;
  if f.requester_id = v_me then return 'outgoing'; end if;                    -- đã gửi (kể cả bị từ chối): không gửi dồn
  if f.status = 'pending' then                                              -- họ đã gửi cho mình → coi như chấp nhận
    update public.friendships set status = 'accepted', responded_at = now() where id = f.id;
    return 'friends';
  end if;
  -- Mình từng từ chối họ, nay tự gửi lời mời → lời mời mới do mình gửi
  update public.friendships set requester_id = v_me, addressee_id = p_user, status = 'pending',
         created_at = now(), responded_at = null
   where id = f.id;
  return 'outgoing';
end $$;
revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if p_accept is null then raise exception 'Thiếu lựa chọn' using errcode = '22023'; end if;
  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where requester_id = p_user and addressee_id = v_me and status = 'pending'
  returning id into v_id;
  if v_id is null then raise exception 'Không có lời mời kết bạn này' using errcode = 'P0002'; end if;
  return case when p_accept then 'friends' else 'none' end;
end $$;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Huỷ kết bạn, hoặc rút lại lời mời mình đã gửi. Lời mời mình đã TỪ CHỐI thì giữ nguyên.
create or replace function public.unfriend(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  delete from public.friendships
   where least(requester_id, addressee_id) = least(v_me, p_user)
     and greatest(requester_id, addressee_id) = greatest(v_me, p_user)
     and (status = 'accepted' or requester_id = v_me);
  return public.friendship_status(p_user);
end $$;
revoke all on function public.unfriend(uuid) from public, anon;
grant execute on function public.unfriend(uuid) to authenticated;

create or replace function public.my_friends()
returns table(user_id uuid, name text, avatar_url text, cover_url text, role text, since timestamptz)
language sql security definer set search_path = '' stable as $$
  select o.uid, idn.name, idn.avatar_url, pm.cover_url, idn.role, coalesce(f.responded_at, f.created_at)
  from public.friendships f
  cross join lateral (select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as uid) o
  cross join lateral public.class_public_identity(o.uid) idn
  left join public.profile_media pm on pm.user_id = o.uid
  where public.is_class_member()
    and f.status = 'accepted'
    and auth.uid() in (f.requester_id, f.addressee_id)
  order by idn.name, o.uid;
$$;
revoke all on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

create or replace function public.incoming_friend_requests()
returns table(user_id uuid, name text, avatar_url text, role text, requested_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select f.requester_id, idn.name, idn.avatar_url, idn.role, f.created_at
  from public.friendships f
  cross join lateral public.class_public_identity(f.requester_id) idn
  where public.is_class_member()
    and f.addressee_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;
revoke all on function public.incoming_friend_requests() from public, anon;
grant execute on function public.incoming_friend_requests() to authenticated;

-- Hồ sơ công khai TỐI THIỂU của một thành viên (ai trong Class cũng xem được) + quan hệ với mình
create or replace function public.get_user_profile(p_user uuid)
returns table(user_id uuid, name text, avatar_url text, cover_url text, role text,
              relationship text, can_view_wall boolean)
language sql security definer set search_path = '' stable as $$
  select p_user, idn.name, idn.avatar_url, pm.cover_url, idn.role,
         public.friendship_status(p_user), public.can_view_wall(p_user)
  from public.class_public_identity(p_user) idn
  left join public.profile_media pm on pm.user_id = p_user
  where public.is_class_member() and public.is_class_member_user(p_user);
$$;
revoke all on function public.get_user_profile(uuid) from public, anon;
grant execute on function public.get_user_profile(uuid) to authenticated;

-- Tường: bài của p_user (Trả bài + bài viết trên tường). Không được xem → KHÔNG trả hàng nào.
create or replace function public.get_user_wall(
  p_user      uuid,
  p_before    timestamptz default null,
  p_before_id uuid        default null,
  p_limit     int         default 20
)
returns table(
  id uuid, type text, body text,
  media_type text, media_provider text, media_url text, external_media_id text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text,
  author_role text, author_ht_member boolean, is_mine boolean,
  is_hidden boolean, comment_count int, audience text
)
language sql security definer set search_path = '' stable as $$
  select p.id, p.type, p.body,
         p.media_type, p.media_provider, p.media_url, p.external_media_id,
         p.created_at, p.updated_at,
         p.author_user_id, idn.name, idn.avatar_url, idn.role, null::boolean,
         p.author_user_id = auth.uid(),
         p.hidden_at is not null,
         (select count(*)::int from public.class_post_comments c
           where c.post_id = p.id and (c.hidden_at is null or public.is_teacher())),
         p.audience
  from public.class_posts p
  cross join lateral public.class_public_identity(p.author_user_id) idn
  where public.can_view_wall(p_user)
    and p.author_user_id = p_user
    and p.type in ('assignment', 'status')
    and (p.hidden_at is null or public.is_teacher())
    and (
      p_before is null
      or p.created_at < p_before
      or (p.created_at = p_before and p_before_id is not null and p.id < p_before_id)
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.get_user_wall(uuid, timestamptz, uuid, int) from public, anon;
grant execute on function public.get_user_wall(uuid, timestamptz, uuid, int) to authenticated;

-- ── 6) edu_students: HẾT đọc/sửa hồ sơ (email/SĐT) của người khác ─────────
-- Trước: rls_setup.sql áp `authenticated FOR ALL USING(true)` → học sinh đăng nhập đọc được
-- email/SĐT mọi người (và sửa được hàng của nhau). Social đưa user_id người khác ra UI → phải khoá.
-- Audit client 28/09: học sinh chỉ đọc/sửa hàng CỦA MÌNH; đọc người khác đều qua RPC SECURITY
-- DEFINER (class_feed, my_class_leaderboard, …); client KHÔNG insert (signup = edge function
-- service role); màn Admin (StudentList/StudentProfile/GroupManager/LeadsManager/DailyMail/
-- ReportsPage) chạy dưới is_teacher(). delete_my_account là SECURITY DEFINER — không bị ảnh hưởng.
alter table public.edu_students enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'edu_students' loop
    execute format('drop policy %I on public.edu_students', p.policyname);
  end loop;
end $$;
create policy edu_students_own_or_teacher_read on public.edu_students
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());
create policy edu_students_own_or_teacher_update on public.edu_students
  for update to authenticated
  using (user_id = auth.uid() or public.is_teacher())
  with check (user_id = auth.uid() or public.is_teacher());
create policy edu_students_teacher_insert on public.edu_students
  for insert to authenticated with check (public.is_teacher());
create policy edu_students_teacher_delete on public.edu_students
  for delete to authenticated using (public.is_teacher());
revoke all on public.edu_students from anon;
revoke truncate, trigger, references on public.edu_students from authenticated;
-- NHỚ: 'edu_students' + 'friendships' đã thêm vào self_managed của db/rls_setup.sql.

notify pgrst, 'reload schema';
