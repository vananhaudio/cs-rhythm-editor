/*
SMOKE PRODUCTION sau migration Learning Thread P1 — TỰ HUỶ, KHÔNG ĐỂ LẠI DỮ LIỆU.
Toàn bộ nằm trong MỘT khối DO; khối LUÔN kết thúc bằng RAISE EXCEPTION → Postgres rollback MỌI thứ đã ghi
(cấu hình bài tạm, thread, event). Kết quả nằm trong thông báo lỗi: "SMOKE PASS n/n …" hoặc "SMOKE FAIL …".
(Chỉ còn dấu vết vô hại: bộ đếm identity learning_thread_events.seq nhảy số — sequence không rollback.)
Workflow thật qua RPC với JWT giả lập của tài khoản THẬT (như smoke Bạn bè + Tường):
  Thầy bật Trả/Hỏi bài cho 1 bài tạm → học sinh A Trả bài → waiting_teacher → Thầy retry → A nộp lại → A chuyển
  "Chỉ Thầy" → Thầy PASS. Kiểm: community/private, học sinh khác, tài khoản ngoài Class, khách, truy cập thẳng bảng.
Không có comment '--' (an toàn khi copy). Chạy: SQL Editor → dán nguyên file → Run.
*/
do $smoke$
declare
  v_t uuid; v_a uuid; v_c uuid; v_n uuid; v_lesson uuid; v_lesson2 uuid; v_thread uuid; v_thread2 uuid;
  v_prog_before bigint; v_prog_after bigint; d jsonb; n int; cand uuid;
  ok text[] := '{}'; bad text[] := '{}';
begin
  if (select count(*) from public.learning_threads) + (select count(*) from public.learning_lesson_settings) <> 0 then
    raise exception 'SMOKE FAIL: bảng P1 đã có dữ liệu — smoke này chỉ dành cho ngay sau migration';
  end if;
  select count(*) into v_prog_before from public.edu_lesson_progress;

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
  select count(*) into v_prog_after from public.edu_lesson_progress;
  if v_prog_after = v_prog_before then ok := ok || text 'ĐẠT không ghi edu_lesson_progress'; else bad := bad || text 'edu_lesson_progress bị đổi'; end if;

  if cardinality(bad) = 0 then
    raise exception 'SMOKE PASS %/% (tự huỷ — mọi dữ liệu test đã rollback): %', cardinality(ok), cardinality(ok), array_to_string(ok, ' | ');
  else
    raise exception 'SMOKE FAIL % lỗi (tự huỷ): % || đạt: %', cardinality(bad), array_to_string(bad, ' | '), array_to_string(ok, ' | ');
  end if;
end $smoke$;
