-- ═══ TEST V1.3 extraction — cluster PostgreSQL TẠM (scripts/test-chord-extraction-db.sh) ═══
-- Nạp SAU fixture + community_setup + nhipphach_capabilities_setup + chord_library_v1_setup + v1_3 setup.
-- A, B = học viên · T = thầy · X = admin · khách = anon
\set ON_ERROR_STOP on
\o /dev/null
begin;
create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid when 'X' then 'ffffffff-0000-4000-8000-00000000000f'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg;
end $$;
create function t.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute q; exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then raise exception 'FAIL: % — sai lý do: %', msg, sqlerrm; end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
create table t.kv (k text primary key, v jsonb);
grant all on t.kv to anon, authenticated;
create function t.put(p_k text, p_v jsonb) returns jsonb language sql as $$
  insert into t.kv values (p_k, p_v) on conflict (k) do update set v = excluded.v returning v $$;
create function t.id(p_k text, p_f text default 'extraction_id') returns uuid language sql as $$ select (v ->> p_f)::uuid from t.kv where k = p_k $$;
-- Kết quả extraction hợp lệ tối thiểu (khuôn chord-extraction/1 mà RPC kiểm): pages, interpretation, pipeline
create function t.obs(n int default 2) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('index', i, 'kind', 'scan', 'method', 'local_ocr', 'regions', '[]'::jsonb)), '[]'::jsonb) from generate_series(1, n) i $$;
create function t.interp() returns jsonb language sql as $$
  select '{"metadata":{"title":null,"author":null,"key":null,"timeSignature":null,"bpm":null},"chords":{"status":"NO_CHORDS_DETECTED","count":0},"structure":null,"draft":{"text":"x","warnings":[],"reviewRequired":true}}'::jsonb $$;
create function t.pipe(eng text default 'chord-extract/1.0.0-slice1') returns jsonb language sql as $$
  select jsonb_build_object('engineVersion', eng, 'stages', '[]'::jsonb, 'config', '{}'::jsonb, 'metrics', '{}'::jsonb,
    'fallbackReasons', '[{"code":"METADATA_MISSING","detail":"x"},{"code":"HIGH_NOISE_RATIO","detail":"y"}]'::jsonb, 'vision', '{"status":"skipped_no_provider"}'::jsonb) $$;
create function t.h(s text) returns text language sql as $$ select encode(sha256(convert_to(s, 'UTF8')), 'hex') $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Dữ liệu nền (postgres, bỏ qua RPC): 1 bài, 1 phiên bản 2 file nguồn (do T đóng góp), 1 phiên bản không file ──
select t.reset();
insert into public.chord_sheets (id, title, composer, created_by) values ('10000000-0000-4000-8000-000000000001', 'Bài thử', 'Tác giả', t.u('T'));
insert into public.chord_sheet_versions (id, sheet_id, version_number, text, text_hash, sources, contributed_by) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, 'la [C] la', t.h('la [C] la'),
   jsonb_build_array(
     jsonb_build_object('path', t.u('T') || '/20000000-0000-4000-8000-000000000001/0.pdf', 'mime', 'application/pdf', 'sha256', t.h('file0'), 'page', 1, 'size_bytes', 31417),
     jsonb_build_object('path', t.u('T') || '/20000000-0000-4000-8000-000000000001/1.jpg', 'mime', 'image/jpeg', 'sha256', t.h('file1'), 'page', 2, 'size_bytes', 1000)), t.u('T')),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 2, 'la [G] la', t.h('la [G] la'), '[]'::jsonb, t.u('T'));
-- A (học viên) là người đóng góp của một phiên bản có nguồn — vẫn KHÔNG đọc/ghi được extraction
insert into public.chord_sheets (id, title, created_by) values ('10000000-0000-4000-8000-000000000002', 'Bài của A', t.u('A'));
insert into public.chord_sheet_versions (id, sheet_id, version_number, text, text_hash, sources, contributed_by) values
  ('20000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000002', 1, 'a', t.h('a'),
   jsonb_build_array(jsonb_build_object('path', t.u('A') || '/20000000-0000-4000-8000-0000000000a1/0.png', 'mime', 'image/png', 'sha256', t.h('fa'), 'size_bytes', 10)), t.u('A'));

-- ── 0) Rào chắn tĩnh ────────────────────────────────────────────────────────────────────────
select t.ok((select relrowsecurity from pg_class where oid = 'public.chord_sheet_extractions'::regclass)
  and (select count(*) from pg_policies where tablename = 'chord_sheet_extractions') = 0, 'bảng extraction: RLS bật, 0 policy');
select t.ok((select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'chord_sheet_extractions' and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0,
  'anon/authenticated: 0 quyền bảng extraction');
select t.ok((select string_agg(p.proname, ',' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname like 'chord\_extraction%' and has_function_privilege('authenticated', p.oid, 'execute'))
  = 'chord_extraction_begin,chord_extraction_complete,chord_extraction_fail,chord_extraction_get,chord_extraction_list', 'authenticated: đúng 5 RPC extraction');
select t.ok((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'chord\_extraction%' and has_function_privilege('anon', p.oid, 'execute')) = 0,
  'anon: 0 hàm extraction gọi được');
select t.ok(has_function_privilege('authenticated', 'public.chord_extractions_guard()'::regprocedure, 'execute') = false, 'trigger guard không gọi được từ client');
select t.ok((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'chord\_extraction%' or p.proname = 'chord_extractions_guard')
   and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'chord_library_v1:%') = 0, 'mọi hàm extraction mang nhãn chord_library_v1');

-- ── Quyền ───────────────────────────────────────────────────────────────────────────────────
select t.as_anon();
select t.fails($q$select public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'e', repeat('a', 64))$q$, 'khách KHÔNG begin', 'permission denied');
select t.fails('select * from public.chord_sheet_extractions', 'khách KHÔNG đọc thẳng bảng', 'permission denied');
select t.as_user('A');
select t.fails($q$select public.chord_extraction_begin('20000000-0000-4000-8000-0000000000a1', 0, 'e', repeat('a', 64))$q$, 'học viên A KHÔNG begin (kể cả trên bản của mình)', 'CHORDLIB_FORBIDDEN');
select t.fails($q$select public.chord_extraction_get(gen_random_uuid())$q$, 'học viên KHÔNG get', 'CHORDLIB_FORBIDDEN');
select t.fails($q$select public.chord_extraction_list('20000000-0000-4000-8000-0000000000a1')$q$, 'học viên KHÔNG list', 'CHORDLIB_FORBIDDEN');
select t.fails('select * from public.chord_sheet_extractions', 'học viên KHÔNG đọc thẳng bảng', 'permission denied');
select t.fails($q$insert into public.chord_sheet_extractions (version_id) values (gen_random_uuid())$q$, 'học viên KHÔNG ghi thẳng bảng', 'permission denied');

-- ── begin: tạo, idempotent, danh tính ───────────────────────────────────────────────────────
select t.as_user('T');
select t.fails($q$select public.chord_extraction_begin(gen_random_uuid(), 0, 'e', repeat('a', 64))$q$, 'phiên bản không có → NOT_FOUND', 'CHORDLIB_NOT_FOUND');
select t.fails($q$select public.chord_extraction_begin('20000000-0000-4000-8000-000000000002', 0, 'e', repeat('a', 64))$q$, 'phiên bản không có file nguồn → INVALID', 'CHORDLIB_INVALID');
select t.fails($q$select public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 2, 'e', repeat('a', 64))$q$, 'source_index vượt số file → INVALID', 'CHORDLIB_INVALID');
select t.fails($q$select public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 10, 'e', repeat('a', 64))$q$, 'source_index = 10 → INVALID', 'CHORDLIB_INVALID');
select t.fails($q$select public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'e', 'xyz')$q$, 'config_hash sai khuôn → INVALID', 'CHORDLIB_INVALID');
select t.put('b1', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'chord-extract/1.0.0-slice1', repeat('a', 64)));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'status' = 'running' and v -> 'source' ->> 'sha256' = t.h('file0')
               and v -> 'source' ->> 'mime' = 'application/pdf' and v -> 'source' ->> 'path' like '%/0.pdf' from t.kv where k = 'b1'),
  'begin tạo lần chạy running, trả path/mime/sha256 của ĐÚNG sources[0]');
select t.put('b1again', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'chord-extract/1.0.0-slice1', repeat('a', 64)));
select t.ok((select v ->> 'duplicate' = 'true' and v ->> 'status' = 'running' and v ->> 'extraction_id' = (select v ->> 'extraction_id' from t.kv where k = 'b1') from t.kv where k = 'b1again'),
  'double-click: begin lần 2 cùng khoá → duplicate, cùng extraction_id, KHÔNG hàng mới');
select t.reset();
select t.ok((select count(*) from public.chord_sheet_extractions) = 1, 'chỉ 1 hàng sau 2 lần begin');
select t.fails($q$insert into public.chord_sheet_extractions (version_id, source_index, source_path, source_mime, source_sha256, schema_version, engine_version, config_hash, request_key, lease_expires_at)
  select version_id, source_index, source_path, source_mime, source_sha256, schema_version, engine_version, config_hash, request_key, now() + interval '1 min' from public.chord_sheet_extractions$q$,
  'unique index: không thể có 2 lần running cùng khoá', 'chord_extractions_one_running_idx');

-- ── get/list khi running ─────────────────────────────────────────────────────────────────────
select t.as_user('X');
select t.ok(public.chord_extraction_get(t.id('b1')) ->> 'status' = 'running' and not (public.chord_extraction_get(t.id('b1')) ? 'document'), 'admin X đọc được lần chạy của T: running, chưa có document');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 100, 2, t.obs(2), t.interp(), t.pipe(), 10)$q$, t.id('b1'), t.h('file0')), 'X KHÔNG hoàn tất lần chạy của T (đúng người đã begin)', 'CHORDLIB_NOT_FOUND');
select t.fails(format($q$select public.chord_extraction_fail(%L, 'internal')$q$, t.id('b1')), 'X KHÔNG đóng lần chạy của T', 'CHORDLIB_NOT_FOUND');

-- ── complete: kiểm khuôn ─────────────────────────────────────────────────────────────────────
select t.as_user('T');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 100, 2, t.obs(2), t.interp(), t.pipe(), 10)$q$, t.id('b1'), t.h('file-khac')), 'sha256 đã đọc ≠ sha256 khai → INVALID', 'sha256');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 100, 3, t.obs(2), t.interp(), t.pipe(), 10)$q$, t.id('b1'), t.h('file0')), 'page_count ≠ số trang observation → INVALID', 'sai khuôn');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 100, 2, t.obs(2), t.interp(), t.pipe('engine-khac'), 10)$q$, t.id('b1'), t.h('file0')), 'engineVersion trong pipeline ≠ lúc begin → INVALID', 'sai khuôn');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 100, 2, '{}'::jsonb, t.interp(), t.pipe(), 10)$q$, t.id('b1'), t.h('file0')), 'observation không phải mảng → INVALID', 'sai khuôn');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 100, 2, t.obs(2), '{"x":1}'::jsonb, t.pipe(), 10)$q$, t.id('b1'), t.h('file0')), 'interpretation thiếu khoá → INVALID', 'sai khuôn');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 100, 1, jsonb_build_array(jsonb_build_object('pad', repeat('x', 4300000))), t.interp(), t.pipe(), 10)$q$, t.id('b1'), t.h('file0')), 'observation > 4 MB → INVALID', 'quá lớn');
select t.ok(public.chord_extraction_get(t.id('b1')) ->> 'status' = 'running', 'các lần hoàn tất sai KHÔNG làm đổi trạng thái (vẫn running)');
select t.put('c1', public.chord_extraction_complete(t.id('b1'), t.h('file0'), 31417, 2, t.obs(2), t.interp(), t.pipe(), 1234));
select t.ok((select v ->> 'status' = 'succeeded' and v ->> 'duplicate' = 'false' from t.kv where k = 'c1'), 'complete → succeeded');
select t.put('g1', public.chord_extraction_get(t.id('b1')));
select t.ok((select v ->> 'status' = 'succeeded' and v -> 'document' ->> 'schema' = 'chord-extraction/1'
               and v -> 'document' ->> 'extractionId' = t.id('b1')::text and v -> 'document' -> 'input' ->> 'sha256' = t.h('file0')
               and v -> 'document' -> 'input' ->> 'pageCount' = '2' and jsonb_array_length(v -> 'document' -> 'pages') = 2
               and v -> 'document' -> 'pipeline' ->> 'engineVersion' = 'chord-extract/1.0.0-slice1'
               and v -> 'fallback_reasons' = '["METADATA_MISSING","HIGH_NOISE_RATIO"]'::jsonb and v ->> 'vision_status' = 'skipped_no_provider'
               and v ->> 'duration_ms' = '1234' and v ->> 'source_index' = '0' from t.kv where k = 'g1'),
  'get: tài liệu chord-extraction/1 đầy đủ, extractionId = id hàng, fallback_reasons + vision_status phi chuẩn hoá đúng');
select t.ok(public.chord_extraction_complete(t.id('b1'), t.h('file0'), 31417, 2, t.obs(2), t.interp(), t.pipe(), 1)
  = jsonb_build_object('ok', true, 'duplicate', true, 'status', 'succeeded', 'extraction_id', t.id('b1')), 'complete lần 2 = no-op (không ghi đè)');
select t.ok(public.chord_extraction_get(t.id('b1')) ->> 'duration_ms' = '1234', 'duration cũ giữ nguyên sau complete lần 2');
select t.put('b2', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'chord-extract/1.0.0-slice1', repeat('a', 64)));
select t.ok((select v ->> 'duplicate' = 'true' and v ->> 'status' = 'succeeded' and v ->> 'extraction_id' = t.id('b1')::text from t.kv where k = 'b2'),
  'begin lại sau khi thành công → trả lần chạy cũ (duplicate/succeeded), KHÔNG chạy lại');
select t.put('b3', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'chord-extract/1.0.0-slice1', repeat('a', 64), true));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'status' = 'running' and v ->> 'extraction_id' <> t.id('b1')::text from t.kv where k = 'b3'),
  'p_force=true → lần chạy MỚI (immutable run), không ghi đè lần cũ');
select t.reset();
select t.ok((select rerun_of from public.chord_sheet_extractions where id = t.id('b3')) = t.id('b1'), 'rerun_of trỏ lần thành công cũ (chuỗi kiểm toán)');
select t.as_user('T');
select t.put('b4', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'chord-extract/1.0.0-slice1', repeat('a', 64), true));
select t.ok((select v ->> 'duplicate' = 'true' and v ->> 'status' = 'running' and v ->> 'extraction_id' = t.id('b3')::text from t.kv where k = 'b4'), 'force khi đang có lần running → dùng lại lần running, không tạo thêm');
-- khoá khác nhau → hàng khác
select t.put('b5', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 1, 'chord-extract/1.0.0-slice1', repeat('a', 64)));
select t.ok((select v ->> 'duplicate' = 'false' and v -> 'source' ->> 'sha256' = t.h('file1') and v -> 'source' ->> 'mime' = 'image/jpeg' from t.kv where k = 'b5'), 'source_index 1 → file thứ 2, extraction riêng');
select t.put('b6', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'chord-extract/1.0.0-slice1', repeat('b', 64)));
select t.ok((select v ->> 'duplicate' = 'false' from t.kv where k = 'b6'), 'config_hash khác (vd. bật Vision) → khoá khác → chạy mới');

-- ── fail: mã máy đọc được ───────────────────────────────────────────────────────────────────
select t.fails(format($q$select public.chord_extraction_fail(%L, 'Traceback (most recent call last)')$q$, t.id('b5')), 'mã lỗi tự do (stack trace) → INVALID', 'mã lỗi');
select t.fails(format($q$select public.chord_extraction_fail(%L, 'abandoned')$q$, t.id('b5')), 'client KHÔNG tự đặt abandoned', 'mã lỗi');
select t.put('f1', public.chord_extraction_fail(t.id('b5'), 'ocr_unavailable', 55));
select t.ok((select v ->> 'status' = 'failed' and v ->> 'error_code' = 'ocr_unavailable' from t.kv where k = 'f1'), 'fail(ocr_unavailable) → failed + error_code');
select t.ok(public.chord_extraction_get(t.id('b5')) ->> 'error_code' = 'ocr_unavailable' and not (public.chord_extraction_get(t.id('b5')) ? 'document'), 'get(failed): có mã lỗi, không có document');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 1, 1, t.obs(1), t.interp(), t.pipe(), 1)$q$, t.id('b5'), t.h('file1')), 'complete sau khi failed → INVALID (đã đóng)', 'đã đóng');
select t.ok(public.chord_extraction_fail(t.id('b5'), 'internal') ->> 'duplicate' = 'true', 'fail lần 2 = no-op');
select t.put('b7', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 1, 'chord-extract/1.0.0-slice1', repeat('a', 64)));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'status' = 'running' from t.kv where k = 'b7'), 'sau failed, begin lại = THỬ LẠI (hàng mới), không trả lần thất bại');

-- ── lease hết hạn: worker chết giữa đường ───────────────────────────────────────────────────
select t.reset();
update public.chord_sheet_extractions set lease_expires_at = now() - interval '1 second' where id = t.id('b7');
select t.as_user('T');
select t.ok(public.chord_extraction_get(t.id('b7')) ->> 'status' = 'failed' and public.chord_extraction_get(t.id('b7')) ->> 'error_code' = 'abandoned',
  'running quá lease → ĐỌC ra failed/abandoned (không bao giờ trông như thành công/đang chạy mãi)');
select t.ok((select e ->> 'status' = 'failed' and e ->> 'error_code' = 'abandoned' from jsonb_array_elements(public.chord_extraction_list('20000000-0000-4000-8000-000000000001')) e where e ->> 'extraction_id' = t.id('b7')::text),
  'list cũng ra abandoned');
select t.reset();
select t.ok((select status from public.chord_sheet_extractions where id = t.id('b7')) = 'running', 'đọc KHÔNG ghi (hàng vẫn running trong bảng)');
select t.as_user('T');
select t.put('b8', public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 1, 'chord-extract/1.0.0-slice1', repeat('a', 64)));
select t.ok((select v ->> 'duplicate' = 'false' from t.kv where k = 'b8'), 'begin sau abandoned → lần chạy mới');
select t.reset();
select t.ok((select status || '/' || error_code from public.chord_sheet_extractions where id = t.id('b7')) = 'failed/abandoned', 'begin đã ĐÓNG hàng quá lease thành failed/abandoned');
select t.as_user('T');
select t.fails(format($q$select public.chord_extraction_complete(%L, %L, 1, 1, t.obs(1), t.interp(), t.pipe(), 1)$q$, t.id('b7'), t.h('file1')), 'worker chết rồi sống lại: complete hàng đã abandoned → bị từ chối', 'đã đóng');

-- ── liệt kê chỉ metadata ────────────────────────────────────────────────────────────────────
select t.ok(jsonb_array_length(public.chord_extraction_list('20000000-0000-4000-8000-000000000001')) >= 5
  and not exists (select 1 from jsonb_array_elements(public.chord_extraction_list('20000000-0000-4000-8000-000000000001')) e where e ? 'observation' or e ? 'document' or e ? 'interpretation'),
  'list: chỉ metadata, KHÔNG chứa observation/document/interpretation');
select t.ok((select (e ->> 'created_at')::timestamptz from jsonb_array_elements(public.chord_extraction_list('20000000-0000-4000-8000-000000000001')) with ordinality x(e, n) where n = 1)
  >= (select (e ->> 'created_at')::timestamptz from jsonb_array_elements(public.chord_extraction_list('20000000-0000-4000-8000-000000000001')) with ordinality x(e, n) where n = 2), 'list: mới nhất trước');
select t.fails($q$select public.chord_extraction_list(gen_random_uuid())$q$, 'list phiên bản không có → NOT_FOUND', 'CHORDLIB_NOT_FOUND');

-- ── Bất biến ở tầng DB (kể cả postgres / service_role) ──────────────────────────────────────
select t.reset();
select t.fails(format($q$update public.chord_sheet_extractions set observation = '[]'::jsonb where id = %L$q$, t.id('b1')), 'UPDATE observation của lần succeeded → IMMUTABLE', 'CHORDLIB_EXTRACTION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_extractions set status = 'failed', error_code = 'internal', observation = null, interpretation = null, pipeline = null, input_sha256 = null, input_bytes = null, page_count = null where id = %L$q$, t.id('b1')), 'succeeded → failed → IMMUTABLE', 'CHORDLIB_EXTRACTION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_extractions set error_code = 'timeout' where id = %L$q$, t.id('b5')), 'sửa error_code của lần failed → IMMUTABLE', 'CHORDLIB_EXTRACTION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_extractions set source_sha256 = %L where id = %L$q$, t.h('khac'), t.id('b3')), 'đổi sha256/danh tính của lần running → IMMUTABLE', 'CHORDLIB_EXTRACTION_IMMUTABLE');
select t.fails(format($q$delete from public.chord_sheet_extractions where id = %L$q$, t.id('b1')), 'DELETE extraction → UNDELETABLE', 'CHORDLIB_EXTRACTION_UNDELETABLE');
select t.fails(format($q$update public.chord_sheet_extractions set status = 'succeeded', lease_expires_at = null, finished_at = now() where id = %L$q$, t.id('b3')), 'succeeded giả không kèm kết quả/sha → CHECK chặn', 'chord_extractions_shape_chk');
select t.fails(format($q$update public.chord_sheet_extractions set status = 'succeeded', lease_expires_at = null, finished_at = now(), input_sha256 = %L, input_bytes = 5, page_count = 1, observation = t.obs(1), interpretation = t.interp(), pipeline = t.pipe() where id = %L$q$, t.h('khac'), t.id('b3')),
  'succeeded mà input_sha256 ≠ sha256 khai → CHECK chặn (extraction luôn gắn đúng file đã khai)', 'chord_extractions_shape_chk');
select t.fails(format($q$delete from public.chord_sheet_versions where id = '20000000-0000-4000-8000-000000000001'$q$), 'xoá phiên bản có extraction vẫn bị chặn', 'CHORDLIB_VERSION_UNDELETABLE');

-- ── Trần 10 lần/giờ/phiên bản ───────────────────────────────────────────────────────────────
select t.as_user('T');
select t.ok((select count(*) from public.chord_extraction_list('20000000-0000-4000-8000-000000000001') ) is not null, 'chuẩn bị trần');
do $$ declare i int; n int; begin
  for i in 1..30 loop
    begin
      perform public.chord_extraction_begin('20000000-0000-4000-8000-000000000001', 0, 'chord-extract/1.0.0-slice1', lpad(to_hex(1000 + i), 64, '0'));
    exception when others then
      if sqlerrm like 'CHORDLIB_LIMIT%' then raise notice 'PASS: trần 10 lần/giờ/phiên bản chặn ở lần thứ % (CHORDLIB_LIMIT)', i; return; end if;
      raise;
    end;
  end loop;
  raise exception 'FAIL: không có trần chạy lại';
end $$;

-- ── Xoá tài khoản: created_by về NULL, lần chạy ở lại nguyên ────────────────────────────────
select t.reset();
insert into auth.users (id, email) values ('99999999-0000-4000-8000-000000000009', 'u9@test.local');
insert into public.app_users (id, role, name, email) values ('99999999-0000-4000-8000-000000000009', 'teacher', 'U9', 'u9@test.local');
insert into public.chord_sheet_extractions (version_id, source_index, source_path, source_mime, source_sha256, schema_version, engine_version, config_hash, request_key, status, finished_at, error_code, created_by)
  select version_id, 0, source_path, source_mime, source_sha256, schema_version, engine_version, config_hash, repeat('c', 64), 'failed', now(), 'internal', '99999999-0000-4000-8000-000000000009' from public.chord_sheet_extractions limit 1;
insert into public.chord_sheet_extractions (version_id, source_index, source_path, source_mime, source_sha256, schema_version, engine_version, config_hash, request_key, status, lease_expires_at, created_by)
  select version_id, 0, source_path, source_mime, source_sha256, schema_version, engine_version, config_hash, repeat('d', 64), 'running', now() + interval '1 min', '99999999-0000-4000-8000-000000000009' from public.chord_sheet_extractions limit 1;
delete from public.app_users where id = '99999999-0000-4000-8000-000000000009';
delete from auth.users where id = '99999999-0000-4000-8000-000000000009';
select t.ok((select count(*) from public.chord_sheet_extractions where request_key in (repeat('c', 64), repeat('d', 64)) and created_by is null) = 2,
  'xoá tài khoản: lần chạy (failed + running) ở lại, created_by = NULL, trigger bất biến không cản');

\o
select 'ALL PASS';
rollback;
