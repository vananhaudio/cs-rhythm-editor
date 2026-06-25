-- =====================================================================
-- BẢNG KHO BÀI "GẢY THEO" (do THẦY soạn) — lưu trên Supabase để dùng trong khoá.
-- CHỈ chứa ~20 bài thầy tự soạn (không đụng dữ liệu người dùng → an toàn bản quyền).
-- Học sinh (authenticated) CHỈ ĐỌC; thầy ghi trực tiếp (gửi Claude hoặc form admin sau này).
--
-- Mốc hợp âm đã được "nướng" sẵn thành GIÂY (chords[].t) lúc xuất → player chỉ cần
-- video_id + chords + lưới nhịp, KHÔNG cần lời (ẩn video/lời vẫn chạy đúng).
-- Chạy 1 lần. Idempotent.
-- =====================================================================

create table if not exists public.strum_songs (
  id            text primary key,
  title         text not null,
  video_id      text,                     -- YouTube id (lấy tiếng) — DÙNG 1 trong 2
  audio_url     text,                     -- HOẶC link audio đã up (Supabase storage)
  time_signature int  not null default 4, -- số phách / ô (4 hoặc 3)
  downbeat_pos  int  not null default 1,  -- vị trí phách mạnh trong ô
  bpm           numeric,
  beat_duration numeric,                  -- giây / phách (để vẽ dải quạt theo nhịp)
  grid_offset   numeric,                  -- giây của phách 0
  chords        jsonb not null default '[]'::jsonb,  -- [{ "t": giây, "name": "C" }]
  enabled       boolean not null default true,       -- false = ẩn khỏi danh sách
  order_index   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.strum_songs enable row level security;

-- authenticated: TOÀN QUYỀN (thầy ghi; học sinh đọc) — theo nếp chung của dự án
drop policy if exists rls_authenticated_all on public.strum_songs;
create policy rls_authenticated_all on public.strum_songs
  for all to authenticated using (true) with check (true);

-- anon: CHỈ đọc bài đang bật (cho phép xem thử khi chưa đăng nhập)
drop policy if exists rls_anon_read on public.strum_songs;
create policy rls_anon_read on public.strum_songs
  for select to anon using (enabled = true);

notify pgrst, 'reload schema';
