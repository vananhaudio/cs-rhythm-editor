-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL P1 — BÀI ĐĂNG CỘNG ĐỒNG (class_posts) + FEED. CHƯA CHẠY.
-- Idempotent. Rollback: db/class_social_posts_rollback.sql.
-- Yêu cầu: db/community_setup.sql đã chạy (hàm public.is_teacher()).
--
-- Bảng MỚI thay vì tái dùng: `stories` là tạp chí có quy trình biên tập + anon đọc,
-- `home_feed_items` là bản tin do thầy soạn, `showcase_*` là CMS — không bảng nào mang
-- nghĩa "hoạt động học tập của thành viên".
--
-- Loại bài (type): assignment (Trả bài) | question (Hỏi bài) | practice (Chia sẻ luyện tập).
-- P1 CHỈ cho tạo assignment + video ngoài (external_video: youtube/tiktok/facebook/external_link).
-- Về sau thêm media_provider 'cloudflare_stream' (external_media_id = Stream UID, media_url có thể
-- null) chỉ bằng cách nới CHECK/policy — không phá schema.
--
-- RLS (hẹp, tự quản — rls_setup.sql đã thêm 'class_posts' vào self_managed):
--   SELECT  thành viên Class (có hồ sơ edu_students hoặc là thầy/admin); anon KHÔNG đọc.
--   INSERT  chỉ với danh tính của chính mình (author_user_id = auth.uid()), đúng loại P1.
--   UPDATE/DELETE  chỉ tác giả. Trigger khoá author_user_id/created_at khi sửa.
-- Feed đọc qua RPC class_feed() (SECURITY DEFINER): trả tên hiển thị + avatar công khai,
-- KHÔNG lộ email/số điện thoại, không N+1, không phụ thuộc policy của edu_students.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Ai là thành viên Class (được đọc/đăng)
create or replace function public.is_class_member()
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and (
    exists (select 1 from public.edu_students s where s.user_id = auth.uid())
    or public.is_teacher()
  );
$$;
revoke all on function public.is_class_member() from public, anon;
grant execute on function public.is_class_member() to authenticated;

-- 2) Bảng bài đăng
create table if not exists public.class_posts (
  id                uuid primary key default gen_random_uuid(),
  author_user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type              text not null,
  body              text not null default '',
  media_type        text,            -- 'external_video' (P1); sau: 'video' (upload), 'image', 'audio'
  media_provider    text,            -- youtube | tiktok | facebook | external_link (P1); sau: cloudflare_stream
  media_url         text,            -- URL đã chuẩn hoá (canonical), chỉ http/https
  external_media_id text,            -- ID video của nhà cung cấp khi trích được
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.class_posts drop constraint if exists class_posts_type_check;
alter table public.class_posts add constraint class_posts_type_check
  check (type in ('assignment', 'question', 'practice'));
alter table public.class_posts drop constraint if exists class_posts_body_check;
alter table public.class_posts add constraint class_posts_body_check
  check (char_length(body) <= 2000);
alter table public.class_posts drop constraint if exists class_posts_media_type_check;
alter table public.class_posts add constraint class_posts_media_type_check
  check (media_type is null or media_type in ('external_video'));
alter table public.class_posts drop constraint if exists class_posts_media_provider_check;
alter table public.class_posts add constraint class_posts_media_provider_check
  check (media_provider is null or media_provider in ('youtube', 'tiktok', 'facebook', 'external_link'));
alter table public.class_posts drop constraint if exists class_posts_media_url_check;
alter table public.class_posts add constraint class_posts_media_url_check
  check (media_url is null or (char_length(media_url) <= 2048 and media_url ~ '^https?://[^[:space:]<>"]+$'));
alter table public.class_posts drop constraint if exists class_posts_external_media_id_check;
alter table public.class_posts add constraint class_posts_external_media_id_check
  check (external_media_id is null or external_media_id ~ '^[A-Za-z0-9_-]{1,64}$');
-- media_type và media_provider luôn đi cùng nhau
alter table public.class_posts drop constraint if exists class_posts_media_pair_check;
alter table public.class_posts add constraint class_posts_media_pair_check
  check ((media_type is null) = (media_provider is null));

create index if not exists class_posts_feed_idx   on public.class_posts (created_at desc, id desc);
create index if not exists class_posts_author_idx on public.class_posts (author_user_id, created_at desc);

-- 3) Sửa bài: không đổi được tác giả / thời điểm tạo; tự cập nhật updated_at
create or replace function public.class_posts_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.author_user_id := old.author_user_id;
  new.created_at     := old.created_at;
  new.updated_at     := now();
  return new;
end $$;
drop trigger if exists class_posts_before_update on public.class_posts;
create trigger class_posts_before_update before update on public.class_posts
  for each row execute function public.class_posts_before_update();

-- 4) RLS
alter table public.class_posts enable row level security;
revoke all on public.class_posts from anon;
grant select, insert, update, delete on public.class_posts to authenticated;

drop policy if exists class_posts_member_read on public.class_posts;
create policy class_posts_member_read on public.class_posts
  for select to authenticated
  using (public.is_class_member());

-- P1: chỉ Trả bài bằng video ngoài, có URL
drop policy if exists class_posts_own_insert on public.class_posts;
create policy class_posts_own_insert on public.class_posts
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and public.is_class_member()
    and type = 'assignment'
    and media_type = 'external_video'
    and media_url is not null
  );

drop policy if exists class_posts_own_update on public.class_posts;
create policy class_posts_own_update on public.class_posts
  for update to authenticated
  using (author_user_id = auth.uid())
  with check (
    author_user_id = auth.uid()
    and type = 'assignment'
    and media_type = 'external_video'
    and media_url is not null
  );

drop policy if exists class_posts_own_delete on public.class_posts;
create policy class_posts_own_delete on public.class_posts
  for delete to authenticated
  using (author_user_id = auth.uid());

-- 5) Feed cộng đồng: mới nhất trước, phân trang keyset (p_before, p_before_id), tối đa 50/trang.
-- Danh tính công khai: tên hiển thị (bỏ phần @… nếu tên là email) + avatar + cờ lớp Hành trình.
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

notify pgrst, 'reload schema';
