/*
PREFLIGHT LEARNING IDENTITY V1 — READ-ONLY (một câu SELECT). Chạy trên production TRƯỚC db/social_learning_identity_v1_setup.sql.
Dòng cuối GATE: PASS → được chạy; STOP → DỪNG. Hằng kỳ vọng GIỐNG mục 0 của migration (test kiểm).
Mục 'info' = thống kê GỘP (không tên người) để kiểm nhãn danh tính trên dữ liệu thật. Chỉ chú thích khối (an toàn khi copy).
*/
with
fn_expected as (select '{"is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "social_class_is_member": ["85167bc26d7c87dfbd7227b2b9687411"], "social_class_members_of": ["b434c0e8478ec8ed62c004fffe6668d0"]}'::jsonb as j),
col_required as (select '{"app_users": ["id", "role"], "class_schedule": ["id", "code", "name", "status", "program_code", "start_date", "end_date", "main_course_id", "cohort_group_id", "group_id"], "edu_courses": ["id", "code", "name", "track"], "edu_group_members": ["user_id", "group_id", "status"], "edu_groups": ["id", "code"], "edu_students": ["user_id", "ht_member", "enrolled_at"]}'::jsonb as j),
fn_rows as (
  select 'function'::text as section, e.key as item,
         coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.key), 'absent') as detail,
         case when e.value ? coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.key), '') then 'OK' else 'STOP' end as status
  from fn_expected, jsonb_each(fn_expected.j) e
),
col_rows as (
  select 'column'::text, t.key || '.' || c.col,
         case when exists (select 1 from information_schema.columns ic where ic.table_schema = 'public' and ic.table_name = t.key and ic.column_name = c.col) then 'present' else 'MISSING' end,
         case when exists (select 1 from information_schema.columns ic where ic.table_schema = 'public' and ic.table_name = t.key and ic.column_name = c.col) then 'OK' else 'STOP' end
  from col_required, jsonb_each(col_required.j) t, jsonb_array_elements_text(t.value) c(col)
),
info_rows as (
  -- Thống kê GỘP (không tên, không email): để kiểm nhãn "Đang học / Sắp học / Đã tốt nghiệp" trên dữ liệu thật
  select 'info'::text, 'lớp có thành viên · status ' || coalesce(cs.status, '∅'),
         count(distinct cs.id)::text || ' lớp · ' || count(distinct gm.user_id)::text || ' thành viên active', 'OK'
  from public.class_schedule cs
  join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
  join public.edu_group_members gm on gm.group_id = g.id and gm.status = 'active'
  group by cs.status
  union all
  select 'info', 'chương trình · program_code ' || coalesce(cs.program_code, '∅') || ' · khoá ' || coalesce(c.code, '∅'),
         count(distinct cs.id)::text || ' lớp: ' || string_agg(distinct coalesce(cs.code, '?') || ' [' || coalesce(cs.status, '∅') || ']', ', '), 'OK'
  from public.class_schedule cs left join public.edu_courses c on c.id = cs.main_course_id
  where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
  group by cs.program_code, c.code
  union all
  select 'info', 'khoá · ' || coalesce(c.code, '∅'), coalesce(c.name, '∅') || ' · track ' || coalesce(c.track, '∅'), 'OK'
  from public.edu_courses c
  where c.id in (select main_course_id from public.class_schedule where coalesce(status, '') not in ('cancelled', 'merged', 'draft'))
  union all
  select 'info', 'lớp completed · thành viên theo status', coalesce(string_agg(x.st || '=' || x.n, ', '), 'không có lớp completed'), 'OK'
  from (select gm.status as st, count(*)::text as n from public.class_schedule cs
        join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
        join public.edu_group_members gm on gm.group_id = g.id
        where cs.status = 'completed' group by gm.status) x
  union all
  select 'info', 'lớp active nhưng end_date đã qua (có thể đã xong mà chưa đổi status)',
         count(*)::text || coalesce(': ' || string_agg(cs.code, ', '), ''), 'OK'
  from public.class_schedule cs where cs.status in ('active', 'ending_soon') and cs.end_date is not null and cs.end_date < current_date
  union all
  -- Từng lớp có thành viên: status + ngày (không tên người) → kiểm luật Đang học / Sắp học / Đã tốt nghiệp theo NGÀY
  select 'info', 'lớp · ' || coalesce(cs.code, '?'),
         coalesce(cs.status, '∅') || ' · bắt đầu ' || coalesce(cs.start_date::text, '∅') || ' · kết thúc ' || coalesce(cs.end_date::text, '∅')
         || ' · ' || count(distinct gm.user_id)::text || ' thành viên active', 'OK'
  from public.class_schedule cs
  join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
  join public.edu_group_members gm on gm.group_id = g.id and gm.status = 'active'
  where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
  group by cs.id, cs.code, cs.status, cs.start_date, cs.end_date
  union all
  select 'info', 'lớp Hành trình · ' || coalesce(cs.code, '?'),
         coalesce(cs.status, '∅') || ' · bắt đầu ' || coalesce(cs.start_date::text, '∅') || ' · kết thúc ' || coalesce(cs.end_date::text, '∅'), 'OK'
  from public.class_schedule cs where cs.program_code ~ '^HT[0-9]{4}$' and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
  union all
  select 'info', 'học sinh có cờ Hành trình (edu_students.ht_member, hàng mới nhất)',
         (select count(*) from (select distinct on (es.user_id) es.ht_member from public.edu_students es
                                where es.user_id is not null order by es.user_id, es.enrolled_at desc nulls last) x where x.ht_member)::text || ' người', 'OK'
  union all
  select 'info', 'social_learning_identities (đã cài?)', case when to_regprocedure('public.social_learning_identities(uuid[])') is null then 'chưa có' else 'đã có' end, 'OK'
),
all_rows as (select * from fn_rows union all select * from col_rows union all select * from info_rows)
select section, item, detail, status from (
  select 1 as ord, section, item, detail, status from all_rows
  union all
  select 2, 'GATE', case when exists (select 1 from all_rows where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end,
         (select count(*) filter (where status = 'STOP') from all_rows)::text || ' STOP', ''
) z order by ord, section, item;
