/* POSTFLIGHT FEED LIKES V1 — READ-ONLY. Kỳ vọng: GATE = PASS (bảng có, RLS bật, không policy, không quyền bảng cho anon/authenticated,
   3 hàm có, 2 RPC chỉ authenticated gọi được, hàm kiểm quyền không gọi được trực tiếp). */
with r as (
  select 'table feed_likes + RLS bật' as item, (select coalesce(relrowsecurity, false) from pg_class where oid = to_regclass('public.feed_likes')) as ok
  union all select 'không policy', not exists (select 1 from pg_policies where tablename = 'feed_likes')
  union all select 'anon/authenticated không quyền bảng', not exists (select 1 from information_schema.role_table_grants where table_name = 'feed_likes' and grantee in ('anon','authenticated','PUBLIC'))
  union all select '3 hàm feed_*', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('feed_like_set','feed_like_summary','feed_target_visible')) = 3
  union all select 'authenticated gọi được feed_like_set', has_function_privilege('authenticated', 'public.feed_like_set(text,uuid,boolean)', 'execute')
  union all select 'anon KHÔNG gọi được feed_like_set', not has_function_privilege('anon', 'public.feed_like_set(text,uuid,boolean)', 'execute')
  union all select 'authenticated gọi được feed_like_summary', has_function_privilege('authenticated', 'public.feed_like_summary(text[],uuid[])', 'execute')
  union all select 'anon KHÔNG gọi được feed_like_summary', not has_function_privilege('anon', 'public.feed_like_summary(text[],uuid[])', 'execute')
  union all select 'authenticated KHÔNG gọi trực tiếp feed_target_visible', not has_function_privilege('authenticated', 'public.feed_target_visible(text,uuid)', 'execute')
)
select item, ok from r union all select 'GATE', not exists (select 1 from r where ok is not true) order by item;
