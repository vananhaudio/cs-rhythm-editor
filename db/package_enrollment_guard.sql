-- Enrollment là theo dõi học; học viên tự ghi danh không được tự cấp quyền trả phí.
-- Giữ toàn bộ quyền enrollment trước migration, quyền mới do teacher/server cấp.
begin;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='edu_enrollments' and column_name='access_granted') then
  alter table public.edu_enrollments add column access_granted boolean not null default false;
  update public.edu_enrollments set access_granted=true;
 end if;
end $$;
create or replace function public.guard_enrollment_access() returns trigger
language plpgsql set search_path='' as $$
begin
 if auth.role()='service_role' or coalesce(public.is_teacher(),false) then
   new.access_granted:=true;
 elsif TG_OP='INSERT' then
   new.access_granted:=false;
 else
   if new.access_granted is distinct from old.access_granted or
     (old.access_granted and new.is_active is distinct from old.is_active) or
     new.student_id is distinct from old.student_id or new.course_id is distinct from old.course_id then
     raise exception 'Chỉ Thầy/Admin được thay đổi quyền ghi danh';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists enrollment_access_guard on public.edu_enrollments;
create trigger enrollment_access_guard before insert or update on public.edu_enrollments for each row execute function public.guard_enrollment_access();
-- Giữ policy đọc cũ; hạn chế ghi để HS không thay đổi enrollment của người khác.
drop policy if exists rls_authenticated_all on public.edu_enrollments;
drop policy if exists enrollment_read on public.edu_enrollments;
create policy enrollment_read on public.edu_enrollments for select to authenticated using(true);
drop policy if exists enrollment_write on public.edu_enrollments;
create policy enrollment_write on public.edu_enrollments for all to authenticated
using(public.is_teacher() or exists(select 1 from public.edu_students s where s.id=student_id and s.user_id=auth.uid()))
with check(public.is_teacher() or exists(select 1 from public.edu_students s where s.id=student_id and s.user_id=auth.uid()));
notify pgrst,'reload schema';
commit;
