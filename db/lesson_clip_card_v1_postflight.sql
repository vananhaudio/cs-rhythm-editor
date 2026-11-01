-- POSTFLIGHT (chỉ đọc) cho db/lesson_clip_card_v1_setup.sql — GATE = PASS mới được coi là xong. Không đọc nội dung giáo trình / dữ liệu cá nhân.
select section, item from (
  select 1 o, 'CHECK' section, 'md5 social_feed (mong đợi 91e32e8ba809cda3b28c6a8964d43efa): ' || coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed'), 'THIẾU') item
  union all select 2, 'CHECK', 'md5 social_feed_scoped (mong đợi f79d95d5d7ce80a7a044513b2d1e086d): ' || coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed_scoped'), 'THIẾU')
  union all select 3, 'CHECK', 'hàm nội bộ không ai gọi được (anon/authenticated/public phải false): '
     || has_function_privilege('anon', 'public.social_feed_clip_items(uuid[])', 'execute') || '/' || has_function_privilege('authenticated', 'public.social_feed_clip_items(uuid[])', 'execute') || ' · '
     || has_function_privilege('anon', 'public.social_clip_added_at(text)', 'execute') || '/' || has_function_privilege('authenticated', 'public.social_clip_added_at(text)', 'execute')
  union all select 4, 'CHECK', 'quyền Feed (authenticated true, anon false): '
     || has_function_privilege('authenticated', 'public.social_feed(timestamptz,text,int)', 'execute') || '/' || has_function_privilege('anon', 'public.social_feed(timestamptz,text,int)', 'execute') || ' · scoped '
     || has_function_privilege('authenticated', 'public.social_feed_scoped(text,timestamptz,text,int)', 'execute') || '/' || has_function_privilege('anon', 'public.social_feed_scoped(text,timestamptz,text,int)', 'execute')
  union all select 5, 'CHECK', 'hai hàm Feed SECURITY DEFINER + search_path rỗng: ' || coalesce((select string_agg(p.proname || '=' || p.prosecdef || '/' || coalesce(p.proconfig::text, 'null'), ' ; ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('social_feed', 'social_feed_scoped', 'social_feed_clip_items')), '')
  union all select 9, 'GATE', case when
       (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed') = '91e32e8ba809cda3b28c6a8964d43efa'
   and (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed_scoped') = 'f79d95d5d7ce80a7a044513b2d1e086d'
   and not has_function_privilege('anon', 'public.social_feed_clip_items(uuid[])', 'execute') and not has_function_privilege('authenticated', 'public.social_feed_clip_items(uuid[])', 'execute')
   and not has_function_privilege('anon', 'public.social_clip_added_at(text)', 'execute') and not has_function_privilege('authenticated', 'public.social_clip_added_at(text)', 'execute')
   and has_function_privilege('authenticated', 'public.social_feed(timestamptz,text,int)', 'execute') and not has_function_privilege('anon', 'public.social_feed(timestamptz,text,int)', 'execute')
   and has_function_privilege('authenticated', 'public.social_feed_scoped(text,timestamptz,text,int)', 'execute') and not has_function_privilege('anon', 'public.social_feed_scoped(text,timestamptz,text,int)', 'execute')
   then 'PASS' else 'FAIL' end
) z order by o;
