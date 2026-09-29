-- ═══ TEST Learning Thread P1 (db/learning_threads_p1_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-learning-threads-db.sh. Có chốt chặn user thật.
-- Mỗi identity chạy dưới ĐÚNG role authenticated/anon + JWT sub → GRANT/RLS/RPC kiểm thật.
-- Người: A (học sinh lớp DH2.KD18) · B, C (tự học) · T (thầy) · N (không thuộc Class — không có hồ sơ học sinh)
\set ON_ERROR_STOP on

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
end $$;

-- N: tài khoản đăng nhập được nhưng không thuộc Class
delete from public.edu_students where user_id = 'eeeeeeee-0000-4000-8000-00000000000e';

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end
$$;
create function t.l(n int) returns uuid language sql immutable as $$
  select case n when 1 then 'e0000000-0000-4000-8000-000000000001'::uuid
                when 2 then 'e0000000-0000-4000-8000-000000000002'::uuid
                when 3 then 'e0000000-0000-4000-8000-000000000003'::uuid
                when 4 then 'e0000000-0000-4000-8000-000000000004'::uuid
                when 9 then 'e0000000-0000-4000-8000-0000000000a1'::uuid end
$$;
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
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
-- Câu lệnh PHẢI bị từ chối; p_expect (nếu có) phải xuất hiện trong thông báo lỗi
create function t.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin
    execute q;
  exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then
      raise exception 'FAIL: % — bị chặn nhưng sai lý do: % (mong: %)', msg, sqlerrm, p_expect;
    end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % — câu lệnh lẽ ra phải bị chặn: %', msg, q;
end $$;
grant execute on all functions in schema t to anon, authenticated;
create table t.ids (k text primary key, v uuid);
grant all on t.ids to anon, authenticated;

-- ── 1) Không truy cập thẳng bảng; anon không gọi được RPC ─────────────────────────────────
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select public.lt_lessons_state(array[t.l(1)])$q$, 'anon không gọi được lt_lessons_state', 'permission denied');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', 'x')$q$, 'anon không gọi được lt_submit', 'permission denied');
  perform t.as_user('A');
  perform t.fails('select * from public.learning_threads', 'học sinh không SELECT thẳng learning_threads', 'permission denied');
  perform t.fails('select * from public.learning_thread_events', 'học sinh không SELECT thẳng learning_thread_events', 'permission denied');
  perform t.fails($q$insert into public.learning_lesson_settings (content_key, lesson_id, submission_mode) values ('L:' || t.l(3), t.l(3), 'allowed')$q$,
                  'học sinh không tự bật Trả bài bằng INSERT thẳng', 'permission denied');
  perform t.fails($q$select public.lt_lesson_open_for_me(t.l(1))$q$, 'hàm nội bộ lt_lesson_open_for_me không mở cho học sinh', 'permission denied');
  perform t.fails($q$select public.lt_identity_snapshot(t.l(1))$q$, 'hàm nội bộ lt_identity_snapshot không mở cho học sinh', 'permission denied');
  perform t.reset();
end $$;

-- ── 2) Cấu hình ở tầng bài: chưa cấu hình = tắt; chỉ Thầy bật ─────────────────────────────
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select public.lt_set_lesson_settings(t.l(1), 'allowed', 'allowed')$q$, 'học sinh không cấu hình được bài', 'LT_TEACHER_ONLY');
  perform t.ok((select bool_and(submission_mode = 'off' and question_mode = 'off' and thread_id is null)
                from public.lt_lessons_state(array[t.l(1), t.l(2), t.l(3)])), 'chưa cấu hình → cả Trả bài và Hỏi bài đều tắt');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', 'Em nộp bài')$q$, 'bài chưa bật → không Trả bài được', 'LT_SUBMISSION_NOT_ENABLED');

  perform t.as_user('T');
  perform public.lt_set_lesson_settings(t.l(1), 'allowed', 'allowed', 'Quay 30 giây kiểu móc 1, thấy rõ tay phải');
  perform public.lt_set_lesson_settings(t.l(2), 'required', 'off');
  perform public.lt_set_lesson_settings(t.l(3), 'off', 'allowed');
  perform public.lt_set_lesson_settings(t.l(4), 'allowed', 'allowed');
  perform t.fails($q$select public.lt_set_lesson_settings(t.l(3), 'bat_buoc', 'off')$q$, 'mode lạ bị CHECK chặn', 'learning_lesson_settings_submission_check');
  perform t.fails($q$select public.lt_set_lesson_settings(gen_random_uuid(), 'allowed', 'off')$q$, 'bài không tồn tại', 'LT_LESSON_NOT_FOUND');

  perform t.as_user('A');
  perform t.ok((select submission_mode = 'allowed' and question_mode = 'allowed' and prompt like 'Quay 30 giây%'
                from public.lt_lessons_state(array[t.l(1)])), 'bài 1: cho phép Trả bài + Hỏi bài, có lời dặn của Thầy');
  perform t.ok((select submission_mode = 'required' and question_mode = 'off' from public.lt_lessons_state(array[t.l(2)])),
               'bài 2: YÊU CẦU Trả bài (tách biệt với "cho phép"), không Hỏi bài');
  perform t.fails($q$select public.lt_submit(t.l(2), 'question', 'Em hỏi')$q$, 'bài 2 tắt Hỏi bài', 'LT_QUESTION_NOT_ENABLED');
  perform t.fails($q$select public.lt_submit(t.l(3), 'submission', 'Em nộp')$q$, 'bài 3 chỉ cho Hỏi bài, không Trả bài', 'LT_SUBMISSION_NOT_ENABLED');
  perform t.reset();
end $$;

-- ── 3) Ai được gửi ───────────────────────────────────────────────────────────────────────
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select public.lt_submit(t.l(4), 'submission', 'Em nộp')$q$, 'bài A chưa được mở (my_learning_state) → chặn', 'LT_NO_ACCESS');
  perform t.fails($q$select public.lt_submit(t.l(1), 'teacher_feedback', 'x')$q$, 'học sinh không gửi được loại của Thầy', 'LT_BAD_KIND');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', '')$q$, 'không nội dung, không video → chặn', 'lte_content_check');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', 'x', 'javascript:alert(1)', 'external_link')$q$, 'URL không phải http(s) bị chặn', 'lte_media_url_check');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', 'x', 'https://youtu.be/x', 'myspace')$q$, 'provider lạ bị chặn', 'LT_BAD_MEDIA');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', 'x', null, null, null, 'public')$q$, 'visibility lạ bị chặn', 'LT_BAD_VISIBILITY');
  perform t.as_user('N');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', 'x')$q$, 'tài khoản không thuộc Class bị chặn', 'LT_NOT_MEMBER');
  perform t.as_user('T');
  perform t.fails($q$select public.lt_submit(t.l(1), 'submission', 'x')$q$, 'Thầy không Trả bài thay học sinh', 'LT_TEACHER_CANNOT_SUBMIT');
  perform t.reset();
end $$;

-- ── 4) Mở thread + đóng dấu danh tính học tập ─────────────────────────────────────────────
do $$
declare v_a uuid; v_a2 uuid; v_b uuid; d jsonb;
begin
  perform t.as_user('A');
  v_a := public.lt_submit(t.l(1), 'submission', 'Em nộp bài Bolero móc kiểu 1',
                          'https://www.youtube.com/watch?v=aaaaaaaaaaa', 'youtube', 'aaaaaaaaaaa');
  insert into t.ids values ('A1', v_a);
  d := public.lt_detail(v_a);
  perform t.ok(d->>'status' = 'waiting_teacher' and (d->>'event_count')::int = 1 and (d->>'is_mine')::boolean,
               'A Trả bài → mở thread, trạng thái waiting_teacher');
  perform t.ok(d->>'visibility' = 'community', 'mặc định Cộng đồng học tập (community)');
  perform t.ok(d#>>'{identity,class,code}' = 'DH2.KD18' and d#>>'{identity,class,stage}' = 'co_ban'
               and d#>>'{identity,class,stage_title}' = 'Đệm hát 2',
               'danh tính A đóng dấu lớp DH2.KD18 · co_ban · chặng "Đệm hát 2"');
  perform t.ok(d#>>'{identity,course,code}' = 'DH2' and d#>>'{identity,course,subject}' = 'dem_hat'
               and d#>>'{identity,module,name}' like 'Chương 4%' and d#>>'{identity,lesson,title}' = 'Bài 4.3 — Bolero móc kiểu 1',
               'danh tính có khoá DH2 · môn đệm hát · Chương 4 · đúng tên bài');
  perform t.ok(d#>>'{learner,name}' = 'An' and (d->'events'->0->>'media_provider') = 'youtube',
               'chi tiết trả về tên công khai + video của lần nộp');

  v_a2 := public.lt_submit(t.l(1), 'question', 'Thầy ơi tay phải em móc bị vấp ở phách 3');
  perform t.ok(v_a2 = v_a and (public.lt_detail(v_a)->>'event_count')::int = 2,
               'Hỏi bài cùng bài → CÙNG thread (không tạo thread thứ hai)');

  perform t.as_user('B');
  v_b := public.lt_submit(t.l(1), 'submission', 'Em tự học, nộp bài', null, null, null, 'private');
  insert into t.ids values ('B1', v_b);
  d := public.lt_detail(v_b);
  perform t.ok(d#>'{identity,class}' = 'null'::jsonb and d#>>'{identity,course,code}' = 'DH2',
               'B tự học (không lớp) vẫn Trả bài được; danh tính lớp = null');
  perform t.ok(d->>'visibility' = 'private', 'B chọn "Chỉ Thầy" ngay khi gửi');
  perform t.reset();
end $$;

-- ── 5) Ai xem được (visibility ĐỘC LẬP với lớp) ────────────────────────────────────────────
do $$
declare v_a uuid := (select v from t.ids where k = 'A1'); v_b uuid := (select v from t.ids where k = 'B1');
begin
  perform t.as_user('C');
  perform t.ok(public.lt_detail(v_a)->>'id' = v_a::text, 'C (thành viên Class, KHÁC lớp) xem được thread community của A');
  perform t.fails(format('select public.lt_detail(%L)', v_b), 'C không xem được thread "Chỉ Thầy" của B', 'LT_NOT_FOUND');
  perform t.as_user('N');
  perform t.fails(format('select public.lt_detail(%L)', v_a), 'tài khoản ngoài Class không xem được thread community', 'LT_NOT_FOUND');
  perform t.as_user('T');
  perform t.ok(public.lt_detail(v_b)->>'visibility' = 'private', 'Thầy xem được thread "Chỉ Thầy"');
  perform t.as_user('C');
  perform t.fails(format('select public.lt_set_visibility(%L, %L)', v_a, 'private'), 'C không đổi được visibility thread của A', 'LT_NOT_FOUND');
  perform t.as_user('A');
  perform public.lt_set_visibility(v_a, 'private');
  perform t.as_user('C');
  perform t.fails(format('select public.lt_detail(%L)', v_a), 'A chuyển "Chỉ Thầy" → C mất quyền xem', 'LT_NOT_FOUND');
  perform t.as_user('A');
  perform public.lt_set_visibility(v_a, 'community');
  perform t.as_user('C');
  perform t.ok(public.lt_detail(v_a) is not null, 'A chuyển lại Cộng đồng → C xem lại được');
  perform t.reset();
end $$;

-- ── 6) Workflow Thầy phản hồi ────────────────────────────────────────────────────────────
do $$
declare v_a uuid := (select v from t.ids where k = 'A1'); v_tag bigint; d jsonb; v_passed timestamptz;
begin
  perform t.as_user('A');
  perform t.fails(format('select public.lt_respond(%L, %L, %L)', v_a, 'teacher_feedback', 'tự khen'), 'học sinh không phản hồi thay Thầy', 'LT_TEACHER_ONLY');
  perform t.fails('select * from public.lt_teacher_queue()', 'học sinh không xem hàng đợi Thầy', 'LT_TEACHER_ONLY');

  perform t.as_user('T');
  perform t.ok((select count(*) from public.lt_teacher_queue()) = 2
               and (select id from public.lt_teacher_queue() limit 1) = v_a,
               'hàng đợi Thầy: 2 thread chờ, cũ nhất trước (FIFO)');
  insert into public.class_tags (name) values ('tay_phai') returning id into v_tag;
  perform t.fails(format($q$select public.lt_respond(%L, 'teacher_feedback', 'x', null, array[999999]::bigint[])$q$, v_a), 'tag không tồn tại bị chặn', 'LT_BAD_TAGS');
  perform t.fails(format($q$select public.lt_respond(%L, 'teacher_feedback', 'x', null, '{}', '[{"resource_type":"youtube","resource_id":"x"}]')$q$, v_a),
                  'tài nguyên sai loại bị chặn', 'LT_BAD_RESOURCES');
  perform t.fails(format($q$select public.lt_respond(%L, 'teacher_answer', 'x', 'pass')$q$, v_a), 'verdict chỉ đi với teacher_feedback', 'LT_BAD_VERDICT');
  perform public.lt_respond(v_a, 'teacher_feedback', 'Tay phải móc chưa đều, xem lại đoạn 1:20', 'retry', array[v_tag],
         '[{"resource_type":"kho_video","resource_id":"kho123","title_snapshot":"Bolero móc","start_seconds":80,"end_seconds":120}]');
  perform t.as_user('A');
  d := public.lt_detail(v_a);
  perform t.ok(d->>'status' = 'needs_retry', 'Thầy chấm "làm lại" → needs_retry');
  perform t.ok(d->'events'->2->>'author_role' = 'teacher' and d->'events'->2#>>'{author,name}' = 'Thầy Văn Anh'
               and d->'events'->2->'tags'->0->>'name' = 'tay_phai' and d->'events'->2->'resources'->0->>'resource_id' = 'kho123',
               'phản hồi mang tên Thầy THẬT (không hard-code), tag + video Kho');

  perform public.lt_submit(t.l(1), 'submission', 'Em quay lại lần 2', 'https://www.youtube.com/watch?v=bbbbbbbbbbb', 'youtube', 'bbbbbbbbbbb');
  perform t.ok(public.lt_detail(v_a)->>'status' = 'waiting_teacher', 'nộp lại → waiting_teacher');

  perform t.as_user('T');
  perform public.lt_respond(v_a, 'teacher_feedback', 'Đạt rồi!', 'pass');
  perform t.as_user('A');
  d := public.lt_detail(v_a);
  v_passed := (d->>'passed_at')::timestamptz;
  perform t.ok(d->>'status' = 'passed' and v_passed is not null and d#>>'{passed_by,name}' = 'Thầy Văn Anh', 'Thầy chấm ĐẠT → passed, ghi người chấm');
  perform t.ok((select count(*) from public.edu_lesson_progress) = 0, 'ĐẠT KHÔNG ghi edu_lesson_progress (P1)');

  perform public.lt_submit(t.l(1), 'question', 'Em hỏi thêm: móc kiểu 2 khác gì?');
  d := public.lt_detail(v_a);
  perform t.ok(d->>'status' = 'waiting_teacher' and (d->>'passed_at')::timestamptz = v_passed,
               'hỏi tiếp sau khi ĐẠT → chờ Thầy nhưng GIỮ mốc đã đạt');
  perform t.ok((d->>'event_count')::int = 6 and jsonb_array_length(d->'events') = 6, 'toàn bộ 6 event trong MỘT thread');

  perform t.as_user('T');
  perform public.lt_respond(v_a, 'teacher_answer', 'Kiểu 2 móc ở phách 2 và 4.');
  perform t.ok(public.lt_detail(v_a)->>'status' = 'teacher_responded', 'Thầy trả lời câu hỏi → teacher_responded');
  perform t.reset();
end $$;

-- ── 7) Danh tính là snapshot: đổi hồ sơ/lớp/khoá sau này KHÔNG đổi thread cũ ─────────────────
do $$
declare v_a uuid := (select v from t.ids where k = 'A1');
begin
  update public.class_schedule set code = 'DH3.KD20', name = 'Lớp mới' where code = 'DH2.KD18';
  update public.edu_courses set name = 'Tên khoá đã đổi' where code = 'DH2';
  update public.edu_group_members set status = 'removed' where user_id = t.u('A');
  perform t.as_user('A');
  perform t.ok(public.lt_detail(v_a)#>>'{identity,class,code}' = 'DH2.KD18'
               and public.lt_detail(v_a)#>>'{identity,course,name}' = 'Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2',
               'đổi mã lớp/tên khoá/rời lớp → thread cũ vẫn mang dấu DH2.KD18 + tên khoá lúc đó');
  perform t.reset();
end $$;

-- ── 8) Kiểm duyệt, lưu trữ, học lại ─────────────────────────────────────────────────────
do $$
declare v_a uuid := (select v from t.ids where k = 'A1'); v_ev uuid; v_new uuid;
begin
  perform t.as_user('T');
  v_ev := (public.lt_detail(v_a)->'events'->1->>'id')::uuid;
  perform public.lt_moderate('event', v_ev, true);
  perform t.ok(jsonb_array_length(public.lt_detail(v_a)->'events') = 7, 'Thầy vẫn thấy event đã ẩn');
  perform t.as_user('C');
  perform t.ok(jsonb_array_length(public.lt_detail(v_a)->'events') = 6, 'người khác không thấy event đã ẩn');
  perform t.as_user('T');
  perform public.lt_moderate('thread', v_a, true);
  perform t.as_user('C');
  perform t.fails(format('select public.lt_detail(%L)', v_a), 'thread bị ẩn → cộng đồng không xem', 'LT_NOT_FOUND');
  perform t.as_user('A');
  perform t.ok(public.lt_detail(v_a) is not null, 'chính chủ vẫn xem thread bị ẩn');
  perform t.fails($q$select public.lt_submit(t.l(1), 'question', 'x')$q$, 'thread bị ẩn → không gửi thêm', 'LT_THREAD_HIDDEN');
  perform t.as_user('T');
  perform public.lt_moderate('thread', v_a, false);
  perform t.fails(format('select public.lt_moderate(%L, %L, true)', 'post', v_a), 'loại kiểm duyệt lạ', 'LT_BAD_KIND');

  perform public.lt_archive(v_a);
  perform t.fails(format($q$select public.lt_respond(%L, 'teacher_answer', 'x')$q$, v_a), 'thread đã lưu trữ → không phản hồi thêm', 'LT_THREAD_ARCHIVED');
  perform t.as_user('A');
  v_new := public.lt_submit(t.l(1), 'submission', 'Học lại khoá: nộp lần đầu');
  perform t.ok(v_new <> v_a and public.lt_detail(v_a)->>'status' = 'archived',
               'sau khi lưu trữ, cùng bài → thread MỚI; thread cũ còn nguyên (archived)');
  perform t.ok((select count(*) from public.lt_my_threads()) = 2, 'lt_my_threads: A thấy cả 2 thread của mình');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.lt_my_threads()) = 1, 'lt_my_threads chỉ trả thread của chính mình');
  perform t.reset();
end $$;

-- ── 9) Xoá bài học: lịch sử KHÔNG mất ────────────────────────────────────────────────────
do $$
declare v_a uuid := (select v from t.ids where k = 'A1');
begin
  delete from public.edu_course_lessons where id = t.l(1);
  perform t.as_user('A');
  perform t.ok(public.lt_detail(v_a)->>'lesson_id' is null
               and public.lt_detail(v_a)->>'content_key' = 'L:' || t.l(1)::text
               and public.lt_detail(v_a)#>>'{identity,lesson,title}' = 'Bài 4.3 — Bolero móc kiểu 1'
               and jsonb_array_length(public.lt_detail(v_a)->'events') = 6,
               'xoá bài → thread còn nguyên (lesson_id = null, content_key + snapshot + event giữ)');
  perform t.ok((select count(*) from public.lt_lessons_state(array[t.l(1)]) where submission_mode = 'off') = 1,
               'cấu hình của bài đã xoá biến mất theo bài');
  perform t.reset();
  perform t.ok(not exists (select 1 from pg_policies where tablename in ('learning_threads', 'learning_thread_events', 'learning_lesson_settings')),
               'bảng P1 không có policy nào (kể cả sau khi chạy lại rls_setup.sql)');
end $$;

-- ── 10) Xoá tài khoản học sinh → thread của họ bị xoá theo ───────────────────────────────
do $$ begin
  delete from public.edu_students where user_id = t.u('B');
  delete from public.app_users where id = t.u('B');
  delete from auth.users where id = t.u('B');
  perform t.ok((select count(*) from public.learning_threads where learner_user_id = t.u('B')) = 0,
               'xoá tài khoản B → thread + event của B bị xoá (CASCADE)');
end $$;

select 'ALL LEARNING THREAD SQL TESTS PASS' as result;
