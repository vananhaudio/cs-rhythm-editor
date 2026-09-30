-- ═══ ROLLBACK BMS ARTIFACT SHARE V1 — trả social_share_tool_result về bản Tool Share V1 (chỉ Metronome).
-- Chưa có artifact nào → gỡ sạch bảng + hàm + trigger. ĐÃ có artifact → GIỮ bảng, trigger, social_delete_tool_artifact
-- (chủ bài vẫn gỡ được; Feed/BMS vẫn mở được bài đã chia sẻ), chỉ ngừng nhận chia sẻ BMS mới.
-- CHẠY bằng scripts/prod-db.py (file KHÔNG có begin/commit). Idempotent.
set local lock_timeout = '5s';

create or replace function public.social_share_tool_result(p_tool text, p_result jsonb, p_client_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_id uuid; v_author uuid; v_payload jsonb; v_bpm int; v_sec int;
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
    else
      raise exception 'TS_UNKNOWN_TOOL' using errcode = '22023';
  end case;

  begin
    insert into public.class_posts (author_user_id, type, audience, body, tool_share)
    values (v_me, 'tool_share', 'class', '', v_payload)
    returning id into v_id;
  exception when unique_violation then   -- bấm đúp đua nhau: bản kia đã chèn trước
    select p.id into v_id from public.class_posts p
     where p.type = 'tool_share' and p.tool_share ->> 'client_key' = p_client_key::text and p.author_user_id = v_me;
    if v_id is null then raise; end if;
  end;
  return v_id;
end $$;

revoke all on function public.social_share_tool_result(text, jsonb, uuid) from public, anon;
grant execute on function public.social_share_tool_result(text, jsonb, uuid) to authenticated;

drop function if exists public.bms_song_normalize(jsonb);

do $$
begin
  if to_regclass('public.tool_artifacts') is null then return; end if;
  if exists (select 1 from public.tool_artifacts) then
    raise notice 'tool_artifacts còn dữ liệu → giữ bảng + trigger + social_delete_tool_artifact';
    return;
  end if;
  drop trigger if exists class_posts_tool_artifact_cleanup on public.class_posts;
  drop function if exists public.tool_artifacts_cleanup_on_post_delete();
  drop function if exists public.social_delete_tool_artifact(uuid);
  drop table public.tool_artifacts;
end $$;

notify pgrst, 'reload schema';
