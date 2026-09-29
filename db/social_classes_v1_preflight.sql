/*
PREFLIGHT SOCIAL UX + LỚP HỌC V1 — READ-ONLY (một câu SELECT). Chạy trên production TRƯỚC db/social_classes_v1_setup.sql.
Dòng cuối GATE: PASS → được chạy; STOP → DỪNG. Hằng kỳ vọng GIỐNG mục 0 của migration (test kiểm).
Chỉ chú thích khối (an toàn khi copy).
*/
with
fn_expected as (select '{"class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "friendship_status": ["9f653ba0b1fbcb58c69acaba880906fc"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_friend_of": ["c5281e64105ae14e008445ba7fb5c354"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"], "lt_thread_card": ["172c1d1d323e637944097493b5bf5344"], "social_feed": ["0916ccb443782eb7b8070a1bb439ed00", "d62b6a78984817b787e7731e46c2a0e5"]}'::jsonb as j),
col_required as (select '{"class_schedule": ["id", "code", "name", "status", "is_active", "program_code", "stage", "start_date", "end_date", "schedule", "main_course_id", "cohort_group_id", "group_id"], "edu_groups": ["id", "code"], "edu_group_members": ["user_id", "group_id", "status"], "learning_threads": ["class_schedule_id", "visibility", "hidden_at", "archived_at", "last_event_at"]}'::jsonb as j),
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
  select 'info'::text, 'class_schedule active/public (ước lượng)', coalesce((select reltuples::bigint::text from pg_class where oid = to_regclass('public.class_schedule')), 'absent'), 'OK'
),
all_rows as (select * from fn_rows union all select * from col_rows union all select * from info_rows)
select section, item, detail, status from (
  select 1 as ord, section, item, detail, status from all_rows
  union all
  select 2, 'GATE', case when exists (select 1 from all_rows where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end,
         (select count(*) filter (where status = 'STOP') from all_rows)::text || ' STOP', ''
) z order by ord, section, item;
