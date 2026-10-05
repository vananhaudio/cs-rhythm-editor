-- SMOKE production Teacher All Classes V1 — CHỈ chạy bằng `prod-db.py dryrun` (luôn ROLLBACK).
-- Danh tính chọn ĐỘNG (không ghi id production vào repo): một tài khoản admin/teacher KHÔNG có hồ sơ học sinh, và một
-- học sinh có lớp nhưng KHÔNG thuộc ít nhất một lớp khác. Chạy dưới role authenticated + JWT sub thật.
do $smoke$
declare
  v_t uuid; v_s uuid; v_other uuid; v_n int; v_expected int; c record; e jsonb; st jsonb;
  fp0 text; fp1 text; n_ok int := 0;
begin
  fp0 := (select count(*) from public.edu_group_members)::text || '/' || (select count(*) from public.class_curriculum_access)
      || '/' || (select count(*) from public.learning_session_progress) || '/' || (select count(*) from public.learning_threads)
      || '/' || (select count(*) from public.edu_students) || '/' || (select count(*) from public.class_schedule);
  select au.id into v_t from public.app_users au
   where au.role in ('admin', 'teacher') and not exists (select 1 from public.edu_students s where s.user_id = au.id)
   order by (au.role = 'admin') desc, au.id limit 1;
  select m.user_id, oc.id into v_s, v_other
  from tva_private.class_memberships m
  join public.edu_students es on es.user_id = m.user_id
  join public.app_users au on au.id = m.user_id and au.role not in ('admin', 'teacher')
  cross join lateral (select cs.id from public.class_schedule cs
                      where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
                        and not exists (select 1 from tva_private.class_memberships x where x.class_id = cs.id and x.user_id = m.user_id)
                        and not exists (select 1 from public.class_curriculum_access a where a.class_id = cs.id and a.user_id = m.user_id)
                      order by cs.id limit 1) oc
  order by m.user_id limit 1;
  if v_t is null or v_s is null then raise exception 'SMOKE: không chọn được danh tính (teacher=%, student=%)', v_t is not null, v_s is not null; end if;
  select count(*) into v_expected from public.class_schedule where coalesce(status, '') not in ('cancelled', 'merged', 'draft');

  -- 1. Thầy (admin không hồ sơ HS): mọi lớp; mở được từng lớp bằng đúng RPC trang lớp/buổi dùng
  perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_n from public.social_all_classes();
  if v_n <> v_expected then raise exception 'SMOKE 1: thấy % / % lớp', v_n, v_expected; end if;
  n_ok := n_ok + 1;
  for c in select (x ->> 'id')::uuid id from public.social_all_classes() x loop
    perform public.social_class_detail(c.id);
    e := public.class_learning_entry(c.id);
    if not coalesce((e -> 'curriculum' ->> 'has_access')::boolean, false) then raise exception 'SMOKE 2: entry % không có quyền giáo trình', c.id; end if;
    st := public.class_learning_state(c.id);
    if (st ->> 'enabled')::boolean and st ->> 'role' <> 'teacher' then raise exception 'SMOKE 2: state % không ở vai trò teacher', c.id; end if;
    perform count(*) from public.social_class_members(c.id);
  end loop;
  n_ok := n_ok + 1;
  if not exists (select 1 from public.class_lesson_content lc join public.class_sessions s on s.id = lc.session_id where lc.status = 'published') then
    raise exception 'SMOKE 3: Thầy không đọc được giáo án đã xuất bản';
  end if;
  n_ok := n_ok + 1;

  -- 4. Học sinh: không gọi được danh sách toàn bộ; lớp KHÔNG tham gia → không entry, không nội dung
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform count(*) from public.social_all_classes();
    raise exception 'SMOKE 4: học sinh gọi được social_all_classes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.class_learning_entry(v_other);
    raise exception 'SMOKE 4: học sinh mở được class_learning_entry lớp không tham gia';
  exception when insufficient_privilege then null;
  end;
  if coalesce((public.class_learning_state(v_other) ->> 'enabled')::boolean, false) then raise exception 'SMOKE 4: state lớp khác bật'; end if;
  if exists (select 1 from public.class_lesson_content lc join public.class_sessions s on s.id = lc.session_id where s.class_id = v_other) then
    raise exception 'SMOKE 4: học sinh đọc được giáo án lớp không tham gia';
  end if;
  if exists (select 1 from public.social_my_classes() x where (x ->> 'id')::uuid = v_other) then raise exception 'SMOKE 4: lớp khác lọt vào Lớp của tôi'; end if;
  n_ok := n_ok + 1;

  -- 5. Khách + dữ liệu không đổi
  perform set_config('role', 'postgres', true);
  if has_function_privilege('anon', 'public.social_all_classes()', 'execute') then raise exception 'SMOKE 5: anon gọi được'; end if;
  fp1 := (select count(*) from public.edu_group_members)::text || '/' || (select count(*) from public.class_curriculum_access)
      || '/' || (select count(*) from public.learning_session_progress) || '/' || (select count(*) from public.learning_threads)
      || '/' || (select count(*) from public.edu_students) || '/' || (select count(*) from public.class_schedule);
  if fp1 <> fp0 then raise exception 'SMOKE 5: dữ liệu đổi % → %', fp0, fp1; end if;
  n_ok := n_ok + 1;
  perform set_config('request.jwt.claims', '{}', true);
  raise notice 'TEACHER ALL CLASSES PROD SMOKE: % / 5 PASS — Thầy thấy + mở được % lớp; học sinh bị chặn; dữ liệu không đổi (dryrun sẽ ROLLBACK)', n_ok, v_expected;
end $smoke$;
