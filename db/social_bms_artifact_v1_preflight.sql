-- BMS ARTIFACT SHARE V1 — PREFLIGHT production (CHỈ ĐỌC). Chạy: prod-db.py query <file>.
select 'fn' as section, p.proname as item, md5(p.prosrc) as detail from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('social_share_tool_result', 'is_class_member', 'is_teacher') order by 2;
select 'table' as section, c.relname as item, 'exists' as detail from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('tool_artifacts');
select 'event_trigger' as section, evtname as item, evtevent || ' → ' || evtfoid::regproc::text as detail from pg_event_trigger;
select 'default_acl' as section, coalesce(n.nspname, '*') || ':' || d.defaclobjtype::text as item, d.defaclacl::text as detail
  from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace where coalesce(n.nspname, 'public') = 'public';
select 'tool_share_posts' as section, coalesce(tool_share ->> 'tool', '-') as item, count(*)::text as detail
  from public.class_posts where type = 'tool_share' group by 2;
select 'constraint' as section, conname as item, pg_get_constraintdef(oid) as detail from pg_constraint
 where conrelid = 'public.class_posts'::regclass and conname in ('class_posts_type_check', 'class_posts_tool_share_check');
