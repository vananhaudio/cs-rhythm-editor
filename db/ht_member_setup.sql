-- Học sinh Hành trình (HT2026/HT2027): cờ ht_member + cấp FULL khoá.
-- App sẽ CHẶN học nhảy cóc: khoá cấp trên chỉ mở khi hoàn thành hết bài cấp dưới (theo PREREQ trong hanhtrinh.ts).
-- Chạy trong Supabase SQL Editor. Idempotent.

-- 1) Cờ đánh dấu học sinh Hành trình
alter table public.edu_students add column if not exists ht_member boolean not null default false;

-- 2) Cấp toàn bộ khoá đang mở (status='on') cho 1 học sinh. Trả số quyền đã ghi. Dùng khi bật cờ HT.
create or replace function public.grant_all_courses(p_student uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; uid uuid;
begin
  select user_id into uid from public.edu_students where id = p_student;
  insert into public.edu_enrollments (student_id, course_id, is_active, enrolled_by)
    select p_student, c.id, true, uid from public.edu_courses c where c.status = 'on'
    on conflict (student_id, course_id) do update set is_active = true;
  insert into public.edu_course_access (student_id, course_id, active, note)
    select p_student, c.id, true, 'HT full khoá' from public.edu_courses c where c.status = 'on'
    on conflict (student_id, course_id) do update set active = true;
  get diagnostics n = row_count;
  return n;
end; $$;

notify pgrst, 'reload schema';
