/*
PREFLIGHT LEARNING THREAD P2 — READ-ONLY (một câu SELECT). Chạy trên production TRƯỚC db/learning_threads_p2_setup.sql.
Dòng cuối GATE: PASS → được chạy migration; STOP → DỪNG. Hằng kỳ vọng GIỐNG mục 0 của migration (test kiểm).
Chỉ chú thích khối (an toàn khi copy).
*/
with
fn_expected as (select '{"can_view_wall": ["72be0399a709b62fb512bbf0be34294b"], "class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"]}'::jsonb as j),
fn_rows as (
  select 'function'::text as section, e.key as item,
         coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.key), 'absent') as detail,
         case when e.value ? coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.key), '') then 'OK' else 'STOP' end as status
  from fn_expected, jsonb_each(fn_expected.j) e
),
tbl_rows as (
  select 'table'::text, t, case when to_regclass('public.' || t) is not null then 'present' else 'MISSING' end,
         case when to_regclass('public.' || t) is not null then 'OK' else 'STOP' end
  from unnest(array['learning_threads', 'learning_thread_events', 'class_posts', 'class_post_comments']) t
  union all
  select 'function', 'lt_detail (P1)', case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'lt_detail') then 'present' else 'MISSING' end,
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'lt_detail') then 'OK' else 'STOP' end
),
info_rows as (
  select 'info'::text, 'p2 functions', (select string_agg(proname, ',' order by proname) from pg_proc where pronamespace = 'public'::regnamespace
         and proname in ('social_feed', 'user_wall', 'learning_journey', 'lt_thread_card')), 'OK'
  union all
  select 'info', 'learning_threads (ước lượng)', coalesce((select reltuples::bigint::text from pg_class where oid = to_regclass('public.learning_threads')), 'absent'), 'OK'
),
all_rows as (select * from fn_rows union all select * from tbl_rows union all select * from info_rows)
select section, item, detail, status from (
  select 1 as ord, section, item, detail, status from all_rows
  union all
  select 2, 'GATE', case when exists (select 1 from all_rows where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end,
         (select count(*) filter (where status = 'STOP') from all_rows)::text || ' STOP', ''
) z order by ord, section, item;
