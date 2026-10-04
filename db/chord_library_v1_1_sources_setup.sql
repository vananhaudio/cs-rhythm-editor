-- ═══════════════════════════════════════════════════════════════════════════
-- THƯ VIỆN HỢP ÂM V1.1 — FILE NGUỒN TÍNH VÀO PHÉP DÒ TRÙNG (delta cho production đã chạy v1 @ 546f5ce).
-- Vì sao: chord_sheet_contribute coi "cùng lời + nhịp + BPM" là trùng và trả bản cũ — nên khi thầy CHỈ thay
-- sheet nguồn, phiên bản mới không được ghi và file vừa tải bị bỏ lại không gắn. Từ bản này: trùng = lời +
-- nhịp + BPM + bộ file nguồn (sha256). text_hash KHÔNG đổi nghĩa (vẫn chỉ băm lời).
-- Nội dung hàm TRÍCH NGUYÊN VĂN từ db/chord_library_v1_setup.sql (test so md5 thân hàm giữa hai đường cài).
-- Không đổi bảng, policy, quyền, trigger, bucket. Idempotent. Rollback: db/chord_library_v1_1_sources_rollback.sql.
-- CHẠY cả file trong MỘT transaction (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
do $gate$ begin
  if to_regprocedure('public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid)') is null
     or coalesce(obj_description(to_regprocedure('public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid)'), 'pg_proc'), '') not like 'chord_library_v1:%' then
    raise exception 'GATE: chưa có Thư viện hợp âm V1 (db/chord_library_v1_setup.sql) — dừng';
  end if;
  if exists (select 1 from pg_proc where proname = 'chord_source_key' and pronamespace = 'public'::regnamespace
              and coalesce(obj_description(oid, 'pg_proc'), '') not like 'chord_library_v1:%') then
    raise exception 'GATE: đã có hàm chord_source_key lạ — dừng';
  end if;
end $gate$;

-- Bộ file nguồn của một phiên bản → một khoá so sánh: các sha256 đã sắp xếp. Hai phiên bản cùng lời/nhịp/BPM
-- nhưng KHÁC bộ file nguồn là hai phiên bản khác nhau (thay sheet nguồn = phiên bản mới). Rỗng/null → ''.
create or replace function public.chord_source_key(p jsonb)
returns text language sql immutable parallel safe set search_path = '' as $$
  select coalesce((select string_agg(e ->> 'sha256', ',' order by e ->> 'sha256')
                     from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) e), '');
$$;
comment on function public.chord_source_key(jsonb) is 'chord_library_v1: khoá so sánh bộ file nguồn (sha256 đã sắp xếp)';

-- 6b) ĐÓNG GÓP. p_sheet_id null = bài mới; có p_sheet_id = phiên bản mới của bài đã có (sửa/nâng chất
-- lượng — KHÔNG sửa bản chuẩn trực tiếp). Người đóng góp = auth.uid(), không bao giờ lấy từ payload.
-- p_version_id do client sinh TRƯỚC để tải file nguồn lên {uid}/{version_id}/{n}.{ext} rồi mới gọi hàm.
create or replace function public.chord_sheet_contribute(
  p_text text,
  p_title text default null,
  p_composer text default null,
  p_meter jsonb default null,
  p_suggested_bpm integer default null,
  p_sources jsonb default '[]'::jsonb,
  p_version_id uuid default null,
  p_sheet_id uuid default null,
  p_parent_version_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_review boolean;
  v_text text := public.chord_canonical_text(p_text);
  v_hash text;
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
    -- Nội dung = lời + nhịp + BPM + bộ file nguồn. text_hash vẫn CHỈ băm lời (neo ô nhịp bám theo lời) — nên
    -- trùng text_hash chưa đủ để gọi là trùng: đổi riêng nhịp, BPM, hay sheet nguồn là một phiên bản mới hợp lệ.
    select v.id, v.sheet_id into v_dup, v_dup_sheet
      from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
     where v.contributed_by = v_uid and v.text_hash = v_hash and v.review_status <> 'rejected'
       and v.meter is not distinct from p_meter and v.suggested_bpm is not distinct from p_suggested_bpm
       and public.chord_source_key(v.sources) = public.chord_source_key(v_sources)
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
     generator, contributed_by, review_status, anchors_status)
  values
    (v_vid, v_sheet.id, v_num, v_parent, v_text, v_hash, p_meter, p_suggested_bpm, v_sources,
     'manual', v_uid, 'private', 'none');

  return jsonb_build_object('ok', true, 'duplicate', false, 'sheet_id', v_sheet.id, 'version_id', v_vid,
    'version_number', v_num, 'text_hash', v_hash, 'review_status', 'private', 'anchors_status', 'none');
end $$;
comment on function public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid)
  is 'chord_library_v1: đóng góp bài mới / phiên bản mới (private, anchors none)';

revoke all on function public.chord_source_key(jsonb) from public, anon, authenticated;
revoke all on function public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid) from public, anon;
grant execute on function public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
