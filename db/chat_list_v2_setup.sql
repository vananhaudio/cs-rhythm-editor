-- CHAT LIST V2 — danh sách Trò chuyện: phân trang bằng con trỏ, tìm kiếm phía server, lọc theo loại/chưa đọc, ghim đồng bộ theo tài khoản.
-- Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit). Idempotent, ADDITIVE:
--   • 1 bảng mới chat_pins (RLS bật, 0 grant, 0 policy → client không CRUD thẳng; không CREATE POLICY ⇒ không dính khoá policy_grants).
--   • Hàm mới tiền tố chat_*; KHÔNG sửa dm_*, bandchat_*, teamlab_*, class_public_identity, bảng/hàm/policy nào đang có.
-- Nguyên tắc:
--   • MỘT nguồn ứng viên: chat_inbox_base(scope) (nội bộ). Quyền dùng đúng luật cũ: dm = người tham gia + chưa chặn nhau (class_ugc_pair_blocked) +
--     is_class_member(); Band = bandchat_access() (thành viên / lưu trữ / Thầy). Tìm kiếm, lọc, đếm, ghim đều đi qua nguồn này nên KHÔNG thể lộ
--     hội thoại người gọi không có quyền thấy.
--   • scope 'mine' = DM + Band mình là thành viên (hoặc từng là lúc lưu trữ). scope 'support' = Band mình KHÔNG thuộc, chỉ Thầy/Admin (người khác → rỗng).
--   • Phân trang keyset theo (sort_at giảm dần, conv_key tăng dần): ổn định khi có tin mới, không bỏ sót/lặp, không trần 50/100.
--   • Tìm kiếm theo tên hội thoại (tên bạn / tên Band), không phân biệt hoa-thường và dấu tiếng Việt (chat_fold).
--   • Ghim: tối đa 10 hội thoại/người; chỉ ghim được hội thoại mình đang thấy; bỏ ghim luôn được.
--   • conv_key: DM = uuid hội thoại · Band = 'band:<uuid>' (khớp id hội thoại ở frontend) · chỗ sẵn cho 'class:<uuid>' (chưa dùng).

-- 0) Cổng drift
do $gate$
declare v_name text;
begin
  if to_regprocedure('public.dm_rule(uuid,uuid)') is null or to_regprocedure('public.class_public_identity(uuid)') is null
     or to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null or to_regprocedure('public.bandchat_access(uuid)') is null
     or to_regprocedure('public.is_class_member()') is null or to_regprocedure('public.is_teacher()') is null
     or to_regclass('public.bandchat_rooms') is null or to_regclass('public.dm_conversations') is null then
    raise exception 'DỪNG — thiếu nền (dm_v1, Band Chat V1, class_ugc_safety_v1, is_teacher)';
  end if;
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'chat_pins' and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'chat_list_v2:%'
  loop raise exception 'DỪNG — đã có bảng % không thuộc Chat List V2', v_name; end loop;
  for v_name in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('chat_fold', 'chat_inbox_base', 'chat_inbox', 'chat_inbox_summary', 'chat_conversation_info', 'chat_pin_set')
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'chat_list_v2:%'
  loop raise exception 'DỪNG — đã có hàm % không thuộc Chat List V2', v_name; end loop;
end $gate$;

-- 1) Ghim (đồng bộ web ↔ app theo tài khoản)
create table if not exists public.chat_pins (
  user_id   uuid not null references auth.users(id) on delete cascade,
  conv_key  text not null check (conv_key ~ '^((band|class):)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  pinned_at timestamptz not null default now(),
  primary key (user_id, conv_key)
);
comment on table public.chat_pins is 'chat_list_v2: hội thoại người dùng chủ động ghim (tối đa 10/người)';
alter table public.chat_pins enable row level security;
revoke all on public.chat_pins from public, anon, authenticated;

-- 2) Gấp dấu để tìm kiếm: bỏ dấu tiếng Việt (cả HOA/thường, không phụ thuộc locale của DB) rồi hạ chữ thường (thuần SQL, immutable; không cần extension)
create or replace function public.chat_fold(p_text text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select lower(translate(coalesce(p_text, ''),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'))
$$;
comment on function public.chat_fold(text) is 'chat_list_v2: chữ thường + bỏ dấu tiếng Việt (so khớp tìm kiếm)';
revoke all on function public.chat_fold(text) from public, anon;
grant execute on function public.chat_fold(text) to authenticated;

-- 3) Nguồn ứng viên DUY NHẤT (nội bộ — client không gọi được). Cùng luật quyền với dm_conversations / bandchat_rooms.
create or replace function public.chat_inbox_base(p_scope text)
returns table(conv_key text, kind text, peer_id uuid, name text, avatar_url text, cover_path text, project_id uuid, project_avatar_path text,
              peer_role text, last_seq bigint, last_body text, last_sender_name text, last_mine boolean, last_at timestamptz, sort_at timestamptz,
              unread int, member_count int, can_send boolean, archived boolean, support boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_teacher boolean;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  if p_scope is null or p_scope not in ('mine', 'support') then raise exception 'scope không hợp lệ' using errcode = '22023'; end if;
  v_teacher := public.is_teacher();
  if p_scope = 'support' and not v_teacher then return; end if;

  if p_scope = 'mine' and public.is_class_member() then
    return query
    select c.id::text, 'dm'::text, pe.user_id, coalesce(nullif(btrim(idn.name), ''), 'Thành viên Class'), idn.avatar_url,
           null::text, null::uuid, null::text, idn.role,
           c.last_seq, left(m.body, 160), null::text, (m.sender_id = v_me), c.last_message_at, coalesce(c.last_message_at, 'epoch'::timestamptz),
           greatest(c.last_seq - me.last_read_seq, 0)::int, 2, public.dm_rule(v_me, pe.user_id), false, false
      from public.dm_participants me
      join public.dm_conversations c on c.id = me.conversation_id
      join public.dm_participants pe on pe.conversation_id = c.id and pe.user_id <> v_me
      cross join lateral public.class_public_identity(pe.user_id) idn
      join lateral (select x.body, x.sender_id from public.dm_messages x where x.conversation_id = c.id and x.seq = c.last_seq) m on true
     where me.user_id = v_me and c.last_seq > 0
       and not public.class_ugc_pair_blocked(v_me, pe.user_id);
  end if;

  return query
  select 'band:' || c.band_id::text, 'band'::text, null::uuid, coalesce(b.name, r.name_snapshot, 'Band đã xoá'), null::text,
         b.cover_path, p.id, p.avatar_path, null::text,
         coalesce(r.last_seq, 0), left(lm.body, 160),
         (select i.name from public.class_public_identity(lm.sender_id) i where lm.sender_id is not null),
         (lm.sender_id = v_me), r.last_message_at, coalesce(r.last_message_at, 'epoch'::timestamptz),
         case when mem.is_member then
           greatest(coalesce(r.last_seq, 0) - coalesce(rd.last_read_seq,
             (select coalesce(max(x.seq), 0) from public.bandchat_messages x where x.band_id = c.band_id and x.created_at <= coalesce(me.created_at, now()))), 0)::int
         else 0 end,
         (select count(*)::int from public.teamlab_band_members k where k.band_id = c.band_id),
         (acc.a = 'send'), (r.archived_at is not null), not mem.is_member
    from (select m0.band_id from public.teamlab_band_members m0 where p_scope = 'mine' and m0.user_id = v_me
          union select f.band_id from public.bandchat_frozen f where p_scope = 'mine' and f.user_id = v_me
          union select tb.id from public.teamlab_bands tb where p_scope = 'support'
          union select rr.band_id from public.bandchat_rooms rr where p_scope = 'support' and rr.last_seq > 0) c
    cross join lateral (select public.bandchat_access(c.band_id) a) acc
    left join public.teamlab_bands b on b.id = c.band_id
    left join public.projects p on p.id = b.project_id
    left join public.bandchat_rooms r on r.band_id = c.band_id
    left join public.teamlab_band_members me on me.band_id = c.band_id and me.user_id = v_me
    left join public.bandchat_reads rd on rd.band_id = c.band_id and rd.user_id = v_me
    cross join lateral (select (me.user_id is not null or exists (select 1 from public.bandchat_frozen f2 where f2.band_id = c.band_id and f2.user_id = v_me)) is_member) mem
    left join lateral (select x.body, x.sender_id from public.bandchat_messages x where x.band_id = c.band_id and x.seq = r.last_seq) lm on true
   where acc.a is not null
     and (p_scope = 'mine' and mem.is_member or p_scope = 'support' and not mem.is_member);
end $$;
comment on function public.chat_inbox_base(text) is 'chat_list_v2: ứng viên danh sách (nội bộ)';
revoke all on function public.chat_inbox_base(text) from public, anon, authenticated;

-- 4) Danh sách có con trỏ + tìm kiếm + lọc. p_pinned: 'exclude' (mặc định) | 'only' (mục Đã ghim, không phân trang) | 'any' (tìm kiếm)
create or replace function public.chat_inbox(
  p_scope text default 'mine', p_kind text default 'all', p_query text default null, p_unread boolean default false,
  p_pinned text default 'exclude', p_limit int default 30, p_cursor_at timestamptz default null, p_cursor_key text default null)
returns table(conv_key text, kind text, peer_id uuid, name text, avatar_url text, cover_path text, project_id uuid, project_avatar_path text,
              peer_role text, last_seq bigint, last_body text, last_sender_name text, last_mine boolean, last_at timestamptz, sort_at timestamptz,
              unread int, member_count int, can_send boolean, archived boolean, support boolean, pinned boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 50);
        v_q text := nullif(btrim(public.chat_fold(p_query)), '');
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  if coalesce(p_kind, 'all') not in ('all', 'dm', 'band', 'class') then raise exception 'kind không hợp lệ' using errcode = '22023'; end if;
  if coalesce(p_pinned, 'exclude') not in ('exclude', 'only', 'any') then raise exception 'pinned không hợp lệ' using errcode = '22023'; end if;
  if v_q is not null then v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select b.conv_key, b.kind, b.peer_id, b.name, b.avatar_url, b.cover_path, b.project_id, b.project_avatar_path, b.peer_role,
         b.last_seq, b.last_body, b.last_sender_name, b.last_mine, b.last_at, b.sort_at, b.unread, b.member_count, b.can_send, b.archived, b.support,
         (pn.conv_key is not null)
    from public.chat_inbox_base(p_scope) b
    left join public.chat_pins pn on pn.user_id = v_me and pn.conv_key = b.conv_key
   where (coalesce(p_kind, 'all') = 'all' or b.kind = p_kind)
     and (not coalesce(p_unread, false) or b.unread > 0)
     and (v_q is null or public.chat_fold(b.name) like v_q escape '\')
     and (case coalesce(p_pinned, 'exclude') when 'only' then pn.conv_key is not null when 'exclude' then pn.conv_key is null else true end)
     and (coalesce(p_pinned, 'exclude') = 'only' or p_cursor_at is null or p_cursor_key is null
          or b.sort_at < p_cursor_at or (b.sort_at = p_cursor_at and b.conv_key > p_cursor_key))
   order by (case when p_pinned = 'only' then pn.pinned_at end) desc nulls last, b.sort_at desc, b.conv_key
   limit v_lim;
end $$;
comment on function public.chat_inbox(text, text, text, boolean, text, int, timestamptz, text) is 'chat_list_v2: danh sách hội thoại có con trỏ/tìm kiếm/lọc/ghim';
revoke all on function public.chat_inbox(text, text, text, boolean, text, int, timestamptz, text) from public, anon;
grant execute on function public.chat_inbox(text, text, text, boolean, text, int, timestamptz, text) to authenticated;

-- 5) Tổng số theo loại (cho bộ lọc, trạng thái trống, mục Quản lý Band của Thầy/Admin)
create or replace function public.chat_inbox_summary()
returns table(dm_total int, band_total int, class_total int, unread_dm int, unread_band int, unread_class int, pinned_total int, support_total int)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  return query
  select (count(*) filter (where b.kind = 'dm'))::int, (count(*) filter (where b.kind = 'band'))::int, 0,
         (count(*) filter (where b.kind = 'dm' and b.unread > 0))::int, (count(*) filter (where b.kind = 'band' and b.unread > 0))::int, 0,
         (count(*) filter (where pn.conv_key is not null))::int,
         (select count(*)::int from public.chat_inbox_base('support'))
    from public.chat_inbox_base('mine') b
    left join public.chat_pins pn on pn.user_id = v_me and pn.conv_key = b.conv_key;
end $$;
comment on function public.chat_inbox_summary() is 'chat_list_v2: tổng số hội thoại theo loại';
revoke all on function public.chat_inbox_summary() from public, anon;
grant execute on function public.chat_inbox_summary() to authenticated;

-- 6) Thông tin MỘT hội thoại (liên kết trực tiếp tới hội thoại ngoài trang đang tải; Band ở chế độ hỗ trợ của Thầy/Admin)
create or replace function public.chat_conversation_info(p_key text)
returns table(conv_key text, kind text, peer_id uuid, name text, avatar_url text, cover_path text, project_id uuid, project_avatar_path text,
              peer_role text, last_seq bigint, last_body text, last_sender_name text, last_mine boolean, last_at timestamptz, sort_at timestamptz,
              unread int, member_count int, can_send boolean, archived boolean, support boolean, pinned boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  return query
  select b.conv_key, b.kind, b.peer_id, b.name, b.avatar_url, b.cover_path, b.project_id, b.project_avatar_path, b.peer_role,
         b.last_seq, b.last_body, b.last_sender_name, b.last_mine, b.last_at, b.sort_at, b.unread, b.member_count, b.can_send, b.archived, b.support,
         (pn.conv_key is not null)
    from (select * from public.chat_inbox_base('mine') union all select * from public.chat_inbox_base('support')) b
    left join public.chat_pins pn on pn.user_id = v_me and pn.conv_key = b.conv_key
   where b.conv_key = p_key
   limit 1;
end $$;
comment on function public.chat_conversation_info(text) is 'chat_list_v2: thông tin một hội thoại mình được thấy';
revoke all on function public.chat_conversation_info(text) from public, anon;
grant execute on function public.chat_conversation_info(text) to authenticated;

-- 7) Ghim / bỏ ghim (idempotent). Trả về số hội thoại đang ghim.
create or replace function public.chat_pin_set(p_key text, p_pinned boolean)
returns int language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_n int;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  if p_key is null or p_pinned is null then raise exception 'Thiếu tham số' using errcode = '22023'; end if;
  if p_pinned then
    if not exists (select 1 from public.chat_inbox_base('mine') b where b.conv_key = p_key) then
      raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('chat_pins:' || v_me::text, 0));
    if not exists (select 1 from public.chat_pins where user_id = v_me and conv_key = p_key)
       and (select count(*) from public.chat_pins where user_id = v_me) >= 10 then
      raise exception 'Chỉ ghim tối đa 10 cuộc trò chuyện' using errcode = '54000';
    end if;
    insert into public.chat_pins (user_id, conv_key, pinned_at) values (v_me, p_key, clock_timestamp()) on conflict do nothing;
  else
    delete from public.chat_pins where user_id = v_me and conv_key = p_key;
  end if;
  select count(*)::int into v_n from public.chat_pins where user_id = v_me;
  return v_n;
end $$;
comment on function public.chat_pin_set(text, boolean) is 'chat_list_v2: ghim/bỏ ghim hội thoại';
revoke all on function public.chat_pin_set(text, boolean) from public, anon;
grant execute on function public.chat_pin_set(text, boolean) to authenticated;
