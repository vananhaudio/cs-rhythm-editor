/*
LEARNING THREAD P1 — SAU MIGRATION: cổng kiểm + smoke tự huỷ + bật 3 bài DH2. MỘT lần dán, chạy SAU
db/learning_threads_p1_setup.sql. FILE SINH TỰ ĐỘNG bởi scripts/build-lt-post-migration.py — đừng sửa tay.
1) Cổng hậu migration: 3 bảng learning_*, RLS bật, 0 policy, anon/authenticated 0 quyền bảng; 15 hàm lt_*
   (10 RPC cho authenticated, 5 hàm nội bộ không ai gọi thẳng, anon không EXECUTE hàm nào); hàm phụ thuộc không lệch.
2) Smoke (giống db/tests/learning_threads_p1_prod_smoke.sql) chạy trong savepoint rồi HUỶ → không để lại dữ liệu.
3) Chỉ khi 1+2 PASS: Thầy/admin bật Trả bài + Hỏi bài (allowed/allowed) cho 3 bài DH2 thật, kiểm đúng id + tên bài
   + thuộc khoá DH2. Không bật "required". Không ghi tiến độ.
Lỗi ở bất kỳ bước nào → RAISE → toàn bộ rollback, không cấu hình gì. Kết quả: bảng (section, item, detail, status).
Không có comment '--' (an toàn khi copy).
*/
do $post$
declare
  v_t uuid; v_a uuid; v_c uuid; v_n uuid; v_lesson uuid; v_lesson2 uuid; v_thread uuid; v_thread2 uuid;
  v_prog_before bigint; v_prog_after bigint; d jsonb; n int; cand uuid;
  ok text[] := '{}'; bad text[] := '{}';
  v_admin uuid; gate_bad text[] := '{}'; n_fn int; r record;
  v_lessons constant jsonb := '[{"id": "5f7acacd-9214-48f3-9349-93cc382649fb", "title": "Bài 4.3 — Bolero móc kiểu 1"}, {"id": "a85592d5-b519-470d-84d0-4d9182d224b3", "title": "Bài 4.4 — Bolero móc kiểu 2"}, {"id": "d2c00805-0000-4000-8000-000000000000", "title": "Bài 6.3 — Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp"}]';
  v_dh2 constant uuid := 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b';
  v_prompt constant text := 'Bạn có thể gửi phần thực hành của bài này hoặc đặt câu hỏi cho Thầy.';
  fn_expected constant jsonb := '{"class_public_identity": "9bda0938889c533040fb52f3301f3152", "is_class_member": "459786921eb5bbd4ff07c83bdb4db480", "is_teacher": "19b164504b4ce59b9bbdb4b0b64e48ad"}';
  report jsonb := '[]';
begin
  for r in select t.name, c.oid, c.relrowsecurity from unnest(array['learning_lesson_settings', 'learning_threads', 'learning_thread_events']) t(name)
           left join pg_class c on c.relname = t.name and c.relnamespace = 'public'::regnamespace loop
    if r.oid is null then gate_bad := gate_bad || ('thiếu bảng ' || r.name); continue; end if;
    if not r.relrowsecurity then gate_bad := gate_bad || ('RLS tắt: ' || r.name); end if;
    if exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.name) then gate_bad := gate_bad || ('có policy trên ' || r.name); end if;
    if exists (select 1 from pg_class c2, aclexplode(c2.relacl) x where c2.oid = r.oid and (x.grantee = 0 or x.grantee in ('anon'::regrole, 'authenticated'::regrole))) then
      gate_bad := gate_bad || ('anon/authenticated còn quyền bảng ' || r.name);
    end if;
  end loop;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'learning_threads_open_uq') then gate_bad := gate_bad || 'thiếu unique thread đang mở'::text; end if;
  select count(*) into n_fn from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'lt\_%';
  if n_fn <> 15 then gate_bad := gate_bad || format('hàm lt_*: %s (cần 15)', n_fn); end if;
  for r in select p.oid, p.proname, p.prosecdef from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'lt\_%' loop
    if has_function_privilege('anon', r.oid, 'EXECUTE') then gate_bad := gate_bad || ('anon EXECUTE ' || r.proname); end if;
    if r.proname in ('lt_lesson_open_for_me', 'lt_can_view', 'lt_check_media', 'lt_normalize_resources', 'lt_identity_snapshot') then
      if has_function_privilege('authenticated', r.oid, 'EXECUTE') then gate_bad := gate_bad || ('hàm nội bộ mở cho authenticated: ' || r.proname); end if;
    else
      if not has_function_privilege('authenticated', r.oid, 'EXECUTE') then gate_bad := gate_bad || ('RPC thiếu quyền authenticated: ' || r.proname); end if;
      if not r.prosecdef then gate_bad := gate_bad || ('RPC không SECURITY DEFINER: ' || r.proname); end if;
    end if;
  end loop;
  for r in select e.key, e.value #>> '{}' as md5 from jsonb_each(fn_expected) e loop
    if coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.key), '') <> r.md5 then
      gate_bad := gate_bad || ('hàm phụ thuộc lệch: ' || r.key);
    end if;
  end loop;
  if cardinality(gate_bad) > 0 then
    raise exception 'DỪNG — cổng hậu migration STOP: %', array_to_string(gate_bad, '; ');
  end if;
  report := report || jsonb_build_array(jsonb_build_object('section', 'post_gate', 'item', 'bảng/RLS/quyền/hàm/phụ thuộc', 'detail', '3 bảng · 15 hàm lt_* · 0 policy · 0 quyền bảng anon/authenticated', 'status', 'OK'));

  begin
    if (select count(*) from public.learning_threads) + (select count(*) from public.learning_lesson_settings) <> 0 then
      raise exception 'SMOKE FAIL: bảng P1 đã có dữ liệu — smoke này chỉ dành cho ngay sau migration';
    end if;

    select a.id into v_t from public.app_users a where a.role in ('teacher', 'admin') order by (a.role = 'teacher') desc, a.id limit 1;
    for cand in
      select s.user_id from public.edu_students s
      where s.user_id is not null and not exists (select 1 from public.app_users a where a.id = s.user_id and a.role in ('teacher', 'admin'))
      order by s.enrolled_at desc nulls last limit 200
    loop
      perform set_config('request.jwt.claims', json_build_object('sub', cand, 'role', 'authenticated')::text, true);
      select jsonb_agg(x.id order by x.ord) into d from (
        select (l ->> 'id')::uuid as id, row_number() over () as ord
        from jsonb_array_elements(coalesce(public.my_learning_state() -> 'courses', '[]'::jsonb)) c,
             jsonb_array_elements(coalesce(c -> 'lessons', '[]'::jsonb)) l
        where l ->> 'access' = 'open' limit 2) x;
      if d is not null then
        v_a := cand; v_lesson := (d ->> 0)::uuid; v_lesson2 := (d ->> 1)::uuid;
        exit;
      end if;
    end loop;
    select s.user_id into v_c from public.edu_students s
     where s.user_id is not null and s.user_id <> v_a
       and not exists (select 1 from public.app_users a where a.id = s.user_id and a.role in ('teacher', 'admin'))
     order by s.enrolled_at desc nulls last limit 1;
    select u.id into v_n from auth.users u
     where not exists (select 1 from public.edu_students s where s.user_id = u.id)
       and not exists (select 1 from public.app_users a where a.id = u.id and a.role in ('teacher', 'admin'))
     limit 1;
    if v_t is null or v_a is null or v_c is null or v_lesson2 is null then
      raise exception 'SMOKE FAIL: thiếu tài khoản để kiểm (thầy %, học sinh có 2 bài mở %, học sinh khác %)', v_t, v_a, v_c;
    end if;
    perform set_config('request.jwt.claims', '{}', true);
    select count(*) into v_prog_before from public.edu_lesson_progress p
     where p.student_id in (select s.id from public.edu_students s where s.user_id = v_a);

    perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    perform public.lt_set_lesson_settings(v_lesson, 'allowed', 'allowed', 'SMOKE tự huỷ');
    ok := ok || text 'Thầy bật Trả/Hỏi bài cho 1 bài (tạm)';

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.lt_lessons_state(array[v_lesson, v_lesson2]) s
     where (s.lesson_id = v_lesson and s.submission_mode = 'allowed') or (s.lesson_id = v_lesson2 and s.submission_mode = 'off');
    if n = 2 then ok := ok || text 'lt_lessons_state: bài bật = allowed, bài khác = off'; else bad := bad || text 'lt_lessons_state sai'; end if;
    begin perform public.lt_submit(v_lesson2, 'submission', 'SMOKE'); bad := bad || text 'TRẢ BÀI ĐƯỢC ở bài chưa bật';
    exception when others then if sqlerrm = 'LT_SUBMISSION_NOT_ENABLED' then ok := ok || text 'bài chưa bật: chặn Trả bài'; else bad := bad || ('bài chưa bật: ' || sqlerrm); end if; end;
    begin perform public.lt_set_lesson_settings(v_lesson2, 'allowed', 'allowed'); bad := bad || text 'HỌC SINH tự bật được Trả bài';
    exception when others then ok := ok || text 'học sinh không tự bật được Trả bài'; end;
    begin perform 1 from public.learning_threads limit 1; bad := bad || text 'ĐỌC THẲNG learning_threads được';
    exception when insufficient_privilege then ok := ok || text 'chặn đọc thẳng bảng thread'; end;
    begin insert into public.learning_lesson_settings (content_key, lesson_id, submission_mode) values ('L:' || v_lesson2, v_lesson2, 'allowed');
      bad := bad || text 'GHI THẲNG cấu hình bài được';
    exception when insufficient_privilege then ok := ok || text 'chặn ghi thẳng cấu hình bài'; end;

    v_thread := public.lt_submit(v_lesson, 'submission', 'SMOKE tự huỷ — lần 1', 'https://www.youtube.com/watch?v=aaaaaaaaaaa', 'youtube', 'aaaaaaaaaaa');
    d := public.lt_detail(v_thread);
    if d ->> 'status' = 'waiting_teacher' and d ->> 'visibility' = 'community' and (d ->> 'lesson_id')::uuid = v_lesson
       and d #>> '{identity,lesson,id}' = v_lesson::text and d #> '{identity,course}' ? 'code' then
      ok := ok || format('A Trả bài → waiting_teacher, community, danh tính khoá %s · lớp %s',
                         coalesce(d #>> '{identity,course,code}', '?'), coalesce(d #>> '{identity,class,code}', 'Tự học'));
    else bad := bad || ('thread mới sai: ' || left(d::text, 200)); end if;
    v_thread2 := public.lt_submit(v_lesson, 'question', 'SMOKE tự huỷ — câu hỏi');
    if v_thread2 = v_thread then ok := ok || text 'Hỏi bài cùng bài → cùng thread'; else bad := bad || text 'Hỏi bài tạo thread thứ hai'; end if;
    begin perform public.lt_respond(v_thread, 'teacher_feedback', 'SMOKE', 'pass'); bad := bad || text 'HỌC SINH tự chấm ĐẠT được';
    exception when others then ok := ok || text 'học sinh không phản hồi/chấm được'; end;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin d := public.lt_detail(v_thread); ok := ok || text 'học sinh khác (thành viên Class) xem được thread community';
    exception when others then bad := bad || ('học sinh khác KHÔNG xem được community: ' || sqlerrm); end;
    begin perform 1 from public.lt_teacher_queue(); bad := bad || text 'HỌC SINH xem được hàng đợi Thầy';
    exception when others then ok := ok || text 'học sinh không xem hàng đợi Thầy'; end;
    begin perform public.lt_set_visibility(v_thread, 'private'); bad := bad || text 'NGƯỜI KHÁC đổi được visibility';
    exception when others then ok := ok || text 'người khác không đổi được visibility'; end;

    if v_n is not null then
      perform set_config('role', 'postgres', true);
      perform set_config('request.jwt.claims', json_build_object('sub', v_n, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      begin perform public.lt_detail(v_thread); bad := bad || text 'TÀI KHOẢN NGOÀI CLASS xem được thread';
      exception when others then ok := ok || text 'tài khoản ngoài Class không xem được thread'; end;
    else
      ok := ok || text '(không có tài khoản ngoài Class để kiểm — bỏ qua)';
    end if;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
    begin perform public.lt_detail(v_thread); bad := bad || text 'KHÁCH xem được thread';
    exception when insufficient_privilege then ok := ok || text 'khách: chặn lt_detail'; end;
    begin perform public.lt_lessons_state(array[v_lesson]); bad := bad || text 'KHÁCH gọi được lt_lessons_state';
    exception when insufficient_privilege then ok := ok || text 'khách: chặn lt_lessons_state'; end;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.lt_teacher_queue() q where q.id = v_thread;
    if n = 1 then ok := ok || text 'thread có trong hàng đợi Thầy'; else bad := bad || text 'thread KHÔNG có trong hàng đợi'; end if;
    perform public.lt_respond(v_thread, 'teacher_feedback', 'SMOKE: làm lại', 'retry');
    if public.lt_detail(v_thread) ->> 'status' = 'needs_retry' then ok := ok || text 'Thầy retry → needs_retry'; else bad := bad || text 'retry sai'; end if;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    perform public.lt_submit(v_lesson, 'submission', 'SMOKE tự huỷ — lần 2', 'https://www.youtube.com/watch?v=bbbbbbbbbbb', 'youtube', 'bbbbbbbbbbb');
    if public.lt_detail(v_thread) ->> 'status' = 'waiting_teacher' then ok := ok || text 'A nộp lại → waiting_teacher'; else bad := bad || text 'nộp lại sai'; end if;
    perform public.lt_set_visibility(v_thread, 'private');
    ok := ok || text 'A chuyển "Chỉ Thầy"';

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin perform public.lt_detail(v_thread); bad := bad || text 'HỌC SINH KHÁC xem được thread "Chỉ Thầy"';
    exception when others then ok := ok || text 'học sinh khác không xem được thread "Chỉ Thầy"'; end;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    perform public.lt_respond(v_thread, 'teacher_feedback', 'SMOKE: đạt', 'pass');
    d := public.lt_detail(v_thread);
    if d ->> 'status' = 'passed' and d ->> 'passed_at' is not null and (d #>> '{passed_by,user_id}')::uuid = v_t
       and (d ->> 'event_count')::int = 5 and jsonb_array_length(d -> 'events') = 5
       and d -> 'events' -> 4 ->> 'author_role' = 'teacher' and coalesce(d -> 'events' -> 4 #>> '{author,name}', '') <> '' then
      ok := ok || format('Thầy PASS → passed, 5 event trong 1 thread, người chấm "%s"', d -> 'events' -> 4 #>> '{author,name}');
    else bad := bad || ('PASS sai: ' || left(d::text, 200)); end if;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.lt_my_threads() m where m.id = v_thread and m.status = 'passed';
    if n = 1 then ok := ok || text 'A thấy thread đã ĐẠT trong lt_my_threads'; else bad := bad || text 'lt_my_threads sai'; end if;

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '{}', true);
    select count(*) into v_prog_after from public.edu_lesson_progress p
     where p.student_id in (select s.id from public.edu_students s where s.user_id = v_a);
    if v_prog_after = v_prog_before then ok := ok || text 'ĐẠT không ghi edu_lesson_progress (của học sinh smoke)'; else bad := bad || text 'edu_lesson_progress của học sinh smoke bị đổi'; end if;

    raise exception 'LT_SMOKE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'LT_SMOKE_ROLLBACK' then bad := bad || ('smoke dừng giữa chừng: ' || sqlerrm); end if;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
  if cardinality(bad) > 0 then
    raise exception 'DỪNG — SMOKE FAIL % lỗi (không cấu hình gì): % || đạt: %', cardinality(bad), array_to_string(bad, ' | '), array_to_string(ok, ' | ');
  end if;
  if (select count(*) from public.learning_threads) + (select count(*) from public.learning_thread_events) + (select count(*) from public.learning_lesson_settings) <> 0 then
    raise exception 'DỪNG — smoke để lại dữ liệu';
  end if;
  report := report || jsonb_build_array(jsonb_build_object('section', 'smoke', 'item', format('SMOKE PASS %s/%s (đã huỷ, 0 dữ liệu còn lại)', cardinality(ok), cardinality(ok)), 'detail', array_to_string(ok, ' | '), 'status', 'OK'));

  for r in select x ->> 'id' as id, x ->> 'title' as title from jsonb_array_elements(v_lessons) x loop
    if not exists (select 1 from public.edu_course_lessons l join public.edu_modules m on m.id = l.module_id
                   where l.id = r.id::uuid and l.title = r.title and m.course_id = v_dh2) then
      raise exception 'DỪNG — bài DH2 không khớp (id/tên/khoá): % "%"', r.id, r.title;
    end if;
  end loop;
  select a.id into v_admin from public.app_users a where a.role in ('admin', 'teacher') order by (a.role = 'admin') desc, a.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  for r in select x ->> 'id' as id, x ->> 'title' as title from jsonb_array_elements(v_lessons) x loop
    perform public.lt_set_lesson_settings(r.id::uuid, 'allowed', 'allowed', v_prompt);
    report := report || jsonb_build_array(jsonb_build_object('section', 'config_dh2', 'item', r.title, 'detail', r.id || ' · submission=allowed · question=allowed', 'status', 'OK'));
  end loop;
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('lt.post_report', report::text, false);
end $post$;

select section, item, detail, status from (
  select 1 as ord, x.section, x.item, x.detail, x.status
  from jsonb_to_recordset(current_setting('lt.post_report')::jsonb) as x(section text, item text, detail text, status text)
  union all
  select 2, 'counts', 'learning_lesson_settings / learning_threads / learning_thread_events',
         (select count(*) from public.learning_lesson_settings)::text || ' / ' || (select count(*) from public.learning_threads)::text
           || ' / ' || (select count(*) from public.learning_thread_events)::text, 'OK'
  union all
  select 3, 'GATE', 'PASS', 'migration + smoke + cấu hình 3 bài DH2 xong', ''
) z order by ord;
