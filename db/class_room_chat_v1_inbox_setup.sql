-- CLASS ROOM CHAT V1 — HỘP THƯ V2 (chạy SAU class_room_chat_v1_setup.sql). Thêm loại 'class' (conv_key 'class:<id>') vào nguồn ứng viên DUY NHẤT
-- chat_inbox_base và đếm chat_inbox_summary. chat_inbox / chat_conversation_info / chat_pin_set đọc từ chat_inbox_base nên tự có lớp (lọc, tìm, ghim, đếm).
-- Thay ĐÚNG 2 hàm; thêm khối 'class' sau khối Band (dm + band giữ nguyên từng chữ). Cổng drift: thân hàm hiện hành phải là bản Chat List V2 gốc
-- (hoặc bản này khi chạy lại). Bản gốc được lưu vào tva_private.classchat_v1_backup để rollback khôi phục NGUYÊN VĂN.
-- File KHÔNG có begin/commit. Idempotent.

do $gate$
declare v_base text; v_sum text;
begin
  if to_regprocedure('public.chat_inbox_base(text)') is null or to_regprocedure('public.chat_inbox_summary()') is null
     or to_regprocedure('public.classchat_access(uuid)') is null then
    raise exception 'DỪNG — thiếu Chat List V2 hoặc Class Room Chat V1';
  end if;
  select md5(prosrc) into v_base from pg_proc where oid = 'public.chat_inbox_base(text)'::regprocedure;
  select md5(prosrc) into v_sum from pg_proc where oid = 'public.chat_inbox_summary()'::regprocedure;
  -- gốc (Chat List V2) hoặc đã áp bản này (chạy lại): bản mới có khối 'class' nên prosrc chứa classchat_access
  if not (v_base = 'ceb4a45a62508f04864c3030f9e63bd8' or exists (select 1 from pg_proc where oid = 'public.chat_inbox_base(text)'::regprocedure and prosrc like '%classchat_access%'))
     or not (v_sum = '5333ce78a8d0dc6edbc4c72385208b3e' or exists (select 1 from pg_proc where oid = 'public.chat_inbox_summary()'::regprocedure and prosrc like '%''class''%')) then
    raise exception 'DỪNG — chat_inbox_base/summary trên production khác repo (base %, summary %) — KHÔNG migration', v_base, v_sum;
  end if;
end $gate$;

create table if not exists tva_private.classchat_v1_backup (fn text primary key, def text not null, saved_at timestamptz not null default now());
revoke all on tva_private.classchat_v1_backup from public, anon, authenticated;
insert into tva_private.classchat_v1_backup (fn, def)
select 'public.' || p.proname, pg_get_functiondef(p.oid) from pg_proc p
 where p.oid in ('public.chat_inbox_base(text)'::regprocedure, 'public.chat_inbox_summary()'::regprocedure)
   and md5(p.prosrc) in ('ceb4a45a62508f04864c3030f9e63bd8', '5333ce78a8d0dc6edbc4c72385208b3e')
on conflict (fn) do nothing;

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

  return query
  select 'class:' || c.class_id::text, 'class'::text, null::uuid, coalesce(nullif(btrim(cs.name), ''), cs.code, r.name_snapshot, 'Lớp đã xoá'), null::text,
         null::text, null::uuid, null::text, null::text,
         coalesce(r.last_seq, 0), left(lm.body, 160),
         (select i.name from public.class_public_identity(lm.sender_id) i where lm.sender_id is not null),
         (lm.sender_id = v_me), r.last_message_at, coalesce(r.last_message_at, 'epoch'::timestamptz),
         case when me.user_id is not null then
           greatest(coalesce(r.last_seq, 0) - coalesce(rd.last_read_seq,
             (select coalesce(max(x.seq), 0) from public.classchat_messages x where x.class_id = c.class_id and x.created_at <= coalesce(me.joined_at, now()))), 0)::int
         else 0 end,
         (select count(*)::int from tva_private.class_memberships k where k.class_id = c.class_id),
         (acc.a = 'send'), (coalesce(cs.status, '') in ('draft', 'cancelled', 'merged')), (me.user_id is null)
    from (select m0.class_id from tva_private.class_memberships m0 where p_scope = 'mine' and m0.user_id = v_me
          union select rr.class_id from public.classchat_rooms rr where p_scope = 'support' and rr.last_seq > 0) c
    cross join lateral (select public.classchat_access(c.class_id) a) acc
    left join public.class_schedule cs on cs.id = c.class_id
    left join public.classchat_rooms r on r.class_id = c.class_id
    left join tva_private.class_memberships me on me.class_id = c.class_id and me.user_id = v_me
    left join public.classchat_reads rd on rd.class_id = c.class_id and rd.user_id = v_me
    left join lateral (select x.body, x.sender_id from public.classchat_messages x where x.class_id = c.class_id and x.seq = r.last_seq) lm on true
   where acc.a is not null and (cs.id is not null or r.class_id is not null)
     and (p_scope = 'mine' and me.user_id is not null or p_scope = 'support' and me.user_id is null);
end $$;
comment on function public.chat_inbox_base(text) is 'chat_list_v2 + classchat_v1: ứng viên danh sách (nội bộ)';

create or replace function public.chat_inbox_summary()
returns table(dm_total int, band_total int, class_total int, unread_dm int, unread_band int, unread_class int, pinned_total int, support_total int)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  return query
  select (count(*) filter (where b.kind = 'dm'))::int, (count(*) filter (where b.kind = 'band'))::int, (count(*) filter (where b.kind = 'class'))::int,
         (count(*) filter (where b.kind = 'dm' and b.unread > 0))::int, (count(*) filter (where b.kind = 'band' and b.unread > 0))::int, (count(*) filter (where b.kind = 'class' and b.unread > 0))::int,
         (count(*) filter (where pn.conv_key is not null))::int,
         (select count(*)::int from public.chat_inbox_base('support'))
    from public.chat_inbox_base('mine') b
    left join public.chat_pins pn on pn.user_id = v_me and pn.conv_key = b.conv_key;
end $$;
comment on function public.chat_inbox_summary() is 'chat_list_v2 + classchat_v1: tổng số hội thoại theo loại';

notify pgrst, 'reload schema';
