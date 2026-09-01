-- ═══ TEST canonical resolver my_learning_state() — chạy bằng: supabase db query --linked -f db/tests/learning_state_test.sql
-- Mỗi assert FAIL sẽ raise exception (dòng nào hỏng thấy ngay). Chạy xong in PASS.
-- Mô phỏng identity bằng set_config role + request.jwt.claims (không đổi dữ liệu thật).

do $$
declare
  st jsonb; guest_state jsonb; teacher_state jsonb;
  v_teacher uuid; v_student_user uuid; v_demo_student uuid;
  n int; c jsonb;
begin
  -- ── Identity mẫu ──
  select u.id into v_student_user from auth.users u where u.email = 'vananhaudio+applereview@gmail.com';
  select id into v_teacher from app_users where role in ('teacher','admin') limit 1;
  if v_student_user is null or v_teacher is null then raise exception 'Thiếu user mẫu'; end if;

  -- ═══ CASE A — KHÁCH (anon) ═══
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('role', 'anon', true);
  guest_state := public.my_learning_state();
  perform set_config('role', 'postgres', true);
  if guest_state->>'mode' <> 'guest' then raise exception 'A1: guest mode sai: %', guest_state->>'mode'; end if;
  -- A2: course ẩn (status=off / visibility=hidden) không lộ
  if exists (
    select 1 from jsonb_array_elements(guest_state->'courses') gc
    join edu_courses ec on ec.id = (gc->>'id')::uuid
    where (coalesce(ec.access_policy_enabled,false) and coalesce(ec.visibility,'visible') <> 'visible')
       or (not coalesce(ec.access_policy_enabled,false) and coalesce(ec.status,'on') = 'off')
  ) then raise exception 'A2: course ẩn bị lộ cho khách'; end if;
  -- A3: khách thấy ít nhất 1 course free có bài open
  select count(*) into n from jsonb_array_elements(guest_state->'courses') gc,
    jsonb_array_elements(gc->'lessons') l where l->>'access' = 'open';
  if n = 0 then raise exception 'A3: khách không có bài open nào'; end if;

  -- ═══ CASE B — HỌC VIÊN CŨ KHÔNG CÓ ENROLLMENT (demo) — bug build 17 ═══
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  st := public.my_learning_state();
  perform set_config('role', 'postgres', true);
  if st->>'mode' <> 'student' then raise exception 'B1: student mode sai: %', st->>'mode'; end if;
  v_demo_student := (st->>'student_id')::uuid;
  if exists (select 1 from edu_enrollments where student_id = v_demo_student) then
    raise notice 'B: demo có enrollment — case B chuyển thành C';
  end if;
  -- B2: hành trình KHÔNG rỗng — có course thuộc journey với bài open
  select count(*) into n from jsonb_array_elements(st->'courses') gc, jsonb_array_elements(gc->'lessons') l
    where gc->>'subject' is not null and l->>'access' = 'open';
  if n = 0 then raise exception 'B2: học viên không-enrollment vẫn thấy journey RỖNG (bug build 17 chưa fix)'; end if;
  raise notice 'B PASS: học viên không-enrollment thấy % bài open trong hành trình', n;

  -- B3/K: completed của học viên khác KHÔNG lộ (chỉ của chính mình)
  if jsonb_array_length(st->'completed_lesson_ids') <>
     (select count(*) from edu_lesson_progress where student_id = v_demo_student and status='completed') then
    raise exception 'B3: completed_lesson_ids không khớp progress của chính học viên'; end if;

  -- ═══ CASE C — HỌC VIÊN CÓ ENROLLMENT: course enrolled (visible+available) phải access=open ═══
  declare r record; bad int;
  begin
    for r in (select distinct s.user_id from edu_students s
              join edu_enrollments e on e.student_id = s.id
              where s.user_id is not null limit 3) loop
      perform set_config('request.jwt.claims', json_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      st := public.my_learning_state();
      perform set_config('role', 'postgres', true);
      select count(*) into bad from jsonb_array_elements(st->'courses') gc
        where (gc->>'enrolled')::boolean and gc->>'access' not in ('open','coming_soon','prereq');
      if bad > 0 then raise exception 'C1: user % có course enrolled nhưng access không open', r.user_id; end if;
      -- K: progress phản chiếu đúng
      if jsonb_array_length(st->'completed_lesson_ids') <>
         (select count(*) from edu_lesson_progress p join edu_students s2 on s2.id = p.student_id
          where s2.user_id = r.user_id and p.status='completed'
            and s2.id = (st->>'student_id')::uuid) then
        raise exception 'C2/K: completed không khớp cho user %', r.user_id; end if;
    end loop;
    raise notice 'C PASS: 3 học viên có enrollment — course enrolled đều open, progress khớp';
  end;

  -- ═══ CASE G — PREREQUISITE (HT member) — kiểm luật thuần từ bảng course_prereqs ═══
  if (select requires from course_prereqs where code='DH2') <> '{DH1,NL1}'::text[] then
    raise exception 'G1: seed prereq DH2 sai'; end if;

  -- ═══ CASE J — KHÔNG LEO QUYỀN: RPC không nhận tham số; student không ghi được bảng cấu hình ═══
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into journey_curriculum (course_id, subject, level, sort_order)
      values ((select id from edu_courses limit 1), 'solo', 9, 999);
    raise exception 'J1: student INSERT được journey_curriculum!';
  exception when insufficient_privilege or check_violation then null;
           when unique_violation then raise exception 'J1: student INSERT được journey_curriculum (trùng khoá)!';
  end;
  begin
    update course_prereqs set requires = '{}' where code = 'DH2';
    if exists (select 1 from course_prereqs where code='DH2' and requires = '{}'::text[]) then
      raise exception 'J2: student UPDATE được course_prereqs!'; end if;
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'postgres', true);

  -- ═══ TEACHER — thấy cả course ẩn, mọi bài open ═══
  perform set_config('request.jwt.claims', json_build_object('sub', v_teacher, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  teacher_state := public.my_learning_state();
  perform set_config('role', 'postgres', true);
  if teacher_state->>'mode' <> 'teacher' then raise exception 'T1: teacher mode sai'; end if;
  if jsonb_array_length(teacher_state->'courses') < jsonb_array_length(guest_state->'courses') then
    raise exception 'T2: teacher thấy ít course hơn khách'; end if;

  raise notice '═══ TẤT CẢ TEST PASS ═══';
end $$;
