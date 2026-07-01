-- ĐĂNG KÝ 1-CHẠM: học sinh vào NHÓM ZALO của lớp (nhóm ≡ mã lớp) → TỰ MỞ đúng khoá của lớp đó.
-- Bao phủ mọi đường thêm nhóm (Trợ lý AI / tay / claim link). SECURITY DEFINER (bỏ qua RLS).
-- BẢO MẬT: học sinh KHÔNG tự insert edu_group_members được (RLS teacher-only); nên không tự cấp khoá cho mình.
-- Chạy trong Supabase SQL Editor. Idempotent.

create or replace function public.grant_class_courses_on_join()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sid   uuid;
  gcode text;
  cids  uuid[];
  cid   uuid;
begin
  if new.status <> 'active' then return new; end if;
  select code into gcode from public.edu_groups where id = new.group_id;
  if gcode is null then return new; end if;                                  -- nhóm không gắn mã lớp → bỏ qua
  select course_ids into cids from public.class_schedule where code = gcode limit 1;
  if cids is null or array_length(cids, 1) is null then return new; end if;   -- không có lớp trùng mã / lớp chưa gắn khoá
  select id into sid from public.edu_students where user_id = new.user_id limit 1;
  if sid is null then return new; end if;                                     -- chưa có hồ sơ học sinh
  foreach cid in array cids loop
    insert into public.edu_enrollments (student_id, course_id, is_active, enrolled_by)
      values (sid, cid, true, new.user_id)
      on conflict (student_id, course_id) do update set is_active = true;
    insert into public.edu_course_access (student_id, course_id, active, note)
      values (sid, cid, true, 'Vào lớp ' || gcode)
      on conflict (student_id, course_id) do update set active = true;
  end loop;
  return new;
end; $$;

drop trigger if exists tg_grant_class_courses on public.edu_group_members;
create trigger tg_grant_class_courses
  after insert or update of status on public.edu_group_members
  for each row execute function public.grant_class_courses_on_join();

notify pgrst, 'reload schema';
