-- PREFLIGHT (read-only) cho db/band_chat_v1_setup.sql — GATE = PASS mới được migrate. Chỉ số đếm gộp, không đọc nội dung.
select section, item from (
  select 1 o, 'CHECK' section, 'bảng bandchat_* đã có: ' || coalesce((select string_agg(c.relname, ', ' order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads', 'bandchat_frozen')), 'chưa') item
  union all select 2, 'CHECK', 'Band: ' || (select count(*) from public.teamlab_bands) || ' · thành viên Band: ' || (select count(*) from public.teamlab_band_members)
  union all select 3, 'CHECK', 'cột nền đủ (phải 10): ' || (select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in
        (('teamlab_bands', 'id'), ('teamlab_bands', 'project_id'), ('teamlab_bands', 'name'), ('teamlab_bands', 'cover_path'),
         ('teamlab_band_members', 'band_id'), ('teamlab_band_members', 'user_id'), ('teamlab_band_members', 'created_at'),
         ('projects', 'id'), ('projects', 'name'), ('projects', 'avatar_path')))
  union all select 4, 'CHECK', 'md5 hàm nền dm_*/identity (không đổi sau migrate): ' || (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname = 'class_public_identity'))
  union all select 9, 'GATE', case when
       to_regclass('public.teamlab_bands') is not null and to_regclass('public.teamlab_band_members') is not null
   and (select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in
        (('teamlab_bands', 'id'), ('teamlab_bands', 'project_id'), ('teamlab_bands', 'name'), ('teamlab_bands', 'cover_path'),
         ('teamlab_band_members', 'band_id'), ('teamlab_band_members', 'user_id'), ('teamlab_band_members', 'created_at'),
         ('projects', 'id'), ('projects', 'name'), ('projects', 'avatar_path'))) = 10
   and to_regprocedure('public.class_public_identity(uuid)') is not null
   and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads', 'bandchat_frozen')
           and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'bandchat_v1:%')
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('bandchat_access', 'bandchat_append', 'bandchat_rooms', 'bandchat_messages',
           'bandchat_send', 'bandchat_mark_read', 'bandchat_unread_count', 'bandchat_members', 'bandchat_set_archived')
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'bandchat_v1:%')
  then 'PASS' else 'FAIL' end
) z order by o;
