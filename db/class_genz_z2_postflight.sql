/*
POSTFLIGHT lớp "Gen Z — Z2" — READ-ONLY (scripts/prod-db.py query). Không ghi gì.
(1) lớp + lịch + số buổi + nhóm · (2) thành viên theo luật Lớp học V1 · (3) danh tính học tập của 9 người (gọi hàm như Social,
đóng vai một thành viên Class CHỈ trong transaction chỉ-đọc) · (4) hồi quy: HT2027 / DH2 / tốt nghiệp / thread lịch sử.
*/
select 'class' as section, c.id::text as class_id, c.code, c.name, c.status, c.section as khoi, c.schedule, c.weekday::text as weekday,
       c.start_time::text as start_time, c.duration_minutes::text as minutes, c.total_sessions::text as total_sessions,
       coalesce(c.start_date::text, 'null') as start_date, coalesce(c.end_date::text, 'null') as end_date,
       c.group_id::text as group_id, coalesce(c.cohort_group_id::text, 'null') as cohort_group_id,
       coalesce(c.main_course_id::text, 'null') as main_course, c.public_enroll::text as public_enroll,
       (select count(*) from public.class_sessions s where s.class_id = c.id)::text as sessions
from public.class_schedule c where upper(coalesce(c.code, '')) = 'Z2';
select 'group' as section, g.id::text, g.code, g.name, g.group_type, g.is_active::text,
       (select count(*) from public.edu_group_members m where m.group_id = g.id and m.status = 'active')::text as active_members
from public.edu_groups g where g.id = '8874c845-78eb-430d-9159-926cda00203b';
select 'v1_members' as section,
       (select count(*) from public.social_class_members_of((select id from public.class_schedule where code = 'Z2'))) as members_all,
       (select count(*) from public.social_class_members_of((select id from public.class_schedule where code = 'Z2')) m
         where not exists (select 1 from public.app_users a where a.id = m.user_id and a.role in ('teacher', 'admin'))) as learners;

select set_config('tva.z2', (select string_agg(m.user_id::text, ',') from public.edu_group_members m
  where m.group_id = '8874c845-78eb-430d-9159-926cda00203b' and m.status = 'active'), true) is not null as z2_ids;
select set_config('tva.reg', (select string_agg(distinct m.user_id::text, ',') from public.class_schedule cs
  join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
  join public.edu_group_members m on m.group_id = g.id and m.status = 'active'
  where cs.code in ('HT2027.TH01', 'DH2.KD0826', 'DH1.KD17', 'TN3.GL11')), true) is not null as reg_ids;
select set_config('request.jwt.claims', json_build_object('sub', (select es.user_id from public.edu_students es
  where es.user_id is not null and lower(coalesce(es.display_name, es.full_name, '')) like '%tiến hải%'
  order by es.enrolled_at desc nulls last limit 1), 'role', 'authenticated')::text, true) is not null as viewer_set;
set local role authenticated;
select 'row' as section, 'z2' as via, r.user_id, r.memberships
from public.social_learning_identities(string_to_array(current_setting('tva.z2'), ',')::uuid[]) r order by r.user_id;
select 'row' as section, 'regression' as via, r.user_id, r.memberships
from public.social_learning_identities(string_to_array(current_setting('tva.reg'), ',')::uuid[]) r order by r.user_id;
reset role;
select 'thread' as section, left(t.id::text, 8) as item,
       coalesce(t.identity #>> '{class,code}', 'Tự học') || ' · md5 ' || md5(t.identity::text) as detail
from public.learning_threads t where t.identity #>> '{lesson,title}' ~ '^Bài 4\.(3|4) ' order by t.created_at;
