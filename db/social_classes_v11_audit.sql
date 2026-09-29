/*
AUDIT LỚP HỌC V1.1 — READ-ONLY (một câu SELECT, không ghi gì). Không xuất tên/email/SĐT học sinh.
Trả lời: lớp thật · membership (số lượng) · mọi Learning Thread + danh tính lớp đã đóng dấu (hay Tự học) ·
lớp nào có hoạt động thật · học sinh ở nhiều lớp · lớp nào có thể sinh thread thật một cách tự nhiên
(lớp dạy khoá của bài đã bật Trả/Hỏi bài). Chỉ chú thích khối (an toàn khi copy).
*/
with
cls as (
  select cs.id, cs.code, cs.name, cs.status, cs.is_active, cs.start_date, cs.main_course_id, cs.course_ids,
         (select count(*) from public.social_class_members_of(cs.id) m
           where not exists (select 1 from public.app_users a where a.id = m.user_id and a.role in ('teacher', 'admin'))) as students,
         (select count(*) from public.social_class_members_of(cs.id) m
           where exists (select 1 from public.app_users a where a.id = m.user_id and a.role in ('teacher', 'admin'))) as teachers,
         (select count(*) from public.learning_threads t where t.class_schedule_id = cs.id) as threads_all,
         (select count(*) from public.learning_threads t where t.class_schedule_id = cs.id and t.visibility = 'community'
             and t.hidden_at is null and t.archived_at is null) as threads_public
  from public.class_schedule cs
  where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
),
class_rows as (
  select 10 as ord, 'class' as section, coalesce(c.code, '(no code)') || ' · ' || c.name as item,
         'status=' || coalesce(c.status, '?') || ' · active=' || c.is_active || ' · start=' || coalesce(c.start_date::text, '?')
           || ' · course=' || coalesce((select code from public.edu_courses where id = c.main_course_id), '?')
           || ' · students=' || c.students || ' · teachers=' || c.teachers
           || ' · threads=' || c.threads_all || ' (public ' || c.threads_public || ')'
           || ' · discover=' || (c.is_active and c.status in ('recruiting', 'ready_to_open', 'scheduled', 'upcoming', 'active', 'ending_soon')) as detail
  from cls c
),
multi as (
  select gm.user_id, count(distinct cs.id) as n
  from public.class_schedule cs
  join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
  join public.edu_group_members gm on gm.group_id = g.id and gm.status = 'active'
  where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft', 'completed')
    and not exists (select 1 from public.app_users a where a.id = gm.user_id and a.role in ('teacher', 'admin'))
  group by gm.user_id
),
membership_rows as (
  select 20 as ord, 'membership' as section, 'students in ≥1 current class' as item, count(*)::text as detail from multi
  union all
  select 21, 'membership', 'students in ≥2 current classes', count(*) filter (where n >= 2)::text from multi
),
thread_rows as (
  select 30 as ord, 'thread' as section, left(t.id::text, 8) || ' · ' || coalesce(t.identity #>> '{lesson,title}', '?') as item,
         'course=' || coalesce(t.identity #>> '{course,code}', '?')
           || ' · class=' || coalesce(t.identity #>> '{class,code}', 'Tự học')
           || ' · class_schedule_id=' || coalesce(left(t.class_schedule_id::text, 8), 'null')
           || ' · visibility=' || t.visibility || ' · status=' || t.status
           || ' · hidden=' || (t.hidden_at is not null) || ' · archived=' || (t.archived_at is not null)
           || ' · events=' || t.event_count || ' · created=' || to_char(t.created_at, 'YYYY-MM-DD HH24:MI')
           || ' · last=' || coalesce(to_char(t.last_event_at, 'YYYY-MM-DD HH24:MI'), '?')
           || ' · learner_current_classes=' || coalesce((
                select string_agg(distinct cs.code, ',')
                from public.class_schedule cs
                join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
                join public.edu_group_members gm on gm.group_id = g.id and gm.status = 'active' and gm.user_id = t.learner_user_id
                where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')), 'none') as detail
  from public.learning_threads t
),
summary_rows as (
  select 40 as ord, 'summary' as section, 'PRODUCTION_THREADS' as item, count(*)::text as detail from public.learning_threads
  union all select 41, 'summary', 'THREADS_WITH_CLASS_IDENTITY', count(*)::text from public.learning_threads where class_schedule_id is not null
  union all select 42, 'summary', 'THREADS_SELF_LEARNING', count(*)::text from public.learning_threads where class_schedule_id is null
  union all select 43, 'summary', 'CLASS_WITH_REAL_ACTIVITY', coalesce((select string_agg(code || '(' || threads_public || ')', ', ') from cls where threads_public > 0), 'none')
  union all select 44, 'summary', 'PRODUCTION_CLASSES (hiện được)', (select count(*)::text from cls)
),
candidate_rows as (
  select 50 as ord, 'candidate' as section, coalesce(cs.code, '?') || ' · ' || cs.name as item,
         'teaches ' || c.code || ' · lessons_enabled=' ||
           (select string_agg(l.title, ' | ' order by l.title)
            from public.learning_lesson_settings s join public.edu_course_lessons l on l.id = s.lesson_id
            join public.edu_modules m on m.id = l.module_id
            where m.course_id = c.id and (s.submission_mode <> 'off' or s.question_mode <> 'off'))
           || ' · active_students=' || (select count(*) from public.social_class_members_of(cs.id) mm
                where not exists (select 1 from public.app_users a where a.id = mm.user_id and a.role in ('teacher', 'admin'))) as detail
  from public.class_schedule cs
  join public.edu_courses c on c.id = cs.main_course_id or c.id = any(coalesce(cs.course_ids, '{}'))
       or exists (select 1 from public.class_stages st where st.class_id = cs.id and st.course_id = c.id)
  where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft', 'completed')
    and exists (select 1 from public.learning_lesson_settings s join public.edu_course_lessons l on l.id = s.lesson_id
                join public.edu_modules m on m.id = l.module_id where m.course_id = c.id)
)
select section, item, detail from (
  select * from class_rows union all select * from membership_rows union all select * from thread_rows
  union all select * from summary_rows union all select * from candidate_rows
) z order by ord, item;
