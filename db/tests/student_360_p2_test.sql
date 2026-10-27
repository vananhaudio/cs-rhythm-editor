-- Test Student 360 P2 (set_visibility). Chạy SAU migration P1 + P2 trên cluster tạm. Dữ liệu giả của social_fixture.
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
create table public._t_ids (k text primary key, v text);
grant all on public._t_ids to authenticated;
grant execute on function public._t_as(uuid), public._t_fails(text, text), public._t_eq(anyelement, anyelement, text) to authenticated, anon;
set role authenticated;

do $$ declare a constant uuid := 'cccccccc-0000-4000-8000-00000000000c'; b constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
 t constant uuid := 'dddddddd-0000-4000-8000-00000000000d'; r jsonb; inf uuid; own uuid; n int; begin
  perform public._t_as(t);
  inf := (public.student_360_add_fact(a, 'difficulty', 'Hay đau tay khi bấm barre', 'inferred', 'crm_zalo', 'crm-link:7')->>'id')::uuid;
  perform public._t_as(a);
  own := (public.student_360_add_fact(null, 'goal', 'Muốn đệm hát')->>'id')::uuid;
  perform public._t_eq(jsonb_array_length(public.student_360_get()->'facts'), 1, 'A chưa thấy mục suy luận (mặc định chỉ Thầy)');
  perform public._t_fails(format($q$select public.student_360_set_visibility(%L,'student_and_teacher')$q$, inf), 'forbidden');
  perform public._t_fails(format($q$select public.student_360_set_visibility(%L,'teacher')$q$, own), 'forbidden');
  perform public._t_as(b);
  perform public._t_fails(format($q$select public.student_360_set_visibility(%L,'student_and_teacher')$q$, inf), 'forbidden');

  perform public._t_as(t);
  perform public._t_fails(format($q$select public.student_360_set_visibility(%L,'public')$q$, inf), 'bad_visibility');
  perform public._t_fails(format($q$select public.student_360_set_visibility(%L,null)$q$, inf), 'bad_visibility');
  perform public._t_fails($q$select public.student_360_set_visibility(gen_random_uuid(),'teacher')$q$, 'not_found');
  r := public.student_360_set_visibility(inf, 'student_and_teacher');
  perform public._t_eq(r->>'visibility', 'student_and_teacher', 'Thầy mở mục suy luận cho học viên');
  perform public._t_eq(r->>'verification', 'unverified', 'mở quyền xem KHÔNG đổi verification');
  perform public._t_eq(r->>'origin', 'inferred', 'mở quyền xem KHÔNG đổi origin');
  perform public._t_as(a);
  perform public._t_eq(jsonb_array_length(public.student_360_get()->'facts'), 2, 'A thấy mục sau khi Thầy mở');
  perform public._t_eq((select count(*)::int from jsonb_array_elements(public.student_360_get()->'facts') f where f ? 'source_ref'), 0, 'học viên vẫn KHÔNG thấy source_ref');
  perform public._t_as(b);
  perform public._t_eq(position('barre' in public.student_360_get()::text) + position('đệm hát' in public.student_360_get()::text), 0, 'B không thấy mục của học viên khác');

  perform public._t_as(t);
  n := jsonb_array_length(public.student_360_fact_history(inf));
  perform public._t_eq((public.student_360_set_visibility(inf, 'student_and_teacher'))->>'visibility', 'student_and_teacher', 'idempotent cùng giá trị');
  perform public._t_eq(jsonb_array_length(public.student_360_fact_history(inf)), n, 'idempotent: không ghi nhật ký thừa');
  r := public.student_360_set_visibility(inf, 'teacher');
  perform public._t_eq(r->>'visibility', 'teacher', 'Thầy thu lại về chỉ-Thầy');
  perform public._t_as(a);
  perform public._t_eq(jsonb_array_length(public.student_360_get()->'facts'), 1, 'A hết thấy mục sau khi thu lại');
  perform public._t_as(t);
  perform public._t_eq(public.student_360_fact_history(inf)->(jsonb_array_length(public.student_360_fact_history(inf))-1)->>'action', 'visibility:teacher', 'nhật ký ghi hành động visibility');
  perform public.student_360_revoke_fact(inf, 'test');
  perform public._t_fails(format($q$select public.student_360_set_visibility(%L,'student_and_teacher')$q$, inf), 'revoked');
end $$;

reset role; set role anon;
do $$ begin
  perform public._t_fails($q$select public.student_360_set_visibility(gen_random_uuid(),'teacher')$q$, 'permission denied');
  raise notice 'PASS anon không EXECUTE được set_visibility';
end $$;
reset role;
drop table public._t_ids;
drop function public._t_as(uuid); drop function public._t_fails(text, text); drop function public._t_eq(anyelement, anyelement, text);
