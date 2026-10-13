-- ═══════════════════════════════════════════════════════════════════════════
-- THƯ VIỆN HỢP ÂM — V1.6: BIÊN TẬP ÂM NHẠC LƯU ĐƯỢC VẠCH NHỊP CHO BÀI CỦA MÌNH (không cấp quyền review đại trà).
-- Rollback: db/chord_library_v1_6_editor_anchors_rollback.sql. Chạy qua prod-db.py (file KHÔNG có begin/commit).
--
-- Lỗi thực tế: chord_sheet_contribute (V1.4) từ chối p_anchors nếu người gọi không có 'review' → Biên tập bấm Lưu bài có
-- chia nhịp thì cả lần lưu bị từ chối. Sửa nhỏ nhất:
--   • chordlib_can_anchors(sheet_id): true khi có 'review'; hoặc là Biên tập âm nhạc VÀ (bài mới, hoặc bài do chính mình tạo).
--     Học viên thường, Trưởng Band, Biên tập với bài người khác / bài Admin → false.
--   • chord_sheet_contribute: điều kiện nhận p_anchors đổi từ "có review" sang chordlib_can_anchors(p_sheet_id). Còn lại
--     NGUYÊN VĂN (một giao dịch: bài + phiên bản + vạch; vạch sai/thiếu quyền → rollback cả lần lưu, không để dở dang).
--   • chord_sheet_accept_anchors: cùng điều kiện (theo bài của phiên bản nguồn) — để Biên tập sửa vạch nhịp bài của mình.
--   • chord_sheet_accept_anchors_publish (MỚI): như contribute_publish — Biên tập → phiên bản mới công khai ngay (bài của mình);
--     người khác → hành vi cũ.
-- KHÔNG đổi: chordlib_can, tool_capabilities, approve/reject, search/get, bảng/cột, policy, 26 phiên bản hiện có.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  v_c text := (select p.prosrc from pg_proc p where p.oid = 'public.chord_sheet_contribute(text,text,text,jsonb,integer,jsonb,uuid,uuid,uuid,jsonb)'::regprocedure);
  v_a text := (select p.prosrc from pg_proc p where p.oid = 'public.chord_sheet_accept_anchors(uuid,jsonb,jsonb)'::regprocedure);
begin
  if to_regprocedure('public.teamlab_is_any_music_editor()') is null then raise exception 'GATE: thiếu teamlab_is_any_music_editor()'; end if;
  if to_regprocedure('public.chord_sheet_contribute_publish(text,text,text,jsonb,integer,jsonb,uuid,uuid,uuid,jsonb)') is null then raise exception 'GATE: chưa có V1.5'; end if;
  if md5(v_c) <> '88f8e7b86da70bbba7066b9835443080' and v_c not like '%chordlib_can_anchors%' then raise exception 'GATE: chord_sheet_contribute khác bản đã đọc'; end if;
  if md5(v_a) <> 'b5cf0cf6dd712fcc41bc35dd79b8bb56' and v_a not like '%chordlib_can_anchors%' then raise exception 'GATE: chord_sheet_accept_anchors khác bản đã đọc'; end if;
end
$gate$;

create or replace function public.chordlib_can_anchors(p_sheet_id uuid)
returns boolean language sql stable security definer set search_path = '' as $f$
  select auth.uid() is not null and (
    public.chordlib_can('review')
    or (public.teamlab_is_any_music_editor()
        and (p_sheet_id is null
             or exists (select 1 from public.chord_sheets s where s.id = p_sheet_id and s.created_by = auth.uid()))))
$f$;
revoke all on function public.chordlib_can_anchors(uuid) from public, anon, authenticated;
comment on function public.chordlib_can_anchors(uuid) is 'chord_library_v1: ai được lưu vạch nhịp (review, hoặc Biên tập với bài mới/bài của mình)';

create or replace function public.chord_sheet_contribute(
  p_text text,
  p_title text default null,
  p_composer text default null,
  p_meter jsonb default null,
  p_suggested_bpm integer default null,
  p_sources jsonb default '[]'::jsonb,
  p_version_id uuid default null,
  p_sheet_id uuid default null,
  p_parent_version_id uuid default null,
  p_anchors jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_review boolean;
  v_text text := public.chord_canonical_text(p_text);
  v_hash text;
  v_anchors jsonb := case when p_anchors is null or jsonb_typeof(p_anchors) = 'null' then null else p_anchors end;
  v_problem text;
  v_title text := btrim(coalesce(p_title, ''));
  v_composer text := nullif(btrim(coalesce(p_composer, '')), '');
  v_vid uuid := coalesce(p_version_id, gen_random_uuid());
  v_sources jsonb := coalesce(p_sources, '[]'::jsonb);
  v_sheet public.chord_sheets%rowtype;
  v_dup uuid;
  v_dup_sheet uuid;
  v_parent uuid;
  v_num integer := 1;
  v_src jsonb;
  v_ok boolean;
  v_path text;
  v_paths text[] := '{}';
  v_meta jsonb;
begin
  if v_uid is null or not public.chordlib_can('contribute') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  v_review := public.chordlib_can('review');
  -- MỘT người, MỘT lượt ghi tại một thời điểm: đếm bản chờ, dò trùng, và kiểm file nguồn đều đọc-rồi-ghi;
  -- không khoá thì hai request song song cùng lọt (31 bản chờ, 2 bài y hệt, file bị xoá ngay sau khi kiểm).
  -- Cùng khoá này được policy tải lên/xoá của bucket giữ (chord_source_can_write) → xoá file và đóng góp
  -- của cùng một người không chạy chéo nhau. Giữ tới hết transaction.
  perform pg_advisory_xact_lock(hashtextextended('chordlib:' || v_uid::text, 0));

  if v_text is null or length(btrim(v_text)) = 0 then
    raise exception 'CHORDLIB_INVALID: thiếu lời + hợp âm' using errcode = '22023';
  end if;
  if length(v_text) > 20000 then
    raise exception 'CHORDLIB_INVALID: lời + hợp âm quá dài (tối đa 20000 ký tự)' using errcode = '22023';
  end if;
  if not public.chord_meter_ok(p_meter) then
    raise exception 'CHORDLIB_INVALID: nhịp phải có dạng {"beats": 1..32, "beatType": 1|2|4|8|16}' using errcode = '22023';
  end if;
  if p_suggested_bpm is not null and p_suggested_bpm not between 20 and 300 then
    raise exception 'CHORDLIB_INVALID: BPM gợi ý phải trong khoảng 20–300' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(v_text, 'UTF8')), 'hex');

  -- V1.4 MỘT LẦN LƯU: vạch nhịp đi CÙNG lời trong cùng giao dịch (không cần phiên bản trung gian rồi accept_anchors).
  --   • Có vạch mà người gọi không có quyền review → TỪ CHỐI CẢ LẦN LƯU (không lưu lời rồi bỏ vạch).
  --   • Vạch phải khớp số chữ của lời này (cùng chord_anchors_problem với chord_sheet_accept_anchors).
  --   • Không có vạch (null) → bản nháp chưa có vạch như trước (anchors none).
  if v_anchors is not null then
    if not public.chordlib_can_anchors(p_sheet_id) then
      raise exception 'CHORDLIB_FORBIDDEN: lưu vạch nhịp cần quyền review hoặc là Biên tập của chính bài này — toàn bộ lần lưu bị từ chối, chưa có gì được lưu'
        using errcode = '42501';
    end if;
    v_problem := public.chord_anchors_problem(v_anchors, public.chord_lyric_token_counts(v_text));
    if v_problem is not null then
      raise exception 'CHORDLIB_INVALID: vạch nhịp không hợp lệ — %', v_problem using errcode = '22023';
    end if;
  end if;

  -- File nguồn. Mỗi mục CHỈ gồm {path, mime, sha256, page?, size_bytes?}:
  --   path        {uid của người gọi}/{version_id này}/{0-9}.{pdf|jpg|jpeg|png|webp}, không lặp
  --   mime        khớp ĐUÔI file; khớp cả mimetype mà Storage ghi nhận (nếu có)
  --   sha256      64 hex — do CLIENT khai (server không đọc được byte của file); dùng để đối chiếu, không phải bằng chứng
  --   page        số nguyên 1..999
  --   size_bytes  số nguyên 1..20MB; khớp size mà Storage ghi nhận (nếu có)
  -- File phải ĐÃ nằm trong bucket, và MỌI file trong thư mục phiên bản phải được khai — không để lại file
  -- mồ côi không ai xoá được sau khi phiên bản đã ghi.
  if jsonb_typeof(v_sources) <> 'array' or jsonb_array_length(v_sources) > 10 then
    raise exception 'CHORDLIB_INVALID: sources phải là mảng tối đa 10 file' using errcode = '22023';
  end if;
  for v_src in select value from jsonb_array_elements(v_sources) loop
    v_ok := jsonb_typeof(v_src) = 'object';
    if v_ok then
      v_path := v_src ->> 'path';
      -- coalesce(…, false): thiếu khoá cho ra NULL, không được coi là đạt.
      v_ok := coalesce(
        (v_src - 'path' - 'mime' - 'sha256' - 'page' - 'size_bytes') = '{}'::jsonb
        and jsonb_typeof(v_src -> 'path') = 'string' and jsonb_typeof(v_src -> 'mime') = 'string'
        and jsonb_typeof(v_src -> 'sha256') = 'string'
        and v_path ~ ('^' || v_uid::text || '/' || v_vid::text || '/[0-9]\.(pdf|jpg|jpeg|png|webp)$')
        and (v_src ->> 'mime') = case substring(v_path from '\.([a-z]+)$')
              when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
              when 'png' then 'image/png' when 'webp' then 'image/webp' end
        and (v_src ->> 'sha256') ~ '^[0-9a-f]{64}$'
        and (not v_src ? 'page'
             or (jsonb_typeof(v_src -> 'page') = 'number' and (v_src ->> 'page') ~ '^[1-9][0-9]{0,2}$'))
        and (not v_src ? 'size_bytes'
             or (jsonb_typeof(v_src -> 'size_bytes') = 'number' and (v_src ->> 'size_bytes') ~ '^[1-9][0-9]{0,7}$'
                 and (v_src -> 'size_bytes') <= to_jsonb(20971520))),
        false);
    end if;
    if not v_ok then
      raise exception 'CHORDLIB_INVALID: file nguồn không hợp lệ — chỉ {path, mime, sha256, page, size_bytes}; đường dẫn {uid}/{version_id}/{0-9}.{pdf|jpg|jpeg|png|webp}; mime khớp đuôi file'
        using errcode = '22023';
    end if;
    if v_path = any (v_paths) then
      raise exception 'CHORDLIB_INVALID: file nguồn bị khai lặp: %', v_path using errcode = '22023';
    end if;
    v_paths := v_paths || v_path;
    select o.metadata into v_meta from storage.objects o
     where o.bucket_id = 'chord-sheet-sources' and o.name = v_path;
    if not found then
      raise exception 'CHORDLIB_INVALID: file nguồn chưa được tải lên: %', v_path using errcode = '22023';
    end if;
    if (v_meta ? 'mimetype' and (v_meta ->> 'mimetype') <> (v_src ->> 'mime'))
       or (v_src ? 'size_bytes' and v_meta ? 'size' and (v_meta ->> 'size') <> (v_src ->> 'size_bytes')) then
      raise exception 'CHORDLIB_INVALID: mime/size khai không khớp file đã tải lên: %', v_path using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from storage.objects o
       where o.bucket_id = 'chord-sheet-sources' and o.name like v_uid::text || '/' || v_vid::text || '/%')
     <> jsonb_array_length(v_sources) then
    raise exception 'CHORDLIB_INVALID: thư mục phiên bản có file chưa được khai trong sources — khai đủ hoặc xoá bớt'
      using errcode = '22023';
  end if;

  -- Chặn spam: tối đa 30 bản đang chờ duyệt cho một người (người review không bị giới hạn).
  if not v_review and (select count(*) from public.chord_sheet_versions v
                        where v.contributed_by = v_uid and v.review_status = 'private') >= 30 then
    raise exception 'CHORDLIB_LIMIT: bạn đang có 30 bản chờ duyệt — chờ thầy duyệt bớt rồi gửi tiếp' using errcode = '54000';
  end if;

  if p_sheet_id is null then
    if length(v_title) not between 1 and 200 then
      raise exception 'CHORDLIB_INVALID: thiếu tên bài (1–200 ký tự)' using errcode = '22023';
    end if;
    if v_composer is not null and length(v_composer) > 200 then
      raise exception 'CHORDLIB_INVALID: tên tác giả quá dài' using errcode = '22023';
    end if;
    if p_parent_version_id is not null then
      raise exception 'CHORDLIB_INVALID: bài mới không có phiên bản cha' using errcode = '22023';
    end if;
    -- Gửi lại y hệt (cùng người, cùng tên bài, cùng NỘI DUNG, chưa bị từ chối) → trả bản đã có.
    -- Nội dung = lời + nhịp + BPM + bộ file nguồn + bộ vạch nhịp. text_hash vẫn CHỈ băm lời (neo ô nhịp bám theo lời) — nên
    -- trùng text_hash chưa đủ để gọi là trùng: đổi riêng nhịp, BPM, hay sheet nguồn là một phiên bản mới hợp lệ.
    select v.id, v.sheet_id into v_dup, v_dup_sheet
      from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
     where v.contributed_by = v_uid and v.text_hash = v_hash and v.review_status <> 'rejected'
       and v.meter is not distinct from p_meter and v.suggested_bpm is not distinct from p_suggested_bpm
       and public.chord_source_key(v.sources) = public.chord_source_key(v_sources)
       and v.anchors is not distinct from v_anchors
       and s.title_key = public.chord_fold_vi(v_title)
     order by v.created_at limit 1;
    if v_dup is not null then
      return jsonb_build_object('ok', true, 'duplicate', true, 'sheet_id', v_dup_sheet, 'version_id', v_dup);
    end if;
    insert into public.chord_sheets (title, composer, created_by)
    values (v_title, v_composer, v_uid) returning * into v_sheet;
  else
    select * into v_sheet from public.chord_sheets s where s.id = p_sheet_id for update;
    if not found or not (v_sheet.canonical_version_id is not null or v_review
         or exists (select 1 from public.chord_sheet_versions v where v.sheet_id = p_sheet_id and v.contributed_by = v_uid)) then
      raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002';
    end if;
    -- Trùng NỘI DUNG (lời + nhịp + BPM + bộ file nguồn) với bản chuẩn hiện hành, hoặc với bản mình đã gửi
    -- (chưa bị từ chối) → trả bản đó.
    select v.id into v_dup from public.chord_sheet_versions v
     where v.sheet_id = p_sheet_id and v.text_hash = v_hash
       and v.meter is not distinct from p_meter and v.suggested_bpm is not distinct from p_suggested_bpm
       and public.chord_source_key(v.sources) = public.chord_source_key(v_sources)
       and v.anchors is not distinct from v_anchors
       and (v.id = v_sheet.canonical_version_id or (v.contributed_by = v_uid and v.review_status <> 'rejected'))
     order by (v.id = v_sheet.canonical_version_id) desc nulls last, v.created_at limit 1;
    if v_dup is not null then
      return jsonb_build_object('ok', true, 'duplicate', true, 'sheet_id', p_sheet_id, 'version_id', v_dup);
    end if;
    -- Cha: người gọi chỉ định → bản chuẩn → bản gần nhất của chính mình trong bài.
    v_parent := coalesce(p_parent_version_id, v_sheet.canonical_version_id,
      (select v.id from public.chord_sheet_versions v
        where v.sheet_id = p_sheet_id and v.contributed_by = v_uid order by v.version_number desc limit 1));
    if v_parent is not null and not exists (
         select 1 from public.chord_sheet_versions v
          where v.id = v_parent and v.sheet_id = p_sheet_id
            and (v.review_status = 'approved' or v.contributed_by = v_uid or v_review)) then
      raise exception 'CHORDLIB_INVALID: phiên bản cha không thuộc bài này' using errcode = '22023';
    end if;
    select coalesce(max(v.version_number), 0) + 1 into v_num
      from public.chord_sheet_versions v where v.sheet_id = p_sheet_id;
  end if;

  if exists (select 1 from public.chord_sheet_versions v where v.id = v_vid) then
    raise exception 'CHORDLIB_INVALID: version_id đã được dùng' using errcode = '22023';
  end if;
  insert into public.chord_sheet_versions
    (id, sheet_id, version_number, parent_version_id, text, text_hash, meter, suggested_bpm, sources,
     anchors, anchor_review, generator, contributed_by, review_status, anchors_status)
  values
    (v_vid, v_sheet.id, v_num, v_parent, v_text, v_hash, p_meter, p_suggested_bpm, v_sources,
     v_anchors,
     case when v_anchors is null then null
          else jsonb_build_object('mode', 'manual', 'reviewedBy', v_uid, 'reviewedAt', now(),
                 'measureCount', jsonb_array_length(v_anchors -> 'measures'), 'hasPickup', v_anchors ? 'pickup') end,
     case when v_anchors is null then 'manual' else 'manual-anchors' end,
     v_uid, 'private', case when v_anchors is null then 'none' else 'ready' end);

  return jsonb_build_object('ok', true, 'duplicate', false, 'sheet_id', v_sheet.id, 'version_id', v_vid,
    'version_number', v_num, 'text_hash', v_hash, 'review_status', 'private',
    'anchors_status', case when v_anchors is null then 'none' else 'ready' end);
end $$;
comment on function public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb)
  is 'chord_library_v1: đóng góp bài mới / phiên bản mới (private; anchors none, hoặc ready khi kèm vạch nhịp — người review, hoặc Biên tập với bài của mình)';

create or replace function public.chord_sheet_accept_anchors(p_from_version_id uuid, p_anchors jsonb, p_anchor_review jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid;
  v public.chord_sheet_versions%rowtype;
  v_problem text;
  v_dup uuid;
  v_new uuid := gen_random_uuid();
  v_num integer;
begin
  if v_uid is null or not public.chordlib_can_anchors(
       (select x.sheet_id from public.chord_sheet_versions x where x.id = p_from_version_id)) then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if p_anchor_review is not null and (jsonb_typeof(p_anchor_review) <> 'object' or (p_anchor_review - 'mode') <> '{}'::jsonb
     or coalesce(p_anchor_review ->> 'mode', 'manual') <> 'manual') then
    raise exception 'CHORDLIB_INVALID: anchor_review chỉ nhận {"mode": "manual"}' using errcode = '22023';
  end if;
  select x.sheet_id into v_sid from public.chord_sheet_versions x where x.id = p_from_version_id;
  if v_sid is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  perform 1 from public.chord_sheets x where x.id = v_sid for update;
  select * into v from public.chord_sheet_versions x where x.id = p_from_version_id for update;
  if v.sheet_id is distinct from v_sid then
    raise exception 'CHORDLIB_RETRY: phiên bản vừa được dời sang bài khác — thử lại' using errcode = '40001';
  end if;
  if v.review_status = 'rejected' then
    raise exception 'CHORDLIB_INVALID: không gắn vạch nhịp vào bản đã bỏ' using errcode = '22023';
  end if;
  v_problem := public.chord_anchors_problem(p_anchors, public.chord_lyric_token_counts(v.text));
  if v_problem is not null then
    raise exception 'CHORDLIB_INVALID: vạch nhịp không hợp lệ — %', v_problem using errcode = '22023';
  end if;

  select x.id into v_dup from public.chord_sheet_versions x
   where x.sheet_id = v.sheet_id and x.review_status <> 'rejected' and x.anchors_status = 'ready'
     and x.text_hash = v.text_hash and x.meter is not distinct from v.meter and x.suggested_bpm is not distinct from v.suggested_bpm
     and public.chord_source_key(x.sources) = public.chord_source_key(v.sources) and x.anchors = p_anchors
   order by x.version_number limit 1;
  if v_dup is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'sheet_id', v.sheet_id, 'version_id', v_dup);
  end if;

  select coalesce(max(x.version_number), 0) + 1 into v_num from public.chord_sheet_versions x where x.sheet_id = v.sheet_id;
  insert into public.chord_sheet_versions
    (id, sheet_id, version_number, parent_version_id, text, text_hash, meter, suggested_bpm, sources,
     anchors, anchor_review, generator, contributed_by, review_status, anchors_status)
  values
    (v_new, v.sheet_id, v_num, v.id, v.text, v.text_hash, v.meter, v.suggested_bpm, v.sources,
     p_anchors,
     jsonb_build_object('mode', 'manual', 'reviewedBy', v_uid, 'reviewedAt', now(),
       'measureCount', jsonb_array_length(p_anchors -> 'measures'), 'hasPickup', p_anchors ? 'pickup'),
     'manual-anchors', v_uid, 'private', 'ready');
  return jsonb_build_object('ok', true, 'duplicate', false, 'sheet_id', v.sheet_id, 'version_id', v_new,
    'version_number', v_num, 'review_status', 'private', 'anchors_status', 'ready');
end $$;
comment on function public.chord_sheet_accept_anchors(uuid, jsonb, jsonb) is 'chord_library_v1: chấp nhận vạch nhịp → phiên bản mới (người review, hoặc Biên tập với bài của mình)';

create or replace function public.chord_sheet_accept_anchors_publish(p_from_version_id uuid, p_anchors jsonb, p_anchor_review jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v public.chord_sheet_versions%rowtype;
begin
  if v_uid is null then raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501'; end if;
  -- Người review, hoặc người KHÔNG phải Biên tập: đúng hành vi cũ (bản nháp; thiếu quyền → bị từ chối).
  if public.chordlib_can('review') or not public.teamlab_is_any_music_editor() then
    return public.chord_sheet_accept_anchors(p_from_version_id, p_anchors, p_anchor_review);
  end if;
  -- Biên tập: accept_anchors tự kiểm bài phải do chính mình tạo (chordlib_can_anchors).
  v_result := public.chord_sheet_accept_anchors(p_from_version_id, p_anchors, p_anchor_review);
  perform 1 from public.chord_sheets x where x.id = (v_result ->> 'sheet_id')::uuid for update;
  select * into v from public.chord_sheet_versions x where x.id = (v_result ->> 'version_id')::uuid for update;
  if v.contributed_by is distinct from v_uid then
    return v_result;   -- trùng với bản của người khác: không công khai hộ
  end if;
  if v.review_status = 'private' then
    update public.chord_sheet_versions
       set review_status = 'approved', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = null
     where id = v.id;
  end if;
  if v.review_status <> 'rejected' then
    update public.chord_sheets
       set canonical_version_id = v.id, archived_at = null, archived_by = null, updated_at = now()
     where id = v.sheet_id and created_by = v_uid;
  end if;
  return v_result || jsonb_build_object('review_status', 'approved', 'published', true);
end $fn$;
revoke all on function public.chord_sheet_accept_anchors_publish(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.chord_sheet_accept_anchors_publish(uuid, jsonb, jsonb) to authenticated;
comment on function public.chord_sheet_accept_anchors_publish(uuid, jsonb, jsonb)
  is 'chord_library_v1: chấp nhận vạch nhịp; Biên tập công khai ngay (bài của mình)';

notify pgrst, 'reload schema';
