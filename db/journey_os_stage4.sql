-- =====================================================================
-- JOURNEY OS — GIAI ĐOẠN 4A: Ưu đãi (offer_campaigns)
-- Chính sách ưu đãi/đăng ký sớm gắn theo mã năng lực hoặc gói (combo).
-- Mira Planner (GĐ4B) tính đề xuất bằng RULE thuần frontend — KHÔNG cần bảng
-- mira_recommendations (đề xuất tính trực tiếp, thầy xem & bấm hành động).
-- Chạy trong Supabase SQL Editor. IDEMPOTENT.
-- =====================================================================

create table if not exists public.offer_campaigns (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                     -- tên chương trình, vd 'Đăng ký sớm HT2027'
  course_code    text,                              -- gắn mã năng lực (vd 'DH2') — tuỳ chọn
  package_code   text,                              -- gắn gói/combo — tuỳ chọn
  original_price text,                              -- giá gốc hiển thị, vd '990k'
  offer_price    text,                              -- giá ưu đãi, vd '690k'
  start_at       date,                              -- bắt đầu áp dụng
  end_at         date,                              -- hết hạn
  quota          int,                               -- số suất (null = không giới hạn)
  used_quota     int  not null default 0,           -- đã dùng
  target_rules   text,                              -- điều kiện/đối tượng (mô tả tự do)
  status         text not null default 'draft',     -- draft | active | paused | expired
  note           text,
  created_at     timestamptz not null default now()
);

do $$ begin
  alter table public.offer_campaigns
    add constraint offer_campaigns_status_chk check (status in ('draft','active','paused','expired'));
exception when duplicate_object then null; end $$;

create index if not exists offer_campaigns_code_idx   on public.offer_campaigns(course_code);
create index if not exists offer_campaigns_status_idx on public.offer_campaigns(status);

-- RLS: thầy (authenticated) toàn quyền. anon KHÔNG đọc (chưa hiện public;
-- khi nào gắn ưu đãi lên trang tuyển sinh mới mở policy anon SELECT riêng).
alter table public.offer_campaigns enable row level security;
drop policy if exists oc_auth_all on public.offer_campaigns;
create policy oc_auth_all on public.offer_campaigns for all to authenticated using (true) with check (true);

-- ⚠️ Nếu chạy lại db/rls_setup.sql: thêm 'offer_campaigns' vào mảng self_managed.

notify pgrst, 'reload schema';
