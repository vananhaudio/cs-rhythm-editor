-- ═══ TEST share_note_session_open (db/share_note_session_open_v1_setup.sql) — bảo vệ khoá buổi cho xem trước trên Feed ═══
-- Chạy trên cluster PostgreSQL TẠM qua scripts/test-share-note-db.sh. KHÔNG production.
-- A, B: SOLO01.TH01 (có quyền giáo trình) · C: SOLO01.TH02 (không quyền TH01) · T: Thầy · N: ngoài Class.
-- CUR01.TH01: A có quyền, B là thành viên KHÔNG quyền giáo trình.
\set ON_ERROR_STOP on
do $$ begin if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if; end $$;
-- MỘT giao dịch: t.as_user() dùng set_config(..., is_local = true) → role/claims giữ qua các câu lệnh cho tới t.reset()
begin;
create schema t; grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true); end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true); end $$;
create function t.reset() returns void language plpgsql as $$ begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true); end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg; end $$;
create function t.err(q text) returns text language plpgsql as $$ begin execute q; return 'OK'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create table t.ids (k text primary key, v text); grant all on t.ids to authenticated, anon;
create function t.id(p text) returns uuid language sql stable as $$ select v::uuid from t.ids where k = p $$;
create function t.put(p text, v uuid) returns void language sql as $$ insert into t.ids values (p, v::text) on conflict (k) do update set v = excluded.v $$;
-- Ảnh chụp giáo trình + số tin Chat (postgres) — chứng minh chia sẻ KHÔNG chạm asset gốc
create function t.snap() returns text language sql security definer as $$ select md5(string_agg(c::text, '|' order by session_id)) from public.class_lesson_content c $$;
create function t.open(p uuid) returns table(status text, note text, is_author boolean, session_no integer, section_idx integer, score_path text[], bar_from integer, bar_to integer)
  language sql as $$ select o.status, o.note, o.is_author, o.session_no, o.section_idx, o.score_path, o.bar_from, o.bar_to from public.share_note_open(p) o $$;
grant execute on all functions in schema t to anon, authenticated;


create function t.prog_snap() returns text language sql security definer as $$
  select coalesce(md5(string_agg(p::text, '|' order by p.id)), 'empty') || ':' || count(*) from public.learning_session_progress p $$;
create function t.last_idx(s uuid) returns int language sql security definer as $$ select jsonb_array_length(blocks) - 1 from public.class_lesson_content where session_id = s $$;
create function t.state_open(k text, n int) returns boolean language plpgsql as $$ declare st jsonb; begin
  perform t.as_user(k); st := public.class_learning_state('b1000000-0000-4000-8000-000000000001'::uuid); perform t.reset();
  return (select (s ->> 'opened_at') is not null from jsonb_array_elements(st -> 'sessions') s where (s ->> 'session_no')::int = n); end $$;
create function t.so(k text, p uuid) returns boolean language plpgsql as $$ declare r boolean; begin
  perform t.as_user(k); r := public.share_note_session_open(p); perform t.reset(); return r; end $$;
grant execute on all functions in schema t to anon, authenticated;

-- Chuẩn bị (postgres): bạn bè A↔B · bản nhạc vào Buổi 1, 2, 3 của TH01 và vào CUR01
insert into public.friendships (requester_id, addressee_id, status, responded_at) values (t.u('A'), t.u('B'), 'accepted', now()) on conflict do nothing;
update public.class_lesson_content set blocks = blocks || '[{"kind":"score","title":"S","tex":"\\ts 4 4\n:4 c4 d4 e4 f4 | g4 a4 b4 c5"}]'::jsonb
 where session_id in ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000001');
-- A (có quyền giáo trình) tạo + đăng Feed 4 note: Buổi 1, 2, 3 (TH01) và CUR01
select t.as_user('A');
select t.put('N1', public.share_note_create('51000000-0000-4000-8000-000000000001', t.last_idx('51000000-0000-4000-8000-000000000001'), array['tex'], 1, 2, 'buổi 1', 'so-key-00001')),
       t.put('N2', public.share_note_create('51000000-0000-4000-8000-000000000002', t.last_idx('51000000-0000-4000-8000-000000000002'), array['tex'], 1, 2, 'buổi 2', 'so-key-00002')),
       t.put('N3', public.share_note_create('51000000-0000-4000-8000-000000000003', t.last_idx('51000000-0000-4000-8000-000000000003'), array['tex'], 1, 2, 'buổi 3', 'so-key-00003')),
       t.put('NC', public.share_note_create('54000000-0000-4000-8000-000000000001', t.last_idx('54000000-0000-4000-8000-000000000001'), array['tex'], 1, 1, 'cur', 'so-key-00004'));
select public.social_share_share_note(t.id('N1')), public.social_share_share_note(t.id('N2')), public.social_share_share_note(t.id('N3')), public.social_share_share_note(t.id('NC'));
select t.reset();

-- ══ 1. Bề mặt + tính chất
select t.ok((select provolatile from pg_proc where oid = 'public.share_note_session_open(uuid)'::regprocedure) = 's', 'hàm là STABLE (không thể ghi dữ liệu)');
select t.as_anon();
select t.ok(t.err($q$select public.share_note_session_open(gen_random_uuid())$q$) like '42501:%', 'anon không gọi được');
select t.reset();
select t.ok(not exists (select 1 from information_schema.routine_privileges where specific_schema = 'public' and routine_name = 'share_note_session_open' and grantee in ('PUBLIC','anon')), 'chỉ authenticated có EXECUTE');
select t.as_user('B'); select t.ok(public.share_note_session_open(null) is false and public.share_note_session_open(gen_random_uuid()) is false, 'null / note không tồn tại → false (không lỗi, không lộ)'); select t.reset();

-- ══ 2. KHÔNG tác dụng phụ: B chưa từng vào lớp → gọi hàm không tạo / sửa tiến độ nào
create table t.snap0 as select t.prog_snap() as s;
select t.ok(t.so('B', t.id('N1')) is true, 'B (chưa vào lớp): Buổi 1 = mở (buổi đầu luôn mở khi vào lớp)');
select t.ok(t.so('B', t.id('N2')) is false, 'B: Buổi 2 chưa mở → false');
select t.ok(t.so('B', t.id('N3')) is false, 'B: Buổi 3 chưa mở → false');
select t.ok(t.prog_snap() = (select s from t.snap0), 'gọi hàm cho B KHÔNG thêm / sửa dòng tiến độ nào (opened_at nguyên vẹn)');
select t.ok(not exists (select 1 from public.learning_session_progress where learner_user_id = t.u('B')), 'B vẫn 0 dòng learning_session_progress');

-- ══ 3. KHỚP class_learning_state THẬT, từng buổi (gọi state làm B vào lớp → Buổi 1 mở)
select t.ok(t.state_open('B', 1) is true and t.state_open('B', 2) is false and t.state_open('B', 3) is false, 'class_learning_state(B): chỉ Buổi 1 mở');
select t.ok(t.so('B', t.id('N1')) = t.state_open('B', 1) and t.so('B', t.id('N2')) = t.state_open('B', 2) and t.so('B', t.id('N3')) = t.state_open('B', 3), 'share_note_session_open == opened_at của class_learning_state (B, 3 buổi)');
select t.ok(t.so('A', t.id('N2')) is false, 'tác giả A cũng bị khoá Buổi 2 (luật như mọi học viên)');
insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id) values (t.u('B'), 'SOLO01', 2, 'b1000000-0000-4000-8000-000000000001');
select t.ok(t.so('B', t.id('N2')) is true and t.so('B', t.id('N3')) is false, 'Buổi 2 có opened_at → mở; Buổi 3 vẫn khoá');
select t.ok(t.so('B', t.id('N2')) = t.state_open('B', 2) and t.so('B', t.id('N3')) = t.state_open('B', 3), 'vẫn khớp class_learning_state sau khi mở Buổi 2');

-- ══ 4. Chính sách 'open' của lớp
update public.class_schedule set unlock_policy = 'open' where id = 'b1000000-0000-4000-8000-000000000001';
select t.ok(t.so('B', t.id('N3')) is true, 'unlock_policy open: Buổi 3 đã xuất bản → mở');
update public.class_schedule set unlock_policy = 'sequential' where id = 'b1000000-0000-4000-8000-000000000001';
select t.ok(t.so('B', t.id('N3')) is false, 'về sequential: Buổi 3 khoá lại');

-- ══ 5. Thầy · lớp khác · ngoài Class · chế độ giáo trình · quyền giáo trình
select t.ok(t.so('T', t.id('N3')) is true, 'Thầy xem được cả Buổi 3 (đang khoá với học viên)');
select t.ok(t.so('C', t.id('N1')) is false and t.so('C', t.id('N2')) is false, 'C (lớp TH02) không thấy / không mở note của TH01');
select t.ok(t.so('N', t.id('N1')) is false, 'N (ngoài Class) → false');
select t.ok(t.so('A', t.id('NC')) is true, 'CUR01 (chế độ giáo trình, không checkpoint): không có khoá → mở');
select t.ok(t.so('B', t.id('NC')) is false, 'CUR01: B là thành viên KHÔNG có quyền giáo trình → false');
-- note đã gỡ: false
select t.as_user('A'); select public.share_note_delete(t.id('N1')); select t.reset();
select t.ok(t.so('B', t.id('N1')) is false, 'note đã gỡ → false');

-- ══ 6. Buổi chuyển sang NHÁP sau khi chia sẻ → false (giống share_note_open)
update public.class_lesson_content set status = 'draft' where session_id = '51000000-0000-4000-8000-000000000002';
select t.ok(t.so('B', t.id('N2')) is false, 'Buổi đã gỡ xuất bản → false dù có opened_at');
update public.class_lesson_content set status = 'published' where session_id = '51000000-0000-4000-8000-000000000002';

-- ══ 7. Toàn vẹn: không chạm giáo trình / tiến độ ngoài các dòng test tự chèn
select t.ok((select count(*) from public.learning_session_progress where learner_user_id = t.u('B')) = 2, 'B có đúng 2 dòng tiến độ: Buổi 1 (do class_learning_state) + Buổi 2 (test chèn)');
select 'DONE';
commit;
