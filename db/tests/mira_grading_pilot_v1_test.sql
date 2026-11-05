-- ═══ TEST MIRA GRADING PILOT V1.1 — cluster PostgreSQL TẠM (scripts/test-mira-grading-pilot-db.sh) ═══
-- Nạp SAU fixture + checkpoint + Student 360 P1 + mira_grading_v1_setup + mira_grading_pilot_v1_setup. A: học viên · T, T2: thầy · N: ngoài Class
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000000f', 't2@test.local');
insert into public.app_users (id, role, name, email) values ('ffffffff-0000-4000-8000-00000000000f', 'teacher', 'Thầy khác', 't2@test.local');
create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'T2' then 'ffffffff-0000-4000-8000-00000000000f'::uuid when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, false);
  perform set_config('request.headers', '{}', false); perform set_config('role', 'authenticated', false);
end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', false); perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  perform set_config('request.headers', '{}', false); perform set_config('role', 'anon', false);
end $$;
create function t.as_mira(key text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', false); perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  perform set_config('request.headers', case when key is null then '{}' else json_build_object('x-mira-grading-key', key)::text end, false);
  perform set_config('role', 'anon', false);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', false); perform set_config('request.jwt.claims', '{}', false); perform set_config('request.headers', '{}', false);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg;
end $$;
create function t.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute q; exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then raise exception 'FAIL: % — sai lý do: %', msg, sqlerrm; end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
create function t.thread() returns uuid language sql security definer set search_path = '' as $$
  select id from public.learning_threads where learner_user_id = t.u('A') and content_key = 'C:SOLO01:1:1.1' $$;
create function t.ctx(key text, tick text, src text) returns jsonb language plpgsql as $$ declare r jsonb; begin
  perform t.as_mira(key); r := public.mira_grading_context(tick, src); perform t.reset(); return r; end $$;
create function t.mint(k text) returns text language plpgsql as $$ declare r jsonb; begin
  perform t.as_user(k); r := public.mira_grading_ticket(t.thread()); perform t.reset(); return r ->> 'ticket'; end $$;
grant execute on all functions in schema t to anon, authenticated;
-- cổng thêm pilot đúng như thao tác Owner sẽ chạy: chỉ thêm khi uid là teacher/admin
create function t.add_pilot(k text) returns integer language plpgsql security definer set search_path = '' as $$ declare n int; begin
  insert into public.mira_grading_pilot (user_id, note) select id, 'test' from public.app_users where id = t.u(k) and role in ('teacher', 'admin') on conflict do nothing;
  get diagnostics n = row_count; return n; end $$;
create function t.del_pilot(k text) returns void language sql security definer set search_path = '' as $$ delete from public.mira_grading_pilot where user_id = t.u(k) $$;
grant execute on function t.add_pilot(text), t.del_pilot(text) to anon, authenticated;

\o /dev/null
select t.as_user('A');
select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', 'Bài của A.');
select t.reset();
insert into public.mira_grading_keys (key_hash) values (encode(sha256(convert_to('KHOA-MIRA-TEST', 'UTF8')), 'hex'));
\o

-- ── 1) Chưa ai trong pilot: mọi người bị chặn ──
select t.ok((select count(*) = 0 from public.mira_grading_pilot), 'pilot rỗng lúc đầu: không ai được thêm sẵn');
select t.as_user('T'); select t.fails($q$ select public.mira_grading_ticket(t.thread()) $q$, 'thầy KHÔNG trong pilot: bị chặn ở server', 'forbidden');
select t.ok(public.mira_grading_pilot_enabled() = false, 'pilot_enabled(thầy ngoài pilot) = false');
select t.as_user('T2'); select t.fails($q$ select public.mira_grading_ticket(t.thread()) $q$, 'thầy khác KHÔNG trong pilot: bị chặn', 'forbidden');
select t.as_user('A'); select t.fails($q$ select public.mira_grading_ticket(t.thread()) $q$, 'học viên bị chặn', 'forbidden');
select t.ok(public.mira_grading_pilot_enabled() = false, 'pilot_enabled(học viên) = false');
select t.as_user('N'); select t.ok(public.mira_grading_pilot_enabled() = false, 'pilot_enabled(người ngoài Class) = false');
select t.as_anon();
select t.fails($q$ select public.mira_grading_ticket(t.thread()) $q$, 'anon xin vé: bị chặn quyền hàm', 'permission denied');
select t.fails($q$ select public.mira_grading_pilot_enabled() $q$, 'anon hỏi pilot_enabled: bị chặn quyền hàm', 'permission denied');
select t.reset();
select t.ok((select count(*) = 0 from public.mira_grading_tickets), 'không vé nào được tạo cho người bị chặn');

-- ── 2) Quyền bảng pilot ──
select t.as_user('T'); select t.fails($q$ select * from public.mira_grading_pilot $q$, 'authenticated không đọc trực tiếp bảng pilot', 'permission denied');
select t.fails($q$ insert into public.mira_grading_pilot (user_id) values (t.u('T')) $q$, 'thầy KHÔNG tự thêm mình vào pilot', 'permission denied');
select t.as_anon(); select t.fails($q$ select * from public.mira_grading_pilot $q$, 'anon không đọc bảng pilot', 'permission denied');
select t.reset();
select t.ok(not has_table_privilege('anon', 'public.mira_grading_pilot', 'select') and not has_table_privilege('authenticated', 'public.mira_grading_pilot', 'insert')
            and not has_table_privilege('authenticated', 'public.mira_grading_pilot', 'update') and not has_table_privilege('authenticated', 'public.mira_grading_pilot', 'delete'), 'không quyền bảng cho anon/authenticated');
select t.ok((select relrowsecurity from pg_class where oid = 'public.mira_grading_pilot'::regclass) and (select count(*) = 0 from pg_policies where tablename = 'mira_grading_pilot'), 'RLS bật, không policy');

-- ── 3) Thêm đúng một uid (thao tác của Owner) ──
select t.ok(t.add_pilot('N') = 0, 'cổng thêm pilot từ chối uid không phải teacher/admin (0 dòng)');
select t.ok(t.add_pilot('A') = 0, 'cổng thêm pilot từ chối học viên (0 dòng)');
select t.ok(t.add_pilot('T') = 1, 'thêm đúng uid thầy T vào pilot (1 dòng)');
select t.ok(t.add_pilot('T') = 0, 'thêm lần hai không nhân đôi');
select t.ok((select count(*) = 1 from public.mira_grading_pilot), 'pilot có đúng 1 tài khoản');
select t.as_user('T'); select t.ok(public.mira_grading_pilot_enabled() = true, 'pilot_enabled(T trong pilot) = true');
select t.as_user('T2'); select t.ok(public.mira_grading_pilot_enabled() = false, 'pilot_enabled(T2) vẫn false — chỉ trả trạng thái của chính người gọi');
select t.fails($q$ select public.mira_grading_ticket(t.thread()) $q$, 'T2 vẫn bị chặn khi T đã vào pilot', 'forbidden');
select t.reset();

-- ── 4) Thầy trong pilot đi đúng đường: vé → Mira đọc ──
create temp table tk as select t.mint('T') tk; grant all on tk to public;
select t.ok((select length(tk) = 64 from tk), 'T (pilot) xin được vé 64 ký tự');
create temp table c1 as select t.ctx('KHOA-MIRA-TEST', (select tk from tk), 'thread') j; grant all on c1 to public;
select t.ok((select j ->> 'status' = 'ok' and j ->> 'thread_id' = t.thread()::text and j -> 'teacher' ->> 'id' = t.u('T')::text from c1), 'Mira đọc đúng bài trả bằng vé của T');
select t.fails($q$ select t.ctx('KHOA-SAI', (select tk from tk), 'thread') $q$, 'sai khoá vẫn bị chặn', 'forbidden');
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', repeat('0', 64), 'thread') $q$, 'vé giả vẫn bị chặn', 'forbidden');

-- ── 5) Gỡ khỏi pilot: vé đang sống mất hiệu lực NGAY ──
select t.del_pilot('T');
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', (select tk from tk), 'thread') $q$, 'gỡ T khỏi pilot → vé còn hạn 5 phút cũng bị từ chối ngay', 'forbidden');
select t.as_user('T'); select t.fails($q$ select public.mira_grading_ticket(t.thread()) $q$, 'T bị gỡ không xin được vé mới', 'forbidden');
select t.ok(public.mira_grading_pilot_enabled() = false, 'pilot_enabled(T đã gỡ) = false');
select t.reset();
select t.ok(t.add_pilot('T') = 1, 'thêm lại T');
select t.ok((select j ->> 'status' = 'ok' from (select t.ctx('KHOA-MIRA-TEST', (select tk from tk), 'thread') j) z), 'thêm lại → vé cũ còn hạn dùng lại được (vé không bị xoá, chỉ bị chặn khi ngoài pilot)');

-- ── 6) Mất vai teacher dù còn trong pilot ──
update public.app_users set role = 'student' where id = t.u('T');
select t.as_user('T'); select t.ok(public.mira_grading_pilot_enabled() = false, 'T mất vai teacher → pilot_enabled = false dù còn trong danh sách');
select t.fails($q$ select public.mira_grading_ticket(t.thread()) $q$, 'T mất vai → không xin vé', 'forbidden');
select t.reset();
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', (select tk from tk), 'thread') $q$, 'T mất vai → vé cũ bị từ chối', 'forbidden');
update public.app_users set role = 'teacher' where id = t.u('T');

-- ── 7) end vẫn dùng được bởi chính chủ; không rò vé của người khác ──
select t.as_user('T'); select t.ok(public.mira_grading_end(t.thread()) >= 1, 'T thu hồi vé của chính mình');
select t.reset();
select t.ok((select count(*) = 0 from public.mira_grading_tickets), 'không còn vé nào sau khi thu hồi');
do $$ begin raise notice 'XONG: kiểm thử pilot DB đạt'; end $$;
