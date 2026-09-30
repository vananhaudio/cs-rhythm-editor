-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — BMS ARTIFACT SHARE V1: chia sẻ BÀI ĐÃ DỰNG trong BMS (Beat my Songs) lên Feed.
-- Thiết kế: docs/SOCIAL-BMS-ARTIFACT-V1.md. Rollback: db/social_bms_artifact_v1_rollback.sql.
--
-- • BMS vẫn LOCAL-FIRST: nháp chỉ ở máy. CHỈ khi chủ bài bấm "Chia sẻ" mới tạo MỘT artifact trên server.
-- • tool_artifacts = kho SẢN PHẨM dùng chung cho công cụ (V1: tool 'bms' · kind 'song'), có owner_id, id ổn định,
--   schema + version rõ ràng. Dữ liệu do SERVER kiểm + dựng lại (bỏ trường lạ, giới hạn kích thước).
-- • RLS (bảng TỰ QUẢN — có trong self_managed của rls_setup.sql):
--     – đọc: chủ bài · hoặc thành viên Class khi visibility = 'class'. anon: không quyền gì.
--     – KHÔNG policy insert/update/delete: ghi/xoá CHỈ qua RPC (người xem không bao giờ sửa được bản gốc).
-- • Feed: dùng lại Tool Share V1 — social_share_tool_result thêm nhánh 'bms': tạo artifact + ĐÚNG MỘT bài
--   class_posts(type tool_share) trong cùng transaction. tool_share chỉ giữ artifact_id + tóm tắt an toàn
--   (tên bài, video id, BPM, nhịp, số hợp âm) — KHÔNG lời bài hát, KHÔNG toàn bộ nháp.
-- • Chủ bài gỡ: social_delete_tool_artifact(id) xoá artifact + bài Feed trỏ tới nó (cùng transaction).
-- Không đụng student_songs. Không sửa/xoá dữ liệu hiện có. Idempotent.
-- CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: đúng hiện trạng production đã kiểm (preflight 30/09) ─────────────
do $gate$
declare v_src text; v_md5 text; drift text[] := '{}';
begin
  select md5(p.prosrc) into v_md5 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'is_class_member';
  if v_md5 is distinct from '459786921eb5bbd4ff07c83bdb4db480' then drift := drift || format('is_class_member md5 %s', v_md5); end if;
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'social_share_tool_result';
  -- Tool Share V1 đúng bản đã phát hành, hoặc đã là bản có nhánh BMS (chạy lại)
  if v_src is null then drift := drift || 'thiếu social_share_tool_result (chưa có Tool Share V1)'::text;
  elsif md5(v_src) <> '59017e95183114bd5f64607dc85d4e86' and position('BMS_ARTIFACT_V1' in v_src) = 0 then
    drift := drift || format('social_share_tool_result khác bản đã kiểm (md5 %s)', md5(v_src));
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_posts' and column_name = 'tool_share') then
    drift := drift || 'thiếu class_posts.tool_share'::text;
  end if;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; '); end if;
end $gate$;

-- ── 1) Kho sản phẩm công cụ ─────────────────────────────────────────────────
create table if not exists public.tool_artifacts (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  tool            text not null,
  kind            text not null,
  schema_version  int  not null,
  title           text not null,
  data            jsonb not null,
  visibility      text not null default 'class',
  client_key      uuid not null,
  created_at      timestamptz not null default now(),
  constraint tool_artifacts_tool_kind_check check ((tool, kind) in (('bms', 'song'))),
  constraint tool_artifacts_visibility_check check (visibility in ('class')),
  constraint tool_artifacts_title_check check (char_length(title) between 1 and 120),
  constraint tool_artifacts_data_check check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  constraint tool_artifacts_client_key_key unique (client_key)
);
create index if not exists tool_artifacts_owner_idx on public.tool_artifacts (owner_id, created_at desc);

alter table public.tool_artifacts enable row level security;
-- Supabase default ACL cấp FULL cho anon/authenticated trên bảng mới → thu hồi, chỉ cấp đúng SELECT.
revoke all on public.tool_artifacts from public, anon, authenticated;
grant select on public.tool_artifacts to authenticated;

drop policy if exists tool_artifacts_read on public.tool_artifacts;
create policy tool_artifacts_read on public.tool_artifacts for select to authenticated
  using (owner_id = auth.uid() or (visibility = 'class' and public.is_class_member()));

-- ── 2) Kiểm + dựng lại dữ liệu bài BMS (THUẦN, dùng nội bộ) ─────────────────
-- Vào: { title, video_id, lyrics, fit:{bpm,beat_duration,grid_offset}, time_signature, downbeat_position,
--        group_beats, anchors:[{word_index,beat_index}], chords:[{word_index,name}] }
-- Ra: bản chuẩn hoá { schema:'bms.song', v:1, ... } hoặc NULL nếu sai.
create or replace function public.bms_song_normalize(p jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_title text; v_vid text; v_lyrics text; v_bpm numeric; v_bd numeric; v_go numeric;
  v_ts int; v_dp int; v_gb jsonb; v_anchors jsonb; v_chords jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  v_title := btrim(coalesce(p ->> 'title', ''));
  v_vid := p ->> 'video_id';
  v_lyrics := p ->> 'lyrics';
  if char_length(v_title) not between 1 and 120 or v_vid is null or v_vid !~ '^[A-Za-z0-9_-]{11}$'
     or v_lyrics is null or char_length(v_lyrics) > 8000 or btrim(v_lyrics) = '' then return null; end if;
  if jsonb_typeof(p -> 'fit') is distinct from 'object' or jsonb_typeof(p -> 'fit' -> 'bpm') is distinct from 'number'
     or jsonb_typeof(p -> 'fit' -> 'beat_duration') is distinct from 'number' or jsonb_typeof(p -> 'fit' -> 'grid_offset') is distinct from 'number' then return null; end if;
  v_bpm := (p -> 'fit' ->> 'bpm')::numeric; v_bd := (p -> 'fit' ->> 'beat_duration')::numeric; v_go := (p -> 'fit' ->> 'grid_offset')::numeric;
  if v_bpm not between 30 and 260 or v_bd not between 0.2 and 2.5 or v_go not between -60 and 3600 then return null; end if;
  if coalesce(p ->> 'time_signature', '') !~ '^[0-9]{1,2}$' or coalesce(p ->> 'downbeat_position', '') !~ '^[0-9]{1,2}$' then return null; end if;
  v_ts := (p ->> 'time_signature')::int; v_dp := (p ->> 'downbeat_position')::int;
  if v_ts not between 2 and 12 or v_dp > v_ts then return null; end if;
  v_gb := coalesce(p -> 'group_beats', 'null'::jsonb);
  if jsonb_typeof(v_gb) not in ('boolean', 'null') then return null; end if;

  if jsonb_typeof(p -> 'anchors') is distinct from 'array' or jsonb_array_length(p -> 'anchors') not between 1 and 2000 then return null; end if;
  if exists (select 1 from jsonb_array_elements(p -> 'anchors') e
              where jsonb_typeof(e) <> 'object'
                 or coalesce(e ->> 'word_index', '') !~ '^[0-9]{1,4}$'
                 or coalesce(e ->> 'beat_index', '') !~ '^-?[0-9]{1,6}$') then return null; end if;
  select jsonb_agg(jsonb_build_object('word_index', (e ->> 'word_index')::int, 'beat_index', (e ->> 'beat_index')::int) order by (e ->> 'word_index')::int)
    into v_anchors from jsonb_array_elements(p -> 'anchors') e;

  if jsonb_typeof(coalesce(p -> 'chords', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'chords', '[]'::jsonb)) > 2000 then return null; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'chords', '[]'::jsonb)) e
              where jsonb_typeof(e) <> 'object'
                 or coalesce(e ->> 'word_index', '') !~ '^[0-9]{1,4}$'
                 or coalesce(e ->> 'name', '') !~ '^[A-G][#b]?[A-Za-z0-9#b+()]{0,10}(/[A-G][#b]?)?$') then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('word_index', (e ->> 'word_index')::int, 'name', e ->> 'name') order by (e ->> 'word_index')::int), '[]'::jsonb)
    into v_chords from jsonb_array_elements(coalesce(p -> 'chords', '[]'::jsonb)) e;

  return jsonb_build_object('schema', 'bms.song', 'v', 1, 'title', v_title, 'video_id', v_vid, 'lyrics', v_lyrics,
    'fit', jsonb_build_object('bpm', round(v_bpm, 3), 'beat_duration', round(v_bd, 6), 'grid_offset', round(v_go, 4)),
    'time_signature', v_ts, 'downbeat_position', v_dp, 'group_beats', v_gb, 'anchors', v_anchors, 'chords', v_chords);
end $$;
revoke all on function public.bms_song_normalize(jsonb) from public, anon, authenticated;

-- ── 3) Ghi: Tool Share V1 + nhánh BMS (BMS_ARTIFACT_V1) ─────────────────────
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

-- ── 4) Xoá bài Feed (tác giả xoá / tài khoản bị xoá) → artifact đi cùng, không để dữ liệu mồ côi ──
create or replace function public.tool_artifacts_cleanup_on_post_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.type = 'tool_share' and old.tool_share ? 'artifact_id' then
    delete from public.tool_artifacts a where a.id::text = old.tool_share ->> 'artifact_id' and a.owner_id = old.author_user_id;
  end if;
  return null;
end $$;
revoke all on function public.tool_artifacts_cleanup_on_post_delete() from public, anon, authenticated;
drop trigger if exists class_posts_tool_artifact_cleanup on public.class_posts;
create trigger class_posts_tool_artifact_cleanup after delete on public.class_posts
  for each row when (old.type = 'tool_share') execute function public.tool_artifacts_cleanup_on_post_delete();

-- ── 5) Chủ bài gỡ chia sẻ: xoá artifact + bài Feed trỏ tới nó ─────────────────
create or replace function public.social_delete_tool_artifact(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  if not exists (select 1 from public.tool_artifacts a where a.id = p_id and a.owner_id = v_me) then
    raise exception 'TS_NOT_OWNER' using errcode = '42501';
  end if;
  delete from public.class_posts p
   where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'artifact_id' = p_id::text;
  delete from public.tool_artifacts a where a.id = p_id and a.owner_id = v_me;
  return true;
end $$;
revoke all on function public.social_delete_tool_artifact(uuid) from public, anon;
grant execute on function public.social_delete_tool_artifact(uuid) to authenticated;

notify pgrst, 'reload schema';
