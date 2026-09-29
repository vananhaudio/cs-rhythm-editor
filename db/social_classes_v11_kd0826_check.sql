/*
LỚP DH2.KD0826 · BÀI 4.4 — KIỂM TRƯỚC & SAU KHI HỎI BÀI. READ-ONLY (một câu SELECT; set_config chỉ trong câu lệnh này).
Chạy HAI lần, cùng một file:
  • TRƯỚC khi Hỏi bài: section 'truoc' — cho TỪNG thành viên DH2.KD0826 (kể cả Thầy/admin) + chủ thread Bài 4.3:
    lt_submit có nhận không (không phải Thầy · là thành viên Class · Bài 4.4 bật Hỏi bài · App MỞ bài) và
    thread MỚI ở Bài 4.4 sẽ đóng dấu lớp nào (đúng hàm lt_identity_snapshot mà lt_submit gọi).
  • SAU khi Hỏi bài: section 'sau' — mọi thread Bài 4.4: class_schedule_id đã đóng dấu, và thread nằm trong
    Hoạt động (social_class_activity thật) của lớp NÀO; section 'bai43' — thread Bài 4.3 cũ giữ nguyên.
Không xuất email/SĐT. Chỉ chú thích khối (an toàn khi copy).
*/
with
kd as (select cs.id, cs.code from public.class_schedule cs where cs.code = 'DH2.KD0826'),
lesson as (
  select l.id, l.title, coalesce(s.question_mode, 'off') as question_mode, coalesce(s.submission_mode, 'off') as submission_mode
  from public.edu_course_lessons l
  left join public.learning_lesson_settings s on s.content_key = 'L:' || l.id::text
  where l.id = 'a85592d5-b519-470d-84d0-4d9182d224b3'::uuid
),
people as (
  select x.user_id, string_agg(distinct x.via, ', ') as via from (
    select m.user_id, 'thành viên DH2.KD0826' as via from kd cross join lateral public.social_class_members_of(kd.id) m
    union all
    select t.learner_user_id, 'chủ thread Bài 4.3' from public.learning_threads t
    where t.lesson_id = '5f7acacd-9214-48f3-9349-93cc382649fb'::uuid
  ) x group by x.user_id
),
probe as (
  select p.user_id, p.via,
         public.is_teacher() and s.c is not null as is_teacher,
         public.is_class_member() and s.c is not null as is_class_member,
         public.lt_lesson_open_for_me(case when s.c is not null then lesson.id end) as is_open,
         public.lt_identity_snapshot(case when s.c is not null then lesson.id end) #>> '{class,code}' as would_stamp,
         exists (select 1 from public.learning_threads t where t.learner_user_id = p.user_id
                 and t.content_key = 'L:' || lesson.id::text and t.archived_at is null) as has_thread,
         lesson.question_mode
  from people p cross join lesson
  cross join lateral (select set_config('request.jwt.claims',
                        json_build_object('sub', p.user_id, 'role', 'authenticated')::text, true) as c) s
),
truoc as (
  select 1 as ord, 'truoc' as section,
         coalesce((select i.name from public.class_public_identity(pr.user_id) i), '?')
           || ' · ' || coalesce((select a.role from public.app_users a where a.id = pr.user_id), '?') || ' · ' || pr.via as item,
         case
           when pr.is_teacher then 'KHÔNG DÙNG ĐƯỢC — tài khoản Thầy/admin: lt_submit từ chối (LT_TEACHER_CANNOT_SUBMIT)'
           when not pr.is_class_member then 'KHÔNG DÙNG ĐƯỢC — chưa là thành viên Class (LT_NOT_MEMBER)'
           when pr.question_mode = 'off' then 'KHÔNG DÙNG ĐƯỢC — Bài 4.4 chưa bật Hỏi bài'
           when not pr.is_open then 'KHÔNG DÙNG ĐƯỢC — App chưa mở Bài 4.4 cho tài khoản này (LT_NO_ACCESS)'
           when pr.has_thread then 'KHÔNG DÙNG ĐƯỢC — đã có thread Bài 4.4 (gửi thêm vào thread cũ, không đóng dấu lại)'
           when pr.would_stamp = 'DH2.KD0826' then 'SẴN SÀNG — Hỏi bài ở Bài 4.4 sẽ đóng dấu DH2.KD0826'
           else 'KHÔNG ĐÚNG LỚP — thread mới sẽ đóng dấu ' || coalesce(pr.would_stamp, 'Tự học')
         end
         || ' [thầy=' || pr.is_teacher || ' · class=' || pr.is_class_member || ' · hỏi_bài=' || pr.question_mode
         || ' · mở=' || pr.is_open || ' · đóng_dấu=' || coalesce(pr.would_stamp, 'Tự học') || ' · có_thread_4.4=' || pr.has_thread || ']' as detail
  from probe pr
),
t44 as (
  select t.*, act.codes
  from public.learning_threads t
  cross join lateral (select set_config('request.jwt.claims',
                        json_build_object('sub', t.learner_user_id, 'role', 'authenticated')::text, true) as c) s
  cross join lateral (
    select string_agg(cs.code, ',' order by cs.code) as codes
    from public.class_schedule cs
    cross join lateral public.social_class_activity(case when s.c is not null then cs.id end, null, null, 50) a
    where a.thread ->> 'id' = t.id::text) act
  where t.lesson_id = 'a85592d5-b519-470d-84d0-4d9182d224b3'::uuid
),
sau as (
  select 2 as ord, 'sau' as section,
         left(t.id::text, 8) || ' · ' || coalesce((select i.name from public.class_public_identity(t.learner_user_id) i), '?') as item,
         case when t.class_schedule_id = (select id from kd) and t.identity #>> '{class,code}' = 'DH2.KD0826'
                   and t.visibility = 'community' and t.codes = 'DH2.KD0826' then 'PASS'
              else 'FAIL' end
         || ' · class_schedule_id=' || coalesce(left(t.class_schedule_id::text, 8), 'null')
         || ' (= DH2.KD0826: ' || coalesce(t.class_schedule_id = (select id from kd), false) || ')'
         || ' · snapshot=' || coalesce(t.identity #>> '{class,code}', 'Tự học')
         || ' · visibility=' || t.visibility || ' · status=' || t.status || ' · events=' || t.event_count
         || ' · có trong Hoạt động của: ' || coalesce(t.codes, 'KHÔNG lớp nào')
         || ' · created=' || to_char(t.created_at, 'YYYY-MM-DD HH24:MI') as detail
  from t44 t
),
bai43 as (
  select 3 as ord, 'bai43' as section, left(t.id::text, 8) || ' · ' || coalesce(t.identity #>> '{lesson,title}', '?') as item,
         'snapshot=' || coalesce(t.identity #>> '{class,code}', 'Tự học') || ' · class_schedule_id=' || coalesce(left(t.class_schedule_id::text, 8), 'null')
         || ' · visibility=' || t.visibility || ' · status=' || t.status || ' · events=' || t.event_count
         || ' · hidden=' || (t.hidden_at is not null) || ' · archived=' || (t.archived_at is not null)
         || ' · last=' || coalesce(to_char(t.last_event_at, 'YYYY-MM-DD HH24:MI'), '?') as detail
  from public.learning_threads t where t.lesson_id = '5f7acacd-9214-48f3-9349-93cc382649fb'::uuid
),
meta as (
  select 0 as ord, 'lop_bai' as section, coalesce((select code || ' · id ' || left(id::text, 8) from kd), 'KHÔNG THẤY DH2.KD0826') as item,
         coalesce((select 'Bài: ' || title || ' · hỏi_bài=' || question_mode || ' · trả_bài=' || submission_mode from lesson), 'KHÔNG THẤY Bài 4.4')
         || ' · threads_4.4=' || (select count(*) from t44) as detail
)
select section, item, detail from (
  select * from meta union all select * from truoc union all select * from sau union all select * from bai43
) z order by ord, item;
