-- CLASS UNIVERSAL SHARE V1 — mở rộng Share (Chat DM + Cộng đồng) sang nhiều object Class bằng MỘT hợp đồng nhỏ. Chạy bằng scripts/prod-db.py (một transaction; KHÔNG begin/commit).
-- Nguyên tắc: Object ≠ nơi phân phối object. Chat chỉ mang THAM CHIẾU; quyền xem do CHÍNH object quyết (RLS/RPC của object).
--   (1) ARTIFACT (private-grant, vòng đời local→shared→class→shared): tool_artifacts, BMS đã LIVE; thêm Nhịp & Phách (tool='nhipphach', kind='score').
--       tool_artifact_save_for_share(tool, payload) = lưu riêng idempotent theo (chủ bài, nội dung) — GOM logic, bms_save_for_share thành lớp bọc mỏng.
--       social_publish_tool_artifact / social_unpublish_tool_artifact nhận cả hai tool (payload Feed theo tool). RLS + dm_artifact_granted + demote_or_delete
--       vốn đã không phụ thuộc tool → KHÔNG đổi.
--   (2) ĐỐI TƯỢNG CÓ QUYỀN RIÊNG (chỉ tham chiếu, KHÔNG tạo artifact, KHÔNG cấp quyền): 'class' (class_schedule.id) và 'class_session' (class_sessions.id,
--       buổi học 'lesson'). dm_share chỉ kiểm NGƯỜI GỬI có quyền với object (thành viên lớp hoặc Thầy); người nhận mở bằng quyền hiện có của họ — không đủ quyền
--       thì trang đích tự chặn (card chỉ hiện metadata công khai: tên lớp / số buổi).
-- KHÔNG đổi: dm_rule/dm_append/dm_messages/dm_open, dm_artifact_granted, policy tool_artifacts_read, tool_artifact_demote_or_delete, trigger Feed,
--   social_delete_tool_artifact, social_share_tool_result, friendship. Không CREATE POLICY, không FK mới → không khoá auth.users.

-- 0) Cổng drift
do $gate$
declare
  v_save text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.bms_save_for_share(jsonb)'));
  v_pub text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.social_publish_tool_artifact(uuid)'));
  v_unp text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.social_unpublish_tool_artifact(uuid)'));
  v_dms text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.dm_share(uuid,text,text)'));
  v_new oid := to_regprocedure('public.tool_artifact_save_for_share(text,jsonb)');
  v_fns text; v_chk text;
begin
  if to_regprocedure('public.dm_artifact_granted(uuid)') is null or to_regprocedure('public.tool_artifact_demote_or_delete(uuid,uuid)') is null
     or to_regprocedure('public.nhipphach_musicxml_check(text)') is null or to_regprocedure('public.nhipphach_settings_normalize(jsonb)') is null
     or to_regprocedure('public.bms_song_normalize(jsonb)') is null or to_regprocedure('public.social_class_is_member(uuid,uuid)') is null
     or to_regclass('public.class_sessions') is null or to_regclass('public.class_schedule') is null then
    raise exception 'DỪNG — thiếu nền (BMS Share Lifecycle, nhipphach_*, social_class_is_member, class_sessions)';
  end if;
  select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname collate "C") into v_fns from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('dm_append', 'dm_messages', 'dm_open', 'dm_rule', 'dm_artifact_granted', 'tool_artifact_demote_or_delete', 'social_delete_tool_artifact', 'social_share_tool_result', 'tool_artifacts_cleanup_on_post_delete');
  if v_fns is distinct from 'dm_append=00aefca4,dm_artifact_granted=493924c7,dm_messages=0605c799,dm_open=7cdcea48,dm_rule=763d62ac,social_delete_tool_artifact=cbcac728,social_share_tool_result=932a8b04,tool_artifact_demote_or_delete=07145b4a,tool_artifacts_cleanup_on_post_delete=d2e889ae' then
    raise exception 'DỪNG — hàm nền khác baseline: %', v_fns;
  end if;
  if v_new is null then
    if v_save is distinct from 'fe706f70edaba2ebca04595c2aab63d4' or v_pub is distinct from 'e64c08ef0cb62b1fcc8ae37837e6d5e8'
       or v_unp is distinct from '94707899924be03dd5234aa88b4a9718' or v_dms is distinct from '120fe4b6498d4176dfa93907c859c6e9' then
      raise exception 'DỪNG — hàm lifecycle/dm_share khác baseline LIVE (save %, publish %, unpublish %, dm_share %)', v_save, v_pub, v_unp, v_dms;
    end if;
    select pg_get_constraintdef(c.oid) into v_chk from pg_constraint c where c.conrelid = 'public.dm_messages'::regclass and c.conname = 'dm_messages_ref_valid_check';
    if v_chk is null or v_chk not like '%tool_artifact%' then raise exception 'DỪNG — dm_messages_ref_valid_check khác baseline: %', v_chk; end if;
  elsif coalesce(obj_description(v_new, 'pg_proc'), '') not like 'universal_share_v1:%' then
    raise exception 'DỪNG — tool_artifact_save_for_share đã có nhưng không thuộc Universal Share';
  end if;
end $gate$;

-- 1) Loại tham chiếu được phép trong tin Chat (ref_key vẫn là uuid)
alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
alter table public.dm_messages add constraint dm_messages_ref_valid_check check (
  ref_type is null or (ref_type in ('tool_artifact', 'class', 'class_session')
                       and ref_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));

-- 2) Lưu RIÊNG một artifact (BMS | Nhịp & Phách): idempotent theo (chủ bài, tool, nội dung chuẩn hoá + MusicXML). Có sẵn (shared hoặc class) → dùng lại.
create or replace function public.tool_artifact_save_for_share(p_tool text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_kind text; v_norm jsonb; v_title text; v_content text; v_composer text; v_meta jsonb; v_set jsonb; v_id uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  case p_tool
    when 'bms' then
      v_kind := 'song';
      v_norm := public.bms_song_normalize(p_payload);
      if v_norm is null or pg_column_size(v_norm) > 65536 then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
      v_title := v_norm ->> 'title';
    when 'nhipphach' then
      v_kind := 'score';
      if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
      v_title := btrim(coalesce(p_payload ->> 'title', ''));
      v_composer := nullif(btrim(coalesce(p_payload ->> 'composer', '')), '');
      v_content := p_payload ->> 'musicxml';
      v_meta := public.nhipphach_musicxml_check(v_content);
      v_set := public.nhipphach_settings_normalize(p_payload -> 'settings');
      if char_length(v_title) not between 1 and 120 or char_length(coalesce(v_composer, '')) > 120 or v_meta is null or v_set is null then
        raise exception 'TS_BAD_RESULT' using errcode = '22023';
      end if;
      v_norm := jsonb_build_object('schema', 'nhipphach.score', 'v', 1, 'title', v_title, 'composer', v_composer, 'meter', v_meta -> 'meter', 'settings', v_set);
    else
      raise exception 'TS_UNKNOWN_TOOL' using errcode = '22023';
  end case;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || ':' || p_tool || ':' || md5(v_norm::text || coalesce(v_content, '')), 21));
  select a.id into v_id from public.tool_artifacts a
   where a.owner_id = v_me and a.tool = p_tool and a.kind = v_kind and a.data = v_norm and a.content is not distinct from v_content
   order by a.created_at, a.id limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.tool_artifacts a where a.owner_id = v_me and a.visibility = 'shared' and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Bạn lưu quá nhiều bài trong thời gian ngắn. Hãy chờ một chút.' using errcode = '54000';
  end if;
  insert into public.tool_artifacts (owner_id, tool, kind, schema_version, title, data, visibility, client_key, content, content_sha256)
  values (v_me, p_tool, v_kind, 1, v_title, v_norm, 'shared', gen_random_uuid(), v_content,
          case when v_content is not null then encode(sha256(convert_to(v_content, 'UTF8')), 'hex') end)
  returning id into v_id;
  return v_id;
end $$;
comment on function public.tool_artifact_save_for_share(text, jsonb) is 'universal_share_v1: lưu riêng artifact (bms|nhipphach), idempotent theo nội dung';
revoke all on function public.tool_artifact_save_for_share(text, jsonb) from public, anon;
grant execute on function public.tool_artifact_save_for_share(text, jsonb) to authenticated;

-- bms_save_for_share (LIVE) → lớp bọc mỏng, cùng hành vi
create or replace function public.bms_save_for_share(p_song jsonb)
returns uuid language sql security definer set search_path = '' as $$
  select public.tool_artifact_save_for_share('bms', p_song);
$$;
comment on function public.bms_save_for_share(jsonb) is 'bms_share_v1: lưu riêng bài BMS (lớp bọc của tool_artifact_save_for_share)';
revoke all on function public.bms_save_for_share(jsonb) from public, anon;
grant execute on function public.bms_save_for_share(jsonb) to authenticated;

-- 3) ĐĂNG cộng đồng: promote chính artifact + MỘT bài Feed (payload theo tool)
create or replace function public.social_publish_tool_artifact(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); a public.tool_artifacts%rowtype; v_post uuid; v_payload jsonb;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_id::text, ''), 22));
  select * into a from public.tool_artifacts t
   where t.id = p_id and t.owner_id = v_me and ((t.tool = 'bms' and t.kind = 'song') or (t.tool = 'nhipphach' and t.kind = 'score')) for update;
  if not found then raise exception 'TS_NOT_OWNER' using errcode = '42501'; end if;
  select p.id into v_post from public.class_posts p
   where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'artifact_id' = p_id::text;
  if v_post is not null then
    if a.visibility <> 'class' then update public.tool_artifacts set visibility = 'class' where id = p_id; end if;
    return v_post;
  end if;
  if a.visibility <> 'class' then update public.tool_artifacts set visibility = 'class' where id = p_id; end if;
  if a.tool = 'bms' then
    v_payload := jsonb_build_object('v', 1, 'tool', 'bms', 'kind', 'song', 'artifact_id', a.id::text,
      'title', a.data ->> 'title', 'video_id', a.data ->> 'video_id',
      'bpm', round((a.data -> 'fit' ->> 'bpm')::numeric)::int, 'beats_per_bar', (a.data ->> 'time_signature')::int,
      'chord_count', (select count(distinct e ->> 'name') from jsonb_array_elements(a.data -> 'chords') e)::int,
      'client_key', a.client_key::text);
  else
    v_payload := jsonb_build_object('v', 1, 'tool', 'nhipphach', 'kind', 'score', 'artifact_id', a.id::text,
      'title', a.title, 'meter', a.data -> 'meter', 'counting_level', a.data -> 'settings' -> 'countingLevel', 'client_key', a.client_key::text);
  end if;
  insert into public.class_posts (author_user_id, type, audience, body, tool_share)
  values (v_me, 'tool_share', 'class', '', v_payload) returning id into v_post;
  return v_post;
end $$;
comment on function public.social_publish_tool_artifact(uuid) is 'universal_share_v1: đăng cộng đồng = promote chính artifact + một bài Feed (bms|nhipphach)';
revoke all on function public.social_publish_tool_artifact(uuid) from public, anon;
grant execute on function public.social_publish_tool_artifact(uuid) to authenticated;

-- 4) GỠ khỏi cộng đồng (bms|nhipphach)
create or replace function public.social_unpublish_tool_artifact(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_vis text; v_r text;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_id::text, ''), 22));
  select t.visibility into v_vis from public.tool_artifacts t
   where t.id = p_id and t.owner_id = v_me and ((t.tool = 'bms' and t.kind = 'song') or (t.tool = 'nhipphach' and t.kind = 'score')) for update;
  if not found then raise exception 'TS_NOT_OWNER' using errcode = '42501'; end if;
  if v_vis = 'shared' then return 'private'; end if;
  delete from public.class_posts p where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'artifact_id' = p_id::text;
  v_r := public.tool_artifact_demote_or_delete(p_id, v_me);
  return case when v_r = 'gone' or v_r = 'deleted' then 'deleted' else 'private' end;
end $$;
comment on function public.social_unpublish_tool_artifact(uuid) is 'universal_share_v1: gỡ khỏi cộng đồng (bms|nhipphach), không mặc định xoá artifact';
revoke all on function public.social_unpublish_tool_artifact(uuid) from public, anon;
grant execute on function public.social_unpublish_tool_artifact(uuid) to authenticated;

-- 5) dm_share: nhận tham chiếu theo LOẠI. Mọi lỗi về object dùng MỘT thông báo (không lộ tồn tại/quyền).
--    tool_artifact: người gửi là chủ bài hoặc bài 'class' (bms|nhipphach). class / class_session: người gửi là thành viên lớp hoặc Thầy.
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
    end if;
  end if;
  if not v_ok then raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023'; end if;
  v_conv := public.dm_open(v_me, p_user);
  v_seq := public.dm_append(v_conv, v_me, null, p_ref_type, v_key);
  return query select v_conv, v_seq;
end $$;
comment on function public.dm_share(uuid, text, text) is 'universal_share_v1: chia sẻ tham chiếu (artifact | lớp | buổi học) cho bạn';
revoke all on function public.dm_share(uuid, text, text) from public, anon;
grant execute on function public.dm_share(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
