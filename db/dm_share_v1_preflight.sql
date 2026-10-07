-- PREFLIGHT (read-only) cho db/dm_share_v1_setup.sql — GATE = PASS mới được dryrun/migrate. Không đọc nội dung hội thoại.
select section, item from (
  select 1 o, 'INFO' section, 'tin dm hiện có (đếm gộp): ' || (select count(*) from public.dm_messages) || ' · cột ref_*: ' ||
         (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'dm_messages' and column_name in ('ref_type', 'ref_key')) item
  union all select 9, 'GATE', case when
       to_regclass('public.tool_artifacts') is not null
   and (select count(*) from pg_policies where tablename = 'tool_artifacts' and policyname = 'tool_artifacts_read') = 1
   and (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('dm_rule','dm_start','dm_send','dm_conversations','dm_mark_read','dm_unread_count','dm_can_message','dm_find'))
       = 'dm_can_message=05d8157fabb5e6f2da69c1b98c01aa7c,dm_conversations=aaaaae7481c7c569cbce0ace968b643e,dm_find=eca4bcd25d5241e9e9f800642761206c,dm_mark_read=a38c5348c98e51e6f94fb31b73eacc6d,dm_rule=763d62ac7dc770931aa9a422701d21df,dm_send=28ea5818ec92c40cb3e98948a7644b7e,dm_start=8481b089af50d1c3b3d6b156e75ee5e8,dm_unread_count=4490dabacd28d12f4a0179f7baa39b16'
   and (   ((select md5(prosrc) from pg_proc where oid = to_regprocedure('public.dm_append(uuid,uuid,text)')) = '07e8750b2391ef413f8c7ee258031241'
        and (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.dm_messages(uuid,bigint,bigint,integer)')) = 'e01f291a572f31eb103d9d963e28cf4b')
        or to_regprocedure('public.dm_append(uuid,uuid,text,text,text)') is not null)   -- baseline V1a, hoặc đã có V1b (chạy lại)
  then 'PASS' else 'FAIL' end
) z order by o;
