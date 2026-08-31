-- Bản tin hôm nay v2 — content feed tổng quát (server-driven content).
-- Idempotent, BẢO TOÀN dữ liệu v1 (link_url → content_url).
-- Yêu cầu: db/community_setup.sql đã chạy (hàm public.is_teacher()).
--
-- RLS: học viên/anon CHỈ ĐỌC item đã xuất bản còn hiệu lực; mọi ghi chỉ teacher.
-- rls_setup.sql đã thêm 'home_feed_items' vào self_managed — đừng áp policy rộng lại.

-- ── Cột mới ──────────────────────────────────────────────────────────────
alter table public.home_feed_items add column if not exists type text not null default 'link';
alter table public.home_feed_items add column if not exists thumbnail_url text;
alter table public.home_feed_items add column if not exists content_data jsonb not null default '{}'::jsonb;
alter table public.home_feed_items add column if not exists open_mode text not null default 'in_app';
alter table public.home_feed_items add column if not exists published_at timestamptz not null default now();
alter table public.home_feed_items add column if not exists expires_at timestamptz;
alter table public.home_feed_items add column if not exists updated_at timestamptz not null default now();

-- link_url (v1) → content_url (giữ dữ liệu)
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='home_feed_items' and column_name='link_url') then
    alter table public.home_feed_items rename column link_url to content_url;
  end if;
end $$;
alter table public.home_feed_items add column if not exists content_url text;

-- Ràng buộc loại nội dung / cách mở
alter table public.home_feed_items drop constraint if exists home_feed_items_type_check;
alter table public.home_feed_items add constraint home_feed_items_type_check
  check (type in ('article','video','image','document','link','announcement','course','event'));
alter table public.home_feed_items drop constraint if exists home_feed_items_open_mode_check;
alter table public.home_feed_items add constraint home_feed_items_open_mode_check
  check (open_mode in ('in_app','native','external'));

-- updated_at tự cập nhật
create or replace function public.home_feed_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_home_feed_touch on public.home_feed_items;
create trigger trg_home_feed_touch before update on public.home_feed_items
  for each row execute function public.home_feed_touch_updated_at();

-- ── RLS: bỏ policy rộng v1, thay bằng đọc-published + teacher-write ─────
alter table public.home_feed_items enable row level security;
drop policy if exists rls_authenticated_all on public.home_feed_items;
drop policy if exists rls_anon_read on public.home_feed_items;
drop policy if exists home_feed_read_published on public.home_feed_items;
drop policy if exists home_feed_teacher_all on public.home_feed_items;

-- Least privilege: policy ĐỌC (anon+student) không dính is_teacher() — anon không cần
-- EXECUTE hàm này. Teacher xem cả draft/hết hạn qua policy FOR ALL riêng (đã bao SELECT).
revoke execute on function public.is_teacher() from anon;

create policy home_feed_read_published on public.home_feed_items
  for select to anon, authenticated
  using (published and published_at <= now() and (expires_at is null or expires_at > now()));

create policy home_feed_teacher_all on public.home_feed_items
  for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ── Storage: mở rộng bucket 'lessons' cho PDF/tài liệu (tái dụng, không tạo bucket mới) ──
update storage.buckets
  set allowed_mime_types = (
    select array(select distinct unnest(coalesce(allowed_mime_types, '{}'::text[]) || array['application/pdf','image/gif','image/svg+xml']))
  )
  where id = 'lessons';

-- ── Migrate item test case đầu tiên (Hành Trình 2027) sang schema mới ────
update public.home_feed_items
  set type = 'article', open_mode = 'in_app'
  where content_url = 'https://class.vananhaudio.com/hanhtrinh2027' and type = 'link';

notify pgrst, 'reload schema';
