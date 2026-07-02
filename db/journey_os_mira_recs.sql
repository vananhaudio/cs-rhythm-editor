-- =====================================================================
-- JOURNEY OS — Lưu & duyệt đề xuất Mira (mira_recommendations)
-- Mira sinh đề xuất bằng RULE mỗi lần mở; bảng này lưu TRẠNG THÁI duyệt/ẩn
-- theo `rec_key` ỔN ĐỊNH (vd 'R1:<classId>') → tải lại không mất, có lịch sử.
-- Chạy trong Supabase SQL Editor. IDEMPOTENT.
-- =====================================================================

create table if not exists public.mira_recommendations (
  id           uuid primary key default gen_random_uuid(),
  rec_key      text not null unique,               -- khoá ổn định theo rule+đối tượng
  kind         text,                               -- warning | open_class | continue | promote | ht2027
  title        text,                               -- ảnh chụp nội dung lúc xử lý
  reason       text,
  priority     int  not null default 5,
  status       text not null default 'new',        -- new | approved | dismissed | done
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$ begin
  alter table public.mira_recommendations
    add constraint mira_recs_status_chk check (status in ('new','approved','dismissed','done'));
exception when duplicate_object then null; end $$;

create index if not exists mira_recs_status_idx on public.mira_recommendations(status);

-- tự cập nhật updated_at
create or replace function public.touch_mira_recs() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_touch_mira_recs on public.mira_recommendations;
create trigger trg_touch_mira_recs before update on public.mira_recommendations
  for each row execute function public.touch_mira_recs();

-- RLS: thầy (authenticated) toàn quyền. anon KHÔNG đọc/ghi.
alter table public.mira_recommendations enable row level security;
drop policy if exists mr_auth_all on public.mira_recommendations;
create policy mr_auth_all on public.mira_recommendations for all to authenticated using (true) with check (true);

-- ⚠️ Nếu chạy lại db/rls_setup.sql: thêm 'mira_recommendations' vào mảng self_managed.

notify pgrst, 'reload schema';
