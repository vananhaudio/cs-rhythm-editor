/*
POSTFLIGHT TOOL SHARE V1 — READ-ONLY (scripts/prod-db.py query). Không ghi gì, không tạo chia sẻ.
*/
select 'column' as section, column_name as item, data_type || ' · null=' || is_nullable as detail
from information_schema.columns where table_schema = 'public' and table_name = 'class_posts' and column_name = 'tool_share';
select 'constraint' as section, conname as item, pg_get_constraintdef(oid) as detail
from pg_constraint where conrelid = 'public.class_posts'::regclass and conname in ('class_posts_type_check', 'class_posts_tool_share_check') order by 2;
select 'index' as section, indexname as item, indexdef as detail from pg_indexes where indexname = 'class_posts_tool_share_client_key';
select 'function' as section, 'social_share_tool_result' as item,
       case when to_regprocedure('public.social_share_tool_result(text,jsonb,uuid)') is null then 'MISSING' else 'present · security_definer=' ||
         (select prosecdef::text from pg_proc where oid = 'public.social_share_tool_result(text,jsonb,uuid)'::regprocedure) end as detail;
select 'grant' as section, grantee as item, privilege_type as detail
from information_schema.routine_privileges where routine_name = 'social_share_tool_result' order by grantee;
select 'posts' as section, type || ' · ' || audience as item, count(*)::text as detail from public.class_posts group by type, audience order by 2;
select 'insert_policy_blocks_tool_share' as section, 'class_posts_own_insert' as item,
       (position('tool_share' in coalesce((select with_check from pg_policies where tablename = 'class_posts' and policyname = 'class_posts_own_insert'), '')) = 0)::text as detail;
