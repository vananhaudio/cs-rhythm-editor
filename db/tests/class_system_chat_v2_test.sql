-- ═══ TEST Class System Chat V2 (db/class_system_chat_v2_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-class-system-chat-db.sh. Có chốt chặn user thật.
-- Đi qua RPC THẬT (lt_submit / lt_respond) dưới đúng role authenticated + JWT sub → trigger, GRANT, RLS đều chạy thật.
-- A = học viên lớp DH2.KD18 · B = tự học (không lớp) · C = học viên trong nhóm lớp (KHÔNG được nhận) ·
-- T, T2 = thầy thuộc lớp · T3 = thầy KHÔNG thuộc lớp
\set ON_ERROR_STOP on

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
end $$;

insert into auth.users (id, email) values
  ('d2d2d2d2-0000-4000-8000-0000000000d2', 't2@test.local'),
  ('d3d3d3d3-0000-4000-8000-0000000000d3', 't3@test.local');
insert into public.app_users (id, role, name, email) values
  ('d2d2d2d2-0000-4000-8000-0000000000d2', 'teacher', 'Thầy Hai', 't2@test.local'),
  ('d3d3d3d3-0000-4000-8000-0000000000d3', 'teacher', 'Thầy Ba', 't3@test.local');
-- Thầy T, T2 và học viên C thuộc nhóm lớp DH2.KD18 (nguồn canonical); T3 thì không
insert into public.edu_group_members (user_id, group_id, source, status) values
  ('dddddddd-0000-4000-8000-00000000000d', 'f0000000-0000-4000-8000-0000000000c1', 'admin', 'active'),
  ('d2d2d2d2-0000-4000-8000-0000000000d2', 'f0000000-0000-4000-8000-0000000000c1', 'admin', 'active'),
  ('cccccccc-0000-4000-8000-00000000000c', 'f0000000-0000-4000-8000-0000000000c1', 'admin', 'active');

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'T2' then 'd2d2d2d2-0000-4000-8000-0000000000d2'::uuid
                when 'T3' then 'd3d3d3d3-0000-4000-8000-0000000000d3'::uuid end $$;
create function t.l(n int) returns uuid language sql immutable as $$
  select case n when 1 then 'e0000000-0000-4000-8000-000000000001'::uuid
                when 2 then 'e0000000-0000-4000-8000-000000000002'::uuid
                when 3 then 'e0000000-0000-4000-8000-000000000003'::uuid end $$;
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
create function t.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute q;
  exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then
      raise exception 'FAIL: % — bị chặn nhưng sai lý do: % (mong: %)', msg, sqlerrm, p_expect;
    end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return;
  end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
-- Số thông báo của một người (đọc bằng postgres, rồi trả lại role + JWT đang dùng)
create function t.n(k text, p_kind text default null) returns int language plpgsql as $$
declare r int; v_role text := current_setting('role'); v_claims text := coalesce(current_setting('request.jwt.claims', true), '{}'); begin
  perform set_config('role', 'postgres', true);
  select count(*)::int into r from public.class_system_notices where user_id = t.u(k) and (p_kind is null or kind = p_kind);
  perform set_config('request.jwt.claims', v_claims, true);
  perform set_config('role', v_role, true);
  return r;
end $$;
grant execute on all functions in schema t to anon, authenticated;

do $$
declare x uuid; y uuid; z uuid; w uuid; n0 int; ev0 int; ev1 int;
begin
  perform t.reset();
  perform t.ok((select count(*) from public.class_system_notices) = 0, 'khởi đầu: 0 thông báo (không backfill)');

  -- Thầy bật Trả bài + Hỏi bài cho bài 1–2
  perform t.as_user('T');
  perform t.as_user('T');
  perform public.lt_set_lesson_settings(t.l(1), 'allowed', 'allowed');
  perform t.reset();
  perform t.as_user('T');
  perform public.lt_set_lesson_settings(t.l(2), 'allowed', 'allowed');
  perform t.reset();

  -- ── 1) Học viên NỘP BÀI → Thầy thuộc lớp (chưa có Thầy phụ trách) ──
  perform t.as_user('A');
  perform t.as_user('A');
  x := public.lt_submit(t.l(1), 'submission', 'Em nộp bài 1');
  perform t.reset();
  perform t.reset();
  perform t.ok((select class_schedule_id is not null and last_teacher_user_id is null from public.learning_threads where id = x), 'thread của A gắn lớp, chưa có Thầy phụ trách');
  perform t.ok(t.n('T', 'submission_received') = 1 and t.n('T2', 'submission_received') = 1, 'nộp bài → báo đủ Thầy thuộc lớp (T, T2)');
  perform t.ok(t.n('T3') = 0, 'Thầy KHÔNG thuộc lớp (T3) không nhận');
  perform t.ok(t.n('C') = 0 and t.n('B') = 0 and t.n('A') = 0, 'học viên (kể cả cùng lớp C) không nhận; người nộp không tự nhận');
  perform t.ok((select body from public.class_system_notices where user_id = t.u('T')) = 'Học viên vừa nộp bài.', 'nội dung ngắn, không chứa bài nộp');
  perform t.ok((select ref_type || ':' || ref_key from public.class_system_notices where user_id = t.u('T')) = 'thread:' || x::text, 'liên kết = đúng thread');

  -- ── 2) Nộp/sửa liên tiếp khi vẫn chờ chấm → KHÔNG thêm ──
  perform t.as_user('A');
  perform t.as_user('A');
  perform public.lt_submit(t.l(1), 'submission', 'Em sửa lại bài 1');
  perform t.reset();
  perform t.as_user('A');
  perform public.lt_submit(t.l(1), 'submission', 'Em sửa lần nữa');
  perform t.reset();
  perform t.ok(t.n('T', 'submission_received') = 1 and t.n('T2', 'submission_received') = 1, 'nộp liên tiếp khi chờ chấm → vẫn 1 thông báo mỗi Thầy (không spam)');

  -- ── 3) HỎI BÀI → Thầy; mỗi câu hỏi mới 1 thông báo ──
  perform t.as_user('A');
  perform t.as_user('A');
  perform public.lt_submit(t.l(1), 'question', 'Cho em hỏi 1');
  perform t.reset();
  perform t.ok(t.n('T', 'question_received') = 1 and t.n('T2', 'question_received') = 1, 'hỏi bài → báo Thầy');
  perform t.ok((select body from public.class_system_notices where user_id = t.u('T') and kind = 'question_received') = 'Học viên vừa gửi câu hỏi mới.', 'nội dung hỏi bài ngắn');
  perform t.as_user('A');
  perform public.lt_submit(t.l(1), 'question', 'Cho em hỏi 2');
  perform t.reset();
  perform t.ok(t.n('T', 'question_received') = 2, 'câu hỏi mới thứ hai → thông báo mới');

  -- ── 4) Thầy TRẢ LỜI Hỏi bài → học viên; nhiều câu trả lời cho cùng câu hỏi = 1 ──
  perform t.as_user('T');
  perform t.as_user('T');
  perform public.lt_respond(x, 'teacher_answer', 'Trả lời nhé');
  perform t.reset();
  perform t.ok(t.n('A', 'question_answered') = 1, 'Thầy trả lời → học viên nhận 1 thông báo');
  perform t.ok((select body from public.class_system_notices where user_id = t.u('A') and kind = 'question_answered') = 'Thầy đã trả lời câu hỏi của bạn.', 'nội dung trả lời ngắn');
  perform t.as_user('T');
  perform t.as_user('T');
  perform public.lt_respond(x, 'teacher_answer', 'Bổ sung thêm');
  perform t.reset();
  perform t.ok(t.n('A', 'question_answered') = 1, 'thêm câu trả lời cho cùng câu hỏi → không thêm thông báo');
  perform t.ok(t.n('T') = 3 and t.n('T2') = 3, 'Thầy không tự nhận thông báo về hành động của mình');

  -- ── 5) Thầy CHẤM → học viên (V1 NGUYÊN VĂN) ──
  perform t.as_user('T');
  perform t.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Nhận xét chưa chấm');
  perform t.reset();
  perform t.ok(t.n('A', 'checkpoint_graded') = 0, 'nhận xét KHÔNG chấm → không thông báo (như V1)');
  perform t.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Làm lại nhé', 'retry');
  perform t.reset();
  perform t.ok(t.n('A', 'checkpoint_graded') = 1, 'chấm xong → học viên nhận 1 thông báo chấm');
  perform t.ok((select body from public.class_system_notices where user_id = t.u('A') and kind = 'checkpoint_graded') = 'Bài trả của bạn đã được chấm.', 'nội dung chấm = V1 (không nêu kết quả)');
  perform t.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Đạt rồi', 'pass');
  perform t.reset();
  perform t.ok(t.n('A', 'checkpoint_graded') = 1, 'chấm lại trong cùng lần nộp → vẫn 1 (hành vi V1)');
  perform t.ok((select last_teacher_user_id from public.learning_threads where id = x) = t.u('T'), 'Thầy vừa phản hồi trở thành Thầy phụ trách');

  -- ── 6) Học viên nộp lại; ƯU TIÊN Thầy phụ trách (chỉ T, không T2) ──
  perform t.as_user('A');
  perform t.as_user('A');
  perform public.lt_submit(t.l(1), 'submission', 'Em nộp lại sau khi được chấm');
  perform t.reset();
  perform t.ok(t.n('T', 'submission_received') = 2, 'nộp lượt mới sau khi Thầy xử lý → báo lại Thầy phụ trách');
  perform t.ok(t.n('T2', 'submission_received') = 1, 'đã có Thầy phụ trách → ưu tiên, T2 không nhận thêm');
  perform t.as_user('A');
  perform public.lt_submit(t.l(1), 'submission', 'Em sửa tiếp');
  perform t.reset();
  perform t.ok(t.n('T', 'submission_received') = 2, 'lại nộp liên tiếp → không thêm');
  perform t.as_user('T');
  perform t.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Đạt', 'pass');
  perform t.reset();
  perform t.ok(t.n('A', 'checkpoint_graded') = 2, 'nộp lại rồi được chấm → thông báo chấm thứ 2 (V1)');

  -- ── 7) Thay đổi Thầy phụ trách / quyền: Thầy phụ trách mất quyền → fallback Thầy lớp ──
  perform t.as_user('A');
  perform t.as_user('A');
  y := public.lt_submit(t.l(2), 'submission', 'Bài 2');
  perform t.reset();
  perform t.as_user('T');
  perform t.as_user('T');
  perform public.lt_respond(y, 'teacher_feedback', 'Xem rồi');                  -- không verdict: chỉ đặt Thầy phụ trách = T
  perform t.reset();
  perform t.reset();
  update public.app_users set role = 'student' where id = t.u('T');             -- T mất quyền xử lý
  perform t.as_user('A');
  perform t.as_user('A');
  perform public.lt_submit(t.l(2), 'submission', 'Bài 2 nộp lại');
  perform t.reset();
  perform t.ok(t.n('T', 'submission_received') = 3, 'Thầy phụ trách đã mất quyền → KHÔNG nhận thêm (vẫn 3 như trước)');
  perform t.ok(t.n('T2', 'submission_received') = 3, 'fallback: Thầy còn quyền thuộc lớp (T2) nhận');
  perform t.reset();
  update public.app_users set role = 'teacher' where id = t.u('T');

  -- ── 8) Tự học (không lớp): không có Thầy phụ trách → không gửi + WARNING, KHÔNG làm hỏng nộp bài ──
  n0 := (select count(*) from public.class_system_notices);
  perform t.as_user('B');
  perform t.as_user('B');
  z := public.lt_submit(t.l(1), 'submission', 'B tự học nộp');
  perform t.reset();
  perform t.reset();
  perform t.ok(z is not null and (select count(*) from public.learning_thread_events where thread_id = z) = 1, 'thread không lớp: nộp bài VẪN thành công');
  perform t.ok((select class_schedule_id is null from public.learning_threads where id = z) and (select count(*) from public.class_system_notices) = n0,
               'thread không lớp & chưa có Thầy phụ trách → không gửi cho ai (không suy "mọi Thầy"; có WARNING ở log)');
  perform t.as_user('T3');                                                      -- T3 phản hồi → thành Thầy phụ trách
  perform t.as_user('T3');
  perform public.lt_respond(z, 'teacher_feedback', 'Chào B');
  perform t.reset();
  perform t.as_user('B');
  perform t.as_user('B');
  perform public.lt_submit(t.l(1), 'submission', 'B nộp lại');
  perform t.reset();
  perform t.ok(t.n('T3', 'submission_received') = 1, 'thread không lớp nhưng có Thầy phụ trách → báo đúng Thầy đó');
  perform t.ok(t.n('T') = (select count(*) from public.class_system_notices where user_id = t.u('T')) and t.n('T2', 'submission_received') = 3, 'Thầy khác không nhận thread của B');

  -- ── 9) Tác giả không tự nhận: sự kiện học viên do chính Thầy phụ trách ghi (chèn trực tiếp) ──
  perform t.reset();
  n0 := (select count(*) from public.class_system_notices);
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body)
  values (z, t.u('T3'), 'student', 'submission', 'tự nộp');
  perform t.ok((select count(*) from public.class_system_notices) = n0, 'không gửi ngược cho chính tác giả sự kiện');

  -- ── 10) LỖI NHÁNH THÔNG BÁO KHÔNG PHÁ NGHIỆP VỤ ──
  perform t.reset();
  alter table public.class_system_notices add constraint t_inject_fail check (false) not valid;   -- mọi INSERT thông báo sẽ lỗi
  n0 := (select count(*) from public.class_system_notices);
  ev0 := (select count(*) from public.learning_thread_events);
  perform t.as_user('A');
  perform t.as_user('A');
  w := public.lt_submit(t.l(2), 'question', 'Hỏi lúc thông báo hỏng');
  perform t.reset();
  perform t.reset();
  perform t.ok(w is not null and (select count(*) from public.learning_thread_events) = ev0 + 1, 'nộp/hỏi bài: nghiệp vụ VẪN commit dù nhánh thông báo lỗi');
  perform t.ok((select status = 'waiting_teacher' and event_count >= 2 from public.learning_threads where id = w), 'trạng thái thread vẫn cập nhật đúng');
  perform t.ok((select count(*) from public.class_system_notices) = n0, 'không để lại thông báo sai/nửa vời khi lỗi');
  perform t.as_user('T');
  perform t.as_user('T');
  perform public.lt_respond(w, 'teacher_answer', 'Trả lời lúc thông báo hỏng');
  perform t.reset();
  perform t.as_user('T');
  perform public.lt_respond(w, 'teacher_feedback', 'Chấm lúc thông báo hỏng', 'pass');
  perform t.reset();
  perform t.reset();
  perform t.ok((select status = 'passed' from public.learning_threads where id = w) and (select count(*) from public.learning_thread_events where thread_id = w and author_role = 'teacher') = 1 + 2,   -- 1 nhận xét cũ + trả lời + chấm
               'Thầy trả lời + chấm: nghiệp vụ VẪN commit dù nhánh thông báo lỗi');
  perform t.ok((select count(*) from public.class_system_notices) = n0, 'chấm/trả lời lỗi thông báo → không có thông báo');
  -- lỗi của CHÍNH nghiệp vụ không bị nuốt
  perform t.fails($q$insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body) values (null, null, 'student', 'submission', 'x')$q$,
                  'lỗi nghiệp vụ chính vẫn nổ lên (không bị khối an toàn nuốt)');
  alter table public.class_system_notices drop constraint t_inject_fail;
  -- Lỗi khác: hạ tầng nhận lớp hỏng (đổi tên view) cũng không phá nghiệp vụ
  update public.learning_threads set last_teacher_user_id = null where id = w;   -- buộc đi đường fallback theo lớp (qua view)
  alter view tva_private.class_memberships rename to class_memberships_off;
  ev0 := (select count(*) from public.learning_thread_events);
  n0 := (select count(*) from public.class_system_notices);
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body)
  values (w, t.u('A'), 'student', 'submission', 'khi view lớp hỏng');
  perform t.ok((select count(*) from public.learning_thread_events) = ev0 + 1 and (select count(*) from public.class_system_notices) = n0, 'view lớp hỏng (lỗi thật khi tra người nhận) → sự kiện vẫn ghi, không thông báo');
  alter view tva_private.class_memberships_off rename to class_memberships;

  -- ── 11) Phục hồi sau lỗi: retry không tạo trùng; thông báo hoạt động lại ──
  perform t.as_user('A');
  perform t.as_user('A');
  perform public.lt_submit(t.l(2), 'question', 'Hỏi sau khi hết lỗi');
  perform t.reset();
  perform t.ok(t.n('T') >= 1, 'hết lỗi → thông báo hoạt động lại');
end $$;

-- ── 12) Quyền & riêng tư dưới đúng role ──
begin;
select t.as_user('A');
do $$
begin
  perform t.ok((select count(*) from public.class_system_notices(null, 100) where body like 'Học viên%') = 0, 'A không thấy thông báo hướng tới Thầy');
  perform t.ok((select count(*) from public.class_system_notices(null, 100)) = 2 + 1, 'A chỉ thấy thông báo của mình (2 chấm + 1 trả lời)');
  perform t.fails($q$select * from public.class_system_notices$q$, 'A không đọc thẳng bảng', 'permission denied');
  perform t.fails($q$insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key) values (t.u('T'), 'submission_received', 'giả', 'thread', '99999999-0000-4000-8000-000000000001', 'x')$q$,
                  'A không tự giả thông báo cho Thầy', 'permission denied');
end $$;
rollback;

begin;
select t.as_user('T3');
do $$
declare v_s record; v_max bigint;
begin
  perform t.ok((select count(*) from public.class_system_notices(null, 100)) = 1, 'T3 chỉ thấy thông báo của chính mình (thread B)');
  select * into v_s from public.class_system_notice_summary();
  perform t.ok(v_s.unread = 1 and v_s.last_body = 'Học viên vừa nộp bài.', 'Thầy: summary đếm chưa đọc + thông báo mới nhất');
  select max(seq) into v_max from public.class_system_notices(null, 100);
  perform public.class_system_notice_mark_read(v_max);
  perform t.ok((select unread from public.class_system_notice_summary()) = 0, 'Thầy đánh dấu đã đọc → 0 chưa đọc');
end $$;
rollback;

begin;
select t.as_user('T');
do $$
begin
  perform t.ok((select count(*) from public.class_system_notices(null, 100) where kind = 'submission_received') = 3, 'Thầy phụ trách thấy thông báo nộp bài của mình');
  perform t.ok((select bool_and(unread) from public.class_system_notices(null, 100)), 'chưa đọc cho tới khi mở màn');
  perform t.fails($q$select public.class_system_notice_on_event()$q$, 'client không gọi trực tiếp hàm trigger', 'permission denied');
end $$;
rollback;

begin;
select t.as_anon();
select t.fails($q$select * from public.class_system_notice_summary()$q$, 'anon không gọi được RPC', 'permission denied');
rollback;

\echo ALL SYSTEM CHAT V2 DB TESTS PASS
