-- SMOKE production LỚP CỦA TÔI V1 — chạy bằng `prod-db.py dryrun` (cả giao dịch ROLLBACK, KHÔNG để lại dấu vết).
-- KHÔNG đụng giáo trình thật: dựng lớp tạm SMOKE.V1 (chương trình SMOKEV1) trong giao dịch. Không in id / tên / email.
-- Danh tính thật mượn trong giao dịch: L = người học có quyền giáo trình SOLO01 · M = học viên khác (bạn cùng lớp tạm)
-- · O = học viên ngoài lớp tạm · T = giáo viên/admin.
do $smoke$
declare
  L uuid; M uuid; O uuid; T uuid; solo uuid; ht uuid; legacy uuid;
  g uuid := gen_random_uuid(); c uuid := gen_random_uuid(); s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
  st jsonb; tid uuid; n int := 0; total int := 0; prog_before int; err text;
  procedure_ok boolean;
begin
  select id into solo from public.class_schedule where code = 'SOLO01.TH01';
  select id into ht from public.class_schedule where code = 'HT2027.TH01';
  select a.user_id into L from public.class_curriculum_access a join public.app_users u on u.id = a.user_id
   where a.class_id = solo and a.status = 'active' and coalesce(u.role, '') not in ('teacher', 'admin') limit 1;
  select id into T from public.app_users where role in ('teacher', 'admin') order by role desc limit 1;
  select es.user_id into M from public.edu_students es left join public.app_users u on u.id = es.user_id
   where es.user_id is not null and es.user_id <> coalesce(L, gen_random_uuid()) and coalesce(u.role, 'student') not in ('teacher', 'admin') order by es.enrolled_at limit 1;
  select es.user_id into O from public.edu_students es left join public.app_users u on u.id = es.user_id
   where es.user_id is not null and es.user_id not in (coalesce(L, gen_random_uuid()), M) and coalesce(u.role, 'student') not in ('teacher', 'admin') order by es.enrolled_at desc limit 1;
  select id into legacy from public.learning_threads where content_kind = 'course_lesson' and visibility = 'community' and hidden_at is null limit 1;
  if L is null or T is null or M is null or O is null then raise exception 'SMOKE SETUP: thiếu danh tính (L/M/O/T)'; end if;
  prog_before := (select count(*) from public.learning_session_progress);

  -- helper: đổi danh tính trong giao dịch
  create temp table _ok(msg text) on commit drop;

  -- ── B. Trạng thái NẰM IM trên lớp thật (chưa có checkpoint) ──
  perform set_config('request.jwt.claims', json_build_object('sub', L, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  st := public.class_learning_state(solo);
  if (st ->> 'enabled')::boolean then raise exception 'FAIL: SOLO01 đã bật V1 dù chưa có checkpoint'; end if;
  st := public.class_learning_state(ht);
  if (st ->> 'enabled')::boolean then raise exception 'FAIL: HT2027 bị đưa vào checkpoint flow'; end if;
  begin perform public.lt_submit_checkpoint(solo, 1, '1.1', 'smoke'); raise exception 'FAIL: nộp checkpoint giả trên SOLO01 lọt';
  exception when others then if sqlerrm not like 'LT_CHECKPOINT_NOT_FOUND%' then raise; end if; end;
  perform set_config('role', 'postgres', true);
  if (select count(*) from public.learning_session_progress) <> prog_before then raise exception 'FAIL: lớp nằm im mà vẫn tạo tiến độ'; end if;
  raise notice 'PASS 1: SOLO01 + HT2027 enabled=false (nằm im) · checkpoint giả trên SOLO01 bị chặn · không tạo tiến độ';

  -- ── Lớp tạm SMOKE.V1 (rollback cuối giao dịch) ──
  insert into public.edu_groups (id, name, group_type, code) values (g, 'CLASS.SMOKE.V1', 'class', 'CLASS.SMOKE.V1');
  insert into public.class_schedule (id, code, name, program_code, status, cohort_group_id, is_active) values (c, 'SMOKE.V1', 'Smoke V1', 'SMOKEV1', 'draft', g, false);
  insert into public.edu_group_members (user_id, group_id, source, status) values (L, g, 'admin', 'active'), (M, g, 'admin', 'active');
  insert into public.class_curriculum_access (class_id, user_id, status, granted_at, granted_by) values (c, L, 'active', now(), T), (c, M, 'active', now(), T);
  insert into public.class_sessions (id, class_id, session_number, title, start_at, event_type, status) values
    (s1, c, 1, 'Buổi 1 · Smoke', now(), 'lesson', 'scheduled'), (s2, c, 2, 'Buổi 2 · Smoke', now() + interval '7 days', 'lesson', 'scheduled');
  insert into public.class_lesson_content (session_id, event_type, status, blocks) values
    (s1, 'lesson', 'published', '[{"kind":"checkpoint","id":"1.1","title":"Smoke 1.1"}]'),
    (s2, 'lesson', 'published', '[{"kind":"checkpoint","id":"2.1","title":"Smoke 2.1"}]');

  perform set_config('request.jwt.claims', json_build_object('sub', L, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  st := public.class_learning_state(c);
  if not (st ->> 'enabled')::boolean or (st -> 'sessions' -> 0 ->> 'opened_at') is null or (st -> 'sessions' -> 1 ->> 'opened_at') is not null
     or jsonb_array_length(st -> 'sessions' -> 1 -> 'checkpoints') <> 0 then raise exception 'FAIL: trạng thái lớp tạm %', st; end if;
  raise notice 'PASS 2: lớp có checkpoint → enabled · Buổi 1 mở lười · Buổi 2 khoá, không lộ checkpoint';
  begin perform public.lt_submit_checkpoint(c, 1, '9.9', 'x'); raise exception 'FAIL: checkpoint giả lọt';
  exception when others then if sqlerrm not like 'LT_CHECKPOINT_NOT_FOUND%' then raise; end if; end;
  begin perform public.lt_submit_checkpoint(c, 2, '2.1', 'x'); raise exception 'FAIL: buổi chưa mở lọt';
  exception when others then if sqlerrm not like 'LT_SESSION_LOCKED%' then raise; end if; end;
  begin perform public.lt_submit_checkpoint(c, 1, '1.1', 'x', null, null, null, 'community'); raise exception 'FAIL: checkpoint community lọt';
  exception when others then if sqlerrm not like 'LT_BAD_VISIBILITY%' then raise; end if; end;
  raise notice 'PASS 3: chặn checkpoint giả · chặn buổi chưa mở · chặn đưa checkpoint ra community';
  tid := public.lt_submit_checkpoint(c, 1, '1.1', 'smoke submit');

  perform set_config('request.jwt.claims', json_build_object('sub', M, 'role', 'authenticated')::text, true);
  if (public.lt_detail(tid) ->> 'id')::uuid <> tid then raise exception 'FAIL: bạn cùng lớp không xem được'; end if;
  if not exists (select 1 from public.social_class_activity(c) a where (a.thread ->> 'id')::uuid = tid) then raise exception 'FAIL: hoạt động lớp thiếu bài'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', O, 'role', 'authenticated')::text, true);
  begin perform public.lt_detail(tid); raise exception 'FAIL: người ngoài lớp xem được';
  exception when others then if sqlerrm not like 'LT_NOT_FOUND%' then raise; end if; end;
  if exists (select 1 from public.social_class_activity(c) a where (a.thread ->> 'id')::uuid = tid) then raise exception 'FAIL: người ngoài thấy trong hoạt động lớp'; end if;
  if exists (select 1 from public.social_feed() f where (f.thread ->> 'id')::uuid = tid) then raise exception 'FAIL: bài trả lọt Feed chung'; end if;
  if legacy is not null and (public.lt_detail(legacy) ->> 'id')::uuid <> legacy then raise exception 'FAIL: thread cũ community đổi quyền'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', T, 'role', 'authenticated')::text, true);
  if not (public.lt_detail(tid) ->> 'can_respond')::boolean then raise exception 'FAIL: thầy không phản hồi được'; end if;
  if not exists (select 1 from public.lt_teacher_queue('waiting_teacher') q where q.id = tid) then raise exception 'FAIL: hàng đợi thầy thiếu bài'; end if;
  raise notice 'PASS 4: quyền xem = chính chủ + cùng lớp + thầy; ngoài lớp KHÔNG (detail/hoạt động/Feed); thread cũ community giữ nguyên; có trong /me/queue';

  perform public.lt_respond(tid, 'teacher_feedback', 'smoke đạt', 'pass');
  perform set_config('role', 'postgres', true);
  if (select completed_at from public.learning_session_progress where learner_user_id = L and program_code = 'SMOKEV1' and session_no = 1) is null
     or (select opened_at from public.learning_session_progress where learner_user_id = L and program_code = 'SMOKEV1' and session_no = 2) is null then
    raise exception 'FAIL: Đạt không hoàn thành buổi / mở buổi kế';
  end if;
  begin update public.learning_session_progress set opened_at = now() - interval '9 days' where learner_user_id = L and program_code = 'SMOKEV1';
    raise exception 'FAIL: opened_at sửa được';
  exception when others then if sqlerrm not like 'LSP_HISTORY_IMMUTABLE%' then raise; end if; end;
  if (select count(*) from public.learning_session_progress where program_code <> 'SMOKEV1') <> prog_before then raise exception 'FAIL: tạo tiến độ ngoài lớp tạm'; end if;
  raise notice 'PASS 5: Thầy chấm Đạt → hoàn thành Buổi 1 + mở Buổi 2 · opened_at bất biến · không tiến độ ngoài lớp tạm';
  raise notice 'SMOKE PASS 5/5 (toàn bộ giao dịch sẽ ROLLBACK)';
end $smoke$;
