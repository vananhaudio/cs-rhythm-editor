-- ═══ TEST Teacher All Classes V1 (db/teacher_all_classes_v1_setup.sql) ═══
-- CHỈ chạy trên cluster tạm qua scripts/test-teacher-all-classes-db.sh. Fixture: A ∈ TH01/HT2027/CUR01 · B ∈ TH01/CUR01 ·
-- C ∈ TH02 · T = teacher · N = ADMIN không hồ sơ học sinh (đúng hình dạng tài khoản Thầy production).
-- Kiểm cả quyền THẬT của các RPC/RLS mà trang lớp/buổi dùng (không chỉ danh sách). class_learning_entry (Join Code V1,
-- không có trong baseline này) được kiểm ở smoke production db/tests/teacher_all_classes_v1_prod_smoke.sql.
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
-- class_sessions: giống production (pg_policies đọc 05/10: cses_auth_read = authenticated đọc mọi buổi; nội dung buổi
-- nằm ở class_lesson_content có RLS riêng). Fixture sau rls_setup.sql bật RLS nhưng chưa có policy này.
alter table public.class_sessions enable row level security;
drop policy if exists cses_auth_read on public.class_sessions;
create policy cses_auth_read on public.class_sessions for select to authenticated using (true);
update public.app_users set role = 'admin' where id = 'eeeeeeee-0000-4000-8000-00000000000e';
delete from public.edu_students where user_id = 'eeeeeeee-0000-4000-8000-00000000000e';

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg;
end $$;
create function t.fails(q text, msg text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn: %', msg, q;
end $$;
create function t.all_ids() returns text language sql as $$ select coalesce(string_agg(c ->> 'id', ',' order by c ->> 'id'), '') from public.social_all_classes() c $$;
create function t.mine_ids() returns text language sql as $$ select coalesce(string_agg(c ->> 'id', ',' order by c ->> 'id'), '') from public.social_my_classes() c $$;
create function t.visible_ids() returns text language sql security definer as $$
  select coalesce(string_agg(id::text, ',' order by id::text), '') from public.class_schedule where coalesce(status, '') not in ('cancelled', 'merged', 'draft') $$;
create function t.data_fp() returns text language sql security definer as $$
  select md5((select count(*) from public.edu_group_members)::text || (select count(*) from public.class_curriculum_access)::text
    || (select count(*) from public.learning_session_progress)::text || (select count(*) from public.learning_threads)::text
    || (select count(*) from public.edu_students)::text || (select string_agg(id::text || coalesce(status, ''), ',' order by id) from public.class_schedule)) $$;
-- Đọc PHẢI ra 0 dòng hoặc bị chặn (anon có thể không có GRANT, hoặc có GRANT nhưng RLS lọc hết)
create function t.none(q text, msg text) returns void language plpgsql as $$ declare n bigint; begin
  begin execute q into n; exception when others then raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  if n <> 0 then raise exception 'FAIL: % — đọc được % dòng', msg, n; end if;
  raise notice 'PASS: % (0 dòng)', msg;
end $$;
grant execute on all functions in schema t to anon, authenticated;
create table t.snap (k text primary key, v text);
grant all on t.snap to authenticated;
insert into t.snap values ('fp', t.data_fp());

-- Lớp huỷ / nháp (không được hiện; social_class_detail cũng không mở được chúng)
insert into public.class_schedule (id, code, name, status, start_date) values
  ('b1000000-0000-4000-8000-0000000000c1', 'X.HUY', 'Lớp đã huỷ', 'cancelled', current_date),
  ('b1000000-0000-4000-8000-0000000000d1', 'X.NHAP', 'Lớp nháp', 'draft', current_date),
  ('b1000000-0000-4000-8000-0000000000e1', 'X.XONG', 'Lớp đã kết thúc', 'completed', current_date - 300);
update t.snap set v = t.data_fp() where k = 'fp';

-- ── 1. Thầy (teacher) + Admin không hồ sơ HS: thấy TẤT CẢ ──
do $$ declare v_all text := t.visible_ids(); begin
  perform t.as_user('T');
  perform t.ok(t.all_ids() = v_all, '1 teacher T thấy TẤT CẢ lớp (bỏ huỷ/gộp/nháp), kể cả lớp đã kết thúc');
  perform t.ok(t.mine_ids() = '', '1 T không là thành viên lớp nào (không enrollment) — Lớp của tôi vẫn rỗng');
  perform t.ok(position('b1000000-0000-4000-8000-0000000000c1' in t.all_ids()) = 0 and position('b1000000-0000-4000-8000-0000000000d1' in t.all_ids()) = 0,
               '1 lớp huỷ / nháp không hiện');
  perform t.as_user('N');
  perform t.ok(t.all_ids() = v_all, '1 ADMIN không hồ sơ học sinh (như tài khoản Thầy) thấy TẤT CẢ lớp');
  perform t.ok((select bool_and((c ->> 'is_member')::boolean = false) from public.social_all_classes() c), '1 thẻ lớp của admin: is_member=false (không giả thành viên)');
  perform t.reset();
end $$;

-- ── 2. Lớp mới tạo tự xuất hiện; lớp đổi sang huỷ tự biến mất ──
insert into public.class_schedule (id, code, name, status, start_date) values ('b1000000-0000-4000-8000-0000000000f1', 'NEW.TH01', 'Lớp mới', 'upcoming', current_date + 7);
do $$ begin
  perform t.as_user('N');
  perform t.ok(position('b1000000-0000-4000-8000-0000000000f1' in t.all_ids()) > 0, '2 lớp mới tạo tự xuất hiện với admin');
  perform t.reset();
  update public.class_schedule set status = 'cancelled' where id = 'b1000000-0000-4000-8000-0000000000f1';
  perform t.as_user('N');
  perform t.ok(position('b1000000-0000-4000-8000-0000000000f1' in t.all_ids()) = 0, '2 lớp chuyển sang huỷ tự biến mất');
  perform t.reset();
  delete from public.class_schedule where id = 'b1000000-0000-4000-8000-0000000000f1';
end $$;

-- ── 3. Học sinh / khách KHÔNG có quyền danh sách toàn bộ ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select * from public.social_all_classes()$q$, '3 học sinh A gọi social_all_classes → 42501');
  perform t.ok(t.mine_ids() <> '' and position('b1000000-0000-4000-8000-000000000002' in t.mine_ids()) = 0,
               '3 A: Lớp của tôi chỉ lớp A tham gia (không có TH02 của C)');
  perform t.as_user('C');
  perform t.ok(position('b1000000-0000-4000-8000-000000000001' in t.mine_ids()) = 0 and position('b1000000-0000-4000-8000-000000000004' in t.mine_ids()) = 0,
               '3 C: Lớp của tôi không có TH01 / CUR01');
  perform t.as_anon();
  perform t.fails($q$select * from public.social_all_classes()$q$, '3 anon không gọi được');
  perform t.none($q$select count(*) from public.social_my_classes()$q$, '3 anon: social_my_classes không trả lớp nào');
  perform t.reset();
end $$;

-- ── 4. Quyền THẬT của trang lớp / buổi: Thầy + admin vào được, không cần enrollment, không tạo tiến độ ──
do $$ declare s jsonb; begin
  perform t.as_user('N');
  s := public.class_learning_state('b1000000-0000-4000-8000-000000000001');
  perform t.ok((s ->> 'enabled')::boolean and s ->> 'role' = 'teacher', '4 admin: class_learning_state TH01 bật, vai trò teacher');
  perform t.ok((select bool_and(x ->> 'opened_at' is null and x ->> 'completed_at' is null) from jsonb_array_elements(s -> 'sessions') x),
               '4 admin: không có tiến độ cá nhân (opened/completed null)');
  perform t.ok((select count(*) from public.class_lesson_content lc join public.class_sessions cs on cs.id = lc.session_id
                where cs.class_id = 'b1000000-0000-4000-8000-000000000004' and lc.status = 'published') = 2,
               '4 admin đọc được giáo án đã xuất bản của CUR01 (RLS teacher)');
  perform t.ok((select count(*) from public.social_class_members('b1000000-0000-4000-8000-000000000002')) >= 1, '4 admin xem được thành viên TH02');
  perform t.ok((public.social_class_detail('b1000000-0000-4000-8000-0000000000e1') ->> 'can_view_members')::boolean, '4 admin mở được lớp đã kết thúc');
  perform t.as_user('T');
  perform t.ok((public.class_learning_state('b1000000-0000-4000-8000-000000000002') ->> 'role') = 'teacher', '4 teacher T: class_learning_state TH02 vai trò teacher');
  perform t.reset();
  perform t.ok(not exists (select 1 from public.learning_session_progress where learner_user_id in (t.u('N'), t.u('T'))),
               '4 xem lớp KHÔNG tạo learning_session_progress cho Thầy/admin');
end $$;

-- ── 5. Cách ly học sinh: C (TH02) mở thẳng TH01 / CUR01 → không lộ nội dung ──
do $$ begin
  perform t.as_user('C');
  perform t.ok(not (public.class_learning_state('b1000000-0000-4000-8000-000000000001') ->> 'enabled')::boolean, '5 C: class_learning_state TH01 TẮT');
  perform t.ok((select count(*) from public.class_lesson_content lc join public.class_sessions cs on cs.id = lc.session_id
                where cs.class_id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004')) = 0,
               '5 C: không đọc được giáo án TH01 / CUR01 (RLS)');
  perform t.fails($q$select * from public.social_class_members('b1000000-0000-4000-8000-000000000001')$q$, '5 C: không xem thành viên TH01');
  perform t.as_user('B');   -- thành viên CUR01 nhưng KHÔNG có quyền giáo trình
  perform t.ok((select count(*) from public.class_lesson_content lc join public.class_sessions cs on cs.id = lc.session_id
                where cs.class_id = 'b1000000-0000-4000-8000-000000000004') = 0, '5 B (thành viên, không quyền giáo trình) vẫn không đọc giáo án CUR01');
  perform t.as_anon();
  perform t.none($q$select count(*) from public.class_lesson_content$q$, '5 anon không đọc được giáo án');
  perform t.fails($q$select public.class_learning_state('b1000000-0000-4000-8000-000000000001')$q$, '5 anon: class_learning_state bị chặn');
  perform t.none($q$select count(*) from public.class_curriculum_access$q$, '5 anon không đọc quyền giáo trình');
  perform t.reset();
end $$;

do $$ begin
  perform t.ok(t.data_fp() = (select v from t.snap where k = 'fp'), '6 KHÔNG đổi membership / quyền giáo trình / tiến độ / thread / hồ sơ HS / lớp');
end $$;
set client_min_messages = warning;
drop schema t cascade;
