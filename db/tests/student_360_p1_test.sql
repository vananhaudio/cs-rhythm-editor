-- Test Student 360 P1 (dữ liệu GIẢ LẬP của social_fixture: A,B,C học viên · T thầy · N không có edu_students).
-- Chạy bởi scripts/test-student-360-db.sh trên cluster tạm. Lỗi = RAISE → psql thoát != 0.
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
select public._t_as('aaaaaaaa-0000-4000-8000-00000000000a');

do $$ declare a constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; b constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
 t constant uuid := 'dddddddd-0000-4000-8000-00000000000d'; r jsonb; fid text; fid2 text; n int; g jsonb; begin
  perform public._t_fails('select * from public.student_360_facts', 'permission denied');
  perform public._t_fails($q$insert into public.student_360_facts(user_id,category,content,origin,source_kind) values (gen_random_uuid(),'goal','x','self_reported','student')$q$, 'permission denied');
  perform public._t_fails('select * from public.student_360_fact_log', 'permission denied');

  -- học viên A thêm: bị ép self_reported/student dù cố khai inferred
  r := public.student_360_add_fact(null, 'goal', '  Muốn đệm hát bài Bolero ', 'inferred', 'crm_zalo', 'crm-link:1', 'teacher');
  perform public._t_eq(r->>'origin', 'self_reported', 'A: origin bị ép self_reported');
  perform public._t_eq(r->>'visibility', 'student_and_teacher', 'A: visibility bị ép');
  perform public._t_eq(r->>'verification', 'unverified', 'A: bắt đầu unverified');
  perform public._t_eq(r->>'content', 'Muốn đệm hát bài Bolero', 'A: content được trim');
  perform public._t_eq(r ? 'source_ref', false, 'A: không thấy source_ref');
  fid := r->>'id'; insert into public._t_ids values ('a1', fid);
  perform public._t_fails(format($q$select public.student_360_add_fact(%L,'goal','x')$q$, b), 'forbidden');
  perform public._t_fails($q$select public.student_360_add_fact(null,'goal','')$q$, 'content_required');
  perform public._t_fails($q$select public.student_360_add_fact(null,'bogus','x')$q$, 'check');
  perform public._t_fails(format($q$select public.student_360_add_fact(null,'goal',%L)$q$, repeat('x',501)), 'check');
  perform public._t_fails(format($q$select public.student_360_get(%L)$q$, b), 'forbidden');
  perform public._t_eq(jsonb_array_length(public.student_360_get()->'facts'), 1, 'A đọc hồ sơ mình: 1 mục');
  perform public._t_eq(public.student_360_get()->'profile'->>'display_name', 'An', 'profile lấy từ edu_students (không sao chép)');
  perform public._t_fails($q$select public.student_360_revoke_by_source('crm_zalo','x')$q$, 'forbidden');
  perform public._t_fails(format($q$select public.student_360_fact_history(%L)$q$, fid), 'forbidden');
  perform public._t_fails(format($q$select public.student_360_set_verification(%L,'teacher_verified')$q$, fid), 'forbidden');
  r := public.student_360_set_verification(fid::uuid, 'student_confirmed');
  perform public._t_eq(r->>'verification', 'student_confirmed', 'A xác nhận mục của mình');

  -- thầy thêm suy luận từ CRM cho A
  perform public._t_as(t);
  r := public.student_360_add_fact(a, 'difficulty', 'Hay đau tay khi bấm barre', 'inferred', 'crm_zalo', 'crm-link:7');
  perform public._t_eq(r->>'visibility', 'teacher', 'suy luận mặc định chỉ Thầy thấy');
  perform public._t_eq(r->>'verification', 'unverified', 'suy luận KHÔNG tự đã xác minh');
  fid2 := r->>'id'; insert into public._t_ids values ('inf', fid2);
end $$;

do $$ declare a constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; b constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
 t constant uuid := 'dddddddd-0000-4000-8000-00000000000d'; n constant uuid := 'eeeeeeee-0000-4000-8000-00000000000e';
 a1 uuid := (select v from public._t_ids where k='a1')::uuid; inf uuid := (select v from public._t_ids where k='inf')::uuid;
 r jsonb; g jsonb; c int; begin
  -- Thầy thấy cả hai + source_ref; học viên A chỉ thấy mục của mình hiển thị cho học viên
  perform public._t_as(t);
  g := public.student_360_get(a);
  perform public._t_eq(jsonb_array_length(g->'facts'), 2, 'Thầy thấy 2 mục của A');
  perform public._t_eq((select count(*)::int from jsonb_array_elements(g->'facts') f where f ? 'source_ref'), 1, 'Thầy thấy source_ref của mục CRM');
  perform public._t_as(a);
  perform public._t_eq(jsonb_array_length(public.student_360_get()->'facts'), 1, 'A KHÔNG thấy mục chỉ-cho-Thầy');
  perform public._t_fails(format($q$select public.student_360_set_verification(%L,'student_confirmed')$q$, inf), 'forbidden');
  perform public._t_fails(format($q$select public.student_360_revoke_fact(%L)$q$, inf), 'forbidden');
  perform public._t_fails(format($q$select public.student_360_edit_fact(%L,'sửa lén')$q$, inf), 'forbidden');

  -- cô lập giữa học viên
  perform public._t_as(b);
  r := public.student_360_add_fact(null, 'music_taste', 'Thích nhạc trữ tình');
  perform public._t_eq(jsonb_array_length(public.student_360_get()->'facts'), 1, 'B chỉ thấy mục của B');
  perform public._t_fails(format($q$select public.student_360_edit_fact(%L,'x')$q$, a1), 'forbidden');
  perform public._t_fails(format($q$select public.student_360_revoke_fact(%L)$q$, a1), 'forbidden');
  perform public._t_fails(format($q$select public.student_360_set_verification(%L,'student_confirmed')$q$, a1), 'forbidden');
  perform public._t_fails(format($q$select public.student_360_get(%L)$q$, a), 'forbidden');
  perform public._t_eq(position('Bolero' in public.student_360_get()::text), 0, 'hồ sơ B không chứa dữ liệu của A');

  -- tài khoản không có edu_students vẫn đọc được (profile null)
  perform public._t_as(n);
  perform public._t_eq(public.student_360_get()->'profile', 'null'::jsonb, 'N: không có edu_students → profile null');
  perform public._t_eq(jsonb_array_length(public.student_360_get()->'facts'), 0, 'N: 0 mục');

  -- sửa: học viên sửa mục mình → về unverified; Thầy xác minh → sửa lại → unverified
  perform public._t_as(a);
  r := public.student_360_edit_fact(a1, 'Muốn đệm hát Bolero và Ballad');
  perform public._t_eq(r->>'verification', 'unverified', 'sửa → verification về unverified');
  perform public._t_as(t);
  r := public.student_360_set_verification(inf, 'teacher_verified');
  perform public._t_eq(r->>'verification', 'teacher_verified', 'Thầy xác minh');
  perform public._t_eq(r->>'verified_by', t::text, 'verified_by = Thầy');
  perform public._t_fails(format($q$select public.student_360_set_verification(%L,'student_confirmed')$q$, inf), 'forbidden');
  r := public.student_360_edit_fact(inf, 'Đau tay khi bấm barre F');
  perform public._t_eq(r->>'verification', 'unverified', 'Thầy sửa → về unverified');
  perform public._t_eq(jsonb_array_length(public.student_360_fact_history(inf)), 3, 'lịch sử một mục: create + verify + edit');
  perform public._t_eq(public.student_360_fact_history(inf)->2->'before'->>'content', 'Hay đau tay khi bấm barre', 'nhật ký giữ nội dung cũ');
end $$;

do $$ declare a constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; t constant uuid := 'dddddddd-0000-4000-8000-00000000000d';
 a1 uuid := (select v from public._t_ids where k='a1')::uuid; inf uuid := (select v from public._t_ids where k='inf')::uuid;
 r jsonb; i int; begin
  -- thu hồi theo nguồn (P2: liên kết sai)
  perform public._t_as(t);
  perform public.student_360_add_fact(a, 'support_need', 'Cần bài tập chậm', 'inferred', 'crm_zalo', 'crm-link:7');
  perform public._t_eq(public.student_360_revoke_by_source('crm_zalo', 'crm-link:7', 'liên kết sai'), 2, 'thu hồi theo nguồn: 2 mục');
  perform public._t_eq(public.student_360_revoke_by_source('crm_zalo', 'crm-link:7'), 0, 'thu hồi lần 2: idempotent 0');
  perform public._t_eq(jsonb_array_length(public.student_360_get(a)->'facts'), 1, 'mục bị thu hồi ẩn khỏi đọc thường');
  perform public._t_eq(jsonb_array_length(public.student_360_get(a, true)->'facts'), 3, 'Thầy xem được cả mục đã thu hồi');
  perform public._t_fails(format($q$select public.student_360_edit_fact(%L,'x')$q$, inf), 'revoked');
  perform public._t_fails(format($q$select public.student_360_set_verification(%L,'teacher_verified')$q$, inf), 'revoked');
  perform public._t_eq(public.student_360_revoke_fact(inf)->>'status', 'revoked', 'revoke idempotent');
  -- học viên thu hồi mục mình; học viên không xem được mục đã thu hồi kể cả include_revoked
  perform public._t_as(a);
  perform public._t_eq(public.student_360_revoke_fact(a1, 'nhầm')->>'status', 'revoked', 'A thu hồi mục của mình');
  perform public._t_eq(jsonb_array_length(public.student_360_get(null, true)->'facts'), 0, 'học viên không đọc được mục đã thu hồi');
  -- trần 50 mục / học viên
  for i in 1..50 loop perform public.student_360_add_fact(null, 'key_topic', 'mục ' || i); end loop;
  perform public._t_fails($q$select public.student_360_add_fact(null,'key_topic','mục 51')$q$, 'too_many_facts');
end $$;

-- anon không gọi được RPC
reset role; set role anon;
do $$ begin
  perform public._t_fails($q$select public.student_360_get()$q$, 'permission denied');
  perform public._t_fails($q$select public.student_360_add_fact(null,'goal','x')$q$, 'permission denied');
  raise notice 'PASS anon không EXECUTE được RPC';
end $$;

-- nhật ký bất biến + hàm nội bộ không gọi được
reset role;
do $$ begin
  perform public._t_fails('update public.student_360_fact_log set action = ''x''', 'bất biến');
  perform public._t_fails('delete from public.student_360_fact_log', 'bất biến');
  if (select count(*) from public.student_360_fact_log) < 10 then raise exception 'nhật ký quá ít'; end if;
  raise notice 'PASS nhật ký bất biến (% dòng)', (select count(*) from public.student_360_fact_log);
end $$;
set role authenticated;
select public._t_as('aaaaaaaa-0000-4000-8000-00000000000a');
do $$ begin
  perform public._t_fails($q$select public.student_360_log(gen_random_uuid(), gen_random_uuid(), 'x', null, null)$q$, 'permission denied');
  raise notice 'PASS hàm nội bộ student_360_log không gọi được từ authenticated';
end $$;
reset role;
drop table public._t_ids;
drop function public._t_as(uuid); drop function public._t_fails(text, text); drop function public._t_eq(anyelement, anyelement, text);
