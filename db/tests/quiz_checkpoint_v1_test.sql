-- ═══ TEST QUIZ CHECKPOINT V1 — cluster PostgreSQL TẠM (scripts/test-learning-threads-db.sh, mục QUIZ V1) ═══
-- Nạp SAU: fixture + P1 + P2 + Lớp học V1 + Feed V1 + class_checkpoints_fixture(+_data) + class_checkpoints_v1_setup
--          + quiz_checkpoint_v1_setup. Dữ liệu trắc nghiệm ở đây là DỮ LIỆU GIẢ cho test (không phải đáp án giáo trình thật).
-- A, B: SOLO01.TH01 (có quyền giáo trình) · C: SOLO01.TH02 · T: thầy · N: ngoài Class
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;

create schema q;
grant usage on schema q to anon, authenticated;
create function q.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
create function q.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', q.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function q.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
end $$;
create function q.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true);
end $$;
create function q.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg;
end $$;
create function q.fails(sql text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute sql; exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then raise exception 'FAIL: % — sai lý do: %', msg, sqlerrm; end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
create function q.th1() returns uuid language sql immutable as $$ select 'b1000000-0000-4000-8000-000000000001'::uuid $$;
create function q.ses(st jsonb, n int) returns jsonb language sql immutable as $$
  select s from jsonb_array_elements(st -> 'sessions') s where (s ->> 'session_no')::int = n $$;
create function q.cp(st jsonb, n int, id text) returns jsonb language sql immutable as $$
  select c from jsonb_array_elements(q.ses(st, n) -> 'checkpoints') c where c ->> 'id' = id $$;
create function q.prog(k text, n int) returns public.learning_session_progress language sql as $$
  select * from public.learning_session_progress where learner_user_id = q.u(k) and program_code = 'SOLO01' and session_no = n $$;
create function q.answer(k text, n int, id text, choices text[]) returns jsonb language plpgsql as $$ declare r jsonb; begin
  perform q.as_user(k); r := public.lt_answer_checkpoint(q.th1(), n, id, choices); perform q.reset(); return r;
end $$;
create function q.pass_thread(k text, key text) returns void language plpgsql as $$ declare v uuid; begin
  perform q.reset();
  select id into v from public.learning_threads where learner_user_id = q.u(k) and content_key = key and archived_at is null;
  perform q.as_user('T'); perform public.lt_respond(v, 'teacher_feedback', 'Thầy chấm', 'pass'); perform q.reset();
end $$;
grant execute on all functions in schema q to anon, authenticated;

-- Buổi 2 của TH01 thành buổi chuẩn mới: 2.1 trắc nghiệm 1 đáp án · 2.2 trắc nghiệm nhiều đáp án · 2.3 video + chữ (Thầy chấm)
-- Buổi 3: thêm 3.3 trắc nghiệm ĐÃ xuất bản nhưng CHƯA có đáp án → không chấm bừa
update public.class_lesson_content set blocks = '[
  {"kind":"note","title":"Nhịp 1","text":"…"},
  {"kind":"checkpoint","id":"2.1","title":"Một đáp án","required":true,"accepts":["quiz"],
   "quiz":{"mode":"single","question":"Câu 1?","options":[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"}],"hint":"Gợi ý"}},
  {"kind":"checkpoint","id":"2.2","title":"Nhiều đáp án","required":true,"accepts":["quiz"],
   "quiz":{"mode":"multiple","question":"Câu 2?","options":[{"id":"a","text":"1"},{"id":"b","text":"2"},{"id":"c","text":"3"},{"id":"d","text":"4"},{"id":"e","text":"5"}]}},
  {"kind":"checkpoint","id":"2.3","title":"Video + chữ","required":true,"accepts":["video_link","text"]}
]'::jsonb where session_id = '51000000-0000-4000-8000-000000000002';
update public.class_lesson_content set blocks = blocks || '[{"kind":"checkpoint","id":"3.3","title":"Chưa có đáp án","required":false,"accepts":["quiz"],
   "quiz":{"mode":"single","question":"?","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}]}}]'::jsonb
 where session_id = '51000000-0000-4000-8000-000000000003';
insert into public.class_checkpoint_keys (session_id, checkpoint_id, mode, correct) values
  ('51000000-0000-4000-8000-000000000002', '2.1', 'single', '{b}'),
  ('51000000-0000-4000-8000-000000000002', '2.2', 'multiple', '{a,b,c}');

-- ── 1) Bảo mật: đáp án / kết quả không đọc-ghi trực tiếp được; RPC chặn anon ──
do $$ begin
  perform q.as_anon();
  perform q.fails($s$ select * from public.class_checkpoint_keys $s$, 'anon KHÔNG đọc được đáp án', 'permission denied');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', '{b}') $s$, 'anon không trả lời được', 'permission denied');
  perform q.as_user('B');
  perform q.fails($s$ select * from public.class_checkpoint_keys $s$, 'học sinh KHÔNG đọc được đáp án', 'permission denied');
  perform q.fails($s$ select * from public.learning_checkpoint_passes $s$, 'học sinh không đọc trực tiếp bảng kết quả', 'permission denied');
  perform q.fails($s$ insert into public.learning_checkpoint_passes (learner_user_id, content_key, program_code, session_no, checkpoint_id, passed_at)
                     values ('bbbbbbbb-0000-4000-8000-00000000000b', 'C:SOLO01:2:2.1', 'SOLO01', 2, '2.1', now()) $s$,
                  'học sinh KHÔNG tự ghi ĐẠT', 'permission denied');
  perform q.fails($s$ select public.lsp_try_complete('bbbbbbbb-0000-4000-8000-00000000000b', 'SOLO01', 2, 'b1000000-0000-4000-8000-000000000001') $s$,
                  'học sinh không gọi được hàm hoàn thành buổi', 'permission denied');
  perform q.as_user('T');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', '{b}') $s$, 'Thầy không trả lời thay', 'LT_TEACHER_CANNOT_SUBMIT');
  perform q.as_user('N');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', '{a}') $s$, 'ngoài lớp → LT_NO_ACCESS', 'LT_NO_ACCESS');
  perform q.as_user('C');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', '{b}') $s$, 'lớp khác (TH02) → LT_NO_ACCESS', 'LT_NO_ACCESS');
  perform q.reset();
end $$;

-- ── 2) Buổi chưa mở → khoá (chưa có đường tắt qua trắc nghiệm) ──
do $$ declare st jsonb; begin
  perform q.as_user('B'); st := public.class_learning_state(q.th1());
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', '{b}') $s$, 'Buổi 2 chưa mở → LT_SESSION_LOCKED', 'LT_SESSION_LOCKED');
  perform q.reset();
  perform q.ok(q.cp(st, 1, '1.1') ? 'quiz_passed_at' and q.cp(st, 1, '1.1') -> 'quiz_passed_at' = 'null'::jsonb, 'class_learning_state có quiz_passed_at (null) cho checkpoint cũ');
  perform q.ok(jsonb_array_length(q.ses(st, 2) -> 'checkpoints') = 0, 'buổi khoá không lộ checkpoint (kể cả câu trắc nghiệm)');
end $$;

-- ── 3) Hoàn thành Buổi 1 bằng đường CŨ (Bài trả chữ → Thầy Đạt) → Buổi 2 mở: checkpoint cũ không đổi hành vi ──
do $$ declare st jsonb; begin
  perform q.as_user('B');
  perform public.lt_submit_checkpoint(q.th1(), 1, '1.1', 'Em gửi âm giai');
  perform q.reset();
  perform q.ok((q.prog('B', 1)).completed_at is null, 'Bài trả chữ chờ Thầy → chưa hoàn thành buổi');
  perform q.pass_thread('B', 'C:SOLO01:1:1.1');
  perform q.ok((q.prog('B', 1)).completed_at is not null and (q.prog('B', 2)).id is not null, 'Thầy chấm Đạt 1.1 → xong Buổi 1 → mở Buổi 2 (luật cũ giữ nguyên)');
end $$;

-- ── 4) Đầu vào không hợp lệ: không bao giờ chấm ──
do $$ begin
  perform q.as_user('B');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', '{z}') $s$, 'lựa chọn không tồn tại', 'LT_BAD_ANSWER');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', '{a,b}') $s$, '1 đáp án mà gửi 2', 'LT_BAD_ANSWER');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.2', '{a,a}') $s$, 'lựa chọn trùng', 'LT_BAD_ANSWER');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', '{}') $s$, 'không chọn gì', 'LT_BAD_ANSWER');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', null) $s$, 'null', 'LT_BAD_ANSWER');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', array[null]::text[]) $s$, 'phần tử null', 'LT_BAD_ANSWER');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '9.9', '{a}') $s$, 'checkpoint giả', 'LT_CHECKPOINT_NOT_FOUND');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.3', '{a}') $s$, 'checkpoint video không phải trắc nghiệm', 'LT_NOT_QUIZ');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', '{a}') $s$, 'checkpoint chữ cũ không phải trắc nghiệm', 'LT_NOT_QUIZ');
  perform q.fails($s$ select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.1', 'Em đoán là B') $s$, 'trắc nghiệm KHÔNG nộp qua Learning Thread', 'LT_CHECKPOINT_UNSUPPORTED');
  perform q.reset();
  perform q.ok(not exists (select 1 from public.learning_checkpoint_passes), 'đầu vào sai không để lại dấu vết');
end $$;

-- ── 5) Một đáp án: sai → không ĐẠT, làm lại → đúng → ĐẠT; phản hồi KHÔNG chứa đáp án ──
do $$ declare r jsonb; n_threads int; n_queue int; begin
  select count(*) into n_threads from public.learning_threads;
  perform q.as_user('T'); select count(*) into n_queue from public.lt_teacher_queue(null); perform q.reset();
  r := q.answer('B', 2, '2.1', '{a}');
  perform q.ok(r ->> 'correct' = 'false' and r -> 'passed_at' = 'null'::jsonb and (r ->> 'attempts')::int = 1, '2.1 chọn sai → Chưa đúng, không ĐẠT, lần 1');
  perform q.ok((select array_agg(k order by k) from jsonb_object_keys(r) k) = '{attempts,correct,passed_at}', 'phản hồi chỉ có correct/passed_at/attempts — không lộ đáp án');
  r := q.answer('B', 2, '2.1', '{c}');
  perform q.ok(r ->> 'correct' = 'false' and (r ->> 'attempts')::int = 2, 'sai lần 2 → vẫn làm lại được');
  r := q.answer('B', 2, '2.1', '{b}');
  perform q.ok(r ->> 'correct' = 'true' and r ->> 'passed_at' is not null and (r ->> 'attempts')::int = 3, 'đúng → ✓ ĐẠT ngay (lần 3)');
  r := q.answer('B', 2, '2.1', '{a}');
  perform q.ok(r ->> 'correct' = 'true' and r ->> 'already_passed' = 'true' and (r ->> 'attempts')::int = 3, 'đã ĐẠT: gửi lại (kể cả sai) không làm mất ĐẠT, không đếm thêm');
  perform q.ok((select count(*) from public.learning_threads) = n_threads, 'trắc nghiệm KHÔNG tạo Learning Thread');
  perform q.as_user('T');
  perform q.ok((select count(*) from public.lt_teacher_queue(null)) = n_queue, 'Hàng đợi Thầy không thêm gì');
  perform q.ok(not exists (select 1 from public.social_class_activity(q.th1()) a where a.thread #>> '{identity,checkpoint,id}' in ('2.1', '2.2')),
               'Không gian lớp / hoạt động lớp không có trắc nghiệm');
  perform q.reset();
end $$;

-- ── 6) Nhiều đáp án: thiếu / thừa → sai; đúng cả tập (thứ tự bất kỳ) → ĐẠT ──
do $$ declare r jsonb; begin
  r := q.answer('B', 2, '2.2', '{a,b}');
  perform q.ok(r ->> 'correct' = 'false', '2.2 thiếu một lựa chọn → sai');
  r := q.answer('B', 2, '2.2', '{a,b,c,d}');
  perform q.ok(r ->> 'correct' = 'false', '2.2 thừa một lựa chọn → sai');
  r := q.answer('B', 2, '2.2', '{d,e}');
  perform q.ok(r ->> 'correct' = 'false', '2.2 chọn toàn sai → sai');
  perform q.ok((q.prog('B', 2)).completed_at is null, 'chưa ĐẠT 2.2 → buổi chưa hoàn thành');
  r := q.answer('B', 2, '2.2', '{c,a,b}');
  perform q.ok(r ->> 'correct' = 'true' and (r ->> 'attempts')::int = 4, '2.2 đúng cả tập (thứ tự khác) → ĐẠT');
end $$;

-- ── 7) Trạng thái học: quiz_passed_at · tách người · Thầy không có tiến độ ──
do $$ declare st jsonb; sa jsonb; tt jsonb; begin
  perform q.as_user('B'); st := public.class_learning_state(q.th1());
  perform q.as_user('A'); sa := public.class_learning_state(q.th1());
  perform q.as_user('T'); tt := public.class_learning_state(q.th1());
  perform q.reset();
  perform q.ok(q.cp(st, 2, '2.1') ->> 'quiz_passed_at' is not null and q.cp(st, 2, '2.2') ->> 'quiz_passed_at' is not null
               and q.cp(st, 2, '2.1') -> 'thread' = 'null'::jsonb, 'B: 2.1 + 2.2 có quiz_passed_at, không thread');
  perform q.ok(q.cp(st, 2, '2.1') -> 'accepts' = '["quiz"]'::jsonb and not (q.cp(st, 2, '2.1') ? 'quiz'), 'trạng thái học trả accepts, KHÔNG trả nội dung/đáp án trắc nghiệm');
  perform q.ok(q.cp(st, 2, '2.3') ->> 'quiz_passed_at' is null, '2.3 (video) chưa trả');
  perform q.ok(coalesce(q.cp(sa, 2, '2.1') ->> 'quiz_passed_at', '') = '', 'A không thấy ĐẠT của B');
  perform q.ok(coalesce(q.cp(tt, 2, '2.1') ->> 'quiz_passed_at', '') = '', 'Thầy: không tiến độ cá nhân');
  perform q.ok((q.prog('B', 2)).completed_at is null and (q.prog('B', 3)).id is null, '2 trắc nghiệm ĐẠT nhưng 2.3 chưa Đạt → chưa xong Buổi 2');
end $$;

-- ── 8) 3/3 ĐẠT (2 trắc nghiệm + video Thầy chấm) → hoàn thành Buổi 2 → mở Buổi 3 ──
do $$ begin
  perform q.as_user('B');
  perform q.fails($s$ select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 2, '2.3', '', null) $s$, '2.3 trống → LT_EMPTY', 'LT_EMPTY');
  perform public.lt_submit_checkpoint(q.th1(), 2, '2.3', 'Ba chỗ còn vướng: …', 'https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ');
  perform q.reset();
  perform q.ok((q.prog('B', 2)).completed_at is null, '2.3 chờ Thầy → chưa xong');
  perform q.pass_thread('B', 'C:SOLO01:2:2.3');
  perform q.ok((q.prog('B', 2)).completed_at is not null and (q.prog('B', 3)).id is not null, 'Thầy Đạt 2.3 → 3/3 → xong Buổi 2 → MỞ Buổi 3');
end $$;

-- ── 9) Thứ tự ngược: video Đạt TRƯỚC, trắc nghiệm ĐẠT SAU → chính lần trả lời đúng hoàn thành buổi ──
do $$ declare r jsonb; begin
  perform q.as_user('A');
  perform public.lt_submit_checkpoint(q.th1(), 1, '1.1', 'A gửi');
  perform q.reset(); perform q.pass_thread('A', 'C:SOLO01:1:1.1');
  perform q.as_user('A');
  perform public.lt_submit_checkpoint(q.th1(), 2, '2.3', 'A gửi', 'https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ');
  perform q.reset(); perform q.pass_thread('A', 'C:SOLO01:2:2.3');
  r := q.answer('A', 2, '2.1', '{b}');
  perform q.ok((q.prog('A', 2)).completed_at is null, 'A: video + 2.1 ĐẠT, còn 2.2 → chưa xong');
  r := q.answer('A', 2, '2.2', '{a,b,c}');
  perform q.ok((q.prog('A', 2)).completed_at is not null and (q.prog('A', 3)).id is not null, 'A: trắc nghiệm cuối ĐẠT → xong Buổi 2 → mở Buổi 3');
end $$;

-- ── 10) Trắc nghiệm đã xuất bản nhưng THIẾU đáp án → không chấm bừa ──
do $$ begin
  perform q.as_user('B');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 3, '3.3', '{a}') $s$, 'thiếu đáp án server → LT_QUIZ_NOT_READY', 'LT_QUIZ_NOT_READY');
  perform q.fails($s$ select public.lt_answer_checkpoint('b1000000-0000-4000-8000-000000000001', 3, '3.2', '{a}') $s$, 'accepts quiz nhưng không có câu hỏi → LT_NOT_QUIZ', 'LT_NOT_QUIZ');
  perform q.reset();
end $$;

-- ── 11) Ràng buộc bảng đáp án ──
do $$ begin
  perform q.fails($s$ insert into public.class_checkpoint_keys values ('51000000-0000-4000-8000-000000000003', '3.9', 'single', '{a,b}') $s$, 'single phải đúng 1 đáp án', 'class_checkpoint_keys_correct_check');
  perform q.fails($s$ insert into public.class_checkpoint_keys values ('51000000-0000-4000-8000-000000000003', '3.9', 'multiple', '{}') $s$, 'đáp án rỗng', 'class_checkpoint_keys_correct_check');
  perform q.fails($s$ insert into public.class_checkpoint_keys values ('51000000-0000-4000-8000-000000000003', '3.9', 'essay', '{a}') $s$, 'mode lạ', 'class_checkpoint_keys_mode_check');
end $$;

drop schema q cascade;
