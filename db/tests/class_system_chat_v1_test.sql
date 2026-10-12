-- ═══ TEST Class System Chat V1 (db/class_system_chat_v1_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-class-system-chat-db.sh. Có chốt chặn user thật.
-- A, B = học sinh · T = thầy. Sự kiện chấm được chèn thẳng vào learning_thread_events (đúng bảng lt_respond ghi) → trigger chạy thật.
\set ON_ERROR_STOP on

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
end $$;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid end $$;
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

-- Dữ liệu: một thread của A (Buổi 02)
select t.reset();
insert into public.learning_threads (id, learner_user_id, content_kind, content_key, program_code, session_no, identity, status)
values ('99999999-0000-4000-8000-000000000001', t.u('A'), 'program_session', 'S:SOLO01:2', 'SOLO01', 2, '{}'::jsonb, 'waiting_teacher');

do $$
begin
  perform t.ok((select count(*) from public.class_system_notices) = 0, 'chưa có sự kiện chấm → chưa có thông báo (không backfill)');

  -- học viên nộp bài: KHÔNG thông báo
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body)
  values ('99999999-0000-4000-8000-000000000001', t.u('A'), 'student', 'submission', 'Em nộp bài');
  perform t.ok((select count(*) from public.class_system_notices) = 0, 'học viên nộp bài không tạo thông báo');

  -- Thầy nhận xét KHÔNG chấm / trả lời Hỏi bài: không thông báo (V1 chỉ thông báo khi hoàn tất chấm)
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body)
  values ('99999999-0000-4000-8000-000000000001', t.u('T'), 'teacher', 'teacher_feedback', 'Nhận xét chưa chấm');
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body)
  values ('99999999-0000-4000-8000-000000000001', t.u('T'), 'teacher', 'teacher_answer', 'Trả lời');
  perform t.ok((select count(*) from public.class_system_notices) = 0, 'nhận xét không chấm / trả lời Hỏi bài không tạo thông báo');

  -- sự kiện chấm đã ẩn: không thông báo
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, verdict, body, hidden_at)
  values ('99999999-0000-4000-8000-000000000001', t.u('T'), 'teacher', 'teacher_feedback', 'pass', 'ẩn', now());
  perform t.ok((select count(*) from public.class_system_notices) = 0, 'sự kiện đã ẩn không tạo thông báo');

  -- lưu thất bại (rollback) → không có thông báo
  begin
    insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, verdict, body)
    values ('99999999-0000-4000-8000-000000000001', t.u('T'), 'teacher', 'teacher_feedback', 'retry', 'sẽ rollback');
    raise exception 'ROLLBACK_TEST';
  exception when others then if sqlerrm <> 'ROLLBACK_TEST' then raise; end if;
  end;
  perform t.ok((select count(*) from public.class_system_notices) = 0, 'lưu thất bại (rollback) → không còn thông báo');

  -- Thầy chấm xong (Cần làm lại) → đúng 1 thông báo cho A, nội dung ngắn không nêu kết quả
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, verdict, body)
  values ('99999999-0000-4000-8000-000000000001', t.u('T'), 'teacher', 'teacher_feedback', 'retry', 'Làm lại nhé: nhận xét chi tiết riêng tư');
  perform t.ok((select count(*) from public.class_system_notices where user_id = t.u('A')) = 1, 'Thầy chấm xong → đúng 1 thông báo cho học viên A');
  perform t.ok((select body from public.class_system_notices) = 'Bài trả Buổi 02 của bạn đã được chấm.', 'nội dung ngắn, đúng buổi, KHÔNG chứa nhận xét/kết quả');
  perform t.ok((select ref_type || ':' || ref_key from public.class_system_notices) = 'thread:99999999-0000-4000-8000-000000000001', 'liên kết = đúng thread của bài trả');

  -- Chấm lại / sửa kết quả trong CÙNG lần nộp → không thêm thông báo (hành vi bảo thủ)
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, verdict, body)
  values ('99999999-0000-4000-8000-000000000001', t.u('T'), 'teacher', 'teacher_feedback', 'pass', 'Đạt rồi');
  perform t.ok((select count(*) from public.class_system_notices) = 1, 'chấm lại trong cùng lần nộp → vẫn 1 thông báo (không dồn dập)');

  -- Học viên nộp lại → Thầy chấm → thông báo MỚI
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, body)
  values ('99999999-0000-4000-8000-000000000001', t.u('A'), 'student', 'submission', 'Em nộp lại');
  insert into public.learning_thread_events (thread_id, author_user_id, author_role, kind, verdict, body)
  values ('99999999-0000-4000-8000-000000000001', t.u('T'), 'teacher', 'teacher_feedback', 'pass', 'Đạt');
  perform t.ok((select count(*) from public.class_system_notices where user_id = t.u('A')) = 2, 'nộp lại rồi được chấm → thông báo thứ 2');
  perform t.ok((select count(*) from public.class_system_notices where user_id <> t.u('A')) = 0, 'không có thông báo cho người khác (Thầy không nhận)');

  -- chống trùng ở tầng DB
  perform t.fails($q$insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
    select user_id, kind, body, ref_type, ref_key, dedupe_key from public.class_system_notices limit 1$q$,
    'cùng (user, dedupe_key) không ghi được hai lần', 'class_system_notices_dedupe_uq');
end $$;

-- Học viên A: chỉ thấy của mình, chưa đọc = 4, đọc xong = 0
begin;
select t.as_user('A');
do $$
declare v_max bigint; v_s record;
begin
  perform t.ok((select count(*) from public.class_system_notices(null, 30)) = 2, 'A thấy 2 thông báo của mình');
  perform t.ok((select bool_and(unread) from public.class_system_notices(null, 30)), 'cả 2 đều chưa đọc');
  perform t.ok((select seq from public.class_system_notices(null, 30) limit 1) = (select max(seq) from public.class_system_notices(null, 30)), 'mới nhất trước');
  select * into v_s from public.class_system_notice_summary();
  perform t.ok(v_s.unread = 2 and v_s.last_body like 'Bài trả Buổi 02%', 'summary: 2 chưa đọc + thông báo mới nhất');
  perform t.ok((select count(*) from public.class_system_notices(null, 2)) = 2, 'phân trang: limit 2');
  perform t.ok((select count(*) from public.class_system_notices(null, 1)) = 1 and (select count(*) from public.class_system_notices((select max(seq) from public.class_system_notices(null, 30)), 30)) = 1, 'phân trang: before_seq');
  select max(seq) into v_max from public.class_system_notices(null, 30);
  perform t.ok(public.class_system_notice_mark_read(v_max - 1) = v_max - 1, 'mark_read tới giữa danh sách');
  perform t.ok((select unread from public.class_system_notice_summary()) = 1, 'còn 1 chưa đọc');
  perform t.ok(public.class_system_notice_mark_read(1) = v_max - 1, 'mark_read lùi không làm tụt (chỉ tăng)');
  perform t.ok(public.class_system_notice_mark_read(v_max + 1000) = v_max, 'mark_read vượt không quá thông báo mới nhất');
  perform t.ok((select unread from public.class_system_notice_summary()) = 0, 'đọc hết → chưa đọc = 0 (reload không bật lại)');
  perform t.fails($q$select * from public.class_system_notices$q$, 'A không đọc thẳng bảng', 'permission denied');
  perform t.fails($q$insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key) values (t.u('A'), 'checkpoint_passed', 'giả', 'thread', '99999999-0000-4000-8000-000000000001', 'x')$q$, 'A không tự ghi thông báo (không giả mạo hệ thống)', 'permission denied');
  perform t.fails($q$update public.class_system_notice_reads set last_read_seq = 0$q$, 'A không sửa thẳng trạng thái đọc', 'permission denied');
end $$;
rollback;

-- Học sinh B: không thấy của A; trạng thái đọc độc lập
begin;
select t.as_user('B');
do $$
declare v_s record;
begin
  perform t.ok((select count(*) from public.class_system_notices(null, 30)) = 0, 'B không thấy thông báo của A');
  select * into v_s from public.class_system_notice_summary();
  perform t.ok(v_s.last_seq is null and v_s.unread = 0, 'B: summary rỗng, 0 chưa đọc');
  perform t.ok(public.class_system_notice_mark_read(1000000) = 0, 'B mark_read không ảnh hưởng ai (chặn ở max của B = 0)');
end $$;
rollback;

-- anon
begin;
select t.as_anon();
select t.fails($q$select * from public.class_system_notices(null, 30)$q$, 'anon không gọi được RPC', 'permission denied');
rollback;

-- Trigger không EXECUTE được từ client
begin;
select t.as_user('A');
select t.fails($q$select public.class_system_notice_on_event()$q$, 'client không gọi trực tiếp hàm trigger', 'permission denied');
rollback;
\echo ALL SYSTEM CHAT DB TESTS PASS
