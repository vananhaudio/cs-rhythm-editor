-- =====================================================================
-- JOURNEY OS — GIAI ĐOẠN 3: Nhu cầu mở lớp (class_demands)
-- Thầy nhập tay ở /admin: ai muốn học mã năng lực nào, khung giờ, ưu tiên.
-- Mira gom theo mã năng lực → đề xuất mở lớp nháp (rule R2).
-- Chạy trong Supabase SQL Editor. IDEMPOTENT.
-- =====================================================================

create table if not exists public.class_demands (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid references public.edu_students(id) on delete set null, -- gắn HV nếu có TK (tuỳ chọn)
  student_name    text,                                  -- tên nhập nhanh khi chưa gắn TK
  course_code     text not null,                         -- mã năng lực muốn học, vd 'DH2'
  preferred_days  text,                                  -- khung ngày mong muốn, vd 'T3, T5'
  preferred_times text,                                  -- khung giờ, vd 'tối 19h'
  priority        int  not null default 0,               -- 0 thường · 1 ưu tiên
  source          text not null default 'admin',         -- admin | app | lead
  status          text not null default 'waiting',       -- waiting | planned | enrolled | cancelled
  note            text,
  created_at      timestamptz not null default now()
);

do $$ begin
  alter table public.class_demands
    add constraint class_demands_status_chk check (status in ('waiting','planned','enrolled','cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists class_demands_code_idx   on public.class_demands(course_code);
create index if not exists class_demands_status_idx on public.class_demands(status);

-- RLS: dữ liệu vận hành nội bộ → chỉ thầy (authenticated). anon KHÔNG đọc/ghi.
alter table public.class_demands enable row level security;
drop policy if exists cd_auth_all on public.class_demands;
create policy cd_auth_all on public.class_demands for all to authenticated using (true) with check (true);

-- ⚠️ Nếu chạy lại db/rls_setup.sql: thêm 'class_demands' vào mảng self_managed.

notify pgrst, 'reload schema';
