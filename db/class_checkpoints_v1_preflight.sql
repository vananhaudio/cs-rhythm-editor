/*
PREFLIGHT LỚP CỦA TÔI V1 (checkpoint + tiến độ buổi) — READ-ONLY (một câu SELECT). Chạy trên production TRƯỚC
db/class_checkpoints_v1_setup.sql. Dòng cuối GATE: PASS → được chạy; STOP → DỪNG. Hằng md5 GIỐNG mục 0 của migration
(test kiểm). Hàm bị thay đã là bản V1 (dấu CHECKPOINT_V1) → OK (chạy lại an toàn). Mục 'info' = thống kê GỘP, không tên người.
*/
with
replaced as (select '{"lt_detail": "5b8f57d71b7b2392a17bfe73fcd61a56", "lt_set_visibility": "60c4201a6afc69ec3cb1d196bfd6163f", "social_class_activity": "560d9faa6251606acb288f800deefa09"}'::jsonb as j),
needed as (select unnest(array['is_teacher', 'is_class_member', 'class_public_identity', 'lt_can_view', 'lt_check_media',
                               'social_class_is_member', 'social_class_members_of', 'lt_thread_card', 'lt_respond']) as fn),
col_required as (select '{"learning_threads": ["content_kind", "content_key", "program_code", "session_no", "class_schedule_id", "class_stage_id", "visibility", "passed_at", "identity"], "class_sessions": ["id", "class_id", "session_number", "event_type", "title", "stage_id"], "class_lesson_content": ["session_id", "status", "blocks"], "class_schedule": ["id", "code", "name", "program_code", "stage", "status", "public_product"], "class_stages": ["id", "stage_no", "public_title"], "class_curriculum_access": ["class_id", "user_id", "status"]}'::jsonb as j),
fn_rows as (
  select 'function'::text as section, e.key as item,
         coalesce((select md5(p.prosrc) || case when position('CHECKPOINT_V1' in p.prosrc) > 0 then ' (V1)' else '' end
                   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.key), 'absent') as detail,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.key
                           and (md5(p.prosrc) = e.value #>> '{}' or position('CHECKPOINT_V1' in p.prosrc) > 0)) then 'OK' else 'STOP' end as status
  from replaced, jsonb_each(replaced.j) e
  union all
  select 'dependency', n.fn,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = n.fn) then 'present' else 'absent' end,
         case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = n.fn) then 'OK' else 'STOP' end
  from needed n
  union all
  select 'dependency', 'tva_private.can_read_class_curriculum(uuid)',
         case when to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is null then 'absent' else 'present' end,
         case when to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is null then 'STOP' else 'OK' end
),
col_rows as (
  select 'column'::text, t.key || '.' || c.col,
         case when exists (select 1 from information_schema.columns ic where ic.table_schema = 'public' and ic.table_name = t.key and ic.column_name = c.col) then 'present' else 'MISSING' end,
         case when exists (select 1 from information_schema.columns ic where ic.table_schema = 'public' and ic.table_name = t.key and ic.column_name = c.col) then 'OK' else 'STOP' end
  from col_required, jsonb_each(col_required.j) t, jsonb_array_elements_text(t.value) c(col)
),
info_rows as (
  select 'info'::text, 'learning_threads theo loại · visibility', coalesce(string_agg(x.k || '/' || x.v || '=' || x.n, ', '), '0'), 'OK'
  from (select content_kind k, visibility v, count(*)::text n from public.learning_threads group by 1, 2) x
  union all
  select 'info', 'learning_session_progress (đã cài?)', case when to_regclass('public.learning_session_progress') is null then 'chưa có' else 'đã có' end, 'OK'
  union all
  select 'info', 'lớp có program_code + buổi đã xuất bản · ' || cs.code,
         count(distinct s.id)::text || ' buổi xuất bản · ' ||
         (select count(*) from public.class_curriculum_access a where a.class_id = cs.id and a.status = 'active')::text || ' người có quyền giáo trình · ' ||
         (select count(*) from public.class_lesson_content c2 join public.class_sessions s2 on s2.id = c2.session_id,
                 jsonb_array_elements(c2.blocks) b where s2.class_id = cs.id and b ->> 'kind' = 'checkpoint')::text || ' khối checkpoint', 'OK'
  from public.class_schedule cs
  join public.class_sessions s on s.class_id = cs.id and s.event_type = 'lesson'
  join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
  where cs.program_code is not null
  group by cs.id, cs.code
),
all_rows as (select * from fn_rows union all select * from col_rows union all select * from info_rows)
select section, item, detail, status from (
  select 1 as ord, section, item, detail, status from all_rows
  union all
  select 2, 'GATE', case when exists (select 1 from all_rows where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end,
         (select count(*) filter (where status = 'STOP') from all_rows)::text || ' STOP', ''
) z order by ord, section, item;
