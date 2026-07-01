-- =====================================================================
-- LỊCH LỚP HỌC — quản lý trong /admin, thay Google Sheet. Mỗi lớp gắn sẵn
-- NHIỀU khoá học (course_ids) + 1 nhóm Zalo (group_id) → đăng ký 1 lần tự chảy.
-- Chạy trong Supabase SQL Editor. Idempotent.
-- =====================================================================

create table if not exists public.class_schedule (
  id          uuid primary key default gen_random_uuid(),
  code        text,                                  -- mã lớp, vd 'KD11'
  name        text not null,                         -- tên lớp hiển thị
  section     text not null default 'upcoming',      -- upcoming | active | oneonone | smallgroup
  schedule    text,                                  -- 'Thứ 3 · 19h00'
  start_text  text,                                  -- '07/07/2026' / 'tháng 9/2026'
  duration    text,                                  -- '8 buổi · mỗi buổi 90 phút'
  price       text,                                  -- '990k' / 'Combo'
  course_ids  uuid[] not null default '{}',          -- NHIỀU khoá lớp này mở (edu_courses.id)
  group_id    uuid,                                  -- 1 nhóm Zalo (edu_groups.id)
  zoom_url    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.class_schedule enable row level security;
drop policy if exists cs_auth_all  on public.class_schedule;
drop policy if exists cs_anon_read on public.class_schedule;
-- Thầy (đã đăng nhập) toàn quyền; khách (trang tuyển sinh) chỉ ĐỌC
create policy cs_auth_all  on public.class_schedule for all    to authenticated using (true) with check (true);
create policy cs_anon_read on public.class_schedule for select to anon using (true);

-- ⚠️ Nếu chạy lại db/rls_setup.sql: thêm 'class_schedule' vào mảng self_managed
--    để không bị gỡ policy cs_anon_read ở trên.

notify pgrst, 'reload schema';
