-- Bản tin hôm nay (home feed) — nguồn dữ liệu thật thay HOME_FEED_MOCK.
-- Idempotent. RLS theo khuôn nội dung không-PII: authenticated toàn quyền, anon chỉ SELECT.
-- Item có link_url → bấm mở link. Sắp theo sort_order tăng dần, chỉ hiện published=true.

create table if not exists public.home_feed_items (
  id uuid primary key default gen_random_uuid(),
  kicker text not null default '',
  title text not null,
  summary text not null default '',
  icon text not null default '📰',
  tone text not null default '#4338CA',
  link_url text,
  published boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.home_feed_items enable row level security;

drop policy if exists rls_authenticated_all on public.home_feed_items;
create policy rls_authenticated_all on public.home_feed_items
  for all to authenticated using (true) with check (true);

drop policy if exists rls_anon_read on public.home_feed_items;
create policy rls_anon_read on public.home_feed_items
  for select to anon using (true);

-- Seed: bài HÀNH TRÌNH 2027 (idempotent theo link_url)
insert into public.home_feed_items (kicker, title, summary, icon, tone, link_url, sort_order)
select 'Hành trình', 'HÀNH TRÌNH 2027 — Bản đồ lộ trình Nghệ sĩ Guitar',
       'Lộ trình từ số 0 đến làm chủ cây đàn cùng Thầy Văn Anh.',
       '🗺️', '#7C3AED', 'https://class.vananhaudio.com/hanhtrinh2027', 10
where not exists (
  select 1 from public.home_feed_items where link_url = 'https://class.vananhaudio.com/hanhtrinh2027'
);

notify pgrst, 'reload schema';
