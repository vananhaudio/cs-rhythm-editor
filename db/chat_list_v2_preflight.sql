-- PREFLIGHT (read-only) cho db/chat_list_v2_setup.sql — GATE = PASS mới được migrate. Chỉ số đếm gộp.
select section, item from (
  select 1 o, 'CHECK' section, 'nền có đủ (phải 8): ' || (
      (case when to_regprocedure('public.dm_rule(uuid,uuid)') is not null then 1 else 0 end)
    + (case when to_regprocedure('public.class_public_identity(uuid)') is not null then 1 else 0 end)
    + (case when to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is not null then 1 else 0 end)
    + (case when to_regprocedure('public.bandchat_access(uuid)') is not null then 1 else 0 end)
    + (case when to_regprocedure('public.is_class_member()') is not null then 1 else 0 end)
    + (case when to_regprocedure('public.is_teacher()') is not null then 1 else 0 end)
    + (case when to_regclass('public.bandchat_rooms') is not null then 1 else 0 end)
    + (case when to_regclass('public.dm_conversations') is not null then 1 else 0 end)) item
  union all select 2, 'CHECK', 'đối tượng chat_list_v2 đã có: ' || coalesce((select string_agg(x, ', ') from (
      select c.relname x from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'chat_pins'
      union all select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('chat_fold', 'chat_inbox_base', 'chat_inbox', 'chat_inbox_summary', 'chat_conversation_info', 'chat_pin_set')) z), 'chưa')
  union all select 3, 'CHECK', 'số hội thoại DM: ' || (select count(*) from public.dm_conversations) || ' · phòng Band: ' || (select count(*) from public.bandchat_rooms)
  union all select 9, 'GATE', case when
       to_regprocedure('public.dm_rule(uuid,uuid)') is not null and to_regprocedure('public.class_public_identity(uuid)') is not null
   and to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is not null and to_regprocedure('public.bandchat_access(uuid)') is not null
   and to_regprocedure('public.is_class_member()') is not null and to_regprocedure('public.is_teacher()') is not null
   and to_regclass('public.bandchat_rooms') is not null and to_regclass('public.dm_conversations') is not null
   and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'chat_pins' and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'chat_list_v2:%')
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('chat_fold', 'chat_inbox_base', 'chat_inbox', 'chat_inbox_summary', 'chat_conversation_info', 'chat_pin_set')
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'chat_list_v2:%')
  then 'PASS' else 'FAIL' end
) z order by o;
