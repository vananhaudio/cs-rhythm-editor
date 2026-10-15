-- ROLLBACK Band Chat V1 — gỡ hàm + 3 bảng bandchat_*. CẢNH BÁO: xoá TOÀN BỘ tin nhắn nhóm Band (chỉ dùng khi chưa có dữ liệu đáng giữ hoặc đã export).
-- Không đụng dm_*, teamlab_*, identity. Idempotent. Không begin/commit (prod-db sở hữu transaction).
do $gate$
declare v_name text;
begin
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads', 'bandchat_frozen')
       and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'bandchat_v1:%'
  loop
    raise exception 'DỪNG — bảng % không thuộc Band Chat V1, không rollback', v_name;
  end loop;
end $gate$;

drop function if exists public.bandchat_set_archived(uuid, boolean);
drop function if exists public.bandchat_members(uuid);
drop function if exists public.bandchat_unread_count();
drop function if exists public.bandchat_mark_read(uuid, bigint);
drop function if exists public.bandchat_send(uuid, text);
drop function if exists public.bandchat_messages(uuid, bigint, bigint, int);
drop function if exists public.bandchat_rooms(int);
drop function if exists public.bandchat_append(uuid, uuid, text);
drop function if exists public.bandchat_access(uuid);
do $tables$
begin
  drop table if exists public.bandchat_frozen;
  drop table if exists public.bandchat_reads;
  drop table if exists public.bandchat_messages;
  drop table if exists public.bandchat_rooms;
end $tables$;

notify pgrst, 'reload schema';
