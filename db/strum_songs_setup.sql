-- =====================================================================
-- BẢNG BÀI "STRUM SCORE" do THẦY soạn trong /admin (mục "Soạn Strum").
-- Bài nền synth (trống+bass) — thầy nhập: tên, nhịp, tempo, điệu, kiểu quạt, vòng hợp âm.
-- KHÔNG cần thu âm → sạch bản quyền. Học sinh đọc; thầy ghi.
-- Chạy 1 lần. Idempotent.
-- =====================================================================

create table if not exists public.strum_songs (
  id             text primary key,
  title          text not null,
  time_signature int  not null default 4,        -- 3 hoặc 4
  tempo          int  not null default 75,
  style_id       text,                            -- điệu nền: ballad/disco/bolero/slowrock/valse (null = không nền)
  pattern_id     text not null default 'chum2',   -- kiểu quạt (chùm): den/chum2/lien3/mockep/den3/chum2-3/lien3-3
  chords         jsonb not null default '[]'::jsonb,  -- ["C","Am","F","G"] — 1 hợp âm / 1 ô
  enabled        boolean not null default true,
  order_index    int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.strum_songs enable row level security;

drop policy if exists rls_authenticated_all on public.strum_songs;
create policy rls_authenticated_all on public.strum_songs
  for all to authenticated using (true) with check (true);

drop policy if exists rls_anon_read on public.strum_songs;
create policy rls_anon_read on public.strum_songs
  for select to anon using (enabled = true);

notify pgrst, 'reload schema';
