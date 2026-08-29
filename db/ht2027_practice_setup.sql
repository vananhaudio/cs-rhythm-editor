-- =====================================================================
-- HT2027 — 40 BUỔI THỰC HÀNH (chương trình Hành trình 2027)
-- Mở rộng TỐI THIỂU hệ lịch sẵn có (class_schedule + class_sessions):
--   • class_schedule:  program_code (mã chương trình) · breaks_after (nghỉ
--                       giữa chặng) · timezone (múi giờ chuẩn)
--   • class_sessions:  event_type (lesson | break) · status + 'confirmed'
--   • BẢNG MỚI class_off_days: lịch nghỉ/lock CHUNG của Class (nghỉ lễ
--     chính thức, Tết, ngày admin khóa vì vận hành) — nguồn dùng chung
--     cho engine sinh lịch và landing page.
-- IDEMPOTENT — chạy lại nhiều lần vô hại. KHÔNG sửa/xoá dữ liệu cũ.
-- =====================================================================

-- ── (1) class_schedule: cột chương trình ─────────────────────────────
alter table public.class_schedule add column if not exists program_code text;           -- mã chương trình, vd 'HT2027' (lớp thường = null)
alter table public.class_schedule add column if not exists breaks_after  int[];         -- nghỉ 2 tuần sau các buổi này, vd {8,16,24,32} (null = không nghỉ)
alter table public.class_schedule add column if not exists timezone      text not null default 'Asia/Ho_Chi_Minh';  -- múi giờ chuẩn của hệ thống

-- ── (2) class_sessions: loại sự kiện + trạng thái xác nhận ───────────
alter table public.class_sessions add column if not exists event_type text not null default 'lesson';

-- Sự kiện KHÔNG phải buổi học (nghỉ giữa chặng) không có số buổi → bỏ NOT NULL
-- (unique(class_id, session_number) vẫn giữ: nhiều NULL được phép trong Postgres)
alter table public.class_sessions alter column session_number drop not null;

do $$ begin
  alter table public.class_sessions
    add constraint class_sessions_event_type_chk check (event_type in ('lesson', 'break'));
exception when duplicate_object then null; end $$;

-- Mở rộng bộ trạng thái buổi: thêm 'confirmed' (Đã xác nhận) — giữ nguyên các giá trị cũ
do $$ begin
  alter table public.class_sessions drop constraint class_sessions_status_chk;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.class_sessions
    add constraint class_sessions_status_chk check (status in (
      'scheduled','confirmed','completed','cancelled','rescheduled','makeup','holiday'
    ));
exception when duplicate_object then null; end $$;

-- ── (3) BẢNG class_off_days — lịch nghỉ/lock chung của Class ──────────
create table if not exists public.class_off_days (
  id         uuid primary key default gen_random_uuid(),
  off_date   date not null unique,                 -- ngày nghỉ / bị khóa
  reason     text not null,                        -- vd 'Tết Nguyên Đán (dự kiến)', 'Quốc khánh 2/9', 'Khóa lịch vận hành'
  source     text not null default 'admin'         -- official (nghỉ lễ chính thức) | tet | admin (khóa vì vận hành)
    check (source in ('official','tet','admin')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists class_off_days_date_idx on public.class_off_days (off_date);

alter table public.class_off_days enable row level security;
drop policy if exists cod_anon_read  on public.class_off_days;
drop policy if exists cod_auth_read  on public.class_off_days;
drop policy if exists cod_auth_write on public.class_off_days;
-- Khách đọc được (landing page công khai hiển thị ngày bỏ qua); chỉ thầy ghi.
create policy cod_anon_read  on public.class_off_days for select to anon using (true);
create policy cod_auth_read  on public.class_off_days for select to authenticated using (true);
create policy cod_auth_write on public.class_off_days for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ── (4) RLS class_sessions: anon chỉ đọc buổi của lớp CHƯƠNG TRÌNH ────
-- (class_sessions đang kín: chỉ authenticated. Landing page công khai cần
--  đọc lịch buổi thực hành → mở đọc HẸP cho lớp có program_code;
--  buổi lớp học thường vẫn không lộ ra ngoài.)
drop policy if exists cses_anon_program_read on public.class_sessions;
create policy cses_anon_program_read on public.class_sessions for select to anon
  using (class_id in (select id from public.class_schedule where program_code is not null));

notify pgrst, 'reload schema';
