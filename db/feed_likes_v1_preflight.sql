/* PREFLIGHT FEED LIKES V1 — READ-ONLY (một câu SELECT). Chạy trên production TRƯỚC db/feed_likes_v1_setup.sql.
   Dòng cuối GATE: PASS → được chạy; STOP → DỪNG. Chỉ chú thích khối (an toàn khi copy). */
with req as (
  select 'table'::text as section, t as item,
         case when to_regclass('public.' || t) is not null then 'present' else 'MISSING' end as detail,
         case when to_regclass('public.' || t) is not null then 'OK' else 'STOP' end as status
  from unnest(array['class_posts','learning_threads','teamlab_publications','friendships']) t
  union all
  select 'function', f, case when to_regprocedure(f) is not null then 'present' else 'MISSING' end,
         case when to_regprocedure(f) is not null then 'OK' else 'STOP' end
  from unnest(array['public.is_class_member()','public.is_teacher()','public.is_friend_of(uuid)','public.class_moderate(text,uuid,boolean)']) f
  union all
  select 'column', t || '.' || c,
         case when exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name=c) then 'present' else 'MISSING' end,
         case when exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name=c) then 'OK' else 'STOP' end
  from (values ('class_posts','audience'),('class_posts','hidden_at'),('class_posts','author_user_id'),
               ('learning_threads','visibility'),('learning_threads','hidden_at'),('learning_threads','archived_at'),
               ('teamlab_publications','status'),('teamlab_publications','published_at'),('teamlab_publications','public_slug')) v(t, c)
  union all
  select 'info', 'feed_likes (chưa tồn tại)', case when to_regclass('public.feed_likes') is null then 'chưa có' else 'ĐÃ CÓ' end,
         case when to_regclass('public.feed_likes') is null then 'OK' else 'STOP' end
  union all
  select 'info', 'RPC feed_* (chưa tồn tại)', (select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname like 'feed\_%'),
         case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'feed\_%') = 0 then 'OK' else 'STOP' end
  union all
  select 'info', 'social_feed có nguồn teamlab_publication', case when position('teamlab_publication' in coalesce((select string_agg(prosrc, '') from pg_proc where pronamespace='public'::regnamespace and proname='social_feed'), '')) > 0 then 'có' else 'KHÔNG' end,
         case when position('teamlab_publication' in coalesce((select string_agg(prosrc, '') from pg_proc where pronamespace='public'::regnamespace and proname='social_feed'), '')) > 0 then 'OK' else 'STOP' end
)
select section, item, detail, status from (
  select 1 as ord, section, item, detail, status from req
  union all
  select 2, 'GATE', case when exists (select 1 from req where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end,
         (select count(*) filter (where status = 'STOP') from req)::text || ' STOP', ''
) z order by ord, section, item;
