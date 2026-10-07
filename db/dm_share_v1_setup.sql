-- CLASS CHAT V1b — Share nội bộ (BMS artifact). Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit).
-- ADDITIVE + backward-compatible với Chat V1a:
--   • dm_messages thêm 2 cột NULL (ref_type, ref_key) + CHECK "cả hai null hoặc cả hai có" (+ allowlist, định dạng uuid).
--   • dm_append: thêm 2 tham số có DEFAULT (lời gọi 3 tham số của dm_start/dm_send vẫn chạy nguyên). Tin share luôn có
--     body CỐ ĐỊNH 'Đã chia sẻ một nội dung' (client V1a cũ thấy một bong bóng text; preview danh sách hội thoại dùng được).
--     KHÔNG nhận lời nhắn người dùng vào body.
--   • dm_messages (RPC): trả thêm ref_type, ref_key (đổi kiểu trả về → DROP + CREATE; client cũ bỏ qua cột thừa).
--   • RPC mới dm_share(p_user, p_ref_type, p_ref_key) + hàm nội bộ dm_open (tìm-hoặc-tạo hội thoại).
-- KHÔNG đổi: dm_rule, dm_start, dm_send, dm_conversations, dm_mark_read, dm_unread_count, RLS, grant bảng, friendships.
-- Chat chỉ mang THAM CHIẾU. Quyền xem object do RLS tool_artifacts quyết tại thời điểm xem; share KHÔNG cấp quyền.
-- Không FK sang auth.users/tool_artifacts → không thêm khoá nào ngoài ALTER TABLE ngắn trên dm_messages.

-- 0) Cổng drift
do $gate$
declare
  v_old_append text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.dm_append(uuid,uuid,text)'));
  v_new_append oid := to_regprocedure('public.dm_append(uuid,uuid,text,text,text)');
  v_old_msgs text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.dm_messages(uuid,bigint,bigint,integer)'));
  v_fns text;
begin
  if to_regclass('public.dm_messages') is null or to_regclass('public.dm_conversations') is null or to_regclass('public.dm_participants') is null
     or to_regclass('public.tool_artifacts') is null then
    raise exception 'DỪNG — thiếu nền Chat V1a (dm_*) hoặc tool_artifacts';
  end if;
  -- hàm V1a KHÔNG được sửa bởi V1b: phải đúng baseline
  select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) into v_fns from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('dm_rule', 'dm_start', 'dm_send', 'dm_conversations', 'dm_mark_read', 'dm_unread_count', 'dm_can_message', 'dm_find');
  if v_fns is distinct from 'dm_can_message=05d8157fabb5e6f2da69c1b98c01aa7c,dm_conversations=aaaaae7481c7c569cbce0ace968b643e,dm_find=eca4bcd25d5241e9e9f800642761206c,dm_mark_read=a38c5348c98e51e6f94fb31b73eacc6d,dm_rule=763d62ac7dc770931aa9a422701d21df,dm_send=28ea5818ec92c40cb3e98948a7644b7e,dm_start=8481b089af50d1c3b3d6b156e75ee5e8,dm_unread_count=4490dabacd28d12f4a0179f7baa39b16' then
    raise exception 'DỪNG — hàm Chat V1a trên production khác baseline: %', v_fns;
  end if;
  if v_new_append is null then
    -- chưa có V1b: dm_append/dm_messages phải đúng baseline V1a
    if v_old_append is distinct from '07e8750b2391ef413f8c7ee258031241' or v_old_msgs is distinct from 'e01f291a572f31eb103d9d963e28cf4b' then
      raise exception 'DỪNG — dm_append/dm_messages khác baseline V1a (append %, messages %)', v_old_append, v_old_msgs;
    end if;
  elsif coalesce(obj_description(v_new_append, 'pg_proc'), '') not like 'dm_share_v1:%' then
    raise exception 'DỪNG — dm_append 5 tham số đã có nhưng không thuộc Chat V1b';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('dm_share', 'dm_open') and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'dm_share_v1:%') then
    raise exception 'DỪNG — đã có hàm dm_share/dm_open không thuộc Chat V1b';
  end if;
end $gate$;

-- 1) Cột tham chiếu + ràng buộc (bảng nhỏ; ACCESS EXCLUSIVE rất ngắn)
alter table public.dm_messages add column if not exists ref_type text;
alter table public.dm_messages add column if not exists ref_key text;
alter table public.dm_messages drop constraint if exists dm_messages_ref_pair_check;
alter table public.dm_messages add constraint dm_messages_ref_pair_check check ((ref_type is null) = (ref_key is null));
alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
alter table public.dm_messages add constraint dm_messages_ref_valid_check check (
  ref_type is null or (ref_type in ('tool_artifact') and ref_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
comment on column public.dm_messages.ref_type is 'dm_share_v1: loại tham chiếu nội bộ (null = tin text)';
comment on column public.dm_messages.ref_key is 'dm_share_v1: khoá object gốc (không snapshot)';

-- 2) Ghi một tin (nội bộ): mở rộng dm_append — tin share có body CỐ ĐỊNH
drop function if exists public.dm_append(uuid, uuid, text);
create or replace function public.dm_append(p_conv uuid, p_me uuid, p_body text, p_ref_type text default null, p_ref_key text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_body text; v_seq bigint; v_recent int;
begin
  if p_ref_type is not null then
    v_body := 'Đã chia sẻ một nội dung';   -- cố định: không nhận lời nhắn vào body của tin share
  else
    v_body := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if v_body = '' then raise exception 'Tin nhắn trống' using errcode = '22023'; end if;
    if char_length(v_body) > 2000 then raise exception 'Tin nhắn quá dài (tối đa 2000 ký tự)' using errcode = '22023'; end if;
  end if;

  perform 1 from public.dm_conversations where id = p_conv for update;
  select count(*) into v_recent from (
    select 1 from public.dm_messages
     where conversation_id = p_conv and sender_id = p_me and created_at > now() - interval '1 minute'
     order by seq desc limit 30) s;
  if v_recent >= 30 then raise exception 'Bạn gửi quá nhanh. Hãy chờ một chút.' using errcode = '54000'; end if;

  update public.dm_conversations set last_seq = last_seq + 1, last_message_at = now()
   where id = p_conv returning last_seq into v_seq;
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body, ref_type, ref_key)
  values (p_conv, v_seq, 'user', p_me, v_body, p_ref_type, p_ref_key);
  update public.dm_participants set last_read_seq = v_seq where conversation_id = p_conv and user_id = p_me;
  return v_seq;
end $$;
comment on function public.dm_append(uuid, uuid, text, text, text) is 'dm_share_v1: ghi tin text hoặc share (nội bộ)';
revoke all on function public.dm_append(uuid, uuid, text, text, text) from public, anon, authenticated;

-- 3) Tìm-hoặc-tạo hội thoại chuẩn tắc (nội bộ; cùng khoá cặp như dm_start)
create or replace function public.dm_open(p_me uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_conv uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(least(p_me, p_user)::text || greatest(p_me, p_user)::text, 11));
  select c.id into v_conv from public.dm_conversations c
   where c.user_lo = least(p_me, p_user) and c.user_hi = greatest(p_me, p_user);
  if v_conv is null then
    insert into public.dm_conversations (user_lo, user_hi) values (least(p_me, p_user), greatest(p_me, p_user)) returning id into v_conv;
    insert into public.dm_participants (conversation_id, user_id) values (v_conv, p_me), (v_conv, p_user);
  end if;
  return v_conv;
end $$;
comment on function public.dm_open(uuid, uuid) is 'dm_share_v1: tìm-hoặc-tạo hội thoại (nội bộ)';
revoke all on function public.dm_open(uuid, uuid) from public, anon, authenticated;

-- 4) Chia sẻ một object nội bộ cho bạn. V1b: CHỈ BMS artifact (tool_artifacts tool='bms', kind='song').
--    Người GỬI phải đọc được artifact (đúng RLS tool_artifacts). Mọi lỗi về object dùng MỘT thông báo chung (không lộ tồn tại).
--    Friendship chỉ quyết ai được gửi cho ai; KHÔNG cấp quyền xem object.
create or replace function public.dm_share(p_user uuid, p_ref_type text, p_ref_key text)
returns table(conversation_id uuid, seq bigint) language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_key text := lower(coalesce(p_ref_key, '')); v_conv uuid; v_seq bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not public.dm_rule(v_me, p_user) then raise exception 'Bạn chưa thể nhắn tin cho người này' using errcode = '42501'; end if;
  if p_ref_type is distinct from 'tool_artifact'
     or v_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not exists (select 1 from public.tool_artifacts a
                     where a.id = v_key::uuid and a.tool = 'bms' and a.kind = 'song'
                       and (a.owner_id = v_me or a.visibility = 'class')) then
    raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023';
  end if;
  v_conv := public.dm_open(v_me, p_user);
  v_seq := public.dm_append(v_conv, v_me, null, 'tool_artifact', v_key);
  return query select v_conv, v_seq;
end $$;
comment on function public.dm_share(uuid, text, text) is 'dm_share_v1: chia sẻ BMS artifact cho bạn (chỉ tham chiếu)';
revoke all on function public.dm_share(uuid, text, text) from public, anon;
grant execute on function public.dm_share(uuid, text, text) to authenticated;

-- 5) dm_messages: trả thêm ref_type, ref_key (đổi kiểu trả về → drop + create)
drop function if exists public.dm_messages(uuid, bigint, bigint, int);
create or replace function public.dm_messages(p_conversation uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, mine boolean, body text, created_at timestamptz, ref_type text, ref_key text)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not exists (select 1 from public.dm_participants p where p.conversation_id = p_conversation and p.user_id = v_me) then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  if p_after_seq is not null then
    return query
    select m.seq, m.sender_id, (m.sender_id = v_me), m.body, m.created_at, m.ref_type, m.ref_key
      from public.dm_messages m
     where m.conversation_id = p_conversation and m.seq > p_after_seq
     order by m.seq asc limit v_lim;
  else
    return query
    select z.seq, z.sender_id, (z.sender_id = v_me), z.body, z.created_at, z.ref_type, z.ref_key
      from (select m.seq, m.sender_id, m.body, m.created_at, m.ref_type, m.ref_key
              from public.dm_messages m
             where m.conversation_id = p_conversation and (p_before_seq is null or m.seq < p_before_seq)
             order by m.seq desc limit v_lim) z
     order by z.seq asc;
  end if;
end $$;
comment on function public.dm_messages(uuid, bigint, bigint, int) is 'dm_share_v1: tin của hội thoại theo seq (+ tham chiếu)';
revoke all on function public.dm_messages(uuid, bigint, bigint, int) from public, anon;
grant execute on function public.dm_messages(uuid, bigint, bigint, int) to authenticated;

notify pgrst, 'reload schema';
