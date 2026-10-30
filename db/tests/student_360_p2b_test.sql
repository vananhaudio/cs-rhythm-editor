-- Test Student 360 P2b (mặc định an toàn của add_fact). Chạy SAU migration P1 + P2 + P2b trên cluster tạm. Dữ liệu giả của social_fixture.
create function public._t_as(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', u::text, false) $$;
create function public._t_fails(sql text, expect text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(expect in sqlerrm) = 0 then raise exception 'sai lỗi: muốn "%" nhận "%" (%)', expect, sqlerrm, sql; end if;
    return;
  end;
  raise exception 'đáng lẽ phải lỗi "%": %', expect, sql;
end $$;
create function public._t_eq(a anyelement, b anyelement, msg text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'FAIL % : % <> %', msg, a, b; end if; raise notice 'PASS %', msg; end $$;
grant execute on function public._t_as(uuid), public._t_fails(text, text), public._t_eq(anyelement, anyelement, text) to authenticated, anon;
set role authenticated;

do $$ declare b constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b'; t constant uuid := 'dddddddd-0000-4000-8000-00000000000d';
 r jsonb; ids uuid[] := '{}'; o text; n int; seen int; begin
  perform public._t_as(t);
  -- Thầy KHÔNG truyền visibility: mọi origin đều mặc định chỉ Thầy thấy
  foreach o in array array['self_reported','class_confirmed','inferred'] loop
    r := public.student_360_add_fact(b, 'goal', 'Mặc định an toàn ' || o, o, case when o = 'inferred' then 'crm_zalo' else 'teacher' end);
    perform public._t_eq(r->>'visibility', 'teacher', 'Thầy không truyền visibility, origin=' || o || ' → chỉ Thầy thấy');
    perform public._t_eq(r->>'verification', 'unverified', 'origin=' || o || ' luôn unverified');
    ids := ids || (r->>'id')::uuid;
  end loop;
  perform public._t_as(b);
  perform public._t_eq(coalesce((select count(*)::int from jsonb_array_elements(public.student_360_get()->'facts') f where f->>'content' like 'Mặc định an toàn%'), 0), 0, 'học viên KHÔNG đọc được mục Thầy vừa thêm (mặc định)');
  -- Chia sẻ tường minh (caller truyền p_visibility) vẫn hoạt động như cũ
  perform public._t_as(t);
  r := public.student_360_add_fact(b, 'goal', 'Chia sẻ tường minh', 'class_confirmed', 'teacher', null, 'student_and_teacher');
  perform public._t_eq(r->>'visibility', 'student_and_teacher', 'truyền p_visibility tường minh vẫn được tôn trọng');
  perform public._t_as(b);
  perform public._t_eq((select count(*)::int from jsonb_array_elements(public.student_360_get()->'facts') f where f->>'content' = 'Chia sẻ tường minh'), 1, 'học viên đọc được mục được chia sẻ tường minh');
  -- Chia sẻ chủ động qua set_visibility: học viên thấy đúng mục được phép
  perform public._t_as(t);
  perform public.student_360_set_visibility(ids[1], 'student_and_teacher');
  perform public._t_as(b);
  perform public._t_eq((select count(*)::int from jsonb_array_elements(public.student_360_get()->'facts') f where f->>'content' like 'Mặc định an toàn%'), 1, 'chỉ mục được chia sẻ chủ động hiện ra, các mục còn lại vẫn ẩn');
  -- Visibility sai vẫn bị chặn bởi ràng buộc bảng; học viên tự thêm: vẫn hiển thị cho chính họ (hành vi P1 giữ nguyên)
  perform public._t_as(t);
  perform public._t_fails($q$select public.student_360_add_fact('bbbbbbbb-0000-4000-8000-00000000000b','goal','x y z','self_reported','teacher',null,'public')$q$, 'student_360_facts');
  perform public._t_as(b);
  r := public.student_360_add_fact(null, 'goal', 'Tự nhập của học viên');
  perform public._t_eq(r->>'visibility', 'student_and_teacher', 'học viên tự thêm: vẫn hiển thị cho chính họ và Thầy');
  perform public._t_eq(r->>'origin', 'self_reported', 'học viên luôn self_reported');
  -- Học viên không thể thêm cho người khác / không ép visibility
  perform public._t_fails($q$select public.student_360_add_fact('dddddddd-0000-4000-8000-00000000000d','goal','xâm nhập hồ sơ')$q$, 'forbidden');
  r := public.student_360_add_fact(null, 'goal', 'Học viên cố ép teacher', 'inferred', 'crm_zalo', 'x', 'teacher');
  perform public._t_eq(r->>'origin', 'self_reported', 'học viên không ép được origin inferred');
  perform public._t_eq(r->>'visibility', 'student_and_teacher', 'học viên không ép được visibility');
end $$;

-- anon không gọi được
reset role; set role anon;
do $$ begin perform public._t_fails($q$select public.student_360_add_fact(null,'goal','anon thử')$q$, 'permission denied'); perform public._t_eq(true, true, 'anon không EXECUTE add_fact'); end $$;
