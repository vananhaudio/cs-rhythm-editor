/*
═══════════════════════════════════════════════════════════════════════════
PREFLIGHT LEARNING THREAD P1 — READ-ONLY (một câu SELECT, không đổi gì). Chạy TRÊN PRODUCTION trước
db/learning_threads_p1_setup.sql. Dòng cuối là GATE: PASS → được chạy migration; STOP → DỪNG, gửi bảng kết quả.

Kiểm:
• hàm phụ thuộc (is_teacher, is_class_member, class_public_identity): md5(prosrc) = bản production 29/09
• my_learning_state() có mặt và trả jsonb
• mọi cột mà RPC mới đọc
• object mới (learning_lesson_settings, learning_threads, learning_thread_events, lt_*): vắng mặt = lần đầu;
  có mặt = đã chạy (migration chạy lại được) — chỉ để thông tin
Hằng kỳ vọng GIỐNG HỆT mục 0 của migration (scripts/test-learning-threads-db.sh kiểm).

An toàn khi copy: chỉ có chú thích khối, không '--' → chạy đúng kể cả khi mất xuống dòng.
═══════════════════════════════════════════════════════════════════════════
*/
with
fn_expected as (select '{"class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"]}'::jsonb as j),
col_required as (select '{"edu_course_lessons": ["id", "module_id", "title", "order_index", "lesson_type"], "edu_modules": ["id", "course_id", "name", "order_index", "level"], "edu_courses": ["id", "code", "name", "track"], "journey_curriculum": ["course_id", "subject", "level"], "edu_students": ["id", "user_id", "ht_member", "level", "enrolled_at"], "edu_groups": ["id", "code"], "edu_group_members": ["user_id", "group_id", "status"], "class_schedule": ["id", "code", "name", "program_code", "stage", "public_product", "status", "main_course_id", "course_ids", "start_date", "cohort_group_id"], "class_stages": ["id", "class_id", "stage_no", "public_title", "course_id", "starts_on", "ends_on"], "class_tags": ["id", "name"], "app_users": ["id", "role"]}'::jsonb as j),
fn_rows as (
  select 'function'::text as section, e.key as item,
         coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = e.key), 'absent') as detail,
         case when (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = e.key) is null then 'STOP'
              when e.value ? (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                               where n.nspname = 'public' and p.proname = e.key) then 'OK'
              else 'STOP' end as status
  from fn_expected, jsonb_each(fn_expected.j) e
),
mls_row as (
  select 'function'::text, 'my_learning_state() returns jsonb',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname = 'my_learning_state' and p.pronargs = 0
                             and p.prorettype = 'jsonb'::regtype) then 'present' else 'MISSING' end,
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname = 'my_learning_state' and p.pronargs = 0
                             and p.prorettype = 'jsonb'::regtype) then 'OK' else 'STOP' end
),
col_rows as (
  select 'column'::text, t.key || '.' || c.col,
         case when exists (select 1 from information_schema.columns ic
                           where ic.table_schema = 'public' and ic.table_name = t.key and ic.column_name = c.col)
              then 'present' else 'MISSING' end,
         case when exists (select 1 from information_schema.columns ic
                           where ic.table_schema = 'public' and ic.table_name = t.key and ic.column_name = c.col)
              then 'OK' else 'STOP' end
  from col_required, jsonb_each(col_required.j) t, jsonb_array_elements_text(t.value) c(col)
),
info_rows as (
  select 'info'::text, o.name,
         case when to_regclass('public.' || o.name) is not null then 'exists (migration da chay)' else 'absent (lan dau)' end,
         'OK'
  from unnest(array['learning_lesson_settings', 'learning_threads', 'learning_thread_events']) o(name)
  union all
  select 'info', 'lt_* functions', (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                     where n.nspname = 'public' and p.proname like 'lt\_%'), 'OK'
  union all
  select 'info', 'server_version', current_setting('server_version'), 'OK'
),
all_rows as (
  select * from fn_rows union all select * from mls_row union all select * from col_rows union all select * from info_rows
)
select section, item, detail, status from (
  select 1 as ord, section, item, detail, status from all_rows
  union all
  select 2, 'GATE', case when exists (select 1 from all_rows where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end,
         (select count(*) filter (where status = 'STOP') from all_rows)::text || ' STOP', ''
) z
order by ord, section, item;
