-- Chỉ cho E2E: FE của main gọi dm_*_safe (production có từ class_ugc_safety_v1) và bandchat_* (Band Chat V1.x).
-- Stack E2E không nạp hai migration đó → stub ủy quyền cho hàm Chat gốc; Band Chat = không có phòng nào. KHÔNG chạy production.
create or replace function public.dm_conversations_safe(p_limit int default 50)
returns table(conversation_id uuid, peer_id uuid, peer_name text, peer_avatar_url text, peer_role text,
              last_seq bigint, last_body text, last_mine boolean, last_at timestamptz, unread int, can_send boolean)
language sql security definer set search_path = '' stable as $$ select * from public.dm_conversations(p_limit) $$;
grant execute on function public.dm_conversations_safe(int) to authenticated;
create or replace function public.dm_messages_safe(p_conversation uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, mine boolean, body text, created_at timestamptz, ref_type text, ref_key text)
language sql security definer set search_path = '' stable as $$ select * from public.dm_messages(p_conversation, p_after_seq, p_before_seq, p_limit) $$;
grant execute on function public.dm_messages_safe(uuid, bigint, bigint, int) to authenticated;
do $stub$ begin
  if to_regprocedure('public.bandchat_rooms(int)') is null then
    execute $f$create function public.bandchat_rooms(p_limit int default 50)
      returns table(band_id uuid, band_name text, cover_path text, project_id uuid, project_name text, project_avatar_path text,
                    last_seq bigint, last_body text, last_sender_name text, last_mine boolean, last_at timestamptz,
                    unread int, member_count int, can_send boolean, archived boolean, support boolean)
      language sql stable as $b$ select null::uuid, null, null, null::uuid, null, null, null::bigint, null, null, null::boolean, null::timestamptz, null::int, null::int, null::boolean, null::boolean, null::boolean where false $b$$f$;
    grant execute on function public.bandchat_rooms(int) to authenticated;
  end if;
  if to_regprocedure('public.bandchat_unread_count()') is null then
    execute 'create function public.bandchat_unread_count() returns int language sql stable as $b$ select 0 $b$';
    grant execute on function public.bandchat_unread_count() to authenticated;
  end if;
end $stub$;
