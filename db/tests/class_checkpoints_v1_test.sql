-- ═══ TEST LỚP CỦA TÔI V1 (checkpoint + tiến độ buổi) — cluster PostgreSQL TẠM (scripts/test-learning-threads-db.sh) ═══
-- Nạp SAU fixture + P1 + P2 + Lớp học V1 + Feed V1 + class_checkpoints_fixture + class_checkpoints_v1_setup.
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

-- ── 1) Quyền gọi: anon bị chặn; ngoài lớp / không quyền giáo trình → enabled=false, không tạo tiến độ ──
do $$ begin
  perform t.as_anon();
  perform t.fails($q$ select public.class_learning_state('b1000000-0000-4000-8000-000000000001') $q$, 'anon không gọi được class_learning_state', 'permission denied');
  perform t.fails($q$ select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', 'x') $q$, 'anon không trả bài được', 'permission denied');
  perform t.as_user('A');
  perform t.fails($q$ select * from public.learning_session_progress $q$, 'authenticated KHÔNG đọc trực tiếp bảng tiến độ', 'permission denied');
  perform t.fails($q$ insert into public.learning_session_progress (learner_user_id, program_code, session_no) values (auth.uid(), 'SOLO01', 9) $q$,
                  'authenticated KHÔNG tự ghi tiến độ (tự mở buổi)', 'permission denied');
  perform t.as_user('C');
  perform t.ok((public.class_learning_state(t.th1()) ->> 'enabled')::boolean = false, 'C (lớp khác) mở TH01: enabled=false');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'x') $q$, 'C không trả bài ở lớp không thuộc', 'LT_NO_ACCESS');
  perform t.as_user('N');
  perform t.ok((public.class_learning_state(t.th1()) ->> 'enabled')::boolean = false, 'N (ngoài Class): enabled=false');
  perform t.as_user('A');
  perform t.ok((public.class_learning_state('b0000000-0000-4000-8000-0000000000c1') ->> 'enabled')::boolean = false,
               'lớp không có giáo trình (DH2.KD18): enabled=false → giữ trang lớp cũ');
  perform t.ok((public.class_learning_state('b1000000-0000-4000-8000-000000000003') ->> 'enabled')::boolean = false,
               'lớp có giáo trình nhưng CHƯA có checkpoint (như HT2027): enabled=false → không khoá buổi, giữ trang cũ');
  perform t.as_user('T');
  perform t.ok((public.class_learning_state('b1000000-0000-4000-8000-000000000003') ->> 'enabled')::boolean = false, 'Thầy: lớp chưa có checkpoint cũng enabled=false');
  perform t.reset();
  perform t.ok((select count(*) from public.learning_session_progress) = 0, 'chưa ai có tiến độ (không bulk-enroll)');
end $$;

-- ── 2) Mở lười Buổi 1 (pilot từ Buổi 1) · idempotent · buổi khoá không lộ checkpoint ──
do $$ declare st jsonb; o1 timestamptz; begin
  perform t.as_user('A');
  st := public.class_learning_state(t.th1());
  perform t.reset();
  perform t.ok((st ->> 'enabled')::boolean and st ->> 'role' = 'learner' and st ->> 'program_code' = 'SOLO01', 'A: enabled, learner, SOLO01');
  perform t.ok(jsonb_array_length(st -> 'sessions') = 4, '4 buổi lesson (dòng nghỉ không phải buổi)');
  perform t.ok(t.ses(st, 1) ->> 'opened_at' is not null and t.ses(st, 2) ->> 'opened_at' is null, 'Buổi 1 mở, Buổi 2 khoá');
  perform t.ok(jsonb_array_length(t.ses(st, 1) -> 'checkpoints') = 2, 'Buổi 1: 2 checkpoint hợp lệ (id sai bị bỏ qua)');
  perform t.ok((t.ses(st, 1) -> 'checkpoints' -> 0 ->> 'id') = '1.1' and (t.ses(st, 1) -> 'checkpoints' -> 1 ->> 'required')::boolean = false,
               'thứ tự theo giáo trình; required=false được tôn trọng');
  perform t.ok(jsonb_array_length(t.ses(st, 2) -> 'checkpoints') = 0, 'Buổi 2 khoá: KHÔNG lộ checkpoint');
  perform t.ok((t.ses(st, 4) ->> 'published')::boolean = false, 'Buổi 4 nháp: published=false');
  perform t.ok((select count(*) from public.learning_session_progress) = 1, 'chỉ đúng 1 dòng tiến độ (A · Buổi 1)');
  o1 := (t.prog('A', 1)).opened_at;
  perform t.as_user('A'); perform public.class_learning_state(t.th1()); perform public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok((select count(*) from public.learning_session_progress) = 1 and (t.prog('A', 1)).opened_at = o1, 'gọi lại ×2: không mở trùng, opened_at giữ nguyên');
  perform t.ok((t.prog('A', 1)).class_schedule_id = t.th1(), 'tiến độ ghi lớp lúc mở (TH01)');
end $$;

-- ── 3) Trả bài tại checkpoint: kiểm server, thread riêng từng checkpoint, đóng dấu lớp/buổi ──
do $$ declare id1 uuid; id1b uuid; id2 uuid; th public.learning_threads; begin
  perform t.as_user('A');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 2, '2.1', 'x') $q$, 'Buổi 2 chưa mở → LT_SESSION_LOCKED', 'LT_SESSION_LOCKED');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '9.9', 'x') $q$, 'checkpoint giả → LT_CHECKPOINT_NOT_FOUND', 'LT_CHECKPOINT_NOT_FOUND');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, 'bad id!', 'x') $q$, 'id sai định dạng → không tồn tại', 'LT_CHECKPOINT_NOT_FOUND');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 2, '1.1', 'x') $q$, 'checkpoint 1.1 KHÔNG thuộc Buổi 2', 'LT_CHECKPOINT_NOT_FOUND');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 4, '4.1', 'x') $q$, 'buổi nháp: checkpoint không tồn tại', 'LT_CHECKPOINT_NOT_FOUND');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '1.1', '  ') $q$, 'rỗng → LT_EMPTY', 'LT_EMPTY');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'x', null, null, null, 'community') $q$, 'checkpoint không được community', 'LT_BAD_VISIBILITY');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'x', 'https://youtu.be/abc', 'myspace', null) $q$, 'media provider lạ', 'LT_BAD_MEDIA');
  id1 := public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'Em gửi âm giai', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ');
  id1b := public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'Em gửi lại');
  id2 := public.lt_submit_checkpoint(t.th1(), 1, '1.2', 'Bài tự chọn', null, null, null, 'private');
  perform t.reset();
  perform t.ok(id1 = id1b and id1 <> id2, 'cùng checkpoint → cùng thread; checkpoint khác → thread riêng');
  th := t.thread('A', 'C:SOLO01:1:1.1');
  perform t.ok(th.content_kind = 'program_checkpoint' and th.program_code = 'SOLO01' and th.session_no = 1 and th.checkpoint_id = '1.1'
               and th.class_schedule_id = t.th1() and th.class_stage_id = 9101 and th.visibility = 'class' and th.event_count = 2,
               'thread đóng dấu program/buổi/checkpoint/lớp/chặng; mặc định visibility=class');
  perform t.ok(th.identity #>> '{lesson,title}' = 'Bài trả 1.1 · Âm giai C–Am'
               and th.identity #>> '{module,name}' = 'SOLO01 · Buổi 01 · Bản đồ nốt C–Am'
               and th.identity #>> '{class,code}' = 'SOLO01.TH01' and th.identity #>> '{checkpoint,id}' = '1.1',
               'danh tính: "Bài trả 1.1 · …" + "SOLO01 · Buổi 01 · …" + lớp');
  perform t.ok((select visibility from t.thread('A', 'C:SOLO01:1:1.2')) = 'private', 'chọn "Chỉ Thầy" → private');
  perform t.as_user('T');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'x') $q$, 'Thầy không trả bài thay', 'LT_TEACHER_CANNOT_SUBMIT');
  perform t.reset();
end $$;

-- ── 4) accepts: chỉ video → bắt buộc link; loại chưa hỗ trợ (quiz) → từ chối, không giả chức năng ──
do $$ begin
  perform set_config('tva.lsp_admin_override', 'on', true);   -- dựng nhanh: mở Buổi 3 cho B để thử accepts
  insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id) values (t.u('B'), 'SOLO01', 3, t.th1());
  perform set_config('tva.lsp_admin_override', '', true);
  perform t.as_user('B');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 3, '3.1', 'chỉ chữ') $q$, 'checkpoint chỉ nhận video: chữ không đủ', 'LT_MEDIA_REQUIRED');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 3, '3.2', 'x') $q$, 'checkpoint quiz (chưa hỗ trợ) → từ chối', 'LT_CHECKPOINT_UNSUPPORTED');
  perform t.ok(public.lt_submit_checkpoint(t.th1(), 3, '3.1', '', 'https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ') is not null, 'video link → nhận');
  perform t.reset();
  delete from public.learning_thread_events where thread_id in (select id from public.learning_threads where learner_user_id = t.u('B'));
  delete from public.learning_threads where learner_user_id = t.u('B');
  delete from public.learning_session_progress where learner_user_id = t.u('B');
end $$;

-- ── 5) Quyền xem: chính chủ · cùng lớp · Thầy. Lớp khác / ngoài Class: KHÔNG. Feed/Tường/Hành trình chung: KHÔNG ──
do $$ declare id1 uuid := (select id from t.thread('A', 'C:SOLO01:1:1.1')); idp uuid := (select id from t.thread('A', 'C:SOLO01:1:1.2')); n int; begin
  perform t.as_user('A'); perform t.ok((public.lt_detail(id1) ->> 'is_mine')::boolean, 'A xem thread của mình');
  perform t.ok(public.lt_detail(id1) ->> 'checkpoint_id' = '1.1' and public.lt_detail(id1) ->> 'content_kind' = 'program_checkpoint'
               and (public.lt_detail(id1) ->> 'class_schedule_id')::uuid = t.th1(), 'lt_detail trả ngữ cảnh checkpoint');
  perform t.as_user('B'); perform t.ok(public.lt_detail(id1) ->> 'id' = id1::text, 'B (cùng lớp TH01) xem được');
  perform t.fails(format('select public.lt_detail(%L)', idp), 'B KHÔNG xem bài "Chỉ Thầy" của A', 'LT_NOT_FOUND');
  perform t.as_user('C'); perform t.fails(format('select public.lt_detail(%L)', id1), 'C (lớp TH02) KHÔNG xem được', 'LT_NOT_FOUND');
  perform t.as_user('N'); perform t.fails(format('select public.lt_detail(%L)', id1), 'N (ngoài Class) KHÔNG xem được', 'LT_NOT_FOUND');
  perform t.as_user('T'); perform t.ok((public.lt_detail(id1) ->> 'can_respond')::boolean and public.lt_detail(idp) ->> 'id' = idp::text, 'Thầy xem mọi thread');
  perform t.as_user('B');
  select count(*) into n from public.social_class_activity(t.th1()) a where a.thread ->> 'id' = id1::text;
  perform t.ok(n = 1, 'Hoạt động lớp TH01 (B): có bài trả của A');
  select count(*) into n from public.social_class_activity(t.th1()) a where a.thread ->> 'id' = idp::text;
  perform t.ok(n = 0, 'Hoạt động lớp: KHÔNG có bài "Chỉ Thầy"');
  select count(*) into n from public.social_feed() f where f.thread ->> 'id' in (id1::text, idp::text);
  perform t.ok(n = 0, 'Feed chung (B): KHÔNG có checkpoint thread');
  select count(*) into n from public.social_feed_scoped('my_classes') f where f.thread ->> 'id' in (id1::text, idp::text);
  perform t.ok(n = 0, 'Feed "Lớp của tôi" (B): KHÔNG lộ (giữ nguyên hàm cũ)');
  select count(*) into n from public.learning_journey(t.u('A')) j where j.id in (id1, idp);
  perform t.ok(n = 0, 'Hành trình của A khi B xem: KHÔNG có checkpoint thread');
  perform t.as_user('C');
  select count(*) into n from public.social_class_activity(t.th1()) a where a.thread ->> 'id' = id1::text;
  perform t.ok(n = 0, 'Hoạt động lớp TH01 khi C (lớp khác) xem: KHÔNG có');
  perform t.as_user('T');
  select count(*) into n from public.social_class_activity(t.th1()) a where a.thread ->> 'id' = id1::text;
  perform t.ok(n = 1, 'Thầy xem Hoạt động lớp: có');
  select count(*) into n from public.lt_teacher_queue('waiting_teacher') q where q.id in (id1, idp);
  perform t.ok(n = 2, 'Hàng đợi Thầy có 2 checkpoint thread (kể cả "Chỉ Thầy")');
  perform t.ok((select q.identity #>> '{module,name}' from public.lt_teacher_queue('waiting_teacher') q where q.id = id1) = 'SOLO01 · Buổi 01 · Bản đồ nốt C–Am',
               'thẻ hàng đợi đủ ngữ cảnh chương trình · buổi');
  perform t.as_user('A');
  select count(*) into n from public.learning_journey(t.u('A')) j where j.id in (id1, idp);
  perform t.ok(n = 2, 'Hành trình của chính A: có cả 2');
  perform t.reset();
end $$;

-- ── 6) Đổi ai được xem: checkpoint class|private; thread cũ community|private (không đổi luật cũ) ──
do $$ declare id1 uuid := (select id from t.thread('A', 'C:SOLO01:1:1.1')); legacy uuid; begin
  perform t.as_user('T'); perform public.lt_set_lesson_settings('e0000000-0000-4000-8000-000000000001', 'allowed', 'allowed');
  perform t.as_user('A');
  legacy := public.lt_submit('e0000000-0000-4000-8000-000000000001', 'submission', 'bài cũ');
  perform t.fails(format('select public.lt_set_visibility(%L, %L)', id1, 'community'), 'checkpoint → community bị chặn', 'LT_BAD_VISIBILITY');
  perform t.fails(format('select public.lt_set_visibility(%L, %L)', legacy, 'class'), 'thread cũ → class bị chặn', 'LT_BAD_VISIBILITY');
  perform public.lt_set_visibility(id1, 'private');
  perform t.as_user('B'); perform t.fails(format('select public.lt_detail(%L)', id1), 'sau khi A chọn private: B không xem được', 'LT_NOT_FOUND');
  perform t.as_user('A'); perform public.lt_set_visibility(id1, 'class');
  perform public.lt_set_visibility(legacy, 'private'); perform public.lt_set_visibility(legacy, 'community');
  perform t.as_user('C'); perform t.ok(public.lt_detail(legacy) ->> 'id' = legacy::text, 'thread cũ community: thành viên Class (C) vẫn xem được như trước');
  perform t.as_user('B'); perform t.ok(public.lt_detail(id1) ->> 'id' = id1::text, 'A đặt lại class: B xem lại được');
  perform t.reset();
end $$;

-- ── 7) Chấm: không bắt buộc / làm lại → chưa xong buổi; ĐẠT đủ required → xong Buổi 1 + mở Buổi 2 (idempotent) ──
do $$ declare o2 timestamptz; c1 timestamptz; st jsonb; begin
  perform t.grade('A', 'C:SOLO01:1:1.2', 'pass');
  perform t.ok((t.prog('A', 1)).completed_at is null and t.prog('A', 2) is null, 'ĐẠT checkpoint không bắt buộc: buổi CHƯA xong');
  perform t.grade('A', 'C:SOLO01:1:1.1', 'retry');
  perform t.ok((t.prog('A', 1)).completed_at is null and (t.thread('A', 'C:SOLO01:1:1.1')).status = 'needs_retry', 'Làm lại: buổi chưa xong, status needs_retry');
  perform t.as_user('A'); perform public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'Em trả lại'); perform t.reset();
  perform t.ok((t.thread('A', 'C:SOLO01:1:1.1')).status = 'waiting_teacher', 'Trả lại → Chờ chấm');
  perform t.grade('A', 'C:SOLO01:1:1.1', 'pass');
  c1 := (t.prog('A', 1)).completed_at; o2 := (t.prog('A', 2)).opened_at;
  perform t.ok(c1 is not null and o2 is not null, 'ĐẠT đủ required → completed_at Buổi 1 + mở Buổi 2');
  perform t.ok((t.prog('A', 1)).completed_class_schedule_id = t.th1(), 'ghi lớp lúc hoàn thành');
  perform t.grade('A', 'C:SOLO01:1:1.1', 'pass');
  perform t.grade('A', 'C:SOLO01:1:1.1', 'retry');
  perform t.ok((t.prog('A', 1)).completed_at = c1 and (t.prog('A', 2)).opened_at = o2
               and (select count(*) from public.learning_session_progress where learner_user_id = t.u('A')) = 2,
               'chấm lại (đạt/làm lại) → không mở trùng, không đổi mốc, không "bỏ hoàn thành"');
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok(t.ses(st, 1) ->> 'completed_at' is not null and jsonb_array_length(t.ses(st, 2) -> 'checkpoints') = 2
               and t.ses(st, 1) -> 'checkpoints' -> 0 -> 'thread' ->> 'status' = 'needs_retry', 'trạng thái: Buổi 1 xong · Buổi 2 hiện checkpoint · thread hiện trạng thái');
end $$;

-- ── 8) Lịch sử bất biến (trừ override Admin tường minh) ──
do $$ begin
  perform t.fails($q$ update public.learning_session_progress set opened_at = now() - interval '30 days' where learner_user_id = t.u('A') and session_no = 1 $q$,
                  'opened_at bất biến', 'LSP_HISTORY_IMMUTABLE');
  perform t.fails($q$ update public.learning_session_progress set completed_at = null where learner_user_id = t.u('A') and session_no = 1 $q$,
                  'completed_at không bị xoá', 'LSP_HISTORY_IMMUTABLE');
  perform set_config('tva.lsp_admin_override', 'on', true);
  update public.learning_session_progress set class_schedule_id = class_schedule_id where learner_user_id = t.u('A') and session_no = 1;
  perform set_config('tva.lsp_admin_override', '', true);
  perform t.ok(true, 'override Admin tường minh cho phép sửa');
end $$;

-- ── 9) Buổi 2 → Buổi 3 bỏ qua dòng nghỉ; Buổi 3 → Buổi 4 nháp: CHỜ, mở lười khi xuất bản; Buổi cuối không lỗi ──
do $$ declare st jsonb; c4 timestamptz; begin
  perform t.as_user('A');
  perform public.lt_submit_checkpoint(t.th1(), 2, '2.1', 'ép ngón'); perform public.lt_submit_checkpoint(t.th1(), 2, '2.2', 'bass');
  perform t.reset();
  perform t.grade('A', 'C:SOLO01:2:2.1', 'pass');
  perform t.ok((t.prog('A', 2)).completed_at is null, 'còn 2.2 (required "yes" ≠ boolean → mặc định bắt buộc)');
  perform t.grade('A', 'C:SOLO01:2:2.2', 'pass');
  perform t.ok((t.prog('A', 2)).completed_at is not null and (t.prog('A', 3)).opened_at is not null, 'xong Buổi 2 → mở Buổi 3 (bỏ qua dòng nghỉ)');
  perform t.as_user('A'); perform public.lt_submit_checkpoint(t.th1(), 3, '3.1', '', 'https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'); perform t.reset();
  perform t.grade('A', 'C:SOLO01:3:3.1', 'pass');
  perform t.ok((t.prog('A', 3)).completed_at is not null and t.prog('A', 4) is null, 'xong Buổi 3 (3.2 không bắt buộc) · Buổi 4 nháp → CHƯA mở (không chạy đồng hồ)');
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok(t.ses(st, 4) ->> 'opened_at' is null, 'trạng thái: Buổi 4 chưa mở');
  update public.class_lesson_content set status = 'published', blocks = '[{"kind":"checkpoint","id":"4.1","title":"Xếp ngón"}]'
   where session_id = '51000000-0000-4000-8000-000000000004';
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok(t.ses(st, 4) ->> 'opened_at' is not null and jsonb_array_length(t.ses(st, 4) -> 'checkpoints') = 1, 'Thầy xuất bản Buổi 4 → mở lười khi A vào lớp');
  perform t.as_user('A'); perform public.lt_submit_checkpoint(t.th1(), 4, '4.1', 'xếp ngón'); perform t.reset();
  perform t.grade('A', 'C:SOLO01:4:4.1', 'pass');
  c4 := (t.prog('A', 4)).completed_at;
  perform t.ok(c4 is not null and (select count(*) from public.learning_session_progress where learner_user_id = t.u('A')) = 4, 'Buổi cuối xong: không có buổi kế, không lỗi');
end $$;

-- ── 10) Sửa giáo trình SAU KHI xong: thêm checkpoint bắt buộc vào Buổi 1 → KHÔNG bỏ hoàn thành ──
do $$ declare c1 timestamptz := (t.prog('A', 1)).completed_at; st jsonb; begin
  update public.class_lesson_content set blocks = blocks || '[{"kind":"checkpoint","id":"1.3","title":"Mới thêm"}]'
   where session_id = '51000000-0000-4000-8000-000000000001';
  perform t.as_user('A'); st := public.class_learning_state(t.th1()); perform t.reset();
  perform t.ok((t.prog('A', 1)).completed_at = c1 and jsonb_array_length(t.ses(st, 1) -> 'checkpoints') = 3, 'thêm checkpoint sau: Buổi 1 vẫn hoàn thành, mốc giữ nguyên');
end $$;

-- ── 11) Buổi không có checkpoint bắt buộc: KHÔNG tự hoàn thành (không dây chuyền mở buổi) · chương trình dùng chung ──
do $$ declare st jsonb; idc uuid; begin
  perform t.as_user('C'); st := public.class_learning_state(t.th2());
  perform public.lt_submit_checkpoint(t.th2(), 1, '1.1', 'C trả bài'); perform t.reset();
  perform t.ok((st ->> 'enabled')::boolean and t.ses(st, 1) ->> 'opened_at' is not null, 'C (TH02, cùng chương trình SOLO01): Buổi 1 mở');
  perform t.ok((t.thread('C', 'C:SOLO01:1:1.1')).class_schedule_id = t.th2(), 'khoá checkpoint theo CHƯƠNG TRÌNH, thread đóng dấu lớp TH02');
  perform t.grade('C', 'C:SOLO01:1:1.1', 'pass');
  perform t.ok((t.prog('C', 2)).opened_at is not null, 'C xong Buổi 1 → mở Buổi 2');
  perform t.as_user('C'); perform public.class_learning_state(t.th2()); perform t.reset();
  perform t.ok((t.prog('C', 2)).completed_at is null, 'Buổi 2 không có checkpoint → không tự hoàn thành');
  idc := (t.thread('C', 'C:SOLO01:1:1.1')).id;
  perform t.as_user('B');
  perform t.ok((select count(*) from public.social_class_activity(t.th1()) a where a.thread ->> 'id' = idc::text) = 0,
               'bài của C (TH02) không hiện trong Hoạt động TH01');
  perform t.reset();
end $$;

-- ── 12) Thầy: xem mọi buổi (preview), không tạo tiến độ · Ẩn thread · Thu hồi quyền giáo trình ──
do $$ declare st jsonb; n0 int := (select count(*) from public.learning_session_progress); id1 uuid := (select id from t.thread('A', 'C:SOLO01:1:1.1')); begin
  perform t.as_user('T'); st := public.class_learning_state(t.th1());
  perform t.ok(st ->> 'role' = 'teacher' and jsonb_array_length(t.ses(st, 2) -> 'checkpoints') = 2 and t.ses(st, 2) -> 'checkpoints' -> 0 -> 'thread' = 'null'::jsonb,
               'Thầy: thấy checkpoint mọi buổi đã xuất bản, không kèm thread riêng');
  perform public.lt_moderate('thread', id1, true);
  perform t.as_user('B'); perform t.fails(format('select public.lt_detail(%L)', id1), 'thread bị ẩn: bạn cùng lớp không xem được', 'LT_NOT_FOUND');
  perform t.as_user('A'); perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'x') $q$, 'thread bị ẩn: không trả tiếp', 'LT_THREAD_HIDDEN');
  perform t.as_user('T'); perform public.lt_moderate('thread', id1, false);
  perform t.reset();
  perform t.ok((select count(*) from public.learning_session_progress) = n0, 'Thầy mở lớp không tạo tiến độ');
  update public.class_curriculum_access set status = 'revoked', revoked_at = now() where user_id = t.u('A');
  perform t.as_user('A');
  perform t.ok((public.class_learning_state(t.th1()) ->> 'enabled')::boolean = false, 'thu hồi quyền giáo trình → enabled=false');
  perform t.fails($q$ select public.lt_submit_checkpoint(t.th1(), 1, '1.1', 'x') $q$, 'thu hồi quyền → không trả bài', 'LT_NO_ACCESS');
  perform t.reset();
  perform t.ok((select count(*) from public.learning_session_progress where learner_user_id = t.u('A')) = 4, 'thu hồi quyền KHÔNG xoá lịch sử tiến độ');
  update public.class_curriculum_access set status = 'active', revoked_at = null where user_id = t.u('A');
end $$;

\echo 'ALL CLASS CHECKPOINTS V1 TESTS PASS'
