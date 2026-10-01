-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — NHỊP & PHÁCH ARTIFACT SHARE V1: chia sẻ BẢN NHẠC ĐÃ ĐÁNH SỐ PHÁCH lên Feed.
-- Thiết kế: docs/SOCIAL-NHIPPHACH-ARTIFACT-V1.md. Rollback: db/social_nhipphach_artifact_v1_rollback.sql.
--
-- Dùng lại nguyên nền BMS Artifact V1: tool_artifacts · class_posts(type tool_share) · social_share_tool_result ·
-- social_delete_tool_artifact · trigger dọn artifact. KHÔNG nhipphach_posts, KHÔNG bảng/bucket mới.
-- • Sản phẩm canonical = MusicXML đang hiển thị (đúng byte người dùng thấy) + thiết lập đếm/trình bày
--   (mức đếm, cách đếm nhịp kép, cách chia nhịp lẻ, màu, cỡ, khoảng cách, hướng giấy). Bản khắc dựng lại từ đó —
--   KHÔNG lưu SVG/PDF/PNG.
-- • MusicXML nằm ở cột tool_artifacts.content (≤ 1 MB, sha256 do server tính). Server kiểm: không <!ENTITY,
--   well-formed, gốc score-partwise; đọc nhịp đầu tiên bằng xpath (tóm tắt thật, không tin client).
-- • class_posts.tool_share CHỈ giữ artifact_id + tên bài + nhịp + mức đếm — KHÔNG MusicXML.
-- • KHÔNG đọc/ghi musicxml_library (kho master) hay nhipphach_scores/versions: hàm không nhắc tới các bảng đó.
-- Idempotent. CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: đúng hiện trạng production (BMS Artifact V1 đã chạy) ─────────────
do $gate$
declare v_src text; drift text[] := '{}';
begin
  if to_regclass('public.tool_artifacts') is null then drift := drift || 'thiếu tool_artifacts (chưa có BMS Artifact V1)'::text; end if;
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'social_share_tool_result';
  if v_src is null or position('BMS_ARTIFACT_V1' in v_src) = 0 then
    drift := drift || 'social_share_tool_result chưa phải bản BMS Artifact V1'::text;
  elsif position('NHIPPHACH_ARTIFACT_V1' in v_src) = 0 and md5(v_src) <> 'a636717b30a234e09c36b01efcf14b34' then
    drift := drift || format('social_share_tool_result khác bản đã kiểm (md5 %s)', md5(v_src));
  end if;
  if not exists (select 1 from pg_proc where proname = 'social_delete_tool_artifact') then drift := drift || 'thiếu social_delete_tool_artifact'::text; end if;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; '); end if;
end $gate$;

-- ── 1) tool_artifacts nhận thêm loại 'nhipphach' · 'score' + nội dung MusicXML ─────
alter table public.tool_artifacts add column if not exists content text;
alter table public.tool_artifacts add column if not exists content_sha256 text;
alter table public.tool_artifacts drop constraint if exists tool_artifacts_tool_kind_check;
alter table public.tool_artifacts add constraint tool_artifacts_tool_kind_check
  check ((tool, kind) in (('bms', 'song'), ('nhipphach', 'score')));
alter table public.tool_artifacts drop constraint if exists tool_artifacts_content_check;
alter table public.tool_artifacts add constraint tool_artifacts_content_check check (
  (tool = 'nhipphach') = (content is not null)
  and (content is null or (octet_length(content) <= 1048576 and content_sha256 ~ '^[0-9a-f]{64}$')));
-- quyền KHÔNG đổi: authenticated chỉ SELECT (cột mới đi theo quyền bảng), anon không gì
revoke all on public.tool_artifacts from public, anon, authenticated;
grant select on public.tool_artifacts to authenticated;

-- ── 2) Kiểm MusicXML (THUẦN, dùng nội bộ) → {meter} hoặc NULL ──────────────
create or replace function public.nhipphach_musicxml_check(p_xml text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_doc xml; v_beats text; v_type text;
begin
  if p_xml is null or octet_length(p_xml) not between 64 and 1048576 then return null; end if;
  if p_xml ~* '<!ENTITY' then return null; end if;          -- chặn entity tự định nghĩa (bom XML)
  if not xml_is_well_formed_document(p_xml) then return null; end if;
  v_doc := xmlparse(document p_xml);
  if (xpath('local-name(/*)', v_doc))[1]::text is distinct from 'score-partwise' then return null; end if;
  v_beats := (xpath('(//*[local-name()="time"])[1]/*[local-name()="beats"][1]/text()', v_doc))[1]::text;
  v_type := (xpath('(//*[local-name()="time"])[1]/*[local-name()="beat-type"][1]/text()', v_doc))[1]::text;
  return jsonb_build_object('meter',
    case when btrim(v_beats) ~ '^[0-9]{1,2}(\+[0-9]{1,2}){0,5}$' and btrim(v_type) ~ '^[0-9]{1,2}$'
         then btrim(v_beats) || '/' || btrim(v_type) end);
exception when others then return null;
end $$;
revoke all on function public.nhipphach_musicxml_check(text) from public, anon, authenticated;

-- ── 3) Chuẩn hoá thiết lập đếm/trình bày (THUẦN, dùng nội bộ) ────────────────
create or replace function public.nhipphach_settings_normalize(p jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_level text; v_mode text; v_orient text; v_color text; v_size numeric; v_dist numeric;
  v_group jsonb := '{}'::jsonb; v_part text; v_map jsonb; k text; v jsonb; n int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  if (p -> 'showBeats') is distinct from 'true'::jsonb then return null; end if;   -- không hiện số phách → không phải bản đã đánh số
  v_level := coalesce(p ->> 'countingLevel', 'beats');
  v_mode := coalesce(p ->> 'compoundCountingMode', 'pulses');
  v_orient := coalesce(p ->> 'orientation', 'portrait');
  v_color := p ->> 'color';
  if v_level not in ('beats', 'eighths', 'sixteenths') or v_mode not in ('pulses', 'compound')
     or v_orient not in ('portrait', 'landscape') or coalesce(v_color, '') !~ '^#[0-9A-Fa-f]{6}$'
     or jsonb_typeof(p -> 'sizePt') is distinct from 'number' or jsonb_typeof(p -> 'distance') is distinct from 'number' then return null; end if;
  v_size := (p ->> 'sizePt')::numeric; v_dist := (p ->> 'distance')::numeric;
  if v_size not between 4 and 20 or v_dist not between 0 and 10 then return null; end if;
  if p ? 'grouping' and jsonb_typeof(p -> 'grouping') <> 'null' then
    if jsonb_typeof(p -> 'grouping') <> 'object' then return null; end if;
    foreach v_part in array array['byMeter', 'byMeasure'] loop
      if (p -> 'grouping') ? v_part and jsonb_typeof(p -> 'grouping' -> v_part) <> 'null' then
        if jsonb_typeof(p -> 'grouping' -> v_part) <> 'object' then return null; end if;
        v_map := '{}'::jsonb;
        for k, v in select * from jsonb_each(p -> 'grouping' -> v_part) loop
          n := n + 1;
          if n > 500 or k !~ (case v_part when 'byMeter' then '^[0-9]{1,2}/[0-9]{1,2}$' else '^[A-Za-z0-9_.:-]{1,64}$' end)
             or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) not between 1 and 12
             or exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'number' or e::text !~ '^[1-9]$') then return null; end if;
          v_map := v_map || jsonb_build_object(k, v);
        end loop;
        v_group := v_group || jsonb_build_object(v_part, v_map);
      end if;
    end loop;
  end if;
  return jsonb_build_object('showBeats', true, 'countingLevel', v_level, 'compoundCountingMode', v_mode, 'orientation', v_orient,
    'color', lower(v_color), 'sizePt', v_size, 'distance', v_dist, 'grouping', v_group);
end $$;
revoke all on function public.nhipphach_settings_normalize(jsonb) from public, anon, authenticated;

-- ── 4) Ghi: Tool Share + BMS + Nhịp & Phách (NHIPPHACH_ARTIFACT_V1) ─────────────
create or replace function public.social_share_tool_result(p_tool text, p_result jsonb, p_client_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_id uuid; v_author uuid; v_payload jsonb; v_bpm int; v_sec int;
  v_song jsonb; v_art uuid;   -- BMS_ARTIFACT_V1
  v_xml text; v_meta jsonb; v_set jsonb; v_title text; v_composer text;   -- NHIPPHACH_ARTIFACT_V1
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
    when 'nhipphach' then
      -- Nhịp & Phách V1: bản nhạc đã đánh số phách = MusicXML đang hiển thị + thiết lập đếm/trình bày.
      -- Server kiểm XML (kích thước, không ENTITY, well-formed, gốc score-partwise) + chuẩn hoá thiết lập.
      if p_result ->> 'kind' is distinct from 'score' or jsonb_typeof(p_result -> 'score') is distinct from 'object' then
        raise exception 'TS_BAD_RESULT' using errcode = '22023';
      end if;
      v_title := btrim(coalesce(p_result -> 'score' ->> 'title', ''));
      v_composer := nullif(btrim(coalesce(p_result -> 'score' ->> 'composer', '')), '');
      v_xml := p_result -> 'score' ->> 'musicxml';
      v_meta := public.nhipphach_musicxml_check(v_xml);
      v_set := public.nhipphach_settings_normalize(p_result -> 'score' -> 'settings');
      if char_length(v_title) not between 1 and 120 or char_length(coalesce(v_composer, '')) > 120
         or v_meta is null or v_set is null then
        raise exception 'TS_BAD_RESULT' using errcode = '22023';
      end if;
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
    elsif p_tool = 'nhipphach' then
      insert into public.tool_artifacts (owner_id, tool, kind, schema_version, title, data, visibility, client_key, content, content_sha256)
      values (v_me, 'nhipphach', 'score', 1, v_title,
              jsonb_build_object('schema', 'nhipphach.score', 'v', 1, 'title', v_title, 'composer', v_composer,
                                 'meter', v_meta -> 'meter', 'settings', v_set),
              'class', p_client_key, v_xml, encode(sha256(convert_to(v_xml, 'UTF8')), 'hex'))
      returning id into v_art;
      v_payload := jsonb_build_object('v', 1, 'tool', 'nhipphach', 'kind', 'score', 'artifact_id', v_art::text,
        'title', v_title, 'meter', v_meta -> 'meter', 'counting_level', v_set -> 'countingLevel', 'client_key', p_client_key::text);
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

notify pgrst, 'reload schema';
