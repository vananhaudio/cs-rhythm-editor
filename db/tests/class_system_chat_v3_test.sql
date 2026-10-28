-- ═══ TEST Class System Chat V3 (db/class_system_chat_v3_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-class-system-chat-db.sh (sau V2, cùng DB). Có chốt chặn user thật.
-- Đi qua RPC THẬT (lt_submit / lt_respond / class_system_notices / class_system_notice_mark_read) dưới đúng role authenticated + JWT sub.
-- A = học viên lớp DH2.KD18 · T, T2 = Thầy thuộc lớp · T3 = Thầy KHÔNG thuộc lớp · B, C = học viên khác
\set ON_ERROR_STOP on

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
end $$;

create schema v3;
grant usage on schema v3 to anon, authenticated;
create function v3.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'T2' then 'd2d2d2d2-0000-4000-8000-0000000000d2'::uuid
                when 'T3' then 'd3d3d3d3-0000-4000-8000-0000000000d3'::uuid end $$;
create function v3.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v3.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function v3.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function v3.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
create function v3.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute q;
  exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then
      raise exception 'FAIL: % — bị chặn nhưng sai lý do: % (mong: %)', msg, sqlerrm, p_expect;
    end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return;
  end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
-- Số thông báo của một người cho một thread (đọc bằng postgres, rồi trả lại role + JWT đang dùng)
create function v3.n(k text, p_thread uuid, p_kind text default null) returns int language plpgsql as $$
declare r int; v_role text := current_setting('role'); v_claims text := coalesce(current_setting('request.jwt.claims', true), '{}'); begin
  perform set_config('role', 'postgres', true);
  select count(*)::int into r from public.class_system_notices where user_id = v3.u(k) and ref_key = p_thread::text and (p_kind is null or kind = p_kind);
  perform set_config('request.jwt.claims', v_claims, true);
  perform set_config('role', v_role, true);
  return r;
end $$;
create function v3.last_body(k text, p_thread uuid, p_kind text) returns text language plpgsql as $$
declare r text; v_role text := current_setting('role'); v_claims text := coalesce(current_setting('request.jwt.claims', true), '{}'); begin
  perform set_config('role', 'postgres', true);
  select body into r from public.class_system_notices where user_id = v3.u(k) and ref_key = p_thread::text and kind = p_kind order by seq desc limit 1;
  perform set_config('request.jwt.claims', v_claims, true);
  perform set_config('role', v_role, true);
  return r;
end $$;
grant execute on all functions in schema v3 to anon, authenticated;

do $$
declare x uuid; q uuid; n0 int; ev0 int; mx bigint; r record; legacy_seq bigint;
begin
  perform v3.reset();
  perform v3.ok(to_regprocedure('public.class_system_notice_on_event()') is not null
                and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'class_system_notices_kind_check') like '%teacher_commented%',
                'nền V3: CHECK kind có teacher_commented, trigger còn đó');

  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_set_lesson_settings('e0000000-0000-4000-8000-000000000003', 'allowed', 'allowed');
  perform v3.reset();

  -- thông báo cũ (V1) của A: phải đọc được nguyên vẹn qua RPC client sau V3
  perform v3.reset();
  insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
  values (v3.u('A'), 'checkpoint_graded', 'Bài trả Buổi 01 của bạn đã được chấm.', 'thread', '99999999-9999-4999-8999-999999999999', 'grade:99999999-9999-4999-8999-999999999999:1')
  returning seq into legacy_seq;

  -- ── 1) Nộp bài lần đầu → Thầy thuộc lớp ──
  perform v3.as_user('A'); perform v3.as_user('A');
  x := public.lt_submit('e0000000-0000-4000-8000-000000000003', 'submission', 'Em nộp bài');
  perform v3.reset();
  perform v3.ok(v3.n('T', x, 'submission_received') = 1 and v3.n('T2', x, 'submission_received') = 1, 'nộp lần đầu → T, T2 mỗi Thầy 1 thông báo');
  perform v3.ok(v3.last_body('T', x, 'submission_received') like 'Học viên vừa nộp bài%' and v3.last_body('T', x, 'submission_received') not like '%nộp lại%',
                'lần đầu: nội dung "nộp bài" (không phải nộp lại), không chứa tên/nội dung bài');
  perform v3.ok(v3.n('T3', x) = 0 and v3.n('A', x) = 0 and v3.n('B', x) = 0 and v3.n('C', x) = 0, 'người ngoài lớp / học viên khác / người nộp KHÔNG nhận');

  -- ── 2) Thầy yêu cầu NỘP LẠI kèm nhận xét trong MỘT lần lưu → học viên đúng 1 thông báo, nói rõ nộp lại ──
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Tay trái chưa đều, làm lại nhé', 'retry');
  perform v3.reset();
  perform v3.ok(v3.n('A', x) = 1 and v3.n('A', x, 'checkpoint_graded') = 1 and v3.n('A', x, 'teacher_commented') = 0,
                'nhận xét + NỘP LẠI trong một lần lưu → học viên đúng 1 thông báo (không thêm "nhận xét" riêng)');
  perform v3.ok(v3.last_body('A', x, 'checkpoint_graded') like 'Thầy yêu cầu bạn nộp lại bài trả%' and v3.last_body('A', x, 'checkpoint_graded') not like '%ĐẠT%'
                and v3.last_body('A', x, 'checkpoint_graded') not like '%nhận xét%',
                'nội dung NỘP LẠI nói rõ phải nộp lại, không nói ĐẠT, không lộ nội dung nhận xét');
  -- gửi lại do mạng (cùng kết quả, cùng lượt nộp) → không nhân đôi
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Tay trái chưa đều, làm lại nhé', 'retry');
  perform v3.reset();
  perform v3.ok(v3.n('A', x, 'checkpoint_graded') = 1, 'retry request / lưu lại cùng kết quả → vẫn 1 thông báo');

  -- ── 3) Học viên NỘP LẠI → Thầy phụ trách nhận thông báo mới, nội dung "nộp lại"; T2 không (đã có Thầy phụ trách) ──
  perform v3.as_user('A'); perform v3.as_user('A');
  perform public.lt_submit('e0000000-0000-4000-8000-000000000003', 'submission', 'Em nộp lại');
  perform v3.reset();
  perform v3.ok(v3.n('T', x, 'submission_received') = 2, 'dedupe KHÔNG nuốt lượt nộp lại: T nhận thông báo thứ 2');
  perform v3.ok(v3.last_body('T', x, 'submission_received') like 'Học viên vừa nộp lại bài%', 'nội dung phân biệt "nộp lại"');
  perform v3.ok(v3.n('T2', x, 'submission_received') = 1, 'đã có Thầy phụ trách → T2 không nhận thêm');
  perform v3.as_user('A'); perform v3.as_user('A');
  perform public.lt_submit('e0000000-0000-4000-8000-000000000003', 'submission', 'Em sửa thêm');
  perform v3.reset();
  perform v3.ok(v3.n('T', x, 'submission_received') = 2, 'nộp liên tiếp khi chờ chấm → không spam');

  -- ── 4) Thầy CHỈ NHẬN XÉT (chưa chấm) → thông báo "nhận xét", không nói đạt / nộp lại ──
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Nhịp 3 hơi vội');
  perform v3.reset();
  perform v3.ok(v3.n('A', x, 'teacher_commented') = 1 and v3.n('A', x, 'checkpoint_graded') = 1, 'chỉ nhận xét → 1 thông báo "nhận xét"; không đụng thông báo chấm');
  perform v3.ok(v3.last_body('A', x, 'teacher_commented') like 'Thầy vừa nhận xét bài trả%' and v3.last_body('A', x, 'teacher_commented') !~ '(ĐẠT|nộp lại)',
                'nội dung nhận xét không nói bài đã đạt / phải nộp lại');
  -- nhận xét nhiều lần trong cùng lượt khi học viên CHƯA đọc → gộp 1
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Bổ sung: giữ nhịp bằng metronome');
  perform public.lt_respond(x, 'teacher_feedback', 'Bổ sung 2');
  perform v3.reset();
  perform v3.ok(v3.n('A', x, 'teacher_commented') = 1, 'Thầy nhận xét nhiều lần khi học viên chưa đọc → vẫn 1 thông báo (không spam)');
  -- học viên đọc xong (RPC thật), Thầy nhận xét tiếp → thông báo mới (không bị dedupe nuốt)
  perform v3.as_user('A'); perform v3.as_user('A');
  mx := (select max(seq) from public.class_system_notices(null, 100));
  perform public.class_system_notice_mark_read(mx);
  perform v3.ok((select unread from public.class_system_notice_summary() ) = 0, 'học viên mở Thông báo → chưa đọc = 0');
  perform v3.reset();
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Sau khi em đọc: thêm một ý nữa');
  perform v3.reset();
  perform v3.ok(v3.n('A', x, 'teacher_commented') = 2, 'học viên ĐÃ đọc rồi Thầy nhận xét tiếp → thông báo mới (không mất do dedupe quá rộng)');

  -- ── 5) Nhận xét + chấm ĐẠT trong MỘT lần lưu → đúng 1 thông báo, nội dung ĐẠT ──
  n0 := (select count(*) from public.class_system_notices where user_id = v3.u('A'));
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Tốt lắm, đạt rồi', 'pass');
  perform v3.reset();
  perform v3.ok((select count(*) from public.class_system_notices where user_id = v3.u('A')) = n0 + 1, 'nhận xét + ĐẠT trong một lần lưu → đúng +1 thông báo');
  perform v3.ok(v3.last_body('A', x, 'checkpoint_graded') like 'Bài trả% của bạn đã ĐẠT.', 'nội dung ĐẠT riêng, khác NỘP LẠI');
  perform v3.ok(v3.n('A', x, 'checkpoint_graded') = 2, 'NỘP LẠI → rồi ĐẠT (kết quả đổi) = 2 thông báo chấm, không bị nuốt');
  -- lưu lại / gửi lại cùng kết quả ĐẠT
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Tốt lắm, đạt rồi', 'pass');
  perform v3.reset();
  perform v3.ok(v3.n('A', x, 'checkpoint_graded') = 2, 'gửi lại cùng kết quả ĐẠT (retry mạng) → không thêm');

  -- ── 6) HỎI BÀI → Thầy; Thầy TRẢ LỜI → học viên (đọc xong rồi trả lời tiếp = thông báo mới) ──
  perform v3.as_user('A'); perform v3.as_user('A');
  perform public.lt_submit('e0000000-0000-4000-8000-000000000003', 'question', 'Em hỏi một câu');
  perform v3.reset();
  perform v3.ok(v3.n('T', x, 'question_received') = 1, 'học viên hỏi bài → Thầy phụ trách nhận 1 thông báo câu hỏi');
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_answer', 'Trả lời nhé');
  perform public.lt_respond(x, 'teacher_answer', 'Bổ sung');
  perform v3.reset();
  perform v3.ok(v3.n('A', x, 'question_answered') = 1, 'Thầy trả lời (nhiều lần khi chưa đọc) → 1 thông báo trả lời');
  perform v3.as_user('A'); perform v3.as_user('A');
  perform public.class_system_notice_mark_read((select max(seq) from public.class_system_notices(null, 100)));
  perform v3.reset();
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_answer', 'Thêm ý sau khi em đọc');
  perform v3.reset();
  perform v3.ok(v3.n('A', x, 'question_answered') = 2, 'học viên đã đọc rồi Thầy trả lời tiếp → thông báo mới');

  -- ── 7) Quyền người nhận ──
  perform v3.ok(v3.n('T3', x) = 0 and v3.n('B', x) = 0 and v3.n('C', x) = 0, 'Thầy ngoài lớp, học viên khác KHÔNG nhận bất kỳ thông báo nào của thread');
  perform v3.ok(v3.n('T', x, 'checkpoint_graded') = 0 and v3.n('T', x, 'teacher_commented') = 0 and v3.n('T', x, 'question_answered') = 0, 'Thầy không nhận thông báo dành cho học viên');
  perform v3.as_user('B'); perform v3.as_user('B');
  perform v3.ok(not exists (select 1 from public.class_system_notices(null, 100) where ref_key = x::text), 'học viên khác gọi RPC đọc thông báo → không thấy thread của A');
  perform v3.reset();
  perform v3.as_user('A'); perform v3.as_user('A');
  perform v3.ok(exists (select 1 from public.class_system_notices(null, 100) where seq = legacy_seq and kind = 'checkpoint_graded' and body like '%đã được chấm%'),
                'thông báo cũ (V1) vẫn đọc được nguyên vẹn qua RPC client');
  perform v3.ok(exists (select 1 from public.class_system_notices(null, 100) where kind in ('teacher_commented', 'checkpoint_graded', 'question_answered') and ref_key = x::text),
                'thông báo mới đọc được qua cùng RPC client (ref thread giữ nguyên để điều hướng)');
  perform v3.reset();

  -- ── 8) Thao tác THẤT BẠI không phát sinh thông báo ──
  n0 := (select count(*) from public.class_system_notices);
  perform v3.as_user('T'); perform v3.as_user('T');
  perform v3.fails(format($q$select public.lt_respond(%L, 'teacher_feedback', 'x', 'bad')$q$, x), 'verdict sai bị chặn', 'LT_BAD_VERDICT');
  perform v3.reset();
  perform v3.as_user('B'); perform v3.as_user('B');
  perform v3.fails(format($q$select public.lt_respond(%L, 'teacher_feedback', 'học viên giả danh Thầy', 'pass')$q$, x), 'học viên không chấm được', 'LT_TEACHER_ONLY');
  perform v3.reset();
  perform v3.ok((select count(*) from public.class_system_notices) = n0, 'thao tác bị từ chối → 0 thông báo mới');

  -- ── 9) Lỗi ở nhánh thông báo KHÔNG phá nghiệp vụ nhận xét / chấm / trả lời ──
  alter table public.class_system_notices add constraint t_inject_fail check (false) not valid;
  n0 := (select count(*) from public.class_system_notices);
  ev0 := (select count(*) from public.learning_thread_events where thread_id = x);
  perform v3.as_user('T'); perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Nhận xét lúc thông báo hỏng');
  perform public.lt_respond(x, 'teacher_feedback', 'Chấm lúc thông báo hỏng', 'retry');
  perform v3.reset();
  perform v3.ok((select count(*) from public.learning_thread_events where thread_id = x) = ev0 + 2, 'nhận xét + chấm: nghiệp vụ VẪN commit dù nhánh thông báo lỗi');
  perform v3.ok((select status = 'needs_retry' from public.learning_threads where id = x), 'trạng thái thread vẫn cập nhật đúng');
  perform v3.ok((select count(*) from public.class_system_notices) = n0, 'lỗi thông báo → không để lại thông báo nửa vời');
  alter table public.class_system_notices drop constraint t_inject_fail;

  -- ── 10) Chạy lại migration (idempotent) không đổi hành vi / dữ liệu ──
  perform v3.ok((select count(*) from public.class_system_notices where kind = 'teacher_commented') >= 2, 'dữ liệu V3 hiện hữu trước rollback');
  raise notice 'ALL V3 SQL PASS';
end $$;
