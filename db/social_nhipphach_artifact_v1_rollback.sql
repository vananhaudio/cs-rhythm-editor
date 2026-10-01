-- ═══ ROLLBACK NHỊP & PHÁCH ARTIFACT SHARE V1 — RPC về bản BMS Artifact V1 (Metronome + BMS).
-- Chưa có artifact Nhịp & Phách → gỡ cột content/content_sha256 + ràng buộc, trả check loại về chỉ BMS.
-- ĐÃ có → GIỮ dữ liệu + cột (chủ bài vẫn gỡ được, người xem vẫn mở được), chỉ ngừng nhận chia sẻ mới.
-- CHẠY bằng scripts/prod-db.py (file KHÔNG có begin/commit). Idempotent.
set local lock_timeout = '5s';

create or replace function public.social_share_tool_result(p_tool text, p_result jsonb, p_client_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_id uuid; v_author uuid; v_payload jsonb; v_bpm int; v_sec int;
  v_song jsonb; v_art uuid;   -- BMS_ARTIFACT_V1
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  if p_client_key is null or p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'TS_BAD_RESULT' using errcode = '22023';
  end if;
  -- Cùng một kết quả (client_key) gửi lại → trả đúng bài đã có của CHÍNH người đó (không tạo bản thứ hai)
  select p.id, p.author_user_id into v_id, v_author from public.class_posts p
   where p.type = 'tool_share' and p.tool_share ->> 'client_key' = p_client_key::text;
  if v_id is not null then
    if v_author <> v_me then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
    return v_id;
  end if;

  case p_tool
    when 'metronome' then
      -- Metronome V1: một phiên luyện tập đo thật (Bắt đầu → Dừng) ở BPM dùng lâu nhất
      if p_result ->> 'kind' is distinct from 'practice_session'
         or coalesce(p_result ->> 'bpm', '') !~ '^[0-9]{1,3}$' or coalesce(p_result ->> 'seconds', '') !~ '^[0-9]{1,5}$' then
        raise exception 'TS_BAD_RESULT' using errcode = '22023';
      end if;
      v_bpm := (p_result ->> 'bpm')::int; v_sec := (p_result ->> 'seconds')::int;
      if v_bpm not between 30 and 260 or v_sec not between 60 and 21600 then
        raise exception 'TS_BAD_RESULT' using errcode = '22023';
      end if;
      v_payload := jsonb_build_object('v', 1, 'tool', 'metronome', 'kind', 'practice_session',
                                      'bpm', v_bpm, 'seconds', v_sec, 'client_key', p_client_key::text);
    when 'bms' then
      -- BMS V1: bài đã dựng → artifact (dữ liệu đủ để luyện lại) + bài Feed chỉ giữ tham chiếu + tóm tắt
      if p_result ->> 'kind' is distinct from 'song' then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
      v_song := public.bms_song_normalize(p_result -> 'song');
      if v_song is null or pg_column_size(v_song) > 65536 then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
    else
      raise exception 'TS_UNKNOWN_TOOL' using errcode = '22023';
  end case;

  begin
    if p_tool = 'bms' then
      insert into public.tool_artifacts (owner_id, tool, kind, schema_version, title, data, visibility, client_key)
      values (v_me, 'bms', 'song', 1, v_song ->> 'title', v_song, 'class', p_client_key)
      returning id into v_art;
      v_payload := jsonb_build_object('v', 1, 'tool', 'bms', 'kind', 'song', 'artifact_id', v_art::text,
        'title', v_song ->> 'title', 'video_id', v_song ->> 'video_id',
        'bpm', round((v_song -> 'fit' ->> 'bpm')::numeric)::int, 'beats_per_bar', (v_song ->> 'time_signature')::int,
        'chord_count', (select count(distinct e ->> 'name') from jsonb_array_elements(v_song -> 'chords') e)::int,
        'client_key', p_client_key::text);
    end if;
    insert into public.class_posts (author_user_id, type, audience, body, tool_share)
    values (v_me, 'tool_share', 'class', '', v_payload)
    returning id into v_id;
  exception when unique_violation then   -- bấm đúp đua nhau: bản kia đã chèn trước (artifact của lần này cũng huỷ)
    select p.id into v_id from public.class_posts p
     where p.type = 'tool_share' and p.tool_share ->> 'client_key' = p_client_key::text and p.author_user_id = v_me;
    if v_id is null then raise; end if;
  end;
  return v_id;
end $$;
revoke all on function public.social_share_tool_result(text, jsonb, uuid) from public, anon;
grant execute on function public.social_share_tool_result(text, jsonb, uuid) to authenticated;

drop function if exists public.nhipphach_musicxml_check(text);
drop function if exists public.nhipphach_settings_normalize(jsonb);

do $$
begin
  if to_regclass('public.tool_artifacts') is null then return; end if;
  if exists (select 1 from public.tool_artifacts where tool = 'nhipphach') then
    raise notice 'tool_artifacts còn bản Nhịp & Phách → giữ cột content + ràng buộc';
    return;
  end if;
  alter table public.tool_artifacts drop constraint if exists tool_artifacts_content_check;
  alter table public.tool_artifacts drop constraint if exists tool_artifacts_tool_kind_check;
  alter table public.tool_artifacts add constraint tool_artifacts_tool_kind_check check ((tool, kind) in (('bms', 'song')));
  alter table public.tool_artifacts drop column if exists content_sha256;
  alter table public.tool_artifacts drop column if exists content;
end $$;

notify pgrst, 'reload schema';
