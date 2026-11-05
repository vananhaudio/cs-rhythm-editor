-- ═══ TEST MIRA CẠNH MÀN CHẤM BÀI V1 — cluster PostgreSQL TẠM (scripts/test-mira-grading-db.sh) ═══
-- Nạp SAU fixture Class + checkpoint + Student 360 P1 + mira_grading_v1_setup. A, B: học viên lớp SOLO01.TH01 · T: thầy · N: ngoài Class
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, false);
  perform set_config('request.headers', '{}', false);
  perform set_config('role', 'authenticated', false);
end $$;
-- Mira: anon + header khoá
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
grant execute on all functions in schema t to anon, authenticated;
create function t.thread(k text) returns uuid language sql security definer set search_path = '' as $$
  select id from public.learning_threads where learner_user_id = t.u(k) and content_key = 'C:SOLO01:1:1.1' $$;

\o /dev/null
-- ── dữ liệu: A và B nộp bài 1.1; Thầy nhận xét bài của A; mục Student 360 của A (một mục bị thu hồi) ──
select t.as_user('A');
select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', 'Em chọn ngón 1 vì cả câu quanh thế I.', 'https://youtu.be/aaaaaaaaaaa', 'youtube', 'aaaaaaaaaaa');
select t.as_user('B');
select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', 'Bài của B.');
select t.as_user('T');
select public.lt_respond(t.thread('A'), 'teacher_feedback', 'Thầy đã xem', null);
select t.reset();
insert into public.student_360_facts (user_id, category, content, origin, source_kind, source_ref, created_by)
values (t.u('A'), 'goal', 'Muốn đệm hát được Diễm Xưa', 'self_reported', 'student', 'REF-NOI-BO-A', t.u('A')),
       (t.u('A'), 'difficulty', 'Hay vướng ngón ở chỗ đổi dây', 'inferred', 'crm_zalo', 'ZALO-REF-A', t.u('T'));
insert into public.student_360_facts (user_id, category, content, origin, source_kind, status, revoked_at)
values (t.u('A'), 'key_topic', 'MỤC ĐÃ THU HỒI', 'self_reported', 'student', 'revoked', now());
insert into public.mira_grading_keys (key_hash) values (encode(sha256(convert_to('KHOA-MIRA-TEST', 'UTF8')), 'hex'));

\o
-- ── 1) Cấp vé ──
select t.as_mira(null);
select t.fails($q$ select public.mira_grading_ticket(t.thread('A')) $q$, 'anon không cấp vé', 'permission denied');
select t.as_user('A');
select t.fails($q$ select public.mira_grading_ticket(t.thread('A')) $q$, 'học viên (kể cả chủ bài) không cấp được vé', 'forbidden');
select t.as_user('N');
select t.fails($q$ select public.mira_grading_ticket(t.thread('A')) $q$, 'người ngoài Class không cấp được vé', 'forbidden');
select t.as_user('T');
select t.fails($q$ select public.mira_grading_ticket('00000000-0000-4000-8000-000000000000') $q$, 'bài trả không tồn tại → not_found', 'not_found');
create temp table tk as select public.mira_grading_ticket(t.thread('A')) j;
grant all on tk to public;
select t.ok((select length(j ->> 'ticket') >= 64 from tk), 'Thầy nhận vé ngẫu nhiên ≥ 64 ký tự');
select t.ok((select (j ->> 'expires_at')::timestamptz between now() + interval '4 minutes' and now() + interval '6 minutes' from tk), 'vé sống ~5 phút');
select t.reset();
select t.ok((select count(*) = 1 from public.mira_grading_tickets), 'DB chỉ lưu 1 dòng vé');
select t.ok((select not exists (select 1 from public.mira_grading_tickets x, tk where x.ticket_hash = tk.j ->> 'ticket' or position(tk.j ->> 'ticket' in x::text) > 0)), 'DB không lưu vé dạng rõ, chỉ băm');
select t.ok((select ticket_hash = encode(sha256(convert_to(j ->> 'ticket', 'UTF8')), 'hex') from public.mira_grading_tickets, tk), 'dòng lưu = SHA-256 của vé');

-- ── 2) Quyền bảng/hàm ──
select t.ok(not has_table_privilege('anon', 'public.mira_grading_tickets', 'select') and not has_table_privilege('authenticated', 'public.mira_grading_tickets', 'select')
            and not has_table_privilege('authenticated', 'public.mira_grading_keys', 'select') and not has_table_privilege('anon', 'public.mira_grading_keys', 'select'),
            'anon/authenticated không đọc trực tiếp bảng vé/khoá');
select t.ok(has_function_privilege('anon', 'public.mira_grading_context(text,text)', 'execute') and not has_function_privilege('authenticated', 'public.mira_grading_context(text,text)', 'execute')
            and not has_function_privilege('anon', 'public.mira_grading_ticket(uuid)', 'execute') and has_function_privilege('authenticated', 'public.mira_grading_ticket(uuid)', 'execute')
            and not has_function_privilege('anon', 'public.mira_grading_end(uuid)', 'execute'), 'quyền EXECUTE đúng: context=anon, ticket/end=authenticated');
select t.ok((select bool_and(prosecdef and proconfig = array['search_path=""']) from pg_proc where proname like 'mira\_grading\_%'), 'cả 3 hàm SECURITY DEFINER + search_path rỗng');

-- ── 3) Đọc ngữ cảnh: khoá + vé ──
create function t.ctx(key text, tick text, src text) returns jsonb language plpgsql as $$ declare r jsonb; begin
  perform t.as_mira(key); r := public.mira_grading_context(tick, src); perform t.reset(); return r; end $$;
create function t.tick() returns text language sql as $$ select j ->> 'ticket' from tk $$;
grant execute on all functions in schema t to anon, authenticated;
select t.fails($q$ select t.ctx(null, t.tick(), 'thread') $q$, 'thiếu khoá Mira → từ chối', 'forbidden');
select t.fails($q$ select t.ctx('KHOA-SAI', t.tick(), 'thread') $q$, 'sai khoá Mira → từ chối', 'forbidden');
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', 'VE-GIA', 'thread') $q$, 'khoá đúng nhưng vé giả → từ chối', 'forbidden');
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', null, 'thread') $q$, 'vé rỗng → từ chối', 'forbidden');
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', t.tick(), 'khac') $q$, 'nguồn lạ → bad_source', 'bad_source');
select t.fails($q$ select public.mira_grading_context(t.tick(), 'thread') $q$, 'gọi không qua t.as_mira (superuser, không header) vẫn cần khoá', 'forbidden');
select t.as_user('T');
select t.fails($q$ select public.mira_grading_context(t.tick(), 'thread') $q$, 'Thầy (authenticated) không gọi trực tiếp được', 'permission denied');
select t.reset();

create temp table c_thread as select t.ctx('KHOA-MIRA-TEST', t.tick(), 'thread') j;
create temp table c_cur as select t.ctx('KHOA-MIRA-TEST', t.tick(), 'curriculum') j;
create temp table c_360 as select t.ctx('KHOA-MIRA-TEST', t.tick(), 'student360') j;
grant all on c_thread, c_cur, c_360 to public;
select t.ok((select j ->> 'thread_id' = t.thread('A')::text and j -> 'teacher' ->> 'id' = t.u('T')::text and j ->> 'status' = 'ok' and j ->> 'v' = '1' from c_thread), 'nguồn thread: đúng bài trả của A, đúng Thầy, status ok');
select t.ok((select j #>> '{data,events,0,body}' like 'Em chọn ngón 1%' and jsonb_array_length(j #> '{data,events}') = 2 and j #>> '{data,events,1,kind}' = 'teacher_feedback' from c_thread), 'thread: bài nộp + nhận xét của Thầy, theo thứ tự');
select t.ok((select j #>> '{data,checkpoint_id}' = '1.1' and j #>> '{data,session_no}' = '1' and j #>> '{data,class,code}' = 'SOLO01.TH01' from c_thread), 'thread: định danh lớp/buổi/bài trả');
select t.ok((select position('Bài của B' in j::text) = 0 and position(t.u('B')::text in j::text) = 0 and position(t.u('A')::text in j::text) = 0 from c_thread), 'thread: KHÔNG lẫn bài của B, KHÔNG lộ user_id của học viên');
select t.ok((select j #>> '{data,checkpoint,prompt}' = 'Gửi video chơi âm giai' and j #>> '{data,checkpoint,id}' = '1.1' from c_cur), 'curriculum: đề của đúng bài trả 1.1');
select t.ok((select j #>> '{data,objectives,0}' = 'x' from c_cur), 'curriculum: mục tiêu của buổi');
select t.ok((select jsonb_array_length(j #> '{data,facts}') = 2 and position('MỤC ĐÃ THU HỒI' in j::text) = 0 from c_360), 'student360: chỉ mục đang hiệu lực (mục thu hồi không xuất hiện)');
select t.ok((select position('REF-NOI-BO-A' in j::text) = 0 and position('ZALO-REF-A' in j::text) = 0 and position(t.u('T')::text in (j #>> '{data,facts}')) = 0 from c_360), 'student360: KHÔNG lộ source_ref/created_by');
select t.ok((select exists (select 1 from jsonb_array_elements(j #> '{data,facts}') f where f ->> 'source_kind' = 'crm_zalo') from c_360), 'student360: mục nguồn crm_zalo đi qua cùng đường, không cần mã riêng');

-- ── 4) Vé gắn đúng một bài trả: không thể đọc bài của B bằng vé của A ──
select t.as_user('T');
create temp table tkb as select public.mira_grading_ticket(t.thread('B')) j;
grant all on tkb to public;
select t.reset();
create temp table cb as select t.ctx('KHOA-MIRA-TEST', (select j ->> 'ticket' from tkb), 'thread') j;
grant all on cb to public;
select t.ok((select j ->> 'thread_id' = t.thread('B')::text and position('Bài của B' in j::text) > 0 and position('Em chọn ngón 1' in j::text) = 0 from cb), 'vé của B chỉ cho bài của B, không lẫn A');
select t.ok((select (select j ->> 'thread_id' from c_thread) <> (select j ->> 'thread_id' from cb)), 'hai vé trả về hai thread khác nhau');

-- ── 5) Hết hạn / thu hồi / mất vai / khoá bị thu hồi ──
select t.as_user('T'); select public.mira_grading_end(t.thread('B')); select t.reset();
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', (select j ->> 'ticket' from tkb), 'thread') $q$, 'vé đã thu hồi (mira_grading_end) → từ chối', 'forbidden');
update public.mira_grading_tickets set expires_at = now() - interval '1 second';
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', t.tick(), 'thread') $q$, 'vé hết hạn → từ chối', 'forbidden');
select t.as_user('T'); create temp table tk2 as select public.mira_grading_ticket(t.thread('A')) j; grant all on tk2 to public; select t.reset();
select t.ok((select j ->> 'status' = 'ok' from (select t.ctx('KHOA-MIRA-TEST', (select j ->> 'ticket' from tk2), 'thread') j) z), 'vé mới hoạt động');
update public.app_users set role = 'student' where id = t.u('T');
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', (select j ->> 'ticket' from tk2), 'thread') $q$, 'Thầy mất vai giữa chừng → vé vô hiệu ngay', 'forbidden');
update public.app_users set role = 'teacher' where id = t.u('T');
update public.mira_grading_keys set revoked_at = now();
select t.fails($q$ select t.ctx('KHOA-MIRA-TEST', (select j ->> 'ticket' from tk2), 'thread') $q$, 'khoá Mira bị thu hồi → từ chối', 'forbidden');

-- ── 6) Không có dữ liệu thì báo rỗng, không lỗi ──
update public.mira_grading_keys set revoked_at = null;
delete from public.student_360_facts;
select t.ok((select j ->> 'status' = 'empty' and j #> '{data,facts}' = '[]'::jsonb from (select t.ctx('KHOA-MIRA-TEST', (select j ->> 'ticket' from tk2), 'student360') j) z), 'student360 rỗng → status empty (không bịa, không lỗi)');
update public.class_lesson_content set status = 'draft';
select t.ok((select j ->> 'status' = 'empty' from (select t.ctx('KHOA-MIRA-TEST', (select j ->> 'ticket' from tk2), 'curriculum') j) z), 'giáo trình chưa xuất bản → status empty');

-- ── 7) Không đổi dữ liệu Class: hàm chỉ đọc ──
select t.ok((select provolatile = 's' from pg_proc where proname = 'mira_grading_context'), 'mira_grading_context khai báo STABLE (chỉ đọc)');
select t.as_user('T'); select t.fails($q$ select public.mira_grading_ticket(t.thread('A')) from generate_series(1, 300) $q$, 'giới hạn tần suất cấp vé (240/giờ)', 'rate_limited'); select t.reset();
do $$ begin raise notice 'XONG: toàn bộ kiểm thử Mira grading DB đạt'; end $$;
