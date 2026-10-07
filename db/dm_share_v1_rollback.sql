-- ROLLBACK Chat V1b → trả dm_append / dm_messages về ĐÚNG nguyên văn V1a (md5 baseline), gỡ dm_share/dm_open.
-- Cột ref_type/ref_key: gỡ CHỈ khi không còn tin share nào; còn tin share thì GIỮ cột (tin vẫn đọc được như text 'Đã chia sẻ một nội dung').
-- KHÔNG xoá tin nhắn. Ưu tiên rollback frontend; file này chỉ dùng khi cần trả hợp đồng DB về V1a. Idempotent. Không begin/commit.
drop function if exists public.dm_share(uuid, text, text);
drop function if exists public.dm_messages(uuid, bigint, bigint, int);
drop function if exists public.dm_append(uuid, uuid, text, text, text);
drop function if exists public.dm_open(uuid, uuid);

create or replace function public.dm_append(p_conv uuid, p_me uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_body text := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'); v_seq bigint; v_recent int;
begin
  if v_body = '' then raise exception 'Tin nhắn trống' using errcode = '22023'; end if;
  if char_length(v_body) > 2000 then raise exception 'Tin nhắn quá dài (tối đa 2000 ký tự)' using errcode = '22023'; end if;

  perform 1 from public.dm_conversations where id = p_conv for update;
  select count(*) into v_recent from (
    select 1 from public.dm_messages
     where conversation_id = p_conv and sender_id = p_me and created_at > now() - interval '1 minute'
     order by seq desc limit 30) s;
  if v_recent >= 30 then raise exception 'Bạn gửi quá nhanh. Hãy chờ một chút.' using errcode = '54000'; end if;

  update public.dm_conversations set last_seq = last_seq + 1, last_message_at = now()
   where id = p_conv returning last_seq into v_seq;
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body) values (p_conv, v_seq, 'user', p_me, v_body);
  update public.dm_participants set last_read_seq = v_seq where conversation_id = p_conv and user_id = p_me;
  return v_seq;
end $$;
comment on function public.dm_append(uuid, uuid, text) is 'dm_v1: ghi tin (nội bộ)';
revoke all on function public.dm_append(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.dm_messages(p_conversation uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, mine boolean, body text, created_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not exists (select 1 from public.dm_participants p where p.conversation_id = p_conversation and p.user_id = v_me) then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  if p_after_seq is not null then
    return query
    select m.seq, m.sender_id, (m.sender_id = v_me), m.body, m.created_at
      from public.dm_messages m
     where m.conversation_id = p_conversation and m.seq > p_after_seq
     order by m.seq asc limit v_lim;
  else
    return query
    select z.seq, z.sender_id, (z.sender_id = v_me), z.body, z.created_at
      from (select m.seq, m.sender_id, m.body, m.created_at
              from public.dm_messages m
             where m.conversation_id = p_conversation and (p_before_seq is null or m.seq < p_before_seq)
             order by m.seq desc limit v_lim) z
     order by z.seq asc;
  end if;
end $$;
comment on function public.dm_messages(uuid, bigint, bigint, int) is 'dm_v1: tin của hội thoại theo seq';
revoke all on function public.dm_messages(uuid, bigint, bigint, int) from public, anon;
grant execute on function public.dm_messages(uuid, bigint, bigint, int) to authenticated;

do $$ begin
  if to_regclass('public.dm_messages') is not null and not exists (select 1 from public.dm_messages where ref_type is not null) then
    alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
    alter table public.dm_messages drop constraint if exists dm_messages_ref_pair_check;
    alter table public.dm_messages drop column if exists ref_key;
    alter table public.dm_messages drop column if exists ref_type;
  end if;
end $$;
notify pgrst, 'reload schema';
