-- PREFLIGHT (chỉ đọc) cho db/lesson_clip_card_v1_setup.sql — GATE = PASS mới được migrate. Không đọc nội dung giáo trình / dữ liệu cá nhân.
-- Đây cũng là câu đo md5 ngay trước ngày chạy (chống trôi hàm Feed).
select section, item from (
  select 1 o, 'CHECK' section, 'md5 social_feed: ' || coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed'), 'THIẾU') item
  union all select 2, 'CHECK', 'md5 social_feed_scoped: ' || coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed_scoped'), 'THIẾU')
  union all select 3, 'CHECK', 'phụ thuộc thiếu (phải rỗng): ' || coalesce((select string_agg(f, ', ') from unnest(array['tva_private.can_read_class_curriculum(uuid)', 'public.social_class_is_member(uuid,uuid)',
      'public.is_class_member()', 'public.social_feed_safe(timestamptz,text,int)', 'public.social_feed_scoped_safe(text,timestamptz,text,int)']) f where to_regprocedure(f) is null), '')
  union all select 4, 'CHECK', 'cột thiếu (phải rỗng): ' || coalesce((select string_agg(c, ', ') from unnest(array['class_lesson_content.session_id', 'class_lesson_content.status', 'class_lesson_content.blocks',
      'class_sessions.id', 'class_sessions.class_id', 'class_sessions.session_number', 'class_sessions.event_type', 'class_schedule.id', 'class_schedule.code', 'class_schedule.name']) c
      where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = split_part(c, '.', 1) and column_name = split_part(c, '.', 2))), '')
  union all select 5, 'CHECK', 'đã cài G3 chưa (social_feed chứa lesson_clip): ' || coalesce((select (position('lesson_clip' in p.prosrc) > 0)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed'), '?')
  union all select 9, 'GATE', case when
       (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed') in ('2697eb50daaf7c085da22adaddc2baa2', '91e32e8ba809cda3b28c6a8964d43efa')
   and (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed_scoped') in ('47bf0f5f3382086d19ad6d0b184644cc', 'f79d95d5d7ce80a7a044513b2d1e086d')
   and to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is not null and to_regprocedure('public.social_class_is_member(uuid,uuid)') is not null
   and to_regprocedure('public.social_feed_safe(timestamptz,text,int)') is not null and to_regprocedure('public.social_feed_scoped_safe(text,timestamptz,text,int)') is not null
   then 'PASS' else 'FAIL' end
) z order by o;
