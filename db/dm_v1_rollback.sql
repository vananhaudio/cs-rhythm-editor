-- ROLLBACK Class Chat V1a — gỡ hàm + 3 bảng dm_*. CẢNH BÁO: xoá TOÀN BỘ tin nhắn đã gửi (chỉ dùng khi tính năng chưa có dữ liệu
-- đáng giữ hoặc đã export). Không đụng friendships/identity/RLS khác. Idempotent. Không begin/commit (prod-db sở hữu transaction).
do $gate$
declare v_name text;
begin
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('dm_conversations', 'dm_participants', 'dm_messages')
       and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'dm_v1:%'
  loop
    raise exception 'DỪNG — bảng % không thuộc Chat V1a, không rollback', v_name;
  end loop;
end $gate$;

drop function if exists public.dm_unread_count();
drop function if exists public.dm_mark_read(uuid, bigint);
drop function if exists public.dm_messages(uuid, bigint, bigint, int);
drop function if exists public.dm_conversations(int);
drop function if exists public.dm_send(uuid, text);
drop function if exists public.dm_start(uuid, text);
drop function if exists public.dm_find(uuid);
drop function if exists public.dm_can_message(uuid);
drop function if exists public.dm_append(uuid, uuid, text);
drop function if exists public.dm_rule(uuid, uuid);
-- Gỡ bảng trong MỘT câu lệnh, đặt cuối: DROP bảng có khoá ngoại → xin khoá mạnh trên auth.users tới COMMIT; một câu = cửa sổ ngắn nhất
do $tables$
begin
  drop table if exists public.dm_messages;
  drop table if exists public.dm_participants;
  drop table if exists public.dm_conversations;
end $tables$;

notify pgrst, 'reload schema';
