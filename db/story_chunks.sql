-- =====================================================================
-- 1001 CÂU CHUYỆN CÙNG GUITAR — MVP 02: Story Raw
-- Bảng story_chunks: lưu từng đoạn người dùng gửi
--
-- Story Raw = ghép toàn bộ story_chunks theo order_index
-- (Không lưu riêng trong DB — tạo động khi cần)
--
-- ⚠️ AN TOÀN: idempotent — chạy lại nhiều lần vô hại.
--   Sau khi chạy: NOTIFY pgrst, 'reload schema'; (đã có ở cuối file)
-- =====================================================================

create table if not exists public.story_chunks (
  id          bigint generated always as identity primary key,
  story_id    uuid not null references public.stories(id) on delete cascade,
  order_index integer not null,                -- thứ tự đoạn kể
  content     text not null,                   -- nguyên văn lời người dùng gửi
  created_at  timestamptz not null default now()
);

create index if not exists story_chunks_story_idx on public.story_chunks (story_id, order_index);

-- Đảm bảo không trùng order_index trong cùng một story
create unique index if not exists story_chunks_order_uq
  on public.story_chunks (story_id, order_index);

alter table public.story_chunks enable row level security;

drop policy if exists "chunks_own_read"    on public.story_chunks;
drop policy if exists "chunks_own_insert"  on public.story_chunks;
drop policy if exists "chunks_public_read" on public.story_chunks;

-- Người kể đọc chunks của câu chuyện MÌNH
create policy "chunks_own_read" on public.story_chunks
  for select to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = story_id and s.user_id = auth.uid()
  ));

-- Edge Function (service role) insert — vượt RLS, không cần policy riêng.
-- Nhưng thêm policy cho authenticated để chủ sở hữu có thể insert (phòng thủ).
create policy "chunks_own_insert" on public.story_chunks
  for insert to authenticated
  with check (exists (
    select 1 from public.stories s
    where s.id = story_id and s.user_id = auth.uid()
  ));

-- Công khai: ai cũng đọc được chunks của bài ĐÃ XUẤT BẢN
create policy "chunks_public_read" on public.story_chunks
  for select to anon, authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = story_id and s.status = 'published'
  ));

-- ── Nạp lại schema cho PostgREST ──
NOTIFY pgrst, 'reload schema';
