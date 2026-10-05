-- SMOKE production Friends UX V2 — CHỈ chạy bằng `prod-db.py dryrun` (luôn ROLLBACK: không hàng nào còn lại).
-- Chọn ĐỘNG hai học sinh chưa có quan hệ với nhau (không ghi id production vào repo), chạy đủ vòng đời dưới danh tính
-- thật của họ (role authenticated + JWT sub) — quyền SECURITY DEFINER/GRANT được kiểm thật trên production.
-- Ghi (RPC volatile) và đọc (RPC stable) phải ở HAI câu lệnh: hàm stable trong cùng câu thấy snapshot đầu câu.
do $smoke$
declare
  u1 uuid; u2 uuid; n0 bigint; n int := 0;
  procedure_ok boolean;
begin
  select count(*) into n0 from public.friendships;
  select a.user_id, b.user_id into u1, u2
  from public.edu_students a join public.edu_students b on b.user_id > a.user_id
  where a.user_id is not null and b.user_id is not null
    and not exists (select 1 from public.friendships f
                    where least(f.requester_id, f.addressee_id) = a.user_id and greatest(f.requester_id, f.addressee_id) = b.user_id)
  order by a.enrolled_at, b.enrolled_at limit 1;
  if u1 is null then raise exception 'SMOKE: không tìm được cặp học sinh'; end if;

  -- 1. u1 gửi → u1 outgoing / u2 incoming
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.send_friend_request(u2) <> 'outgoing' then raise exception 'SMOKE 1 send'; end if;
  if not exists (select 1 from public.outgoing_friend_requests() where user_id = u2) then raise exception 'SMOKE 1 outgoing'; end if;
  if public.can_view_wall(u2) and not public.is_teacher() then raise exception 'SMOKE 1 pending ≠ friends'; end if;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if not exists (select 1 from public.incoming_friend_requests() where user_id = u1) then raise exception 'SMOKE 1 incoming'; end if;
  if exists (select 1 from public.outgoing_friend_requests() where user_id = u1) then raise exception 'SMOKE 1 outgoing lộ sang u2'; end if;
  n := n + 1;

  -- 2. u1 huỷ lời mời → hai phía none
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.unfriend(u2) <> 'none' then raise exception 'SMOKE 2 cancel'; end if;
  if exists (select 1 from public.outgoing_friend_requests() where user_id = u2) then raise exception 'SMOKE 2 outgoing còn'; end if;
  n := n + 1;

  -- 3. u2 gửi, u1 Xóa → hàng biến mất, u2 gửi lại được
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.send_friend_request(u1);
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.respond_friend_request(u2, false) <> 'none' then raise exception 'SMOKE 3 decline'; end if;
  if exists (select 1 from public.incoming_friend_requests() where user_id = u2) then raise exception 'SMOKE 3 incoming còn'; end if;
  perform set_config('role', 'postgres', true);
  if exists (select 1 from public.friendships where least(requester_id, addressee_id) = least(u1, u2) and greatest(requester_id, addressee_id) = greatest(u1, u2)) then
    raise exception 'SMOKE 3 Xóa phải xoá hàng';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.friendship_status(u1) <> 'none' or exists (select 1 from public.outgoing_friend_requests() where user_id = u1) then raise exception 'SMOKE 3 u2 còn thấy lời mời'; end if;
  if public.send_friend_request(u1) <> 'outgoing' then raise exception 'SMOKE 3 gửi lại'; end if;
  n := n + 1;

  -- 4. u1 xác nhận → bạn hai phía, lời mời biến mất
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.respond_friend_request(u2, true) <> 'friends' then raise exception 'SMOKE 4 accept'; end if;
  if not exists (select 1 from public.my_friends() where user_id = u2) or exists (select 1 from public.incoming_friend_requests() where user_id = u2)
    or not public.can_view_wall(u2) then raise exception 'SMOKE 4 u1'; end if;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if not exists (select 1 from public.my_friends() where user_id = u1) or exists (select 1 from public.outgoing_friend_requests() where user_id = u1) then raise exception 'SMOKE 4 u2'; end if;
  n := n + 1;

  -- 5. u2 huỷ kết bạn → hai phía none
  if public.unfriend(u1) <> 'none' then raise exception 'SMOKE 5 unfriend'; end if;
  if exists (select 1 from public.my_friends() where user_id = u1) then raise exception 'SMOKE 5 my_friends còn'; end if;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.friendship_status(u2) <> 'none' then raise exception 'SMOKE 5 u1'; end if;
  n := n + 1;

  -- 6. anon + bảng khoá
  perform set_config('role', 'postgres', true);
  procedure_ok := not has_function_privilege('anon', 'public.outgoing_friend_requests()', 'execute')
              and not has_function_privilege('anon', 'public.respond_friend_request(uuid,boolean)', 'execute')
              and not has_table_privilege('authenticated', 'public.friendships', 'select')
              and not has_table_privilege('authenticated', 'public.friendships', 'delete');
  if not procedure_ok then raise exception 'SMOKE 6 quyền'; end if;
  n := n + 1;

  perform set_config('request.jwt.claims', '{}', true);
  if (select count(*) from public.friendships) <> n0 then raise exception 'SMOKE: số hàng đổi'; end if;
  raise notice 'FRIENDS V2 PROD SMOKE: % / 6 PASS (cặp học sinh chọn động; dryrun sẽ ROLLBACK)', n;
end $smoke$;
