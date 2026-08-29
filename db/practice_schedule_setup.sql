-- =====================================================================
-- PRACTICE SCHEDULE — Lịch thực hành Class 2.0 (chạy trên /azz)
-- Mở rộng TỐI THIỂU hệ lịch sẵn có (class_schedule + class_sessions + class_off_days).
-- Nguyên tắc: Admin là nguồn DUY NHẤT thiết lập lịch. KHÔNG seed lịch vận hành.
--   • class_schedule: + show_on_practice_schedule (CỜ hiển thị trên /azz — quyết
--     định visibility) + stage (BẬC SƯ PHẠM: co_ban/phat_trien/nang_cao — độc lập
--     với visibility) + practice_type (loại thực hành) + metadata.
--     weekday, stage, visibility là các khái niệm ĐỘC LẬP — không gắn logic thứ↔bậc.
--   • class_sessions: event_type thêm 'special' (buổi đặc biệt/hỗ trợ theo nhu cầu).
--   • RLS class_sessions: anon đọc buổi của nhóm có program_code (HT2027…) HOẶC
--     show_on_practice_schedule = true — KHÔNG dựa trên stage.
--   • BẢNG MỚI practice_topic_interests: học sinh/lead đăng ký chủ đề muốn được
--     Thầy hỗ trợ (buổi theo nhu cầu). anon chỉ GHI (như leads), admin đọc/quản lý.
-- IDEMPOTENT — chạy lại nhiều lần vô hại. KHÔNG sửa/xoá dữ liệu cũ.
-- =====================================================================

-- ── (1) class_schedule: show_on_practice_schedule + stage + practice_type + metadata ──
alter table public.class_schedule add column if not exists show_on_practice_schedule boolean not null default false;  -- CỜ: có xuất hiện trong lịch thực hành Class (public /azz) hay không
alter table public.class_schedule add column if not exists stage          text;      -- BẬC SƯ PHẠM: co_ban | phat_trien | nang_cao (độc lập với cờ hiển thị)
alter table public.class_schedule add column if not exists practice_type  text;      -- loại thực hành, vd 'tia_not' 'dem_hat' 'nang_cao' (nhập tự do)
alter table public.class_schedule add column if not exists metadata       jsonb not null default '{}'::jsonb;  -- metadata mở (màu, mô tả...)

do $$ begin
  alter table public.class_schedule
    add constraint class_schedule_stage_chk check (stage is null or stage in ('co_ban','phat_trien','nang_cao'));
exception when duplicate_object then null; end $$;

create index if not exists class_schedule_stage_idx on public.class_schedule (stage);
create index if not exists class_schedule_show_practice_idx on public.class_schedule (show_on_practice_schedule);

-- ── (2) class_sessions: loại sự kiện thêm 'special' ──────────────────
do $$ begin
  alter table public.class_sessions drop constraint class_sessions_event_type_chk;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.class_sessions
    add constraint class_sessions_event_type_chk check (event_type in ('lesson', 'break', 'special'));
exception when duplicate_object then null; end $$;

-- ── (3) RLS class_sessions: anon đọc buổi của nhóm CHƯƠNG TRÌNH (HT2027…)
--     hoặc nhóm được BẬT cờ show_on_practice_schedule (lịch thực hành Class).
--     KHÔNG dựa trên stage — stage chỉ là bậc sư phạm, không quyết định visibility.
drop policy if exists cses_anon_program_read on public.class_sessions;
drop policy if exists cses_public_read on public.class_sessions;
create policy cses_public_read on public.class_sessions for select to anon
  using (class_id in (
    select id from public.class_schedule
    where program_code is not null or show_on_practice_schedule = true
  ));

-- ── (4) BẢNG practice_topic_interests — nhu cầu buổi hỗ trợ theo chủ đề ──
create table if not exists public.practice_topic_interests (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,                 -- chủ đề muốn được hỗ trợ, vd 'Chuyển hợp âm'
  name        text,                          -- tên người đăng ký (lead ẩn danh / học viên)
  phone       text,                          -- số điện thoại liên hệ (tuỳ chọn)
  zalo        text,                          -- zalo (tuỳ chọn)
  student_id  uuid references public.edu_students(id) on delete set null,  -- gắn HV nếu đã có TK
  source      text not null default 'azz',   -- azz | app | admin
  status      text not null default 'new',   -- new | planned | done | cancelled
  note        text,
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table public.practice_topic_interests
    add constraint pti_status_chk check (status in ('new','planned','done','cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists pti_topic_idx  on public.practice_topic_interests (topic);
create index if not exists pti_status_idx on public.practice_topic_interests (status);
create index if not exists pti_created_idx on public.practice_topic_interests (created_at desc);

alter table public.practice_topic_interests enable row level security;
drop policy if exists pti_anon_insert on public.practice_topic_interests;
drop policy if exists pti_auth_read   on public.practice_topic_interests;
drop policy if exists pti_auth_update on public.practice_topic_interests;
-- Public CHỈ được GHI (đăng ký chủ đề) — KHÔNG đọc được của ai (không lộ thông tin liên hệ)
create policy pti_anon_insert on public.practice_topic_interests
  for insert to anon with check (true);
-- Admin đọc & cập nhật trạng thái
create policy pti_auth_read on public.practice_topic_interests
  for select to authenticated using (true);
create policy pti_auth_update on public.practice_topic_interests
  for update to authenticated using (true) with check (true);

-- ⚠️ Nếu chạy lại db/rls_setup.sql: thêm 'class_schedule','class_sessions',
--    'class_off_days','class_demands','offer_campaigns','practice_topic_interests'
--    vào mảng self_managed để không bị áp policy rộng đè lên.

notify pgrst, 'reload schema';
