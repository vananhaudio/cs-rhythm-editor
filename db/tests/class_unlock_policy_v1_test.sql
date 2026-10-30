-- ═══ TEST CLASS_UNLOCK_POLICY_V1 (tách điểm nộp bài khỏi mở khoá tuần tự) — cluster PostgreSQL TẠM (scripts/test-learning-threads-db.sh) ═══
-- Nạp SAU fixture + P1 + P2 + Lớp học V1 + Feed V1 + class_checkpoints_fixture + checkpoint V1 + QUIZ V1 + class_unlock_policy_v1_setup.
-- A, B: lớp SOLO01.TH01 (có quyền giáo trình) · C: lớp SOLO01.TH02 · T: thầy · N: ngoài Class
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
grant execute on all functions in schema t to anon, authenticated;

create function t.th1() returns uuid language sql immutable as $$ select 'b1000000-0000-4000-8000-000000000001'::uuid $$;
create function t.th2() returns uuid language sql immutable as $$ select 'b1000000-0000-4000-8000-000000000002'::uuid $$;
-- trạng thái một buổi trong class_learning_state của NGƯỜI GỌI
create function t.ses(st jsonb, n int) returns jsonb language sql immutable as $$
  select s from jsonb_array_elements(st -> 'sessions') s where (s ->> 'session_no')::int = n $$;
create function t.prog(k text, n int) returns public.learning_session_progress language sql as $$
  select * from public.learning_session_progress where learner_user_id = t.u(k) and program_code = 'SOLO01' and session_no = n $$;
create function t.thread(k text, key text) returns public.learning_threads language sql as $$
  select * from public.learning_threads where learner_user_id = t.u(k) and content_key = key and archived_at is null $$;
create function t.grade(k text, key text, verdict text) returns void language plpgsql as $$ declare v uuid; begin
  perform t.reset();
  v := (t.thread(k, key)).id;
  perform t.as_user('T');
  perform public.lt_respond(v, 'teacher_feedback', 'Thầy chấm', verdict);
  perform t.reset();
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── 1) MẶC ĐỊNH 'sequential': hành vi cũ giữ nguyên · RPC trả thêm unlock_policy / pace_days / start_at ──
do $$ declare st jsonb; begin
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok(st ->> 'unlock_policy' = 'sequential' and (st ->> 'pace_days')::int = 7, 'mặc định sequential, pace_days = 7 (như cũ)');
  perform t.ok(t.ses(st, 1) ->> 'opened_at' is not null and t.ses(st, 2) ->> 'opened_at' is null, 'sequential: Buổi 1 mở, Buổi 2 vẫn khoá');
  perform t.ok(t.ses(st, 2) ->> 'start_at' is not null, 'mỗi buổi có start_at (lịch thật)');
  perform t.as_user('A');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 2, '2.1', 'x') $q$, 'sequential: Buổi 2 chưa mở → LT_SESSION_LOCKED', 'LT_SESSION_LOCKED');
  perform t.reset();
  perform t.fails($q$ update public.class_schedule set unlock_policy = 'tuy_y' where id = t.th1() $q$, 'chính sách lạ bị ràng buộc chặn', 'class_schedule_unlock_policy_check');
  perform t.ok((select count(*) from public.class_schedule where unlock_policy <> 'sequential') = 0, 'chưa lớp nào bị đặt open (migration không tự đổi)');
end $$;

-- ── 2) Lớp 'open': MỌI buổi đã xuất bản mở · buổi nháp không mở · checkpoint của buổi đã mở hiện ra ──
do $$ declare st jsonb; begin
  update public.class_schedule set unlock_policy = 'open' where id = t.th1();
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok(st ->> 'unlock_policy' = 'open' and (st ->> 'pace_days')::int = 0, 'open: unlock_policy=open, pace_days=0 (không nhịp tuần)');
  perform t.ok(t.ses(st, 1) ->> 'opened_at' is not null and t.ses(st, 2) ->> 'opened_at' is not null and t.ses(st, 3) ->> 'opened_at' is not null,
               'open: Buổi 1, 2, 3 (đã xuất bản) đều mở dù chưa trả bài nào');
  perform t.ok((t.ses(st, 4) ->> 'published')::boolean = false and t.ses(st, 4) ->> 'opened_at' is null, 'open: Buổi 4 là bản NHÁP → không mở');
  perform t.ok(jsonb_array_length(t.ses(st, 2) -> 'checkpoints') = 2 and jsonb_array_length(t.ses(st, 3) -> 'checkpoints') = 2, 'open: checkpoint của Buổi 2, 3 hiện ra');
  perform t.ok((select count(*) from public.learning_session_progress where learner_user_id = t.u('A')) = 3, 'A có đúng 3 dòng tiến độ (1,2,3)');
end $$;

-- ── 3) Trả bài ở buổi sau KHÔNG cần xong buổi trước (tách checkpoint khỏi unlock) · nộp/chấm dùng đúng hệ thống cũ ──
do $$ declare th uuid; begin
  perform t.as_user('A');
  th := public.lt_submit_checkpoint(t.th1(), 2, '2.1', 'Em đã làm bài 2.1');
  perform public.lt_submit_checkpoint(t.th1(), 3, '3.1', null, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ');
  perform t.reset();
  perform t.ok((t.thread('A', 'C:SOLO01:2:2.1')).status = 'waiting_teacher' and (t.thread('A', 'C:SOLO01:2:2.1')).class_schedule_id = t.th1(),
               'A trả bài 2.1 khi chưa xong Buổi 1: thread chờ Thầy, gắn đúng lớp');
  perform t.ok((t.thread('A', 'C:SOLO01:2:2.1')).session_no = 2 and (t.thread('A', 'C:SOLO01:2:2.1')).checkpoint_id = '2.1' and (t.thread('A', 'C:SOLO01:2:2.1')).learner_user_id = t.u('A'),
               'thread đóng dấu đúng học viên · buổi · bài trả');
  perform t.ok((select count(*) from public.learning_threads where content_kind = 'program_checkpoint' and learner_user_id = t.u('A')) = 2, 'cùng hệ thống learning_threads (không bảng mới): 2 thread');
  perform t.ok((t.prog('A', 1)).completed_at is null, 'Buổi 1 vẫn CHƯA hoàn thành (không bị tự hoàn thành)');
  perform t.grade('A', 'C:SOLO01:2:2.1', 'pass');
  perform t.as_user('A'); perform public.lt_submit_checkpoint(t.th1(), 2, '2.2', 'Bài 2.2'); perform t.reset();
  perform t.grade('A', 'C:SOLO01:2:2.2', 'pass');
  perform t.ok((t.prog('A', 2)).completed_at is not null, 'đủ bài trả bắt buộc Buổi 2 ĐẠT → Buổi 2 ghi nhận hoàn thành');
  perform t.ok((t.prog('A', 1)).completed_at is null and (t.prog('A', 3)).completed_at is null, 'hoàn thành Buổi 2 không đụng Buổi 1 và Buổi 3');
end $$;

-- ── 4) Quyền KHÔNG đổi: Thầy không nộp · người ngoài lớp / thiếu quyền giáo trình bị chặn · lớp sequential khác không đổi ──
do $$ declare st jsonb; begin
  perform t.as_user('T');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 2, '2.1', 'x') $q$, 'Thầy không nộp bài', 'LT_TEACHER_CANNOT_SUBMIT');
  st := public.class_learning_state(t.th1());
  perform t.reset();
  perform t.ok(st ->> 'role' = 'teacher' and (select count(*) from public.learning_session_progress where learner_user_id = t.u('T')) = 0, 'Thầy xem được, KHÔNG sinh tiến độ cho Thầy');
  perform t.as_user('C');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 2, '2.1', 'x') $q$, 'C (lớp khác) vẫn không nộp được ở TH01', 'LT_NO_ACCESS');
  st := public.class_learning_state(t.th2()); perform t.reset();
  perform t.ok(st ->> 'unlock_policy' = 'sequential' and t.ses(st, 1) ->> 'opened_at' is not null and t.ses(st, 2) ->> 'opened_at' is null,
               'lớp TH02 vẫn sequential: chỉ Buổi 1 mở (lớp đang chạy KHÔNG bị ảnh hưởng)');
  perform t.as_user('B');
  perform t.ok((public.class_learning_state(t.th1()) ->> 'unlock_policy') = 'open', 'B (cùng TH01, có quyền) cũng thấy lớp open');
  perform t.reset();
  perform t.ok((select count(*) from public.learning_session_progress where learner_user_id = t.u('B')) = 3, 'B được mở 3 buổi đã xuất bản (lười, theo lần vào lớp đầu)');
end $$;

-- ── 5) Xuất bản buổi mới → mở lười ở lần vào lớp kế · đổi lại 'sequential': buổi đã mở GIỮ, buổi mới KHÔNG tự mở ──
do $$ declare st jsonb; begin
  update public.class_lesson_content set status = 'published', blocks = '[{"kind":"checkpoint","id":"4.1","title":"Buổi 4"}]' where session_id = '51000000-0000-4000-8000-000000000004';
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok(t.ses(st, 4) ->> 'opened_at' is not null, 'open: buổi vừa xuất bản tự mở khi A vào lớp');
  update public.class_schedule set unlock_policy = 'sequential' where id = t.th1();
  insert into public.class_sessions (id, class_id, session_number, title, start_at, event_type, status, stage_id)
  values ('51000000-0000-4000-8000-000000000005', t.th1(), 5, 'Buổi 5', now() + interval '21 days', 'lesson', 'scheduled', 9101);
  insert into public.class_lesson_content (session_id, status, blocks) values ('51000000-0000-4000-8000-000000000005', 'published', '[{"kind":"checkpoint","id":"5.1","title":"Buổi 5"}]');
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok(st ->> 'unlock_policy' = 'sequential' and (st ->> 'pace_days')::int = 7, 'đổi về sequential: unlock_policy + pace_days = 7');
  perform t.ok(t.ses(st, 1) ->> 'opened_at' is not null and t.ses(st, 4) ->> 'opened_at' is not null and t.ses(st, 5) ->> 'opened_at' is null,
               'đổi về sequential: buổi đã mở GIỮ (lịch sử bất biến), Buổi 5 mới KHÔNG tự mở');
  update public.class_schedule set unlock_policy = 'open' where id = t.th1();
end $$;

-- ── 6) Ca Hành Trình (đích của thay đổi): lớp 'open' có checkpoint ở MỘT số buổi, buổi khác chỉ là tài liệu ──
do $$ declare st jsonb; htc constant uuid := 'b1000000-0000-4000-8000-000000000003'; begin
  insert into public.class_sessions (id, class_id, session_number, title, event_type) values
    ('53000000-0000-4000-8000-000000000002', htc, 2, 'Buổi 2 · Tài liệu', 'lesson'),
    ('53000000-0000-4000-8000-000000000003', htc, 3, 'Buổi 3 · Có Trả bài', 'lesson');
  insert into public.class_lesson_content (session_id, status, blocks) values
    ('53000000-0000-4000-8000-000000000002', 'published', '[{"kind":"study","title":"Ôn tập","blocks":[]}]'),
    ('53000000-0000-4000-8000-000000000003', 'published', '[{"kind":"study","title":"Ôn tập","blocks":[]},{"kind":"checkpoint","id":"3.1","title":"Nộp bài cuối tuần","accepts":["text","video_link"]}]');
  perform t.as_user('A'); st := public.class_learning_state(htc); perform t.reset();
  perform t.ok((st ->> 'enabled')::boolean, 'HT: chỉ cần checkpoint ở Buổi 3 là cả lớp vào chế độ bài trả (đúng thiết kế hiện hành)');
  perform t.ok(st ->> 'unlock_policy' = 'sequential' and t.ses(st, 1) ->> 'opened_at' is not null and t.ses(st, 2) ->> 'opened_at' is null and t.ses(st, 3) ->> 'opened_at' is null,
               'HT sequential (rủi ro đã biết): Buổi 1 không có bài trả bắt buộc → chuỗi ĐỨNG ở Buổi 1, Buổi 2–3 khoá');
  update public.class_schedule set unlock_policy = 'open' where id = htc;
  perform t.as_user('A'); st := public.class_learning_state(htc); perform t.reset();
  perform t.ok(t.ses(st, 1) ->> 'opened_at' is not null and t.ses(st, 2) ->> 'opened_at' is not null and t.ses(st, 3) ->> 'opened_at' is not null,
               'HT open: cả 3 buổi mở; học viên chưa trả bài vẫn học được mọi buổi được cấp quyền');
  perform t.ok(jsonb_array_length(t.ses(st, 1) -> 'checkpoints') = 0 and jsonb_array_length(t.ses(st, 2) -> 'checkpoints') = 0 and jsonb_array_length(t.ses(st, 3) -> 'checkpoints') = 1,
               'HT open: buổi chỉ có tài liệu → không có nút; Buổi 3 có đúng 1 bài trả');
  perform t.as_user('A');
  perform public.lt_submit_checkpoint(htc, 3, '3.1', 'Nộp bài tuần 3');
  perform t.reset();
  perform t.ok((select count(*) from public.learning_threads where content_key = 'C:HT2027:3:3.1' and learner_user_id = t.u('A') and class_schedule_id = htc) = 1,
               'HT open: nộp bài Buổi 3 khi chưa đụng Buổi 1–2 → thread gắn đúng lớp HT2027 · buổi 3 · bài 3.1');
  perform t.ok((select count(*) from public.learning_session_progress where learner_user_id = t.u('A') and program_code = 'HT2027') = 3, 'tiến độ HT tách theo program_code (không lẫn SOLO01)');
end $$;
select 'XONG test class_unlock_policy_v1' as ket_qua;
