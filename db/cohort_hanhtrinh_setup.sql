-- =====================================================================
-- LỚP HÀNH TRÌNH (HT2026 / HT2027) — học sinh 2 lớp này được học TẤT CẢ khoá.
-- Thầy gán lớp 1 lần → trigger TỰ CẤP toàn bộ khoá; đăng nhập sau tự top-up khoá mới.
-- Chạy trong Supabase SQL Editor. Idempotent. Cần is_teacher() (community_setup.sql).
--
-- BẢO MẬT: lớp lưu ở bảng RIÊNG chỉ THẦY ghi được (giống edu_course_access) — KHÔNG
-- lưu trên edu_students (RLS hiện cho authenticated ghi rộng → học sinh sẽ tự gán được).
-- grant_all_courses bị REVOKE khỏi mọi role → không gọi trực tiếp được, chỉ trigger/sync dùng.
-- =====================================================================

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

-- 2) Cấp TOÀN BỘ khoá cho 1 học sinh: ghi danh (khoá HIỆN) + mở quyền + nâng level. Idempotent.
create or replace function public.grant_all_courses(sid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- ghi danh mọi khoá (để khoá hiện ra trong app)
  insert into public.edu_enrollments (student_id, course_id, is_active, enrolled_by)
  select sid, c.id, true, auth.uid()
  from public.edu_courses c
  on conflict (student_id, course_id) do update set is_active = true;
  -- cấp quyền MỞ khoá trả phí
  insert into public.edu_course_access (student_id, course_id, active, note)
  select sid, c.id, true, 'Lớp Hành trình'
  from public.edu_courses c
  on conflict (student_id, course_id) do update set active = true;
  -- nâng trình độ để mở mọi tier bài
  update public.edu_students set level = 'advanced' where id = sid;
end; $$;
revoke all on function public.grant_all_courses(uuid) from public, anon, authenticated;

-- 3) Trigger: gán/đổi lớp sang HT2026/HT2027 → tự cấp full khoá NGAY.
create or replace function public.trg_cohort_grant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cohort in ('HT2026','HT2027') then
    perform public.grant_all_courses(new.student_id);
  end if;
  return new;
end; $$;
drop trigger if exists tg_cohort_grant on public.edu_cohorts;
create trigger tg_cohort_grant
  after insert or update on public.edu_cohorts
  for each row execute function public.trg_cohort_grant();

-- 4) Top-up khi học sinh HT đăng nhập: cấp các khoá MỚI (thêm sau) — app gọi rpc này.
--    Trả về tên lớp (để app/Mira biết) hoặc null nếu không thuộc lớp HT.
create or replace function public.sync_my_cohort_access()
returns text language plpgsql security definer set search_path = '' as $$
declare sid uuid; coh text;
begin
  select s.id, c.cohort into sid, coh
  from public.edu_students s
  left join public.edu_cohorts c on c.student_id = s.id
  where s.user_id = auth.uid();
  if sid is null or coh is null then return null; end if;
  if coh in ('HT2026','HT2027') then
    perform public.grant_all_courses(sid);
  end if;
  return coh;
end; $$;
revoke all on function public.sync_my_cohort_access() from anon;
grant execute on function public.sync_my_cohort_access() to authenticated;

notify pgrst, 'reload schema';
