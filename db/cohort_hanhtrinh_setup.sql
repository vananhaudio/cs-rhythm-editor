-- =====================================================================
-- LỚP HÀNH TRÌNH (HT2026 / HT2027) — chỉ GẮN NHÃN lớp cho học sinh.
-- ⚠️ KHÔNG mở hết khoá. Khoá mở LẦN LƯỢT theo bản đồ hành trình, sau khi học
--    sinh đăng ký buổi Zoom ở thời khoá biểu (cơ chế mở sẽ chốt sau).
-- Chạy trong Supabase SQL Editor. Idempotent. Cần is_teacher() (community_setup.sql).
--
-- BẢO MẬT: lớp lưu ở bảng RIÊNG chỉ THẦY ghi được (giống edu_course_access) —
-- KHÔNG lưu trên edu_students (RLS hiện cho authenticated ghi rộng).
-- =====================================================================

-- Gỡ bản TỰ-MỞ-HẾT (nếu đã lỡ chạy bản trước) — tránh mở toàn bộ khoá.
drop trigger  if exists tg_cohort_grant on public.edu_cohorts;
drop function if exists public.trg_cohort_grant();
drop function if exists public.grant_all_courses(uuid);

-- 1) Bảng lớp: 1 học sinh ↔ 1 lớp. Đọc: ai cũng đọc. Ghi: chỉ thầy.
create table if not exists public.edu_cohorts (
  student_id  uuid primary key,           -- = edu_students.id
  cohort      text not null,              -- 'HT2026' | 'HT2027'
  assigned_by uuid,
  assigned_at timestamptz not null default now()
);
alter table public.edu_cohorts enable row level security;
drop policy if exists ec_read on public.edu_cohorts;
drop policy if exists ec_ins  on public.edu_cohorts;
drop policy if exists ec_upd  on public.edu_cohorts;
drop policy if exists ec_del  on public.edu_cohorts;
create policy ec_read on public.edu_cohorts for select to authenticated using (true);
create policy ec_ins  on public.edu_cohorts for insert to authenticated with check (public.is_teacher());
create policy ec_upd  on public.edu_cohorts for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy ec_del  on public.edu_cohorts for delete to authenticated using (public.is_teacher());

-- 2) RPC: học sinh tự đọc lớp của mình (để app/Mira biết). KHÔNG cấp khoá gì.
create or replace function public.sync_my_cohort_access()
returns text language sql security definer set search_path = '' stable as $$
  select c.cohort from public.edu_cohorts c
  join public.edu_students s on s.id = c.student_id
  where s.user_id = auth.uid();
$$;
revoke all on function public.sync_my_cohort_access() from anon;
grant execute on function public.sync_my_cohort_access() to authenticated;

notify pgrst, 'reload schema';
