-- POSTFLIGHT (read-only) cho db/chord_video_export_v1_setup.sql — GATE = PASS mới coi là xong. Không đọc nội dung bài/người dùng.
select section, item from (
  select 1 o, 'CHECK' section, 'capability: ' || (select string_agg(role || '=' || allowed::text, ', ' order by role) from public.tool_capabilities where tool_id = 'chordlib' and capability = 'export_video') item
  union all select 2, 'CHECK', 'eval cấp cho: ' || (select count(*) from pg_proc p where p.proname = 'chord_video_export_eval'
        and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))) || ' (phải 0)'
  union all select 9, 'GATE', case when
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('chord_video_export_ok', 'chord_video_export_eval') and p.prosecdef and p.proconfig @> array['search_path=""']) = 2
   and (select has_function_privilege('authenticated', 'public.chord_video_export_ok(uuid,text)', 'execute')
        and not has_function_privilege('anon', 'public.chord_video_export_ok(uuid,text)', 'execute')
        and not has_function_privilege('authenticated', 'public.chord_video_export_eval(uuid,uuid,text)', 'execute')
        and not has_function_privilege('anon', 'public.chord_video_export_eval(uuid,uuid,text)', 'execute'))
   and not exists (select 1 from pg_proc p where p.proname in ('chord_video_export_ok', 'chord_video_export_eval')
                    and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0))
   and (select count(*) from public.tool_capabilities where tool_id = 'chordlib' and capability = 'export_video' and allowed) = 2
  then 'PASS' else 'FAIL' end
) z order by o;
