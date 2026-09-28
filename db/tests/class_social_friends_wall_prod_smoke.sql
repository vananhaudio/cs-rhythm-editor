/*
SMOKE PRODUCTION sau migration Bạn bè + Tường — TỰ HUỶ, KHÔNG ĐỂ LẠI THAY ĐỔI.
Mọi kiểm tra chạy trong MỘT khối DO; khối LUÔN kết thúc bằng RAISE EXCEPTION → Postgres rollback toàn bộ
(kể cả nếu có gì đó lỡ ghi). Kết quả nằm trong thông báo lỗi: "SMOKE PASS …" hoặc "SMOKE FAIL …".
Không gửi lời mời thật, không đăng bài, không sửa hồ sơ: chỉ SELECT + gọi RPC ở nhánh BỊ TỪ CHỐI.
Identity: tự chọn 2 học sinh THẬT (không phải thầy) theo user_id, giả lập JWT như tests/learning_state_test.sql.
Không có comment '--' (an toàn khi copy). Chạy: SQL Editor → dán nguyên file → Run.
*/
do $smoke$
declare
  v_me uuid; v_other uuid; v_other_email text;
  n_class int; n_mine int; n int; r text;
  ok text[] := '{}'; bad text[] := '{}';
begin
  select s.user_id into v_me from public.edu_students s
   where s.user_id is not null and not exists (select 1 from public.app_users a where a.id = s.user_id and a.role in ('teacher', 'admin'))
   order by (select count(*) from public.class_posts p where p.author_user_id = s.user_id) desc, s.enrolled_at desc nulls last limit 1;
  select s.user_id, s.email into v_other, v_other_email from public.edu_students s
   where s.user_id is not null and s.user_id <> v_me and coalesce(s.email, '') <> ''
     and not exists (select 1 from public.app_users a where a.id = s.user_id and a.role in ('teacher', 'admin'))
   order by s.enrolled_at desc nulls last limit 1;
  if v_me is null or v_other is null then raise exception 'SMOKE FAIL: không đủ 2 học sinh có tài khoản để kiểm'; end if;
  select count(*) into n_class from public.class_posts where audience = 'class' and hidden_at is null;
  select count(*) into n_mine from public.class_posts where author_user_id = v_me and type in ('assignment', 'status') and hidden_at is null;

  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.class_feed(null, null, 50);
  if n = least(n_class, 50) then ok := ok || format('feed %s/%s bài Class', n, n_class); else bad := bad || format('feed %s ≠ %s', n, n_class); end if;
  select count(*) into n from public.class_posts where audience = 'class';
  if n = n_class then ok := ok || format('đọc thẳng class_posts: %s bài Class', n); else bad := bad || format('class_posts %s ≠ %s', n, n_class); end if;
  select count(*) into n from public.edu_students where user_id <> v_me;
  if n = 0 then ok := ok || text 'edu_students: 0 hồ sơ người khác'; else bad := bad || format('thấy %s hồ sơ người khác', n); end if;
  select count(*) into n from public.edu_students where user_id = v_me;
  if n >= 1 then ok := ok || format('edu_students: đọc được %s hồ sơ của mình', n); else bad := bad || text 'không đọc được hồ sơ của mình'; end if;
  select count(*) into n from public.edu_students where email = v_other_email;
  if n = 0 then ok := ok || text 'không đọc được email người khác'; else bad := bad || text 'ĐỌC ĐƯỢC email người khác'; end if;
  select count(*) into n from public.get_user_wall(v_other);
  if n = 0 then ok := ok || text 'tường người khác (chưa là bạn): 0 bài'; else bad := bad || format('tường người khác lộ %s bài', n); end if;
  select count(*) into n from public.get_user_wall(v_me);
  if n = least(n_mine, 20) then ok := ok || format('tường của mình: %s bài', n); else bad := bad || format('tường mình %s ≠ %s', n, n_mine); end if;
  r := public.friendship_status(v_other);
  if r = 'none' then ok := ok || text 'friendship_status = none'; else bad := bad || text 'friendship_status ' || r; end if;
  select count(*) into n from public.my_friends();
  if n = 0 then ok := ok || text 'my_friends: 0'; else bad := bad || format('my_friends %s', n); end if;
  select count(*) into n from public.get_user_profile(v_other);
  if n = 1 then ok := ok || text 'get_user_profile: hồ sơ tối thiểu'; else bad := bad || format('get_user_profile %s hàng', n); end if;
  begin perform public.send_friend_request(v_me); bad := bad || text 'KẾT BẠN VỚI CHÍNH MÌNH được';
  exception when others then ok := ok || text 'chặn tự kết bạn'; end;
  begin perform public.respond_friend_request(v_other, true); bad := bad || text 'CHẤP NHẬN lời mời không tồn tại được';
  exception when others then ok := ok || text 'chặn giả chấp nhận lời mời'; end;
  begin perform 1 from public.friendships limit 1; bad := bad || text 'ĐỌC THẲNG friendships được';
  exception when insufficient_privilege then ok := ok || text 'chặn đọc thẳng friendships'; end;
  begin insert into public.friendships (requester_id, addressee_id, status) values (v_me, v_other, 'accepted'); bad := bad || text 'GHI THẲNG friendships được';
  exception when insufficient_privilege then ok := ok || text 'chặn ghi thẳng friendships'; end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform 1 from public.get_user_wall(v_me); bad := bad || text 'KHÁCH gọi được get_user_wall';
  exception when insufficient_privilege then ok := ok || text 'khách: chặn get_user_wall'; end;
  begin perform 1 from public.class_feed(); bad := bad || text 'KHÁCH gọi được class_feed';
  exception when insufficient_privilege then ok := ok || text 'khách: chặn class_feed'; end;
  begin perform 1 from public.edu_students limit 1; bad := bad || text 'KHÁCH đọc được edu_students';
  exception when insufficient_privilege then ok := ok || text 'khách: chặn edu_students'; end;
  begin perform 1 from public.class_posts limit 1; bad := bad || text 'KHÁCH đọc được class_posts';
  exception when insufficient_privilege then ok := ok || text 'khách: chặn class_posts'; end;
  perform set_config('role', 'postgres', true);

  if cardinality(bad) = 0 then
    raise exception 'SMOKE PASS %/% (tự huỷ — không thay đổi gì): %', cardinality(ok), cardinality(ok), array_to_string(ok, ' | ');
  else
    raise exception 'SMOKE FAIL % lỗi: % || đạt: %', cardinality(bad), array_to_string(bad, ' | '), array_to_string(ok, ' | ');
  end if;
end $smoke$;
