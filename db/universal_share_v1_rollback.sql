-- ROLLBACK Universal Share V1 → trả bms_save_for_share / social_publish_tool_artifact / social_unpublish_tool_artifact / dm_share về ĐÚNG nguyên văn LIVE (md5 baseline),
-- gỡ tool_artifact_save_for_share. Idempotent. Không begin/commit. KHÔNG xoá tin nhắn, KHÔNG xoá artifact.
-- CHECK loại tham chiếu: chỉ thu hẹp về 'tool_artifact' khi KHÔNG còn tin 'class'/'class_session' (còn thì GIỮ check rộng để không hỏng dữ liệu).
-- Artifact nhipphach đang 'shared': giữ nguyên (chủ bài đọc được; người nhận vẫn qua policy/grant hiện có).
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

create or replace function public.bms_save_for_share(p_song jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_song jsonb; v_id uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  v_song := public.bms_song_normalize(p_song);
  if v_song is null or pg_column_size(v_song) > 65536 then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || ':bms:' || md5(v_song::text), 21));
  select a.id into v_id from public.tool_artifacts a
   where a.owner_id = v_me and a.tool = 'bms' and a.kind = 'song' and a.data = v_song order by a.created_at, a.id limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.tool_artifacts a where a.owner_id = v_me and a.visibility = 'shared' and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Bạn lưu quá nhiều bài trong thời gian ngắn. Hãy chờ một chút.' using errcode = '54000';
  end if;
  insert into public.tool_artifacts (owner_id, tool, kind, schema_version, title, data, visibility, client_key)
  values (v_me, 'bms', 'song', 1, v_song ->> 'title', v_song, 'shared', gen_random_uuid())
  returning id into v_id;
  return v_id;
end $$;
comment on function public.bms_save_for_share(jsonb) is 'bms_share_v1: lưu riêng bài BMS (shared), idempotent theo nội dung';
revoke all on function public.bms_save_for_share(jsonb) from public, anon;
grant execute on function public.bms_save_for_share(jsonb) to authenticated;

create or replace function public.social_publish_tool_artifact(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); a public.tool_artifacts%rowtype; v_post uuid; v_payload jsonb;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_id::text, ''), 22));
  select * into a from public.tool_artifacts t where t.id = p_id and t.owner_id = v_me and t.tool = 'bms' and t.kind = 'song' for update;
  if not found then raise exception 'TS_NOT_OWNER' using errcode = '42501'; end if;
  select p.id into v_post from public.class_posts p
   where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'artifact_id' = p_id::text;
  if v_post is not null then
    if a.visibility <> 'class' then update public.tool_artifacts set visibility = 'class' where id = p_id; end if;
    return v_post;
  end if;
  if a.visibility <> 'class' then update public.tool_artifacts set visibility = 'class' where id = p_id; end if;
  v_payload := jsonb_build_object('v', 1, 'tool', 'bms', 'kind', 'song', 'artifact_id', a.id::text,
    'title', a.data ->> 'title', 'video_id', a.data ->> 'video_id',
    'bpm', round((a.data -> 'fit' ->> 'bpm')::numeric)::int, 'beats_per_bar', (a.data ->> 'time_signature')::int,
    'chord_count', (select count(distinct e ->> 'name') from jsonb_array_elements(a.data -> 'chords') e)::int,
    'client_key', a.client_key::text);
  insert into public.class_posts (author_user_id, type, audience, body, tool_share)
  values (v_me, 'tool_share', 'class', '', v_payload) returning id into v_post;
  return v_post;
end $$;
comment on function public.social_publish_tool_artifact(uuid) is 'bms_share_v1: đăng cộng đồng = promote chính artifact + một bài Feed';
revoke all on function public.social_publish_tool_artifact(uuid) from public, anon;
grant execute on function public.social_publish_tool_artifact(uuid) to authenticated;

create or replace function public.social_unpublish_tool_artifact(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_vis text; v_r text;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_id::text, ''), 22));
  select t.visibility into v_vis from public.tool_artifacts t where t.id = p_id and t.owner_id = v_me and t.tool = 'bms' and t.kind = 'song' for update;
  if not found then raise exception 'TS_NOT_OWNER' using errcode = '42501'; end if;
  if v_vis = 'shared' then return 'private'; end if;     -- chưa đăng: không có gì để gỡ (KHÔNG xoá bài riêng)
  delete from public.class_posts p where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'artifact_id' = p_id::text;
  v_r := public.tool_artifact_demote_or_delete(p_id, v_me);
  return case when v_r = 'gone' or v_r = 'deleted' then 'deleted' else 'private' end;
end $$;
comment on function public.social_unpublish_tool_artifact(uuid) is 'bms_share_v1: gỡ khỏi cộng đồng (không mặc định xoá artifact)';
revoke all on function public.social_unpublish_tool_artifact(uuid) from public, anon;
grant execute on function public.social_unpublish_tool_artifact(uuid) to authenticated;

drop function if exists public.tool_artifact_save_for_share(text, jsonb);
do $$ begin
  if not exists (select 1 from public.dm_messages where ref_type in ('class', 'class_session')) then
    alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
    alter table public.dm_messages add constraint dm_messages_ref_valid_check check (
      ref_type is null or (ref_type in ('tool_artifact') and ref_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
  end if;
end $$;
notify pgrst, 'reload schema';
