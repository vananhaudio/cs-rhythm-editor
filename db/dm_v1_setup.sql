-- CLASS CHAT V1a — Text 1-1 (Trò chuyện trong /me/chat). Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit).
-- Idempotent, ADDITIVE: tạo 3 bảng + hàm MỚI (tiền tố dm_), không sửa bảng/hàm/policy nào đang có.
--
-- Nguyên tắc (giống friendships / learning_threads):
--   • RLS BẬT, thu hồi MỌI grant, KHÔNG có policy nào → client không CRUD thẳng bảng. Mọi thao tác qua RPC
--     SECURITY DEFINER (search_path rỗng) dùng auth.uid(). Không CREATE POLICY ⇒ không dính khoá policy_grants.
--   • Lỗi không lộ sự tồn tại: không phải thành viên hội thoại và hội thoại không tồn tại → cùng một lỗi DM_NOT_FOUND.
--   • Quyền nhắn tin (dm_rule, hàm nội bộ — MỘT chỗ duy nhất):
--       - học viên ↔ học viên: friendship 'accepted' (cùng lớp KHÔNG tự động được nhắn);
--       - Thầy ↔ học viên: CHƯA triển khai — chờ helper canonical (docs/CLASS-CHAT-V1A.md). Thầy vẫn nhắn được người
--         đã là bạn (accepted) như mọi thành viên. Mở nhánh Thầy = sửa đúng dm_rule, không đổi schema.
--   • Đọc lịch sử luôn được (người trong hội thoại), GỬI mới phải còn đủ quyền ở thời điểm gửi (huỷ kết bạn → không gửi mới).
--   • Hội thoại 1-1 chuẩn tắc: user_lo < user_hi, unique (user_lo, user_hi). Hội thoại chỉ được tạo cùng tin đầu tiên
--     (dm_start) → mở hồ sơ/bấm "Nhắn tin" không sinh hội thoại rác.
--   • seq tăng ổn định trong hội thoại (khoá hàng hội thoại khi gửi). last_read_seq theo người tham gia — KHÔNG có hàng
--     "đã đọc" cho từng tin. Gửi tin = đã đọc tới tin đó của chính người gửi.
--   • Chuẩn bị cho sau này: sender_kind ('user'|'mira'), thêm ref_type/ref_key = ALTER TABLE ADD COLUMN NULL (không phá model).
--     Realtime: chưa thêm bảng vào publication.
--
-- Hàm cũ phụ thuộc (KHÔNG sửa): is_class_member(), is_class_member_user(uuid), class_public_identity(uuid), bảng friendships.

-- 0) Cổng drift
do $gate$
declare
  v_ident text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.class_public_identity(uuid)'));
  v_name text;
begin
  if to_regprocedure('public.is_class_member()') is null or to_regprocedure('public.is_class_member_user(uuid)') is null
     or to_regclass('public.friendships') is null or v_ident is null then
    raise exception 'DỪNG — thiếu hàm/bảng nền (is_class_member, is_class_member_user, friendships, class_public_identity)';
  end if;
  if v_ident <> 'c1129bf0314c9ee6954a177059368562' then
    raise exception 'DỪNG — class_public_identity trên production khác repo (md5 %)', v_ident;
  end if;
  -- Va chạm tên: nếu đã có đối tượng dm_* mà KHÔNG thuộc Chat V1a → dừng
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('dm_conversations', 'dm_participants', 'dm_messages')
       and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'dm_v1:%'
  loop
    raise exception 'DỪNG — đã có bảng % không thuộc Chat V1a', v_name;
  end loop;
  for v_name in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('dm_rule', 'dm_append', 'dm_can_message', 'dm_find', 'dm_start', 'dm_send',
                                                  'dm_conversations', 'dm_messages', 'dm_mark_read', 'dm_unread_count')
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'dm_v1:%'
  loop
    raise exception 'DỪNG — đã có hàm % không thuộc Chat V1a', v_name;
  end loop;
end $gate$;

-- 1) Luật nhắn tin — MỘT chỗ duy nhất (nội bộ, không ai gọi trực tiếp)
create or replace function public.dm_rule(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select p_a is not null and p_b is not null and p_a <> p_b
    and public.is_class_member_user(p_a) and public.is_class_member_user(p_b)
    and (
      exists (
        select 1 from public.friendships f
         where f.status = 'accepted'
           and least(f.requester_id, f.addressee_id) = least(p_a, p_b)
           and greatest(f.requester_id, f.addressee_id) = greatest(p_a, p_b)
      )
      -- Nhánh Thầy ↔ học viên (quyền thật với lớp): CHƯA triển khai, chờ Owner duyệt helper canonical.
    );
$$;
comment on function public.dm_rule(uuid, uuid) is 'dm_v1: luật nhắn tin nội bộ (bạn accepted)';
revoke all on function public.dm_rule(uuid, uuid) from public, anon, authenticated;

-- 2) Ghi một tin (nội bộ): khoá hàng hội thoại → seq ổn định; giới hạn tốc độ; người gửi coi như đã đọc tới tin này
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

-- 3) RPC cho client
-- Mình có thể nhắn cho p_user ngay bây giờ không (chỉ tiết lộ quyền CỦA CHÍNH MÌNH)
create or replace function public.dm_can_message(p_user uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and public.is_class_member() and public.dm_rule(auth.uid(), p_user);
$$;
comment on function public.dm_can_message(uuid) is 'dm_v1: mình nhắn được p_user không';
revoke all on function public.dm_can_message(uuid) from public, anon;
grant execute on function public.dm_can_message(uuid) to authenticated;

-- Hội thoại đã có với p_user (không tạo). null = chưa có.
create or replace function public.dm_find(p_user uuid)
returns uuid language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if p_user is null or p_user = v_me then return null; end if;
  select c.id into v_id from public.dm_conversations c
   where c.user_lo = least(v_me, p_user) and c.user_hi = greatest(v_me, p_user);
  return v_id;
end $$;
comment on function public.dm_find(uuid) is 'dm_v1: hội thoại có sẵn với p_user';
revoke all on function public.dm_find(uuid) from public, anon;
grant execute on function public.dm_find(uuid) to authenticated;

-- Gửi tin đầu (hoặc tin bất kỳ) tới p_user: tìm-hoặc-tạo hội thoại chuẩn tắc rồi ghi tin, MỘT bước
create or replace function public.dm_start(p_user uuid, p_body text)
returns table(conversation_id uuid, seq bigint) language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_conv uuid; v_seq bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not public.dm_rule(v_me, p_user) then raise exception 'Bạn chưa thể nhắn tin cho người này' using errcode = '42501'; end if;

  -- Khoá theo cặp: hai người gửi cùng lúc không tạo hai hội thoại
  perform pg_advisory_xact_lock(hashtextextended(least(v_me, p_user)::text || greatest(v_me, p_user)::text, 11));
  select c.id into v_conv from public.dm_conversations c
   where c.user_lo = least(v_me, p_user) and c.user_hi = greatest(v_me, p_user);
  if v_conv is null then
    insert into public.dm_conversations (user_lo, user_hi) values (least(v_me, p_user), greatest(v_me, p_user)) returning id into v_conv;
    insert into public.dm_participants (conversation_id, user_id) values (v_conv, v_me), (v_conv, p_user);
  end if;
  v_seq := public.dm_append(v_conv, v_me, p_body);
  return query select v_conv, v_seq;
end $$;
comment on function public.dm_start(uuid, text) is 'dm_v1: tìm-hoặc-tạo hội thoại rồi gửi tin';
revoke all on function public.dm_start(uuid, text) from public, anon;
grant execute on function public.dm_start(uuid, text) to authenticated;

-- Gửi tin vào hội thoại có sẵn (còn đủ quyền nhắn tin thì mới gửi)
create or replace function public.dm_send(p_conversation uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_peer uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  select p.user_id into v_peer from public.dm_participants p
   where p.conversation_id = p_conversation and p.user_id <> v_me
     and exists (select 1 from public.dm_participants m where m.conversation_id = p_conversation and m.user_id = v_me);
  if v_peer is null then raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002'; end if;
  if not public.dm_rule(v_me, v_peer) then raise exception 'Bạn chưa thể nhắn tin cho người này' using errcode = '42501'; end if;
  return public.dm_append(p_conversation, v_me, p_body);
end $$;
comment on function public.dm_send(uuid, text) is 'dm_v1: gửi tin vào hội thoại có sẵn';
revoke all on function public.dm_send(uuid, text) from public, anon;
grant execute on function public.dm_send(uuid, text) to authenticated;

-- Danh sách hội thoại của mình (mới nhất trước): người kia + tin cuối + số chưa đọc + còn nhắn được không
create or replace function public.dm_conversations(p_limit int default 50)
returns table(conversation_id uuid, peer_id uuid, peer_name text, peer_avatar_url text, peer_role text,
              last_seq bigint, last_body text, last_mine boolean, last_at timestamptz, unread int, can_send boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  return query
  select c.id, pe.user_id, idn.name, idn.avatar_url, idn.role,
         c.last_seq, left(m.body, 160), (m.sender_id = v_me), c.last_message_at,
         greatest(c.last_seq - me.last_read_seq, 0)::int,
         public.dm_rule(v_me, pe.user_id)
    from public.dm_participants me
    join public.dm_conversations c on c.id = me.conversation_id
    join public.dm_participants pe on pe.conversation_id = c.id and pe.user_id <> v_me
    cross join lateral public.class_public_identity(pe.user_id) idn
    join lateral (select x.body, x.sender_id from public.dm_messages x where x.conversation_id = c.id and x.seq = c.last_seq) m on true
   where me.user_id = v_me and c.last_seq > 0
   order by c.last_message_at desc, c.id
   limit v_lim;
end $$;
comment on function public.dm_conversations(int) is 'dm_v1: danh sách hội thoại của mình';
revoke all on function public.dm_conversations(int) from public, anon;
grant execute on function public.dm_conversations(int) to authenticated;

-- Tin trong một hội thoại, phân trang theo seq (luôn trả TĂNG DẦN theo seq).
--   p_after_seq  → các tin seq > p_after_seq (polling: chỉ lấy tin mới)
--   p_before_seq → các tin seq < p_before_seq, lấy p_limit tin MỚI NHẤT trong đó (cuộn lên xem cũ)
--   không truyền → p_limit tin mới nhất
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

-- Đánh dấu đã đọc tới p_seq (chỉ tăng, không vượt tin cuối). Trả last_read_seq mới.
create or replace function public.dm_mark_read(p_conversation uuid, p_seq bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_read bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  update public.dm_participants p
     set last_read_seq = greatest(p.last_read_seq, least(coalesce(p_seq, 0), c.last_seq))
    from public.dm_conversations c
   where p.conversation_id = p_conversation and p.user_id = v_me and c.id = p.conversation_id
  returning p.last_read_seq into v_read;
  if v_read is null then raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002'; end if;
  return v_read;
end $$;
comment on function public.dm_mark_read(uuid, bigint) is 'dm_v1: đánh dấu đã đọc';
revoke all on function public.dm_mark_read(uuid, bigint) from public, anon;
grant execute on function public.dm_mark_read(uuid, bigint) to authenticated;

-- Số hội thoại còn tin chưa đọc (cho badge; một truy vấn nhẹ theo chỉ mục user_id)
create or replace function public.dm_unread_count()
returns int language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null or not public.is_class_member() then return 0; end if;
  return (select count(*)::int from public.dm_participants p
            join public.dm_conversations c on c.id = p.conversation_id
           where p.user_id = auth.uid() and c.last_seq > p.last_read_seq);
end $$;
comment on function public.dm_unread_count() is 'dm_v1: số hội thoại chưa đọc';
revoke all on function public.dm_unread_count() from public, anon;
grant execute on function public.dm_unread_count() to authenticated;

-- N) Bảng — đặt CUỐI và gói trong MỘT câu lệnh: khoá ngoại tới auth.users xin khoá ShareRowExclusive trên auth.users và giữ tới COMMIT;
--    đặt cuối + một câu lệnh = cửa sổ khoá ngắn nhất (hàm ở trên chỉ tham chiếu bảng lúc chạy, không lúc tạo — dm_unread_count là plpgsql vì lý do này).
do $tables$
begin
create table if not exists public.dm_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_lo         uuid not null references auth.users(id) on delete cascade,
  user_hi         uuid not null references auth.users(id) on delete cascade,
  last_seq        bigint not null default 0,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint dm_conversations_pair_order check (user_lo < user_hi)
);
create unique index if not exists dm_conversations_pair_key on public.dm_conversations (user_lo, user_hi);

create table if not exists public.dm_participants (
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  last_read_seq   bigint not null default 0,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists dm_participants_user_idx on public.dm_participants (user_id);

create table if not exists public.dm_messages (
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  seq             bigint not null,
  sender_kind     text not null default 'user',
  sender_id       uuid references auth.users(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, seq),
  constraint dm_messages_sender_kind_check check (sender_kind in ('user', 'mira')),
  constraint dm_messages_sender_check check ((sender_kind = 'user') = (sender_id is not null)),
  constraint dm_messages_body_check check (char_length(body) between 1 and 2000)
);

comment on table public.dm_conversations is 'dm_v1: hội thoại 1-1 chuẩn tắc (user_lo < user_hi)';
comment on table public.dm_participants is 'dm_v1: người tham gia + last_read_seq';
comment on table public.dm_messages is 'dm_v1: tin nhắn text (seq tăng trong hội thoại)';

-- Không ai (kể cả chính chủ) đọc/ghi thẳng bảng: mọi thao tác qua RPC bên dưới.
alter table public.dm_conversations enable row level security;
alter table public.dm_participants enable row level security;
alter table public.dm_messages enable row level security;
revoke all on public.dm_conversations from public, anon, authenticated;
revoke all on public.dm_participants from public, anon, authenticated;
revoke all on public.dm_messages from public, anon, authenticated;
end $tables$;

notify pgrst, 'reload schema';
