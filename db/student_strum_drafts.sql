-- =====================================================================
-- TVA Guitar — STRUM SCORE do HỌC SINH tự soạn ("bài tập của họ")
-- Học sinh dùng công cụ /strum-builder: dán lời-hợp âm ([C]…) + vạch nhịp,
-- (sau này) gán kiểu quạt/tempo/nền để LUYỆN gảy theo.
--
-- Bảo mật (RLS theo-hàng):
--   • Mỗi học sinh CHỈ đọc/ghi/xoá bài CỦA MÌNH (owner_id = auth.uid()).
--   • Thầy (is_teacher()) ĐỌC được mọi bài để xem/chấm — KHÔNG sửa của học sinh.
--   • anon: không quyền.
--   • Bảng TỰ QUẢN RLS → đã thêm vào mảng self_managed của db/rls_setup.sql
--     để vòng lặp áp-policy-rộng BỎ QUA (đừng để nó cấp FOR ALL USING(true)).
--
-- Idempotent: chạy lại vô hại.
-- Sau khi chạy, PostgREST sẽ tự reload schema (notify ở cuối).
-- =====================================================================

-- ── 1) Bảng ──
create table if not exists public.student_strum_drafts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title       text not null default 'Bài chưa đặt tên',
  sheet_url   text,                                  -- link ảnh sheet tham chiếu (chỉ để nhìn)
  meter       int  not null default 4,               -- số phách/ô (2,3,4)
  raw_lyric   text not null default '',              -- lời-hợp âm thô kiểu [C]…
  cuts        jsonb not null default '[]'::jsonb,    -- mảng chỉ số từ có vạch nhịp
  -- Bước 2 (chơi được) — điền sau, cho phép null:
  pattern_id  text,                                  -- kiểu quạt (strumPatterns.ts)
  style_id    text,                                  -- điệu nền (backingStyles)
  tempo       int,                                   -- bpm
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ssd_owner on public.student_strum_drafts (owner_id, updated_at desc);

-- ── 2) Tự cập nhật updated_at khi sửa ──
create or replace function public.tg_ssd_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_ssd_touch on public.student_strum_drafts;
create trigger trg_ssd_touch before update on public.student_strum_drafts
  for each row execute function public.tg_ssd_touch();

-- ── 3) RLS ──
alter table public.student_strum_drafts enable row level security;

-- Chủ sở hữu: toàn quyền trên bài của mình
drop policy if exists ssd_owner_all on public.student_strum_drafts;
create policy ssd_owner_all on public.student_strum_drafts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Thầy: CHỈ đọc mọi bài (không sửa của học sinh)
drop policy if exists ssd_teacher_read on public.student_strum_drafts;
create policy ssd_teacher_read on public.student_strum_drafts
  for select to authenticated
  using (public.is_teacher());

-- ── 4) Quyền bảng ──
revoke all on public.student_strum_drafts from anon;
grant select, insert, update, delete on public.student_strum_drafts to authenticated;

notify pgrst, 'reload schema';
