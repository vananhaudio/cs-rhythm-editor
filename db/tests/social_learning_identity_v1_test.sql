-- ═══ TEST LEARNING IDENTITY V1 (social_learning_identities) — cluster PostgreSQL TẠM (scripts/test-learning-threads-db.sh) ═══
-- Nạp SAU fixture + P1 + P2 + social_classes_v1 + social_learning_identity_v1. KHÔNG chạy production.
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
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
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true);
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
-- Mã lớp (sắp xếp) trong danh tính của một người, gọi với quyền người đang đóng vai
create function t.codes(p_user uuid) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'class_code' order by e ->> 'class_code'), '{}')
  from public.social_learning_identities(array[p_user]) r, jsonb_array_elements(r.memberships) e
$$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Dữ liệu: A (KD18 fixture) + HT2027 (đang học) + SOLO01 (completed) + DH1 (completed) + lớp sắp mở + lớp huỷ + lớp đã rời;
--    C vào lớp qua nhóm CÙNG MÃ (nhánh upper(g.code) = upper(cs.code)); Thầy T là thành viên nhóm KD18 (quản lý) ──
insert into public.edu_courses (id, name, code, track) values
  ('c0000000-0000-4000-8000-0000000000f1', 'Hành trình 2027', 'HT2027', 'dem_hat'),
  ('c0000000-0000-4000-8000-0000000000f2', 'Solo Guitar Căn Bản', 'SOLO', 'solo'),
  ('c0000000-0000-4000-8000-0000000000f3', 'Khởi Đầu Đam Mê – Đệm Hát Trình Độ 1', 'DH1', 'dem_hat');
insert into public.edu_groups (id, name, group_type, code) values
  ('f0000000-0000-4000-8000-0000000000a1', 'HT', 'class', 'HT2027.TH01'),
  ('f0000000-0000-4000-8000-0000000000a2', 'SOLO', 'class', 'SOLO01.TH01'),
  ('f0000000-0000-4000-8000-0000000000a3', 'DH1', 'class', 'DH1.KD17'),
  ('f0000000-0000-4000-8000-0000000000a4', 'CB', 'class', 'CB1.T3'),
  ('f0000000-0000-4000-8000-0000000000a5', 'HUY', 'class', 'DH1.KD20'),
  ('f0000000-0000-4000-8000-0000000000a6', 'ROI', 'class', 'TN1.GL14'),
  ('f0000000-0000-4000-8000-0000000000a7', 'ZALO-DH3', 'zalo', 'DHNC01.TH01');   -- không gắn id: khớp theo MÃ
insert into public.class_schedule (id, code, name, status, is_active, start_date, cohort_group_id, program_code, main_course_id) values
  ('b0000000-0000-4000-8000-0000000000a1', 'HT2027.TH01', 'Hành trình 2027 — 40 buổi thực hành', 'active', true, current_date - 30, 'f0000000-0000-4000-8000-0000000000a1', 'HT2027', 'c0000000-0000-4000-8000-0000000000f1'),
  ('b0000000-0000-4000-8000-0000000000a2', 'SOLO01.TH01', 'Solo Guitar Căn Bản', 'completed', true, current_date - 300, 'f0000000-0000-4000-8000-0000000000a2', 'SOLO01', 'c0000000-0000-4000-8000-0000000000f2'),
  ('b0000000-0000-4000-8000-0000000000a3', 'DH1.KD17', 'Khởi đầu đam mê khóa 17 - KD17', 'completed', true, current_date - 400, 'f0000000-0000-4000-8000-0000000000a3', null, 'c0000000-0000-4000-8000-0000000000f3'),
  ('b0000000-0000-4000-8000-0000000000a4', 'CB1.T3', 'Guitar căn bản 1', 'upcoming', true, current_date + 10, 'f0000000-0000-4000-8000-0000000000a4', null, null),
  ('b0000000-0000-4000-8000-0000000000a5', 'DH1.KD20', 'Lớp đã huỷ', 'cancelled', true, current_date - 10, 'f0000000-0000-4000-8000-0000000000a5', null, 'c0000000-0000-4000-8000-0000000000f3'),
  ('b0000000-0000-4000-8000-0000000000a6', 'TN1.GL14', 'Tỉa nốt 1 — GL14', 'active', true, current_date - 10, 'f0000000-0000-4000-8000-0000000000a6', null, null),
  ('b0000000-0000-4000-8000-0000000000a7', 'DHNC01.TH01', 'Đệm hát nâng cao', 'active', true, current_date - 5, null, 'DHNC01', null);
insert into public.class_schedule (id, code, name, status, is_active, start_date, end_date, program_code) values
  ('b0000000-0000-4000-8000-0000000000a8', 'HT2028.TH01', 'Hành trình 2028', 'scheduled', true, current_date + 90, null, 'HT2028'),
  ('b0000000-0000-4000-8000-0000000000a9', 'HT2025.TH01', 'Hành trình 2025', 'active', true, current_date - 700, current_date - 300, 'HT2025');
update public.edu_students set ht_member = true where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b';
insert into public.edu_group_members (user_id, group_id, source, status) values
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000a1', 'admin', 'active'),
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000a2', 'admin', 'active'),
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000a3', 'admin', 'active'),
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000a4', 'admin', 'active'),
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000a5', 'admin', 'active'),
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000a6', 'admin', 'inactive'),
  (t.u('C'), 'f0000000-0000-4000-8000-0000000000a7', 'admin', 'active'),
  (t.u('T'), 'f0000000-0000-4000-8000-0000000000c1', 'admin', 'active');

do $$
declare r record; keys text[]; v1 text[];
begin
  perform t.as_user('B');
  perform t.ok(t.codes(t.u('A')) = array['CB1.T3', 'DH1.KD17', 'DH2.KD18', 'HT2027.TH01', 'SOLO01.TH01'],
    'A: đang học (KD18, HT2027) + sắp học (CB1) + đã xong (SOLO01, DH1) — KHÔNG lớp huỷ, KHÔNG lớp đã rời (inactive): ' || t.codes(t.u('A'))::text);
  -- Nhất quán với Lớp học V1: đúng tập lớp social_class_is_member (trừ cancelled/merged/draft) — tính bằng quyền quản trị test
  perform t.reset();
  select coalesce(array_agg(cs.code order by cs.code), '{}') into v1 from public.class_schedule cs
   where cs.status in ('active', 'ending_soon', 'paused', 'recruiting', 'ready_to_open', 'scheduled', 'upcoming', 'completed')
     and public.social_class_is_member(cs.id, t.u('A'));
  perform t.as_user('B');
  perform t.ok(t.codes(t.u('A')) = v1, 'tập lớp = ĐÚNG luật thành viên social_class_is_member của Lớp học V1: ' || t.codes(t.u('A'))::text || ' vs ' || v1::text);
  perform t.ok(t.codes(t.u('C')) = array['DHNC01.TH01'], 'C vào lớp qua nhóm CÙNG MÃ lớp (không gắn id) → có danh tính');
  perform t.ok(t.codes(t.u('T')) = '{}' and not exists (select 1 from public.social_learning_identities(array[t.u('T')])),
    'Thầy (thành viên nhóm để quản lý) KHÔNG có danh tính học sinh');
  select r2.memberships -> 0 as m into r from public.social_learning_identities(array[t.u('A')]) r2;
  select array_agg(k order by k) into keys from jsonb_object_keys(r.m) k;
  perform t.ok(keys = array['class_code', 'class_id', 'class_name', 'course_code', 'course_name', 'end_date', 'program_code', 'start_date', 'status', 'track'],
    'chỉ thông tin lớp công khai (không zoom/giá/tiến độ/email/SĐT): ' || keys::text);
  perform t.ok((select e ->> 'program_code' from public.social_learning_identities(array[t.u('A')]) r3, jsonb_array_elements(r3.memberships) e
                where e ->> 'class_code' = 'HT2027.TH01') = 'HT2027', 'HT2027: trả program_code để client dựng nhãn Hành trình 2027');
  perform t.ok((select count(*) from public.social_learning_identities(array[t.u('A'), t.u('B'), t.u('A'), null])) = 2,
    'nhiều người một lần, bỏ trùng + null');
  perform t.ok((select count(*) from public.social_learning_identities((select array_agg(gen_random_uuid()) from generate_series(1, 250)))) = 200,
    'tối đa 200 người mỗi lần gọi');
  -- Cờ Hành trình (edu_students.ht_member): gắn vào lớp Hành trình ĐANG DIỄN RA — không vào khoá HT chưa mở / đã hết hạn
  perform t.ok(t.codes(t.u('B')) = array['HT2027.TH01'], 'B có cờ Hành trình (không trong nhóm lớp) → lớp Hành trình đang diễn ra: ' || t.codes(t.u('B'))::text);
  perform t.ok(not ('HT2028.TH01' = any(t.codes(t.u('B')))) and not ('HT2025.TH01' = any(t.codes(t.u('B')))),
    'không gắn vào HT2028 (chưa mở) / HT2025 (đã hết hạn)');
  perform t.ok(t.codes(t.u('C')) = array['DHNC01.TH01'], 'không có cờ → không Hành trình');
  perform t.as_user('N');
  perform t.ok(not exists (select 1 from public.social_learning_identities(array[t.u('A')])), 'ngoài Class: không thấy gì');
  perform t.as_anon();
  perform t.fails($q$ select * from public.social_learning_identities(array['aaaaaaaa-0000-4000-8000-00000000000a'::uuid]) $q$,
    'khách không gọi được', 'permission denied');
  perform t.reset();
end $$;

drop schema t cascade;
