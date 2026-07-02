-- =====================================================================
-- JOURNEY OS — GIAI ĐOẠN 1: Lịch thật + tiến trình lớp
-- (1) Nâng class_schedule: ngày/giờ thật, số buổi, ngày kết thúc, status.
-- (2) Bảng class_sessions: từng buổi học (sinh ở client khi lưu lớp).
-- Chạy trong Supabase SQL Editor. IDEMPOTENT (chạy lại nhiều lần vô hại).
-- Giữ NGUYÊN các cột text cũ (schedule/start_text/duration) — trang tuyển
-- sinh vẫn đọc chúng; cột ngày/giờ thật chạy SONG SONG.
-- =====================================================================

-- ── (1) NÂNG class_schedule ─────────────────────────────────────────
alter table public.class_schedule add column if not exists start_date       date;   -- ngày khai giảng thật
alter table public.class_schedule add column if not exists weekday          int;    -- thứ trong tuần: 0=CN … 6=T7 (1 buổi/tuần)
alter table public.class_schedule add column if not exists start_time       time;   -- giờ bắt đầu, vd 19:00
alter table public.class_schedule add column if not exists duration_minutes int not null default 90;  -- thời lượng 1 buổi
alter table public.class_schedule add column if not exists total_sessions   int not null default 8;   -- số buổi
alter table public.class_schedule add column if not exists end_date         date;   -- ngày kết thúc dự kiến (client tự tính)
alter table public.class_schedule add column if not exists status           text not null default 'draft'; -- enum lớp (dưới)
alter table public.class_schedule add column if not exists max_students     int;    -- sĩ số tối đa (GĐ3 tính %)
alter table public.class_schedule add column if not exists min_students     int;    -- sĩ số tối thiểu mở lớp

-- weekday hợp lệ 0..6 (cho phép null khi chưa xếp)
do $$ begin
  alter table public.class_schedule
    add constraint class_schedule_weekday_chk check (weekday is null or (weekday between 0 and 6));
exception when duplicate_object then null; end $$;

-- status thuộc bộ trạng thái lớp trong spec
do $$ begin
  alter table public.class_schedule
    add constraint class_schedule_status_chk check (status in (
      'draft','recruiting','ready_to_open','scheduled','upcoming',
      'active','ending_soon','completed','paused','cancelled','merged'
    ));
exception when duplicate_object then null; end $$;

-- Lớp đang bật mà chưa có status rõ → coi như 'upcoming' (dữ liệu cũ)
update public.class_schedule set status = 'upcoming'
  where status = 'draft' and is_active = true and start_date is null;

-- ── (2) BẢNG class_sessions — từng buổi học ─────────────────────────
create table if not exists public.class_sessions (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.class_schedule(id) on delete cascade,
  session_number int  not null,                 -- buổi thứ mấy: 1..total_sessions
  title          text,                          -- nhãn buổi (tuỳ chọn), vd "B1 · Giới thiệu hành trình"
  start_at       timestamptz not null,          -- thời điểm bắt đầu buổi
  end_at         timestamptz,                    -- thời điểm kết thúc buổi
  status         text not null default 'scheduled',
  note           text,
  created_at     timestamptz not null default now(),
  unique (class_id, session_number)
);

do $$ begin
  alter table public.class_sessions
    add constraint class_sessions_status_chk check (status in (
      'scheduled','completed','cancelled','rescheduled','makeup','holiday'
    ));
exception when duplicate_object then null; end $$;

create index if not exists class_sessions_class_idx   on public.class_sessions(class_id);
create index if not exists class_sessions_startat_idx on public.class_sessions(start_at);

-- ── RLS ─────────────────────────────────────────────────────────────
-- Buổi học = dữ liệu VẬN HÀNH nội bộ → chỉ thầy (authenticated) toàn quyền;
-- anon KHÔNG đọc (khác class_schedule vốn cho anon đọc cho trang tuyển sinh).
alter table public.class_sessions enable row level security;
drop policy if exists cses_auth_all on public.class_sessions;
create policy cses_auth_all on public.class_sessions for all to authenticated using (true) with check (true);

-- ⚠️ Nếu chạy lại db/rls_setup.sql: thêm 'class_sessions' vào mảng self_managed
--    để vòng lặp áp policy rộng KHÔNG đè lên policy hẹp ở trên.
--    (class_schedule cũng đã lưu ý tương tự để giữ cs_anon_read.)

notify pgrst, 'reload schema';
