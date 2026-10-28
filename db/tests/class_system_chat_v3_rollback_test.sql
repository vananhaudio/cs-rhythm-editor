-- ═══ TEST sau ROLLBACK V3 (db/class_system_chat_v3_rollback.sql) ═══
-- Chạy trên cluster PostgreSQL TẠM, ngay sau rollback, cùng DB với class_system_chat_v3_test.sql (schema v3 còn helper).
-- Chứng minh: thông báo 'teacher_commented' còn nguyên và vẫn đọc / đánh dấu đã đọc được; hành vi trigger là V2.
\set ON_ERROR_STOP on

do $$
declare
  x uuid; n_tc int; mx bigint; u int; n0 int;
begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
  select ref_key::uuid into x from public.class_system_notices where kind = 'teacher_commented' and user_id = v3.u('A') order by seq limit 1;
  perform v3.ok(x is not null, 'sau rollback: còn thông báo teacher_commented của A');
  n_tc := (select count(*) from public.class_system_notices where kind = 'teacher_commented');

  -- Đọc qua RPC thật dưới role authenticated
  perform v3.as_user('A');
  perform v3.ok(exists (select 1 from public.class_system_notices(null, 100) where kind = 'teacher_commented' and ref_key = x::text),
                'RPC class_system_notices vẫn trả thông báo teacher_commented sau rollback');
  perform v3.ok((select unread from public.class_system_notice_summary()) >= 1, 'summary vẫn đếm chưa đọc');
  mx := (select max(seq) from public.class_system_notices(null, 100));
  perform public.class_system_notice_mark_read(mx);
  perform v3.ok((select unread from public.class_system_notice_summary()) = 0, 'mark_read đánh dấu đã đọc được (kể cả teacher_commented)');
  perform v3.ok(not exists (select 1 from public.class_system_notices(null, 100) where unread), 'không còn dòng nào chưa đọc');
  perform v3.reset();

  -- Hành vi trigger là V2: chỉ nhận xét → KHÔNG có thông báo mới; chấm ĐẠT → có (checkpoint_graded)
  n0 := (select count(*) from public.class_system_notices);
  perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Nhận xét sau rollback');
  perform v3.reset();
  perform v3.ok((select count(*) from public.class_system_notices) = n0 and (select count(*) from public.class_system_notices where kind = 'teacher_commented') = n_tc,
                'V2: chỉ nhận xét → không tạo thông báo (không sinh teacher_commented mới)');
  perform v3.as_user('T');
  perform public.lt_respond(x, 'teacher_feedback', 'Chấm sau rollback', 'pass');
  perform v3.reset();
  perform v3.ok((select count(*) from public.class_system_notices) = n0 + 1
                and (select count(*) from public.class_system_notices where kind = 'checkpoint_graded' and ref_key = x::text and body like '%đã được chấm%') >= 1,
                'V2: chấm → 1 thông báo checkpoint_graded kiểu V2 ("đã được chấm")');
  perform v3.ok((select count(*) from public.class_system_notices where kind = 'teacher_commented') = n_tc, 'số teacher_commented không đổi sau rollback');
  raise notice 'ALL V3 ROLLBACK SQL PASS';
end $$;
