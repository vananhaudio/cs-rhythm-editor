-- ═══════════════════════════════════════════════════════════════════════════
-- THƯ VIỆN HỢP ÂM V1.2 — VẠCH NHỊP THỦ CÔNG (delta cho production đã chạy V1.1).
-- Thêm 3 hàm: chord_lyric_token_counts (nội bộ), chord_anchors_problem (nội bộ), chord_sheet_accept_anchors (RPC,
-- chỉ người review). KHÔNG đổi bảng, policy, trigger, bucket, capability; không sửa hàm nào đã có.
-- Nội dung TRÍCH NGUYÊN VĂN khối "V1.2 ANCHORS" của db/chord_library_v1_setup.sql (test so md5 hai đường cài).
-- Idempotent. Rollback: db/chord_library_v1_2_anchors_rollback.sql. CHẠY cả file trong MỘT transaction.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
do $gate$ begin
  if to_regprocedure('public.chord_source_key(jsonb)') is null then
    raise exception 'GATE: chưa có Thư viện hợp âm V1.1 (chord_source_key) — dừng';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and proname in ('chord_lyric_token_counts', 'chord_anchors_problem', 'chord_sheet_accept_anchors')
              and coalesce(obj_description(oid, 'pg_proc'), '') not like 'chord_library_v1:%') then
    raise exception 'GATE: đã có hàm vạch nhịp lạ cùng tên — dừng';
  end if;
end $gate$;

-- >>> V1.2 ANCHORS ───────────────────────────────────────────────────────────────────────────
-- VẠCH NHỊP THỦ CÔNG (lát 5A). Vạch nhịp là NỘI DUNG: không bao giờ ghi vào phiên bản đã có — "Chấp nhận vạch
-- nhịp" tạo PHIÊN BẢN MỚI (cùng lời, nhịp, BPM, file nguồn; cha = phiên bản nguồn; anchors_status = ready;
-- review_status = private — vẫn phải Duyệt). Hình dạng (khớp prototype RhythmScrollAnchoredData):
--   { "pickup"?: {"line": n, "token": n}, "measures": [ {"line": n|null, "token": n|null}, … ] }
--   • measures là DÒNG THỜI GIAN biểu diễn (theo thứ tự hát, được quay lại dòng cũ khi điệp khúc lặp);
--   • line = dòng của lời chuẩn; token = chữ hát đầu ô, đếm SAU khi bỏ [hợp âm] và bỏ NHÃN đầu dòng;
--     token = số chữ của dòng = vạch cuối dòng; line null + token null = ô không lời; hai ô liền nhau
--     cùng vị trí = ô ngân. Không pixel, không toạ độ DOM.

-- Số chữ hát của từng dòng — CÙNG quy tắc với lyricTokens (src/thuvien/chordAnchors.ts), có test đối chiếu:
--   • [hợp âm] là ranh giới chữ, không phải chữ ("ti[Am]ễn" = 2 chữ);
--   • hợp âm cuối dòng mà không có chữ nào sau nó vẫn chiếm 1 vị trí (để vạch đặt được trước nó);
--   • chữ ĐẦU dòng, đứng trước mọi hợp âm, là NHÃN nếu (bỏ dấu, thường hoá) khớp: "1."…"99.", "đk", "coda",
--     "intro", "dạo", "verse", "chorus", "bridge" (có/không dấu ":") — nhãn không tính là chữ;
--   • khoảng trắng = tập \s của JavaScript.
create or replace function public.chord_lyric_token_counts(p_text text)
returns integer[] language plpgsql immutable strict parallel safe set search_path = '' as $$
declare
  v_marker constant text := '\[[^][[:space:]][^][\n]{0,15}\]';
  -- Khoảng trắng = đúng tập \s của JavaScript (gồm NBSP và các khoảng trắng Unicode).
  v_ws constant text := '[[:space:]   -     　﻿]';
  v_line text;
  v_words text;
  v_counts integer[] := '{}';
  v_n integer;
  v_prefix text;
  v_first text;
begin
  -- Lời rỗng = MỘT dòng trống (như split('\n') của JavaScript), không phải 0 dòng.
  foreach v_line in array coalesce(nullif(string_to_array(public.chord_canonical_text(p_text), E'\n'), '{}'), '{""}') loop
    v_words := regexp_replace(regexp_replace(v_line, v_marker, ' ', 'g'), '^' || v_ws || '+|' || v_ws || '+$', '', 'g');
    v_n := case when v_words = '' then 0 else array_length(regexp_split_to_array(v_words, v_ws || '+'), 1) end;
    -- hợp âm cuối dòng, sau nó không còn chữ → thêm 1 vị trí
    if v_line ~ v_marker and regexp_replace(v_line, '^.*' || v_marker, '') ~ ('^' || v_ws || '*$') then
      v_n := v_n + 1;
    end if;
    -- nhãn đầu dòng: chữ đầu tiên, đứng TRƯỚC hợp âm đầu tiên
    v_prefix := regexp_replace(split_part(regexp_replace(v_line, v_marker, E'\x01'), E'\x01', 1), '^' || v_ws || '+', '');
    v_first := (regexp_split_to_array(v_prefix, v_ws || '+'))[1];
    if coalesce(v_first, '') <> '' and public.chord_fold_vi(v_first) ~ '^(\d{1,2}\.|dk:?|coda:?|intro:?|dao:?|verse:?|chorus:?|bridge:?)$' then
      v_n := v_n - 1;
    end if;
    v_counts := v_counts || v_n;
  end loop;
  return v_counts;
end $$;
comment on function public.chord_lyric_token_counts(text) is 'chord_library_v1: số chữ hát mỗi dòng (bỏ hợp âm + nhãn) — nền kiểm vạch nhịp';

-- Kiểm vạch nhịp với ĐÚNG lời của phiên bản. NULL = hợp lệ; chuỗi = lý do. Không tin client.
create or replace function public.chord_anchors_problem(p_anchors jsonb, p_counts integer[])
returns text language plpgsql immutable parallel safe set search_path = '' as $$
declare
  v_anchor jsonb;
  v_at integer := 0;
  v_line integer;
  v_token integer;
  v_lines integer := coalesce(array_length(p_counts, 1), 0);
begin
  if p_anchors is null or jsonb_typeof(p_anchors) <> 'object' then return 'vạch nhịp phải là một object'; end if;
  if octet_length(p_anchors::text) > 100000 then return 'dữ liệu vạch nhịp quá lớn'; end if;
  if (p_anchors - 'pickup' - 'measures') <> '{}'::jsonb then return 'vạch nhịp chỉ gồm pickup và measures'; end if;
  if jsonb_typeof(p_anchors -> 'measures') is distinct from 'array' then return 'measures phải là một mảng'; end if;
  if jsonb_array_length(p_anchors -> 'measures') = 0 then return 'chưa có vạch nhịp nào'; end if;
  if jsonb_array_length(p_anchors -> 'measures') > 2000 then return 'tối đa 2000 ô nhịp'; end if;
  for v_anchor in
    select value from jsonb_array_elements(p_anchors -> 'measures')
    union all select p_anchors -> 'pickup' where p_anchors ? 'pickup'
  loop
    v_at := v_at + 1;
    if jsonb_typeof(v_anchor) is distinct from 'object' or (v_anchor - 'line' - 'token') <> '{}'::jsonb
       or not (v_anchor ? 'line') or not (v_anchor ? 'token') then
      return format('vị trí %s: phải là {line, token}', v_at);
    end if;
    if jsonb_typeof(v_anchor -> 'line') = 'null' then
      if jsonb_typeof(v_anchor -> 'token') <> 'null' then return format('vị trí %s: ô không lời thì token cũng phải null', v_at); end if;
      if v_at > jsonb_array_length(p_anchors -> 'measures') then return 'nhịp lấy đà phải nằm trên một chữ'; end if;
      continue;
    end if;
    if jsonb_typeof(v_anchor -> 'line') <> 'number' or jsonb_typeof(v_anchor -> 'token') <> 'number'
       or (v_anchor ->> 'line') !~ '^\d{1,5}$' or (v_anchor ->> 'token') !~ '^\d{1,5}$' then
      return format('vị trí %s: line và token phải là số nguyên ≥ 0', v_at);
    end if;
    v_line := (v_anchor ->> 'line')::integer;
    v_token := (v_anchor ->> 'token')::integer;
    if v_line >= v_lines then return format('vị trí %s: dòng %s không có trong lời', v_at, v_line + 1); end if;
    if p_counts[v_line + 1] = 0 then return format('vị trí %s: dòng %s không có chữ hát', v_at, v_line + 1); end if;
    if v_token > p_counts[v_line + 1] then return format('vị trí %s: dòng %s chỉ có %s chữ', v_at, v_line + 1, p_counts[v_line + 1]); end if;
  end loop;
  return null;
end $$;
comment on function public.chord_anchors_problem(jsonb, integer[]) is 'chord_library_v1: kiểm hình dạng + phạm vi vạch nhịp theo lời';

-- 6g) CHẤP NHẬN VẠCH NHỊP → PHIÊN BẢN MỚI. Chỉ người review. Phiên bản mới chép NGUYÊN nội dung của phiên
-- bản nguồn (lời, text_hash, nhịp, BPM) và TRỎ LẠI đúng các file nguồn của nó — không chép file: thư mục của
-- phiên bản nguồn đã đóng băng. Đây là đường DUY NHẤT tạo tham chiếu file nguồn sang thư mục khác; client không
-- gửi sources ở đây nên không thay được. anchor_review do máy chủ dựng (không tin client về người/giờ).
-- Trùng (cùng bài, cùng lời + nhịp + BPM + bộ nguồn + CÙNG vạch nhịp, chưa bị từ chối) → trả bản đã có.
-- Khoá: bài trước, phiên bản sau — như approve/reject; hai lượt Chấp nhận cùng bài xếp hàng trên khoá bài.
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
  if v_uid is null or not public.chordlib_can('review') then
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
comment on function public.chord_sheet_accept_anchors(uuid, jsonb, jsonb) is 'chord_library_v1: chấp nhận vạch nhịp → phiên bản mới (chỉ người review)';

revoke all on function public.chord_lyric_token_counts(text), public.chord_anchors_problem(jsonb, integer[]),
  public.chord_sheet_accept_anchors(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.chord_sheet_accept_anchors(uuid, jsonb, jsonb) to authenticated;
-- <<< V1.2 ANCHORS ───────────────────────────────────────────────────────────────────────────

notify pgrst, 'reload schema';
