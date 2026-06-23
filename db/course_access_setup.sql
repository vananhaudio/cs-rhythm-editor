-- =====================================================================
-- MỞ KHOÁ THEO TỪNG KHOÁ (per-course access) — freemium chính xác
-- Chạy trong Supabase SQL Editor. Idempotent. Cần is_teacher() (community_setup.sql).
--
-- Mô hình:
--   • edu_courses.is_free = true  → khoá miễn phí, mọi tài khoản học được.
--   • edu_courses.is_free = false → khoá trả phí: chỉ mở khi học viên ĐƯỢC CẤP QUYỀN
--     (edu_course_access), TRỪ các bài đánh dấu tier='free' (bài học thử, ai cũng xem).
--   • Thầy cấp/thu quyền từng khoá cho từng học viên ở "Hồ sơ học viên".
-- =====================================================================

-- 1) Cờ miễn phí cho khoá học (mặc định true → KHÔNG khoá gì khi mới chạy)
alter table public.edu_courses
  add column if not exists is_free boolean not null default true;

-- 2) Bảng quyền truy cập từng khoá (thầy cấp khi học viên đóng phí)
create table if not exists public.edu_course_access (
  id          bigint generated always as identity primary key,
  student_id  uuid not null,        -- = edu_students.id
  course_id   uuid not null,        -- = edu_courses.id
  active      boolean not null default true,
  note        text,                 -- ghi chú (mã CK, ngày đóng phí...)
  granted_by  uuid,                 -- thầy cấp (auth.uid)
  granted_at  timestamptz not null default now(),
  unique (student_id, course_id)
);
create index if not exists eca_student_idx on public.edu_course_access (student_id);
create index if not exists eca_course_idx  on public.edu_course_access (course_id);

-- 3) RLS: authenticated ĐỌC được (để học viên biết khoá mình đã mở);
--    CHỈ thầy (is_teacher) được GHI → học viên không tự cấp quyền cho mình.
alter table public.edu_course_access enable row level security;
drop policy if exists eca_read   on public.edu_course_access;
drop policy if exists eca_insert on public.edu_course_access;
drop policy if exists eca_update on public.edu_course_access;
drop policy if exists eca_delete on public.edu_course_access;
create policy eca_read   on public.edu_course_access for select to authenticated using (true);
create policy eca_insert on public.edu_course_access for insert to authenticated with check (public.is_teacher());
create policy eca_update on public.edu_course_access for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy eca_delete on public.edu_course_access for delete to authenticated using (public.is_teacher());

notify pgrst, 'reload schema';

-- =====================================================================
-- GỢI Ý (tuỳ chọn): đánh dấu khoá miễn phí theo tên.
-- Nhập môn & Nhạc lý → miễn phí; còn lại → trả phí.
-- (Hoặc thầy tự bật/tắt "Khoá miễn phí" trong Course Editor.)
-- =====================================================================
-- update public.edu_courses set is_free = (name ~* 'nhập môn|nhạc lý');
-- notify pgrst, 'reload schema';
