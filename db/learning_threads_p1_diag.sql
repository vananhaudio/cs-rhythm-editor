/*
CHẨN ĐOÁN LEARNING THREAD P1 — READ-ONLY (một câu SELECT, không ghi gì; set_config chỉ trong câu lệnh này).
Trả lời: cấu hình 3 bài DH2 có thật không · lesson_id có khớp bài App đang mở không · RPC lt_lessons_state
trả gì cho CHÍNH học sinh vừa ghi nhận Bài 4.3 (đúng lời gọi của App) · quyền hàm · số thread.
Không xuất email/SĐT/tên học sinh. Chỉ chú thích khối (an toàn khi copy).
*/
with
ids(ord, id, label) as (values
  (1, '5f7acacd-9214-48f3-9349-93cc382649fb'::uuid, 'Bài 4.3'),
  (2, 'a85592d5-b519-470d-84d0-4d9182d224b3'::uuid, 'Bài 4.4'),
  (3, 'd2c00805-0000-4000-8000-000000000000'::uuid, 'Bài 6.3')),
settings as (
  select 10 as ord, 'settings' as section, s.content_key as item,
         'lesson ' || coalesce(l.title, '(KHÔNG CÒN BÀI)') || ' · sub=' || s.submission_mode || ' · q=' || s.question_mode
           || ' · prompt=' || coalesce(left(s.prompt, 40), 'null') || ' · by_role=' || coalesce(a.role, '?') || ' · at=' || s.updated_at::text as detail
  from public.learning_lesson_settings s
  left join public.edu_course_lessons l on l.id = s.lesson_id
  left join public.app_users a on a.id = s.updated_by
),
settings_count as (
  select 11 as ord, 'settings' as section, 'total_rows' as item, count(*)::text as detail from public.learning_lesson_settings
),
lessons as (
  select 20 + i.ord as ord, 'lesson' as section, i.label || ' ' || i.id as item,
         coalesce('title=' || l.title || ' · type=' || l.lesson_type || ' · course=' || c.code || ' (' || c.id || ')', 'KHÔNG TỒN TẠI')
           || ' · setting=' || case when exists (select 1 from public.learning_lesson_settings s where s.content_key = 'L:' || i.id::text) then 'CÓ' else 'KHÔNG' end as detail
  from ids i
  left join public.edu_course_lessons l on l.id = i.id
  left join public.edu_modules m on m.id = l.module_id
  left join public.edu_courses c on c.id = m.course_id
),
twins as (
  select 30 as ord, 'lesson_same_title' as section, l.id::text as item,
         l.title || ' · course=' || coalesce(c.code, '?') || ' · type=' || coalesce(l.lesson_type, '?') as detail
  from public.edu_course_lessons l
  join public.edu_modules m on m.id = l.module_id
  left join public.edu_courses c on c.id = m.course_id
  where l.title ilike '%Bolero móc kiểu%' or l.title ilike '%Dự án cuối khoá%'
),
recent_log as (
  select a.user_id, a.lesson_id, a.created_at
  from public.student_action_logs a
  where a.action_type = 'submitted_video_self_report' and a.lesson_id = '5f7acacd-9214-48f3-9349-93cc382649fb'
  order by a.created_at desc limit 1
),
logs as (
  select 40 as ord, 'app_log_4.3' as section, 'submitted_video_self_report gần nhất' as item,
         coalesce((select 'at=' || created_at::text || ' · lesson_id=' || lesson_id::text
                          || ' · là_giáo_viên=' || coalesce((select (role in ('teacher', 'admin'))::text from public.app_users where id = r.user_id), 'không có app_users')
                          || ' · có_edu_students=' || exists (select 1 from public.edu_students s where s.user_id = r.user_id)::text
                   from recent_log r), 'KHÔNG CÓ') as detail
),
sim as (
  select 50 + row_number() over (order by x.lesson_id) as ord, 'rpc_as_that_student' as section, x.lesson_id::text as item,
         'sub=' || x.submission_mode || ' · q=' || x.question_mode || ' · prompt=' || coalesce(left(x.prompt, 30), 'null')
           || ' · thread=' || coalesce(x.thread_id::text, 'null') as detail
  from (select set_config('request.jwt.claims',
                 json_build_object('sub', (select user_id from recent_log), 'role', 'authenticated')::text, true) as c) s
  cross join lateral public.lt_lessons_state(case when s.c is not null then (select array_agg(id order by ord) from ids) end) x
),
fn as (
  select 60 as ord, 'function' as section, p.oid::regprocedure::text as item,
         'secdef=' || p.prosecdef || ' · authenticated_exec=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
           || ' · anon_exec=' || has_function_privilege('anon', p.oid, 'EXECUTE') as detail
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('lt_lessons_state', 'lt_submit', 'lt_detail', 'lt_set_lesson_settings')
),
counts as (
  select 70 as ord, 'counts' as section, 'threads / events' as item,
         (select count(*) from public.learning_threads)::text || ' / ' || (select count(*) from public.learning_thread_events)::text as detail
)
select section, item, detail from (
  select * from settings union all select * from settings_count union all select * from lessons
  union all select * from twins union all select * from logs union all select * from sim
  union all select * from fn union all select * from counts
) z order by ord, item;
