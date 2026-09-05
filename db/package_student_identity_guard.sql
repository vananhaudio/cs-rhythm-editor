-- Danh tính và cờ cấp quyền không được tự sửa để nhận gói của người khác.
-- Giữ luồng nhận hồ sơ legacy chưa có user_id qua email đã xác thực.
create or replace function public.guard_student_package_identity() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user in ('postgres','supabase_admin') or auth.role()='service_role' or coalesce(public.is_teacher(),false) then return new; end if;
 if auth.uid() is null then raise exception 'Cần đăng nhập'; end if;
 if TG_OP='INSERT' then
   if new.user_id is distinct from auth.uid() or coalesce(new.ht_member,false) then raise exception 'Không được tự cấp quyền học'; end if;
 else
   if old.user_id is distinct from auth.uid() and not
     (old.user_id is null and lower(coalesce(old.email,''))=lower(coalesce(auth.jwt()->>'email','')) and coalesce(old.email,'')<>'') then
     raise exception 'Không được sửa hồ sơ người khác';
   end if;
   if new.user_id is distinct from auth.uid() or new.ht_member is distinct from old.ht_member or new.email is distinct from old.email then
     raise exception 'Chỉ Thầy/Admin được đổi danh tính và quyền Hành trình';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists student_package_identity_guard on public.edu_students;
create trigger student_package_identity_guard before insert or update on public.edu_students
for each row execute function public.guard_student_package_identity();
notify pgrst,'reload schema';
