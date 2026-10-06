-- ═══════════════════════════════════════════════════════════════════════════
-- THƯ VIỆN HỢP ÂM V1.3 — EXTRACTION (Slice 2A: nền DB cho đường PDF → chord-extraction/1). DELTA cho production đã chạy V1.2.
-- Rollback: db/chord_library_v1_3_extractions_rollback.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-chord-extraction-db.sh.
--
-- Context: thầy nạp một sheet (PDF/ảnh) rồi cần bản đọc máy (chord-extraction/1) để người sửa lời + hợp âm.
-- Engine chạy ở worker (Mac mini) bằng JWT của chính thầy — worker KHÔNG có service-role. Bảng này giữ KẾT QUẢ ĐỌC,
-- không phải bản nháp: chưa tạo phiên bản nào, chưa đổi bất cứ thứ gì của chord_sheet_versions.
--
-- Nguyên tắc:
--   • MỘT extraction = MỘT lần chạy trên MỘT file nguồn của MỘT phiên bản: (version_id, source_index) → file sources[source_index]
--     (sources bất biến nên con trỏ này không bao giờ trôi). Phiên bản nhiều file ⇒ nhiều extraction, ghép lại theo sources[].page.
--   • LẦN CHẠY BẤT BIẾN: running → succeeded|failed rồi KHÔNG đổi nữa (trigger). Chạy lại = hàng MỚI (rerun_of trỏ hàng cũ).
--   • TRUY VẾT: version → file nguồn (path/mime/sha256 chụp lại) → extraction → pipeline (engine/provider/model/ngưỡng nằm trong
--     cột pipeline, cùng khuôn chord-extraction/1). input_sha256 là sha256 worker TÍNH TRÊN BYTE ĐÃ TẢI và PHẢI bằng sha256 khai
--     ở sources — DB ép bằng CHECK, nên extraction thành công luôn gắn với đúng file đã khai.
--   • CHỐNG TRÙNG: request_key = sha256(version | source_index | source_sha256 | schema | engine_version | config_hash).
--     begin() trả lại lần chạy THÀNH CÔNG hoặc ĐANG CHẠY cùng khoá (double-click/retry không sinh hàng mới); chỉ p_force=true
--     (chủ ý chạy lại) mới tạo hàng mới. Chỉ một lần ĐANG CHẠY cho mỗi khoá (unique index một phần). Trần 10 lần/giờ/phiên bản.
--   • VÒNG ĐỜI: running (có lease) → succeeded | failed(error_code). Worker chết giữa chừng ⇒ lease hết hạn ⇒ ĐỌC ra 'failed/abandoned'
--     (không bao giờ trông như thành công), và begin() kế tiếp đóng hàng đó lại.
--   • QUYỀN: chỉ người có quyền REVIEW của chordlib (thầy/admin) — cùng ngưỡng với worker phân tích vạch nhịp. RLS bật, KHÔNG policy,
--     KHÔNG quyền bảng: mọi thứ qua RPC chord_extraction_* (SECURITY DEFINER). Người ghi kết quả = đúng người đã begin().
--   • GIỚI HẠN ĐÃ BIẾT: observation/pipeline do CLIENT worker gửi qua RPC, DB không kiểm chứng được chúng sinh từ đúng file
--     (chỉ kiểm khuôn, kích thước, sha256 file, engine_version). Người ghi đã là thầy/admin — vốn gõ được lời tuỳ ý — nên không
--     có leo thang quyền; extraction là "bằng chứng tham khảo có chữ ký người chạy", không phải bản chuẩn.
--   • error_code là mã máy đọc được từ danh sách đóng; KHÔNG lưu stack trace / thông điệp tự do / lời bài hát.
--
-- Chỉ TẠO MỚI. KHÔNG đụng chord_sheets / chord_sheet_versions / Storage / policy / quyền sẵn có. Idempotent.
-- CHẠY cả file trong MỘT transaction (file KHÔNG có begin/commit).
-- ⛔ CỔNG: CHƯA chạy trên production cho tới khi Owner duyệt PRE-MIGRATION GATE (xem báo cáo Slice 2A).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$ begin
  if to_regclass('public.chord_sheet_versions') is null
     or coalesce(obj_description('public.chord_sheet_versions'::regclass, 'pg_class'), '') not like 'chord_library_v1:%' then
    raise exception 'GATE: chưa có Thư viện hợp âm V1 — dừng';
  end if;
  if to_regprocedure('public.chord_sheet_accept_anchors(uuid, jsonb, jsonb)') is null then
    raise exception 'GATE: chưa có V1.2 (anchors) — dừng';
  end if;
  if to_regprocedure('public.chordlib_can(text)') is null then
    raise exception 'GATE: thiếu chordlib_can — dừng';
  end if;
  if to_regclass('public.chord_sheet_extractions') is not null
     and coalesce(obj_description(to_regclass('public.chord_sheet_extractions'), 'pg_class'), '') not like 'chord_library_v1:%' then
    raise exception 'GATE: đã có bảng chord_sheet_extractions lạ — dừng';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'chord\_extraction%'
              and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'chord_library_v1:%') then
    raise exception 'GATE: đã có hàm chord_extraction_* lạ — dừng';
  end if;
end $gate$;

-- ── 1) Bảng ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.chord_sheet_extractions (
  id               uuid primary key default gen_random_uuid(),
  -- restrict: phiên bản vốn không xoá được; extraction đi cùng phiên bản.
  version_id       uuid not null references public.chord_sheet_versions(id) on delete restrict,
  source_index     integer not null check (source_index between 0 and 9),
  -- Chụp lại mục sources[source_index] tại lúc chạy (sources bất biến ⇒ không trôi; chụp để tra không cần giải JSON).
  source_path      text not null check (source_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]\.(pdf|jpg|jpeg|png|webp)$'),
  source_mime      text not null check (source_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  source_sha256    text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  schema_version   text not null check (schema_version = 'chord-extraction/1'),
  engine_version   text not null check (length(engine_version) between 1 and 80),
  config_hash      text not null check (config_hash ~ '^[0-9a-f]{64}$'),
  request_key      text not null check (request_key ~ '^[0-9a-f]{64}$'),
  -- Chủ ý chạy lại: trỏ về lần chạy THÀNH CÔNG gần nhất cùng khoá (chuỗi kiểm toán).
  rerun_of         uuid references public.chord_sheet_extractions(id),
  status           text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error_code       text check (error_code is null or error_code in (
                     'source_missing', 'forbidden_source', 'unsupported_mime', 'sha_mismatch', 'too_large', 'timeout',
                     'ocr_unavailable', 'engine_failed', 'invalid_result', 'abandoned', 'upstream', 'internal', 'bad_file')),
  lease_expires_at timestamptz,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  duration_ms      integer check (duration_ms is null or duration_ms >= 0),
  -- ── KẾT QUẢ (chỉ khi succeeded) — khuôn chord-extraction/1 chia ba cột + vài cột phi chuẩn hoá để liệt kê không phải giải JSON ──
  input_sha256     text check (input_sha256 is null or input_sha256 ~ '^[0-9a-f]{64}$'),
  input_bytes      integer check (input_bytes is null or input_bytes between 1 and 20971520),
  page_count       integer check (page_count is null or page_count between 1 and 200),
  observation      jsonb check (observation is null or jsonb_typeof(observation) = 'array'),
  interpretation   jsonb check (interpretation is null or jsonb_typeof(interpretation) = 'object'),
  pipeline         jsonb check (pipeline is null or jsonb_typeof(pipeline) = 'object'),
  fallback_reasons text[],
  vision_status    text check (vision_status is null or length(vision_status) <= 40),
  -- set null: tài khoản bị xoá (delete_my_account) thì extraction ở lại, không còn tên.
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint chord_extractions_shape_chk check (
       (status = 'running' and lease_expires_at is not null and finished_at is null and error_code is null
          and observation is null and interpretation is null and pipeline is null and input_sha256 is null
          and input_bytes is null and page_count is null)
    or (status = 'succeeded' and lease_expires_at is null and finished_at is not null and error_code is null
          and observation is not null and interpretation is not null and pipeline is not null
          and input_sha256 = source_sha256 and input_bytes is not null and page_count is not null
          and jsonb_array_length(observation) = page_count)
    or (status = 'failed' and lease_expires_at is null and finished_at is not null and error_code is not null
          and observation is null and interpretation is null and pipeline is null and input_sha256 is null)),
  -- Trần kích thước: đo corpus thật 37–225 KB (compact); 4 MB là trần an toàn cho PDF ≤ 20 trang, vượt = từ chối chứ không nuốt.
  constraint chord_extractions_size_chk check (observation is null or octet_length(observation::text) <= 4194304)
);
comment on table public.chord_sheet_extractions is 'chord_library_v1: một lần chạy engine đọc một file nguồn của một phiên bản (bất biến sau khi kết thúc)';
create index if not exists chord_extractions_version_idx on public.chord_sheet_extractions (version_id, created_at desc);
create index if not exists chord_extractions_key_idx on public.chord_sheet_extractions (request_key, created_at desc);
create index if not exists chord_extractions_creator_idx on public.chord_sheet_extractions (created_by);
-- Một lần ĐANG CHẠY cho mỗi khoá yêu cầu: hai worker/request đồng thời không thể cùng chạy một việc.
create unique index if not exists chord_extractions_one_running_idx on public.chord_sheet_extractions (request_key) where status = 'running';

-- ── 2) BẤT BIẾN — chặn ở database, không chỉ ở mã ────────────────────────────────────────────
create or replace function public.chord_extractions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CHORDLIB_EXTRACTION_UNDELETABLE: không xoá lần chạy extraction' using errcode = '23514';
  end if;
  -- Tài khoản bị xoá: chỉ created_by được về NULL (on delete set null), mọi thứ khác nguyên.
  if old.status in ('succeeded', 'failed') then
    if (to_jsonb(new) - 'created_by') is distinct from (to_jsonb(old) - 'created_by')
       or (new.created_by is distinct from old.created_by and new.created_by is not null) then
      raise exception 'CHORDLIB_EXTRACTION_IMMUTABLE: lần chạy đã kết thúc thì không sửa; hãy chạy lại (hàng mới)' using errcode = '23514';
    end if;
    return new;
  end if;
  -- running: danh tính + khoá yêu cầu không đổi; chỉ được đi tiếp sang succeeded|failed.
  if (new.id, new.version_id, new.source_index, new.source_path, new.source_mime, new.source_sha256, new.schema_version,
      new.engine_version, new.config_hash, new.request_key, new.rerun_of, new.started_at, new.created_at)
     is distinct from
     (old.id, old.version_id, old.source_index, old.source_path, old.source_mime, old.source_sha256, old.schema_version,
      old.engine_version, old.config_hash, old.request_key, old.rerun_of, old.started_at, old.created_at)
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'CHORDLIB_EXTRACTION_IMMUTABLE: danh tính lần chạy không đổi' using errcode = '23514';
  end if;
  return new;
end $$;
comment on function public.chord_extractions_guard() is 'chord_library_v1: trigger bất biến của extraction';
drop trigger if exists chord_extractions_guard_trg on public.chord_sheet_extractions;
create trigger chord_extractions_guard_trg before update or delete on public.chord_sheet_extractions
  for each row execute function public.chord_extractions_guard();

-- ── 3) RLS: bật, KHÔNG policy, KHÔNG quyền bảng ─────────────────────────────────────────────
alter table public.chord_sheet_extractions enable row level security;
revoke all on public.chord_sheet_extractions from public, anon, authenticated;
grant all on public.chord_sheet_extractions to service_role;

-- ── 4) RPC ──────────────────────────────────────────────────────────────────────────────────
-- Lỗi (cùng bảng mã với chord_sheet_*): 42501 CHORDLIB_FORBIDDEN · 22023 CHORDLIB_INVALID · P0002 CHORDLIB_NOT_FOUND ·
-- 54000 CHORDLIB_LIMIT. "Không có" và "không được xem" cùng một lỗi NOT_FOUND.

-- 4a) BẮT ĐẦU (idempotent). Trả {ok, duplicate, status, extraction_id, source?}.
--   duplicate=true: đã có lần chạy THÀNH CÔNG hoặc ĐANG CHẠY cùng khoá → dùng lại (không hàng mới).
--   p_force=true: chủ ý chạy lại một khoá đã thành công (hàng mới, rerun_of trỏ hàng cũ). Lần đang chạy vẫn được dùng lại.
--   Lần chạy 'running' đã quá lease bị đóng thành failed/abandoned trước khi quyết định.
create or replace function public.chord_extraction_begin(
  p_version_id uuid, p_source_index integer, p_engine_version text, p_config_hash text, p_force boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v public.chord_sheet_versions%rowtype;
  v_src jsonb;
  v_key text;
  v_prev public.chord_sheet_extractions%rowtype;
  v_ok_id uuid;
  v_new public.chord_sheet_extractions%rowtype;
begin
  if v_uid is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if p_source_index is null or p_source_index not between 0 and 9
     or p_engine_version is null or length(p_engine_version) not between 1 and 80
     or p_config_hash is null or p_config_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'CHORDLIB_INVALID: tham số không hợp lệ' using errcode = '22023';
  end if;
  select * into v from public.chord_sheet_versions x where x.id = p_version_id;
  if not found then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  v_src := v.sources -> p_source_index;
  if v_src is null or jsonb_typeof(v_src) <> 'object' then
    raise exception 'CHORDLIB_INVALID: phiên bản không có file nguồn thứ %', p_source_index using errcode = '22023';
  end if;
  v_key := encode(sha256(convert_to(concat_ws('|', v.id::text, p_source_index::text, v_src ->> 'sha256', 'chord-extraction/1',
                                               p_engine_version, p_config_hash), 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('chordext:' || v_key, 0));

  update public.chord_sheet_extractions e
     set status = 'failed', error_code = 'abandoned', lease_expires_at = null, finished_at = now()
   where e.request_key = v_key and e.status = 'running' and e.lease_expires_at < now();

  select * into v_prev from public.chord_sheet_extractions e where e.request_key = v_key and e.status = 'running' limit 1;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'status', 'running', 'extraction_id', v_prev.id);
  end if;
  select e.id into v_ok_id from public.chord_sheet_extractions e
   where e.request_key = v_key and e.status = 'succeeded' order by e.created_at desc limit 1;
  if v_ok_id is not null and not coalesce(p_force, false) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'status', 'succeeded', 'extraction_id', v_ok_id);
  end if;
  -- Trần: không để retry/double-click sinh hàng trăm hàng. 10 lần chạy / giờ / phiên bản.
  if (select count(*) from public.chord_sheet_extractions e where e.version_id = v.id and e.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'CHORDLIB_LIMIT: phiên bản này đã chạy phân tích 10 lần trong một giờ — thử lại sau' using errcode = '54000';
  end if;

  insert into public.chord_sheet_extractions (version_id, source_index, source_path, source_mime, source_sha256, schema_version,
                                              engine_version, config_hash, request_key, rerun_of, status, lease_expires_at, created_by)
  values (v.id, p_source_index, v_src ->> 'path', v_src ->> 'mime', v_src ->> 'sha256', 'chord-extraction/1',
          p_engine_version, p_config_hash, v_key, v_ok_id, 'running', now() + interval '5 minutes', v_uid)
  returning * into v_new;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'running', 'extraction_id', v_new.id,
    'lease_expires_at', v_new.lease_expires_at,
    'source', jsonb_build_object('path', v_new.source_path, 'mime', v_new.source_mime, 'sha256', v_new.source_sha256,
                                 'size_bytes', v_src -> 'size_bytes'));
end $$;
comment on function public.chord_extraction_begin(uuid, integer, text, text, boolean) is 'chord_library_v1: bắt đầu một lần chạy extraction (idempotent theo request_key)';

-- 4b) HOÀN TẤT thành công. Chỉ người đã begin(); chỉ khi còn 'running'. Gọi lại khi đã succeeded = no-op (không ghi đè).
create or replace function public.chord_extraction_complete(
  p_id uuid, p_input_sha256 text, p_input_bytes integer, p_page_count integer,
  p_observation jsonb, p_interpretation jsonb, p_pipeline jsonb, p_duration_ms integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  e public.chord_sheet_extractions%rowtype;
begin
  if v_uid is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  select * into e from public.chord_sheet_extractions x where x.id = p_id for update;
  if not found or e.created_by is distinct from v_uid then
    raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002';
  end if;
  if e.status = 'succeeded' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'status', 'succeeded', 'extraction_id', e.id);
  end if;
  if e.status <> 'running' then
    raise exception 'CHORDLIB_INVALID: lần chạy đã đóng (%)', e.error_code using errcode = '22023';
  end if;
  if p_input_sha256 is distinct from e.source_sha256 then
    raise exception 'CHORDLIB_INVALID: sha256 file đã đọc khác sha256 khai ở phiên bản' using errcode = '22023';
  end if;
  if p_page_count is null or p_page_count not between 1 and 200 or p_input_bytes is null or p_input_bytes not between 1 and 20971520
     or p_observation is null or jsonb_typeof(p_observation) <> 'array' or jsonb_array_length(p_observation) <> p_page_count
     or p_interpretation is null or jsonb_typeof(p_interpretation) <> 'object'
     or not (p_interpretation ? 'metadata' and p_interpretation ? 'chords' and p_interpretation ? 'draft')
     or p_pipeline is null or jsonb_typeof(p_pipeline) <> 'object'
     or jsonb_typeof(p_pipeline -> 'stages') is distinct from 'array'
     or jsonb_typeof(p_pipeline -> 'vision') is distinct from 'object'
     or (p_pipeline ->> 'engineVersion') is distinct from e.engine_version then
    raise exception 'CHORDLIB_INVALID: kết quả extraction sai khuôn chord-extraction/1' using errcode = '22023';
  end if;
  if octet_length(p_observation::text) > 4194304 then
    raise exception 'CHORDLIB_INVALID: kết quả extraction quá lớn (tối đa 4 MB)' using errcode = '22023';
  end if;
  update public.chord_sheet_extractions x
     set status = 'succeeded', lease_expires_at = null, finished_at = now(), duration_ms = p_duration_ms,
         input_sha256 = p_input_sha256, input_bytes = p_input_bytes, page_count = p_page_count,
         observation = p_observation, interpretation = p_interpretation, pipeline = p_pipeline,
         fallback_reasons = coalesce((select array_agg(r ->> 'code') from jsonb_array_elements(
                              case when jsonb_typeof(p_pipeline -> 'fallbackReasons') = 'array' then p_pipeline -> 'fallbackReasons' else '[]'::jsonb end) r), '{}'),
         vision_status = left(p_pipeline -> 'vision' ->> 'status', 40)
   where x.id = e.id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'succeeded', 'extraction_id', e.id);
end $$;
comment on function public.chord_extraction_complete(uuid, text, integer, integer, jsonb, jsonb, jsonb, integer) is 'chord_library_v1: ghi kết quả extraction (người đã begin)';

-- 4c) THẤT BẠI có mã máy đọc được (danh sách đóng — CHECK của bảng). Gọi lại khi đã đóng = no-op.
create or replace function public.chord_extraction_fail(p_id uuid, p_error_code text, p_duration_ms integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  e public.chord_sheet_extractions%rowtype;
begin
  if v_uid is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  select * into e from public.chord_sheet_extractions x where x.id = p_id for update;
  if not found or e.created_by is distinct from v_uid then
    raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002';
  end if;
  if e.status <> 'running' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'status', e.status, 'extraction_id', e.id);
  end if;
  if p_error_code is null or p_error_code = 'abandoned' or p_error_code not in (
       'source_missing', 'forbidden_source', 'unsupported_mime', 'sha_mismatch', 'too_large', 'timeout',
       'ocr_unavailable', 'engine_failed', 'invalid_result', 'upstream', 'internal', 'bad_file') then
    raise exception 'CHORDLIB_INVALID: mã lỗi không hợp lệ' using errcode = '22023';
  end if;
  update public.chord_sheet_extractions x
     set status = 'failed', error_code = p_error_code, lease_expires_at = null, finished_at = now(), duration_ms = p_duration_ms
   where x.id = e.id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'failed', 'extraction_id', e.id, 'error_code', p_error_code);
end $$;
comment on function public.chord_extraction_fail(uuid, text, integer) is 'chord_library_v1: đóng lần chạy extraction là thất bại (mã máy đọc được)';

-- 4d) ĐỌC một extraction (đủ tài liệu chord-extraction/1 khi succeeded). Quá lease mà còn 'running' ⇒ ra 'failed/abandoned'
-- (đọc không ghi) — một worker chết giữa đường không bao giờ trông như đang chạy mãi hay đã thành công.
create or replace function public.chord_extraction_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  e public.chord_sheet_extractions%rowtype;
  v_status text;
  v_error text;
begin
  if auth.uid() is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  select * into e from public.chord_sheet_extractions x where x.id = p_id;
  if not found then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  v_status := e.status; v_error := e.error_code;
  if e.status = 'running' and e.lease_expires_at < now() then v_status := 'failed'; v_error := 'abandoned'; end if;
  return jsonb_build_object(
    'extraction_id', e.id, 'version_id', e.version_id, 'source_index', e.source_index,
    'source', jsonb_build_object('path', e.source_path, 'mime', e.source_mime, 'sha256', e.source_sha256),
    'schema_version', e.schema_version, 'engine_version', e.engine_version, 'config_hash', e.config_hash, 'rerun_of', e.rerun_of,
    'status', v_status, 'error_code', v_error, 'started_at', e.started_at, 'finished_at', e.finished_at, 'duration_ms', e.duration_ms,
    'page_count', e.page_count, 'fallback_reasons', to_jsonb(e.fallback_reasons), 'vision_status', e.vision_status,
    'created_by', e.created_by, 'created_at', e.created_at)
  || case when e.status = 'succeeded' then jsonb_build_object('document', jsonb_build_object(
       'schema', e.schema_version, 'extractionId', e.id, 'createdAt', e.finished_at,
       'input', jsonb_build_object('sha256', e.input_sha256, 'mime', e.source_mime, 'bytes', e.input_bytes, 'pageCount', e.page_count),
       'pipeline', e.pipeline, 'pages', e.observation, 'interpretation', e.interpretation))
     else '{}'::jsonb end;
end $$;
comment on function public.chord_extraction_get(uuid) is 'chord_library_v1: đọc một extraction (tài liệu chord-extraction/1 khi thành công)';

-- 4e) LIỆT KÊ extraction của một phiên bản — chỉ metadata (không JSON thân), mới nhất trước, tối đa 50.
create or replace function public.chord_extraction_list(p_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.chord_sheet_versions v where v.id = p_version_id) then
    raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002';
  end if;
  return coalesce((select jsonb_agg(s.x order by s.ord desc) from (
    select e.created_at as ord, jsonb_build_object(
      'extraction_id', e.id, 'source_index', e.source_index,
      'status', case when e.status = 'running' and e.lease_expires_at < now() then 'failed' else e.status end,
      'error_code', case when e.status = 'running' and e.lease_expires_at < now() then 'abandoned' else e.error_code end,
      'engine_version', e.engine_version, 'created_at', e.created_at, 'finished_at', e.finished_at, 'duration_ms', e.duration_ms,
      'page_count', e.page_count, 'fallback_reasons', to_jsonb(e.fallback_reasons), 'vision_status', e.vision_status, 'rerun_of', e.rerun_of) as x
      from public.chord_sheet_extractions e where e.version_id = p_version_id order by e.created_at desc limit 50) s), '[]'::jsonb);
end $$;
comment on function public.chord_extraction_list(uuid) is 'chord_library_v1: liệt kê extraction của một phiên bản (metadata)';

revoke all on function public.chord_extractions_guard(),
  public.chord_extraction_begin(uuid, integer, text, text, boolean),
  public.chord_extraction_complete(uuid, text, integer, integer, jsonb, jsonb, jsonb, integer),
  public.chord_extraction_fail(uuid, text, integer), public.chord_extraction_get(uuid), public.chord_extraction_list(uuid)
from public, anon, authenticated;
grant execute on function
  public.chord_extraction_begin(uuid, integer, text, text, boolean),
  public.chord_extraction_complete(uuid, text, integer, integer, jsonb, jsonb, jsonb, integer),
  public.chord_extraction_fail(uuid, text, integer), public.chord_extraction_get(uuid), public.chord_extraction_list(uuid)
to authenticated;

notify pgrst, 'reload schema';
