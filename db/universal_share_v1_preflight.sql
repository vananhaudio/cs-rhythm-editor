-- PREFLIGHT (read-only) cho db/universal_share_v1_setup.sql — GATE = PASS mới được dryrun/migrate. Không đọc nội dung bài/hội thoại.
select section, item from (
  select 1 o, 'INFO' section, 'tool_artifacts: ' || (select coalesce(string_agg(tool || '/' || visibility || '=' || n, ', '), '(trống)') from (select tool, visibility, count(*) n from public.tool_artifacts group by 1, 2) z) item
  union all select 2, 'INFO', 'tin có ref: ' || (select coalesce(string_agg(coalesce(ref_type, 'text') || '=' || n, ', '), '(trống)') from (select ref_type, count(*) n from public.dm_messages group by 1) z)
  union all select 9, 'GATE', case when
       to_regprocedure('public.dm_artifact_granted(uuid)') is not null and to_regprocedure('public.tool_artifact_demote_or_delete(uuid,uuid)') is not null
   and to_regprocedure('public.nhipphach_musicxml_check(text)') is not null and to_regprocedure('public.social_class_is_member(uuid,uuid)') is not null
   and (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_append', 'dm_messages', 'dm_open', 'dm_rule', 'dm_artifact_granted', 'tool_artifact_demote_or_delete', 'social_delete_tool_artifact', 'social_share_tool_result', 'tool_artifacts_cleanup_on_post_delete'))
       = 'dm_append=00aefca4,dm_artifact_granted=493924c7,dm_messages=0605c799,dm_open=7cdcea48,dm_rule=763d62ac,social_delete_tool_artifact=cbcac728,social_share_tool_result=932a8b04,tool_artifact_demote_or_delete=07145b4a,tool_artifacts_cleanup_on_post_delete=d2e889ae'
   and (   (to_regprocedure('public.tool_artifact_save_for_share(text,jsonb)') is null
            and (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.bms_save_for_share(jsonb)')) = 'fe706f70edaba2ebca04595c2aab63d4'
            and (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.social_publish_tool_artifact(uuid)')) = 'e64c08ef0cb62b1fcc8ae37837e6d5e8'
            and (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.social_unpublish_tool_artifact(uuid)')) = '94707899924be03dd5234aa88b4a9718'
            and (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.dm_share(uuid,text,text)')) = '120fe4b6498d4176dfa93907c859c6e9')
        or to_regprocedure('public.tool_artifact_save_for_share(text,jsonb)') is not null)   -- baseline LIVE, hoặc đã có Universal Share (chạy lại)
  then 'PASS' else 'FAIL' end
) z order by o;
