-- PLAY SCROLL SHARE V1 — chia sẻ một PHIÊN BẢN hợp âm đã duyệt (approved) lên tường /me và qua DM. Chạy bằng scripts/prod-db.py (một transaction; KHÔNG begin/commit).
-- Họ B của Universal Share (reference-only): tin DM / bài Feed chỉ mang THAM CHIẾU version_id; quyền đọc do chord_sheet_get quyết ở máy chủ.
--   (1) dm_messages.ref_type thêm 'chord_sheet' (ref_key = chord_sheet_versions.id).
--   (2) dm_share: nhánh 'chord_sheet' — người gửi phải qua chordlib_can('search'); bản phải approved và bài chưa lưu trữ.
--   (3) chord_share_card(uuid[]): metadata công khai cho thẻ (tên, tác giả, nhịp, BPM, có vạch nhịp) — CHỈ bản approved; KHÔNG trả lời/hợp âm.
--   (4) social_share_chord_sheet(uuid): đăng tường = đúng MỘT bài Feed (class_posts type 'tool_share', tool 'chord_sheet'); idempotent theo (người đăng, phiên bản).
-- KHÔNG đổi: dm_rule/dm_open/dm_append, các nhánh tool_artifact/class/class_session của dm_share, class_posts CHECK, chord_* RPC hiện có, RLS. Không bảng mới, không policy mới.

do $gate$
declare v_md5 text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.dm_share(uuid,text,text)')); v_chk text;
begin
  if v_md5 is distinct from '512d95a7b6d3e82977b37958080bba9f' then raise exception 'DỪNG — dm_share khác baseline LIVE: %', v_md5; end if;
  select pg_get_constraintdef(c.oid) into v_chk from pg_constraint c where c.conrelid = 'public.dm_messages'::regclass and c.conname = 'dm_messages_ref_valid_check';
  if v_chk is null or v_chk not like '%class_session%' or v_chk like '%chord_sheet%' then raise exception 'DỪNG — dm_messages_ref_valid_check khác baseline: %', v_chk; end if;
  if to_regprocedure('public.chordlib_can(text)') is null or to_regprocedure('public.is_class_member()') is null
     or to_regprocedure('public.dm_open(uuid,uuid)') is null or to_regclass('public.chord_sheet_versions') is null or to_regclass('public.chord_sheets') is null then
    raise exception 'DỪNG — thiếu nền (chordlib_can, is_class_member, dm_open, chord_sheet*)';
  end if;
  if to_regprocedure('public.chord_share_card(uuid[])') is not null or to_regprocedure('public.social_share_chord_sheet(uuid)') is not null then
    raise exception 'DỪNG — hàm chord share đã tồn tại';
  end if;
end $gate$;

-- 1) Loại tham chiếu
alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
alter table public.dm_messages add constraint dm_messages_ref_valid_check check (
  ref_type is null or (ref_type in ('tool_artifact', 'class', 'class_session', 'chord_sheet')
                       and ref_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));

-- 2) Điều kiện chia sẻ: bản approved + bài chưa lưu trữ + người gọi có quyền tìm hợp âm
create or replace function public.chord_share_ok(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.chordlib_can('search') and exists (
    select 1 from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
     where v.id = p_version and v.review_status = 'approved' and s.archived_at is null);
$$;
comment on function public.chord_share_ok(uuid) is 'chord_share_v1: phiên bản approved, chưa lưu trữ, người gọi có quyền search';
revoke all on function public.chord_share_ok(uuid) from public, anon;
grant execute on function public.chord_share_ok(uuid) to authenticated;

-- 3) dm_share: thêm nhánh chord_sheet, giữ nguyên ba nhánh cũ
create or replace function public.dm_share(p_user uuid, p_ref_type text, p_ref_key text)
returns table(conversation_id uuid, seq bigint) language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_key text := lower(coalesce(p_ref_key, '')); v_conv uuid; v_seq bigint; v_ok boolean := false;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not public.dm_rule(v_me, p_user) then raise exception 'Bạn chưa thể nhắn tin cho người này' using errcode = '42501'; end if;
  if v_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if p_ref_type = 'tool_artifact' then
      v_ok := exists (select 1 from public.tool_artifacts a
                       where a.id = v_key::uuid and ((a.tool = 'bms' and a.kind = 'song') or (a.tool = 'nhipphach' and a.kind = 'score'))
                         and (a.owner_id = v_me or a.visibility = 'class'));
    elsif p_ref_type = 'class' then
      v_ok := exists (select 1 from public.class_schedule c where c.id = v_key::uuid)
              and (public.is_teacher() or public.social_class_is_member(v_key::uuid, v_me));
    elsif p_ref_type = 'class_session' then
      v_ok := exists (select 1 from public.class_sessions s where s.id = v_key::uuid and s.event_type = 'lesson'
                       and (public.is_teacher() or public.social_class_is_member(s.class_id, v_me)));
    elsif p_ref_type = 'chord_sheet' then
      v_ok := public.chord_share_ok(v_key::uuid);
    end if;
  end if;
  if not v_ok then raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023'; end if;
  v_conv := public.dm_open(v_me, p_user);
  v_seq := public.dm_append(v_conv, v_me, null, p_ref_type, v_key);
  return query select v_conv, v_seq;
end $$;
comment on function public.dm_share(uuid, text, text) is 'universal_share_v1 + chord_share_v1: chia sẻ tham chiếu (artifact | lớp | buổi học | hợp âm) cho bạn';
revoke all on function public.dm_share(uuid, text, text) from public, anon;
grant execute on function public.dm_share(uuid, text, text) to authenticated;

-- 4) Metadata thẻ (theo lô). Bản không approved / đã lưu trữ → không có hàng (thẻ "không còn khả dụng").
create or replace function public.chord_share_card(p_ids uuid[])
returns table(version_id uuid, title text, composer text, meter jsonb, bpm integer, has_anchors boolean)
language sql stable security definer set search_path = '' as $$
  select v.id, s.title, s.composer, v.meter, v.suggested_bpm, v.anchors is not null
    from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
   where v.id = any (p_ids[1:50]) and public.chord_share_ok(v.id);
$$;
comment on function public.chord_share_card(uuid[]) is 'chord_share_v1: metadata thẻ của bản approved (không lời/hợp âm)';
revoke all on function public.chord_share_card(uuid[]) from public, anon;
grant execute on function public.chord_share_card(uuid[]) to authenticated;

-- 5) Đăng tường: một bài Feed cho (người đăng, phiên bản). Payload chỉ tham chiếu + tóm tắt công khai.
create or replace function public.social_share_chord_sheet(p_version uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_post uuid; v_title text; v_composer text; v_meter jsonb; v_bpm int; v_anch boolean; v_payload jsonb;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  if p_version is null or not public.chord_share_ok(p_version) then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || ':chord:' || p_version::text, 23));
  select p.id into v_post from public.class_posts p
   where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'tool' = 'chord_sheet' and p.tool_share ->> 'version_id' = p_version::text
   order by p.created_at limit 1;
  if v_post is not null then return v_post; end if;
  if (select count(*) from public.class_posts p where p.author_user_id = v_me and p.type = 'tool_share' and p.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.' using errcode = '54000';
  end if;
  select s.title, s.composer, v.meter, v.suggested_bpm, v.anchors is not null into v_title, v_composer, v_meter, v_bpm, v_anch
    from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = p_version;
  v_payload := jsonb_build_object('v', 1, 'tool', 'chord_sheet', 'kind', 'chord_sheet', 'version_id', p_version::text,
    'title', left(v_title, 120), 'composer', left(coalesce(v_composer, ''), 120), 'meter', v_meter, 'bpm', v_bpm, 'has_anchors', v_anch);
  insert into public.class_posts (author_user_id, type, audience, body, tool_share)
  values (v_me, 'tool_share', 'class', '', v_payload) returning id into v_post;
  return v_post;
end $$;
comment on function public.social_share_chord_sheet(uuid) is 'chord_share_v1: đăng một phiên bản hợp âm approved lên tường (một bài mỗi người mỗi phiên bản)';
revoke all on function public.social_share_chord_sheet(uuid) from public, anon;
grant execute on function public.social_share_chord_sheet(uuid) to authenticated;

notify pgrst, 'reload schema';
