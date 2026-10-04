-- ═══ TEST Thư viện hợp âm chuẩn hoá V1 — Lát 1 — cluster PostgreSQL TẠM (scripts/test-chord-library-db.sh) ═══
-- Nạp SAU fixture + community_setup + nhipphach_capabilities_setup + chord_library_v1_setup.
-- A, B, C, N = học viên · T = thầy · X = admin · khách = anon
\set ON_ERROR_STOP on
\o /dev/null
-- MỘT transaction: set_config(..., true) của t.as_* giữ qua các câu lệnh
begin;
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid when 'X' then 'ffffffff-0000-4000-8000-00000000000f'::uuid end $$;
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
-- Sổ ghi kết quả RPC để dùng lại id giữa các câu lệnh / các vai
create table t.kv (k text primary key, v jsonb);
grant all on t.kv to anon, authenticated;
create function t.put(p_k text, p_v jsonb) returns jsonb language sql as $$
  insert into t.kv values (p_k, p_v) on conflict (k) do update set v = excluded.v returning v $$;
create function t.id(p_k text, p_f text default 'version_id') returns uuid language sql as $$
  select (v ->> p_f)::uuid from t.kv where k = p_k $$;
-- Lời + hợp âm mẫu (có \r\n, khoảng trắng cuối dòng, dòng trống đầu/cuối, nhãn "1." / "ĐK:")
create function t.loi(extra text default '') returns text language sql as $$
  select E'\n\n1. Chiều [Am] nao, tiễn nhau [E7] đi   \r\nKhi bóng ngả xế [Am] tàn\t\r\nĐK: Hoàng [Dm] hôn đến đâu [G] đây' || extra || E'  \n\n' $$;
-- chord_canonical_text không cấp cho client → bọc lại để các vai so sánh được
create function t.canon(p text) returns text language sql security definer as $$ select public.chord_canonical_text(p) $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── E) Chuẩn hoá tiếng Việt ───────────────────────────────────────────────────
select t.ok(public.chord_fold_vi('Con đường xưa em đi') = 'con duong xua em di', 'fold: "Con đường xưa em đi" → "con duong xua em di"');
select t.ok(public.chord_fold_vi('CON ĐƯỜNG XƯA EM ĐI') = 'con duong xua em di', 'fold: chữ HOA có dấu → cùng khoá');
select t.ok(public.chord_fold_vi('con duong xua em di') = 'con duong xua em di', 'fold: không dấu → cùng khoá');
select t.ok(public.chord_fold_vi(E'  Con   đường\txưa em  đi \n') = 'con duong xua em di', 'fold: gộp khoảng trắng (cả tab, NBSP, xuống dòng) + cắt hai đầu');
select t.ok(public.chord_fold_vi(normalize('Diễm Xưa', NFD)) = public.chord_fold_vi(normalize('Diễm Xưa', NFC))
  and public.chord_fold_vi('Diễm Xưa') = 'diem xua', 'fold: dạng tổ hợp (NFD) và dựng sẵn (NFC) cho cùng khoá');
select t.ok(public.chord_fold_vi('Ướt Mi — Trịnh Công Sơn') = 'uot mi — trinh cong son'
  and public.chord_fold_vi('Nguyễn Ánh 9') = 'nguyen anh 9', 'fold: ư/ơ/ă/â/ê/ô + số giữ nguyên');
select t.ok(public.chord_fold_vi(null) is null and public.chord_fold_vi('') = '', 'fold: null → null, rỗng → rỗng');
select t.ok(public.chord_canonical_text(t.loi()) = E'1. Chiều [Am] nao, tiễn nhau [E7] đi\nKhi bóng ngả xế [Am] tàn\nĐK: Hoàng [Dm] hôn đến đâu [G] đây',
  'canonical text: \r\n → \n, bỏ khoảng trắng cuối dòng, bỏ dòng trống đầu/cuối, GIỮ nhãn "1." / "ĐK:"');
select t.ok(public.chord_meter_ok('{"beats": 4, "beatType": 4}') and public.chord_meter_ok('{"beats": 6, "beatType": 8}') and public.chord_meter_ok(null)
  and not public.chord_meter_ok('{"beats": 0, "beatType": 4}') and not public.chord_meter_ok('{"beats": 4, "beatType": 3}')
  and not public.chord_meter_ok('{"beats": "4", "beatType": 4}') and not public.chord_meter_ok('{"beats": 4, "beatType": 4, "x": 1}')
  and not public.chord_meter_ok('"4/4"') and public.chord_meter_ok('{"beats": 4}') = false and public.chord_meter_ok('{}') = false,
  'meter: 4/4, 6/8, null hợp lệ; 0/4, 4/3, chuỗi, thừa khoá, THIẾU khoá → false (không phải NULL)');

-- ── Khách (anon): không gì cả ─────────────────────────────────────────────────
select t.as_anon();
select t.fails($q$select public.chord_sheet_search('a')$q$, 'khách KHÔNG tìm được', 'permission denied');
select t.fails($q$select public.chord_sheet_contribute(p_text => 'x', p_title => 'y')$q$, 'khách KHÔNG đóng góp được', 'permission denied');
select t.fails($q$select public.chord_sheet_get(gen_random_uuid())$q$, 'khách KHÔNG đọc được', 'permission denied');
select t.fails($q$select public.chordlib_can('search')$q$, 'khách KHÔNG gọi được chordlib_can', 'permission denied');
select t.fails('select * from public.chord_sheets', 'khách KHÔNG đọc thẳng bảng chord_sheets', 'permission denied');
select t.fails('select * from public.chord_sheet_versions', 'khách KHÔNG đọc thẳng bảng chord_sheet_versions', 'permission denied');

-- ── A) Học viên A đóng góp ────────────────────────────────────────────────────
select t.as_user('A');
select t.ok(public.my_chordlib_caps() = '{"role": "student", "caps": {"search": true, "contribute": true, "review": false}}',
  'A: role student — search + contribute, KHÔNG review');
select t.put('a1', public.chord_sheet_contribute(p_text => t.loi(), p_title => '  Con đường xưa em đi ', p_composer => 'Châu Kỳ',
  p_meter => '{"beats": 4, "beatType": 4}', p_suggested_bpm => 66));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'version_number' = '1' and v ->> 'review_status' = 'private'
               and v ->> 'anchors_status' = 'none' from t.kv where k = 'a1'),
  'A đóng góp bài mới → v1, review_status=private, anchors_status=none');
select t.put('a1get', public.chord_sheet_get(t.id('a1')));
select t.ok((select v ->> 'title' = 'Con đường xưa em đi' and v ->> 'composer' = 'Châu Kỳ' and v ->> 'mine' = 'true'
               and v ? 'sources' and v ->> 'contributed_by' = t.u('A')::text and v -> 'anchors' = 'null'
               and v ->> 'is_canonical' = 'false' and v -> 'canonical_version_id' = 'null' from t.kv where k = 'a1get'),
  'A đọc bản của mình: đủ trường, tên bài đã cắt khoảng trắng, anchors null, chưa có bản chuẩn');
select t.ok((select v ->> 'text' = t.canon(t.loi())
               and v ->> 'text_hash' = encode(sha256(convert_to(v ->> 'text', 'UTF8')), 'hex')
               and v ->> 'text' !~ E'\r' from t.kv where k = 'a1get'),
  'text lưu dạng chuẩn; text_hash = sha256(utf8(text)) — consumer tự băm lại là khớp');
select t.ok(public.chord_sheet_contribute(p_text => t.loi(), p_title => 'CON ĐƯỜNG XƯA EM ĐI')
  = jsonb_build_object('ok', true, 'duplicate', true, 'sheet_id', t.id('a1', 'sheet_id'), 'version_id', t.id('a1')),
  'A gửi lại y hệt (tên viết HOA) → duplicate, trả bản đã có, không tạo bài mới');
select t.ok(jsonb_array_length(public.chord_sheet_search('con duong xua')) = 1
  and public.chord_sheet_search('con duong xua') -> 0 ->> 'mine' = 'true'
  and public.chord_sheet_search('con duong xua') -> 0 ->> 'review_status' = 'private'
  and not (public.chord_sheet_search('con duong xua') -> 0 ? 'contributed_by'),
  'A tìm không dấu → thấy bản private của CHÍNH mình (không lộ contributed_by)');
select t.fails(format('select public.chord_sheet_approve(%L)', t.id('a1')), 'A KHÔNG approve được', 'CHORDLIB_FORBIDDEN');
select t.fails(format('select public.chord_sheet_reject(%L, %L)', t.id('a1'), 'x'), 'A KHÔNG reject được', 'CHORDLIB_FORBIDDEN');
select t.fails('select * from public.chord_sheets', 'A KHÔNG đọc thẳng bảng', 'permission denied');
select t.fails(format('update public.chord_sheets set canonical_version_id = %L', t.id('a1')), 'A KHÔNG tự UPDATE canonical_version_id', 'permission denied');
select t.fails($q$update public.chord_sheet_versions set review_status = 'approved'$q$, 'A KHÔNG tự UPDATE review_status', 'permission denied');
select t.fails($q$insert into public.chord_sheets (title) values ('x')$q$, 'A KHÔNG INSERT thẳng bảng', 'permission denied');
select t.fails($q$select public.chord_sheet_contribute(p_text => E'  \n ', p_title => 'x')$q$, 'thiếu lời → chặn', 'CHORDLIB_INVALID');
select t.fails($q$select public.chord_sheet_contribute(p_text => 'la [C] la')$q$, 'thiếu tên bài → chặn', 'CHORDLIB_INVALID');
select t.fails($q$select public.chord_sheet_contribute(p_text => 'la', p_title => 'x', p_meter => '{"beats": 4}')$q$, 'meter sai dạng → chặn', 'CHORDLIB_INVALID');
select t.fails($q$select public.chord_sheet_contribute(p_text => 'la', p_title => 'x', p_suggested_bpm => 500)$q$, 'BPM 500 → chặn', 'CHORDLIB_INVALID');
select t.fails(format('select public.chord_sheet_contribute(p_text => %L, p_title => %L, p_version_id => %L)', 'khác', 'Bài khác', t.id('a1')),
  'version_id đã dùng → chặn', 'CHORDLIB_INVALID');

-- ── B) Học viên B không thấy bản private của A ────────────────────────────────
select t.as_user('B');
select t.ok(public.chord_sheet_search('con duong xua') = '[]', 'B tìm → KHÔNG thấy bản private của A');
select t.ok(public.chord_sheet_search('') = '[]', 'B liệt kê tất cả → rỗng');
select t.fails(format('select public.chord_sheet_get(%L)', t.id('a1')), 'B KHÔNG đọc được bản private của A', 'CHORDLIB_NOT_FOUND');
select t.fails(format('select public.chord_sheet_contribute(p_text => %L, p_sheet_id => %L)', 'b sửa', t.id('a1', 'sheet_id')),
  'B KHÔNG gắn được phiên bản vào bài còn private của A (không lộ là bài có tồn tại)', 'CHORDLIB_NOT_FOUND');
select t.fails(format('select public.chord_sheet_approve(%L)', t.id('a1')), 'B KHÔNG approve được', 'CHORDLIB_FORBIDDEN');

-- ── C) Thầy đọc, duyệt ────────────────────────────────────────────────────────
select t.as_user('T');
select t.ok(public.my_chordlib_caps() -> 'caps' ->> 'review' = 'true' and public.my_chordlib_caps() ->> 'role' = 'teacher', 'T: role teacher, có review');
select t.ok(jsonb_array_length(public.chord_sheet_search('CHÂU KỲ')) = 1
  and public.chord_sheet_search('CHÂU KỲ') -> 0 ->> 'contributed_by' = t.u('A')::text,
  'T tìm theo TÁC GIẢ → thấy bản chờ duyệt của A, biết ai đóng góp');
select t.ok(public.chord_sheet_get(t.id('a1')) ->> 'contributed_by' = t.u('A')::text, 'T đọc được bản private của A');
select t.put('ap1', public.chord_sheet_approve(t.id('a1')));
select t.ok((select v ->> 'canonical_version_id' = t.id('a1')::text and v -> 'previous_canonical_version_id' = 'null' from t.kv where k = 'ap1'),
  'T approve → canonical_version_id = bản của A');
select t.ok(public.chord_sheet_get(t.id('a1')) ->> 'review_status' = 'approved'
  and public.chord_sheet_get(t.id('a1')) ->> 'reviewed_by' = t.u('T')::text
  and public.chord_sheet_get(t.id('a1')) ->> 'is_canonical' = 'true', 'bản đã duyệt: approved, reviewed_by = T, is_canonical');

select t.as_user('B');
select t.ok(jsonb_array_length(public.chord_sheet_search('CON ĐƯỜNG')) = 1
  and public.chord_sheet_search('CON ĐƯỜNG') -> 0 ->> 'is_canonical' = 'true'
  and public.chord_sheet_search('CON ĐƯỜNG') -> 0 ->> 'mine' = 'false', 'B tìm sau khi duyệt → THẤY bản chuẩn');
select t.put('bget', public.chord_sheet_get(t.id('a1')));
select t.ok((select v ->> 'text' = t.canon(t.loi()) and not v ? 'sources' and not v ? 'contributed_by'
               and not v ? 'rejection_reason' and v ->> 'anchors_status' = 'none' from t.kv where k = 'bget'),
  'B đọc bản chuẩn: có lời + hợp âm (anchors_status=none vẫn dùng được), KHÔNG có sources / danh tính người đóng góp');

-- ── D) Phiên bản ──────────────────────────────────────────────────────────────
select t.as_user('A');
select t.put('a2', public.chord_sheet_contribute(p_text => t.loi(' [C] ta'), p_sheet_id => t.id('a1', 'sheet_id')));
select t.ok((select v ->> 'version_number' = '2' and v ->> 'review_status' = 'private' and v ->> 'duplicate' = 'false' from t.kv where k = 'a2'),
  'A sửa sau khi đã duyệt → tạo v2 private (không sửa bản chuẩn)');
select t.ok(public.chord_sheet_get(t.id('a2')) ->> 'parent_version_id' = t.id('a1')::text, 'v2 có parent_version_id = v1');
select t.ok(public.chord_sheet_get(t.id('a1')) ->> 'is_canonical' = 'true'
  and public.chord_sheet_get(t.id('a2')) ->> 'canonical_version_id' = t.id('a1')::text, 'có v2 rồi nhưng bản chuẩn VẪN là v1');
select t.ok(public.chord_sheet_contribute(p_text => t.loi(), p_sheet_id => t.id('a1', 'sheet_id')) ->> 'version_id' = t.id('a1')::text,
  'gửi nội dung trùng bản chuẩn → duplicate, trả bản chuẩn');
select t.ok(jsonb_array_length(public.chord_sheet_search('con duong')) = 2, 'A thấy 2 dòng: bản chuẩn + v2 private của mình');

select t.as_user('B');
select t.ok(jsonb_array_length(public.chord_sheet_search('con duong')) = 1, 'B vẫn chỉ thấy bản chuẩn (không thấy v2 private của A)');
select t.fails(format('select public.chord_sheet_get(%L)', t.id('a2')), 'B KHÔNG đọc được v2 private của A', 'CHORDLIB_NOT_FOUND');
select t.put('b3', public.chord_sheet_contribute(p_text => 'bản của B [G]', p_sheet_id => t.id('a1', 'sheet_id')));
select t.ok((select v ->> 'version_number' = '3' from t.kv where k = 'b3')
  and public.chord_sheet_get(t.id('b3')) ->> 'parent_version_id' = t.id('a1')::text, 'B góp phiên bản cho bài ĐÃ duyệt → v3, cha = bản chuẩn');
select t.fails(format('select public.chord_sheet_contribute(p_text => %L, p_sheet_id => %L, p_parent_version_id => %L)', 'x', t.id('a1', 'sheet_id'), t.id('a2')),
  'B KHÔNG lấy được bản private của A làm cha', 'CHORDLIB_INVALID');

select t.as_user('A');
select t.fails(format('select public.chord_sheet_get(%L)', t.id('b3')), 'A KHÔNG đọc được bản private của B', 'CHORDLIB_NOT_FOUND');

select t.as_user('T');
select t.fails(format('select public.chord_sheet_reject(%L, %L)', t.id('b3'), '   '), 'reject không lý do → chặn', 'CHORDLIB_INVALID');
select t.fails(format('select public.chord_sheet_reject(%L, %L)', t.id('a1'), 'thử'), 'KHÔNG reject được bản đang là bản chuẩn', 'CHORDLIB_INVALID');
select t.ok(public.chord_sheet_reject(t.id('b3'), 'Hợp âm chưa đúng tông') ->> 'review_status' = 'rejected', 'T reject bản của B (có lý do)');
select t.fails($q$select public.chord_sheet_approve(gen_random_uuid())$q$, 'approve id không tồn tại → NOT_FOUND', 'CHORDLIB_NOT_FOUND');
select t.put('ap2', public.chord_sheet_approve(t.id('a2')));
select t.ok((select v ->> 'canonical_version_id' = t.id('a2')::text and v ->> 'previous_canonical_version_id' = t.id('a1')::text from t.kv where k = 'ap2'),
  'T approve v2 → con trỏ MỚI đổi sang v2');

select t.as_user('B');
select t.ok(public.chord_sheet_get(t.id('b3')) ->> 'rejection_reason' = 'Hợp âm chưa đúng tông'
  and public.chord_sheet_get(t.id('b3')) ->> 'review_status' = 'rejected', 'B đọc được bản bị từ chối của mình + lý do');
select t.ok(public.chord_sheet_get(t.id('a1')) ->> 'review_status' = 'approved'
  and public.chord_sheet_get(t.id('a1')) ->> 'is_canonical' = 'false'
  and public.chord_sheet_get(t.id('a1')) ->> 'text_hash' = (select v ->> 'text_hash' from t.kv where k = 'a1get'),
  'bản chuẩn CŨ (v1) vẫn approved, vẫn đọc được, nguyên hash — consumer giữ snapshot không bị đổi nghĩa');
select t.ok(public.chord_sheet_search('con duong') -> 0 ->> 'version_id' = t.id('a2')::text, 'tìm → bản chuẩn giờ là v2');

select t.as_user('T');
select t.ok(public.chord_sheet_approve(t.id('a1')) ->> 'previous_canonical_version_id' = t.id('a2')::text, 'T chọn lại v1 làm bản chuẩn (approve bản đã duyệt cũ)');
select t.ok(public.chord_sheet_approve(t.id('a2')) ->> 'canonical_version_id' = t.id('a2')::text, 'T đặt lại v2');

-- Bất biến: kể cả postgres/service cũng không sửa được nội dung
select t.reset();
select t.fails(format($q$update public.chord_sheet_versions set text = 'sửa lén' where id = %L$q$, t.id('a1')), 'KHÔNG sửa được text của phiên bản', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_versions set sources = '[{"path": "x"}]' where id = %L$q$, t.id('a1')), 'KHÔNG sửa được sources', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_versions set meter = '{"beats": 3, "beatType": 4}', suggested_bpm = 90 where id = %L$q$, t.id('a1')), 'KHÔNG sửa được meter / BPM', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_versions set anchors = '{"measures": []}', anchors_status = 'ready' where id = %L$q$, t.id('a1')), 'KHÔNG gắn neo đè lên phiên bản cũ (phải tạo phiên bản mới)', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format('update public.chord_sheet_versions set contributed_by = %L where id = %L', t.u('B'), t.id('a1')), 'KHÔNG đổi được người đóng góp', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format('delete from public.chord_sheet_versions where id = %L', t.id('b3')), 'KHÔNG xoá được phiên bản', 'CHORDLIB_VERSION_UNDELETABLE');
select t.fails(format('delete from public.chord_sheets where id = %L', t.id('a1', 'sheet_id')), 'KHÔNG xoá được bài còn phiên bản', 'violates foreign key');

-- Không UNIQUE theo khoá: N tạo bài trùng tên (không dấu); thầy gộp về bài đã có lúc duyệt
select t.as_user('N');
select t.put('n1', public.chord_sheet_contribute(p_text => 'bản của N [Em]', p_title => 'con duong xua em di'));
select t.ok(t.id('n1', 'sheet_id') <> t.id('a1', 'sheet_id'), 'N đóng góp cùng tên (không dấu) → được, thành bài riêng (KHÔNG có UNIQUE theo khoá)');
select t.reset();
select t.ok((select count(*) = 2 and count(distinct title_key) = 1 from public.chord_sheets where title_key = 'con duong xua em di'),
  '2 bài, CÙNG title_key — để search gợi ý, thầy quyết');
select t.fails(format('update public.chord_sheets set canonical_version_id = %L where id = %L', t.id('n1'), t.id('a1', 'sheet_id')),
  'con trỏ canonical KHÔNG trỏ được sang phiên bản của bài khác', 'violates foreign key');
select t.as_user('T');
select t.ok(jsonb_array_length(public.chord_sheet_search('Con Đường Xưa Em Đi')) = 2, 'T tìm → thấy bản chuẩn + bản chờ duyệt trùng tên của N');
select t.put('apn', public.chord_sheet_approve(t.id('n1'), t.id('a1', 'sheet_id')));
select t.ok((select v ->> 'sheet_id' = t.id('a1', 'sheet_id')::text and v ->> 'previous_canonical_version_id' = t.id('a2')::text from t.kv where k = 'apn')
  and public.chord_sheet_get(t.id('n1')) ->> 'version_number' = '4'
  and public.chord_sheet_get(t.id('n1')) -> 'parent_version_id' = 'null'
  and public.chord_sheet_get(t.id('n1')) ->> 'title' = 'Con đường xưa em đi',
  'T approve bản ĐỘC LẬP còn private của N VÀO bài đã có → thành v4, là bản chuẩn mới; parent KHÔNG bị ghi đè (vẫn null)');
select t.reset();
select t.ok((select count(*) = 1 from public.chord_sheets where title_key = 'con duong xua em di'), 'bài trùng (rỗng) của N đã được gộp — còn 1 bài');

-- Admin
select t.as_user('X');
select t.ok(public.my_chordlib_caps() = '{"role": "admin", "caps": {"search": true, "contribute": true, "review": true}}', 'X: role admin, đủ quyền');
select t.put('x1', public.chord_sheet_contribute(p_text => 'bài của admin [D]', p_title => 'Nắng Thuỷ Tinh', p_composer => 'Trịnh Công Sơn'));
select t.ok(public.chord_sheet_reject(t.id('x1'), 'thử từ chối') ->> 'review_status' = 'rejected', 'admin reject PASS');
select t.ok(public.chord_sheet_approve(t.id('x1')) ->> 'canonical_version_id' = t.id('x1')::text, 'admin approve PASS (đổi ý sau khi từ chối)');
-- Câu lệnh RIÊNG: chord_sheet_get là STABLE nên không thấy thay đổi của chính câu lệnh đang chạy.
select t.ok(public.chord_sheet_get(t.id('x1')) -> 'rejection_reason' = 'null'
  and public.chord_sheet_get(t.id('x1')) ->> 'review_status' = 'approved', '…lý do từ chối cũ được xoá');
select t.ok(public.chord_sheet_get(t.id('a2')) ->> 'contributed_by' = t.u('A')::text, 'admin đọc được mọi bản');

-- ── M2/M3) Bản đã duyệt là trạng thái cuối; gộp chỉ cho đóng góp độc lập còn private ──
select t.as_user('A');
select t.put('a5', public.chord_sheet_contribute(p_text => 'bản sửa thứ năm [Am]', p_sheet_id => t.id('a1', 'sheet_id')));
select t.as_user('T');
select t.fails(format('select public.chord_sheet_reject(%L, %L)', t.id('a1'), 'đổi ý'),
  'M2: KHÔNG reject được bản ĐÃ approved dù không còn là bản chuẩn', 'bản đã duyệt không từ chối được');
select t.fails(format('select public.chord_sheet_approve(%L, %L)', t.id('a1'), t.id('x1', 'sheet_id')),
  'M3: KHÔNG gộp được bản ĐÃ approved sang bài khác', 'chỉ gộp được đóng góp còn private');
select t.fails(format('select public.chord_sheet_approve(%L, %L)', t.id('b3'), t.id('x1', 'sheet_id')),
  'M3: KHÔNG gộp được bản đã rejected sang bài khác', 'chỉ gộp được đóng góp còn private');
select t.fails(format('select public.chord_sheet_approve(%L, %L)', t.id('a5'), t.id('x1', 'sheet_id')),
  'M3: KHÔNG gộp được bản private CÓ CHA (nằm trong chuỗi phiên bản)', 'chuỗi phiên bản');
select t.as_user('B');
select t.ok(public.chord_sheet_get(t.id('a1')) ->> 'sheet_id' = t.id('a1', 'sheet_id')::text
  and public.chord_sheet_get(t.id('a1')) ->> 'version_number' = '1'
  and public.chord_sheet_get(t.id('a1')) ->> 'review_status' = 'approved'
  and public.chord_sheet_get(t.id('a1')) ->> 'text_hash' = (select v ->> 'text_hash' from t.kv where k = 'a1get'),
  'M2/M3: bản approved cũ (v1) vẫn đọc được, NGUYÊN bài / số phiên bản / hash');
select t.as_user('A');
select t.ok(public.chord_sheet_get(t.id('a5')) ->> 'sheet_id' = t.id('a1', 'sheet_id')::text
  and public.chord_sheet_get(t.id('a5')) ->> 'review_status' = 'private'
  and public.chord_sheet_get(t.id('a5')) ->> 'parent_version_id' is not null, 'M3: lượt gộp bị từ chối không để lại trạng thái nửa chừng');
select t.reset();
select t.fails(format('update public.chord_sheet_versions set parent_version_id = null where id = %L', t.id('a5')),
  'M3: parent_version_id bất biến ở tầng trigger', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format('update public.chord_sheet_versions set sheet_id = %L, version_number = 99 where id = %L', t.id('x1', 'sheet_id'), t.id('a1')),
  'M3: bản đã approved không đổi được sheet_id (kể cả postgres)', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format('update public.chord_sheet_versions set version_number = 99 where id = %L', t.id('b3')),
  'M3: bản đã rejected không đổi được version_number', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_versions set review_status = 'rejected', rejection_reason = 'x' where id = %L$q$, t.id('a1')),
  'M2: approved → rejected bị chặn ở tầng trigger', 'CHORDLIB_VERSION_IMMUTABLE');
select t.fails(format($q$update public.chord_sheet_versions set review_status = 'private', reviewed_at = null, reviewed_by = null where id = %L$q$, t.id('a1')),
  'M2: approved → private bị chặn ở tầng trigger', 'CHORDLIB_VERSION_IMMUTABLE');
select t.as_user('T');
select t.ok(public.chord_sheet_reject(t.id('a5'), 'chưa đạt') ->> 'review_status' = 'rejected', 'bản private vẫn reject bình thường');
select t.ok(public.chord_sheet_approve(t.id('n1')) ->> 'canonical_version_id' = t.id('n1')::text, 'approve tại chỗ một bản đã duyệt (chọn lại bản chuẩn) vẫn chạy');

-- Ma trận quyền: Admin tắt contribute của học viên → chặn ngay, không cần sửa code
select t.reset();
update public.tool_capabilities set allowed = false where tool_id = 'chordlib' and role = 'student' and capability = 'contribute';
select t.as_user('A');
select t.fails($q$select public.chord_sheet_contribute(p_text => 'x', p_title => 'y')$q$, 'tắt capability contribute của student → A bị chặn', 'CHORDLIB_FORBIDDEN');
select t.ok(jsonb_array_length(public.chord_sheet_search('nang thuy tinh')) = 1, '…nhưng A vẫn search được (capability tách nhau)');
select t.reset();
update public.tool_capabilities set allowed = true where tool_id = 'chordlib' and role = 'student' and capability = 'contribute';

-- Chặn spam: 30 bản chờ duyệt
select t.as_user('C');
do $$ begin for i in 1..30 loop
  perform public.chord_sheet_contribute(p_text => 'lời ' || i, p_title => 'Bài thử ' || i);
end loop; end $$;
select t.fails($q$select public.chord_sheet_contribute(p_text => 'lời 31', p_title => 'Bài thử 31')$q$, 'bản chờ duyệt thứ 31 của cùng một người → chặn', 'CHORDLIB_LIMIT');

-- ── F) Storage: bucket riêng tư chord-sheet-sources ───────────────────────────
select t.reset();
select t.ok((select not public and file_size_limit = 20971520
               and allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
               from storage.buckets where id = 'chord-sheet-sources'),
  'bucket chord-sheet-sources: riêng tư, 20MB, PDF/JPEG/PNG/WebP (không HEIC)');
select t.put('f', jsonb_build_object('version_id', gen_random_uuid(), 'v2', gen_random_uuid()));
create function t.p(k text, n text) returns text language sql as $$ select t.u(k)::text || '/' || t.id('f')::text || '/' || n $$;
grant execute on function t.p(text, text) to anon, authenticated;

select t.as_user('A');
insert into storage.objects (bucket_id, name, owner) values ('chord-sheet-sources', t.p('A', '1.png'), t.u('A'));
insert into storage.objects (bucket_id, name, owner) values ('chord-sheet-sources', t.p('A', '2.pdf'), t.u('A'));
select t.ok((select count(*) = 2 from storage.objects where bucket_id = 'chord-sheet-sources'), 'A tải lên thư mục của mình ({uid}/{version_id}/{n}.{ext}) + đọc lại được');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.p('A', '3.heic')), 'HEIC → chặn', 'row-level security');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.p('B', '1.png')), 'A KHÔNG tải vào thư mục của B', 'row-level security');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.u('A')::text || '/tu-do/1.png'), 'đường dẫn sai khuôn → chặn', 'row-level security');
select t.fails(format($q$select public.chord_sheet_contribute(p_text => 'có nguồn', p_title => 'Bài có nguồn', p_version_id => %L, p_sources => %L)$q$, t.id('f'),
    jsonb_build_array(jsonb_build_object('path', t.p('A', '9.png'), 'mime', 'image/png', 'sha256', repeat('b', 64)))),
  'khai file nguồn CHƯA tải lên → chặn', 'CHORDLIB_INVALID');
select t.fails(format($q$select public.chord_sheet_contribute(p_text => 'có nguồn', p_title => 'Bài có nguồn', p_version_id => %L, p_sources => %L)$q$, t.id('f'),
    jsonb_build_array(jsonb_build_object('path', t.p('B', '1.png'), 'mime', 'image/png', 'sha256', repeat('b', 64)))),
  'khai file nguồn trong thư mục người khác → chặn', 'CHORDLIB_INVALID');
select t.put('s1', public.chord_sheet_contribute(p_text => 'có nguồn [Am]', p_title => 'Bài có nguồn', p_version_id => t.id('f'),
  p_sources => jsonb_build_array(
    jsonb_build_object('path', t.p('A', '1.png'), 'mime', 'image/png', 'sha256', repeat('b', 64), 'page', 1),
    jsonb_build_object('path', t.p('A', '2.pdf'), 'mime', 'application/pdf', 'sha256', repeat('c', 64), 'page', 2))));
select t.ok(t.id('s1') = t.id('f') and jsonb_array_length(public.chord_sheet_get(t.id('s1')) -> 'sources') = 2,
  'A đóng góp kèm 2 file nguồn (version_id do client sinh) → sources ghi đúng');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.p('A', '3.png')),
  'phiên bản đã ghi → KHÔNG thêm được file nguồn nữa', 'row-level security');
delete from storage.objects where bucket_id = 'chord-sheet-sources';
select t.ok((select count(*) = 2 from storage.objects where bucket_id = 'chord-sheet-sources'), 'phiên bản đã ghi → A KHÔNG xoá được file nguồn (bằng chứng)');
insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', t.u('A')::text || '/' || t.id('f', 'v2')::text || '/1.webp');
delete from storage.objects where name = t.u('A')::text || '/' || t.id('f', 'v2')::text || '/1.webp';
select t.ok((select count(*) = 2 from storage.objects where bucket_id = 'chord-sheet-sources'), 'file tải lên mà CHƯA thành phiên bản → A tự dọn được');

-- ── M4) sources: kiểm chặt ───────────────────────────────────────────────────
select t.reset();
select t.put('m4', jsonb_build_object('version_id', gen_random_uuid()));
create function t.m(n text) returns text language sql as $$ select t.u('A')::text || '/' || t.id('m4')::text || '/' || n $$;
create function t.src(extra jsonb default '{}', n text default '1.png') returns jsonb language sql as $$
  select jsonb_build_object('path', t.m(n), 'mime', 'image/png', 'sha256', repeat('d', 64)) || extra $$;
create function t.try_src(p_sources jsonb) returns text language sql as $$
  select format($q$select public.chord_sheet_contribute(p_text => 'm4', p_title => 'Bài M4', p_version_id => %L, p_sources => %L)$q$, t.id('m4'), p_sources) $$;
grant execute on function t.m(text), t.src(jsonb, text), t.try_src(jsonb) to anon, authenticated;
select t.as_user('A');
insert into storage.objects (bucket_id, name, metadata) values ('chord-sheet-sources', t.m('1.png'), '{"mimetype": "image/png", "size": 1234}');
select t.fails(t.try_src(jsonb_build_array(t.src('{"junk": "x"}'))), 'M4: khoá lạ trong sources → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src('{"mime": "application/pdf"}'))), 'M4: mime không khớp đuôi file (.png + application/pdf) → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src('{"size_bytes": -5}'))), 'M4: size_bytes âm → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src('{"size_bytes": 20971521}'))), 'M4: size_bytes > 20MB → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src('{"size_bytes": "1234"}'))), 'M4: size_bytes là chuỗi → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src('{"page": "abc"}'))), 'M4: page không phải số → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src('{"page": 1.5}'))), 'M4: page không nguyên → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src('{"sha256": "ABC"}'))), 'M4: sha256 sai dạng → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src() - 'sha256')), 'M4: thiếu sha256 → chặn (NULL không được coi là đạt)', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(t.src() - 'mime')), 'M4: thiếu mime → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src(jsonb_build_array(jsonb_build_object('path', 123, 'mime', 'image/png', 'sha256', repeat('d', 64)))), 'M4: path không phải chuỗi → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src('["chuỗi"]'), 'M4: phần tử không phải object → chặn', 'file nguồn không hợp lệ');
select t.fails(t.try_src('{"path": "x"}'), 'M4: sources không phải mảng → chặn', 'sources phải là mảng');
select t.fails(t.try_src(jsonb_build_array(t.src(), t.src())), 'M4: khai lặp cùng một path → chặn', 'khai lặp');
select t.fails(t.try_src(jsonb_build_array(t.src('{"size_bytes": 999}'))), 'M4: size_bytes khai ≠ size Storage ghi nhận → chặn', 'không khớp file đã tải lên');
insert into storage.objects (bucket_id, name, metadata) values ('chord-sheet-sources', t.m('2.png'), '{"mimetype": "application/pdf", "size": 10}');
select t.fails(t.try_src(jsonb_build_array(t.src(), t.src('{}', '2.png'))), 'M4: mime khai ≠ mimetype Storage ghi nhận (file .png thật ra là PDF) → chặn', 'không khớp file đã tải lên');
select t.fails(t.try_src(jsonb_build_array(t.src())), 'M4: thư mục phiên bản còn file CHƯA khai → chặn (không để file mồ côi)', 'chưa được khai');
select t.fails(t.try_src('[]'), 'M4: có file trong thư mục mà sources rỗng → chặn', 'chưa được khai');
delete from storage.objects where name = t.m('2.png');
select t.put('m4ok', public.chord_sheet_contribute(p_text => 'm4', p_title => 'Bài M4', p_version_id => t.id('m4'),
  p_sources => jsonb_build_array(t.src('{"size_bytes": 1234, "page": 1}'))));
select t.ok((select v ->> 'duplicate' = 'false' from t.kv where k = 'm4ok')
  and public.chord_sheet_get(t.id('m4')) -> 'sources' = jsonb_build_array(t.src('{"size_bytes": 1234, "page": 1}')),
  'M4: sources hợp lệ (đủ khoá, khớp metadata Storage) → nhận, lưu đúng nguyên văn');

-- ── H2) Hạn mức tải lên + L3) cổng ghi chỉ trả lời về thư mục của chính mình ───
select t.reset();
select t.put('q', jsonb_build_object('v1', gen_random_uuid(), 'v2', gen_random_uuid(), 'v3', gen_random_uuid()));
create function t.q(v text, n text) returns text language sql as $$ select t.u('B')::text || '/' || t.id('q', v)::text || '/' || n $$;
grant execute on function t.q(text, text) to anon, authenticated;
select t.as_user('B');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.q('v1', '10.png')),
  'H2: số file hai chữ số ({n} = 10) → chặn (tối đa 0–9 = 10 file một phiên bản)', 'row-level security');
insert into storage.objects (bucket_id, name) select 'chord-sheet-sources', t.q('v1', n || '.png') from generate_series(0, 9) n;
insert into storage.objects (bucket_id, name) select 'chord-sheet-sources', t.q('v2', n || '.pdf') from generate_series(0, 9) n;
select t.ok((select count(*) = 20 from storage.objects where name like t.u('B')::text || '/%'), 'H2: B tải được 20 file chưa gắn phiên bản');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.q('v3', '0.png')),
  'H2: file thứ 21 chưa gắn phiên bản → chặn (hết hạn mức)', 'row-level security');
delete from storage.objects where name = t.q('v2', '9.pdf');
insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', t.q('v3', '0.png'));
select t.ok((select count(*) = 20 from storage.objects where name like t.u('B')::text || '/%'), 'H2: xoá bớt một file → tải tiếp được (hạn mức tính theo file đang có)');
delete from storage.objects where name = t.q('v3', '0.png');
select t.put('qv1', public.chord_sheet_contribute(p_text => 'bài có 10 nguồn', p_title => 'Bài mười trang', p_version_id => t.id('q', 'v1'),
  p_sources => (select jsonb_agg(jsonb_build_object('path', t.q('v1', n || '.png'), 'mime', 'image/png', 'sha256', repeat('e', 64), 'page', n + 1) order by n) from generate_series(0, 9) n)));
insert into storage.objects (bucket_id, name) select 'chord-sheet-sources', t.q('v3', n || '.webp') from generate_series(0, 9) n;
insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', t.q('v2', '9.pdf'));
select t.ok((select count(*) = 30 from storage.objects where name like t.u('B')::text || '/%'),
  'H2: đóng góp xong (10 file đã gắn phiên bản) → hạn mức được trả lại, tải tiếp tới đủ 20 file chưa gắn');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.u('B')::text || '/' || gen_random_uuid() || '/0.png'),
  'H2: …nhưng vẫn không vượt 20 file chưa gắn phiên bản', 'row-level security');
delete from storage.objects where name like t.u('B')::text || '/' || t.id('q', 'v2')::text || '/%';
delete from storage.objects where name like t.u('B')::text || '/' || t.id('q', 'v3')::text || '/%';
select t.ok((select count(*) = 10 from storage.objects where name like t.u('B')::text || '/%'), 'B dọn được file chưa gắn phiên bản; 10 file đã gắn thì còn nguyên');
select t.ok(not public.chord_source_can_write('x/' || t.id('a1')::text || '/1.png', 'insert')
  and not public.chord_source_can_write(t.u('A')::text || '/' || gen_random_uuid()::text || '/1.png', 'insert')
  and not public.chord_source_can_write(t.u('A')::text || '/' || t.id('a1')::text || '/1.png', 'delete'),
  'L3: cổng ghi trả false cho mọi tên NGOÀI thư mục của người gọi — có hay không có phiên bản cũng vậy');
select t.ok(public.chord_source_can_write(t.u('B')::text || '/' || t.id('a1')::text || '/1.png', 'insert')
  = public.chord_source_can_write(t.u('B')::text || '/' || gen_random_uuid()::text || '/1.png', 'insert'),
  'L3: version id của NGƯỜI KHÁC đặt trong thư mục của mình cho kết quả y như một id ngẫu nhiên (không lộ tồn tại)');
select t.ok(not public.chord_source_can_write(null, 'insert') and not public.chord_source_can_write(t.q('v1', '0.png'), 'update')
  and not public.chord_source_can_write(t.u('B')::text || '/khong-phai-uuid/1.png', 'insert'), 'L3: tên null / thao tác lạ / không phải uuid → false, không lỗi ép kiểu');
select t.reset();
select t.ok((select count(*) = 0 from pg_proc where proname = 'chord_source_recorded'), 'L3: hàm cũ chord_source_recorded không còn');

select t.as_user('B');
select t.ok((select count(*) = 0 from storage.objects where bucket_id = 'chord-sheet-sources' and name like t.u('A')::text || '/%'), 'học viên khác (B) KHÔNG đọc được file nguồn của A');
select t.as_anon();
select t.ok((select count(*) = 0 from storage.objects where bucket_id = 'chord-sheet-sources'), 'khách KHÔNG đọc được file nguồn');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.p('A', '5.png')), 'khách KHÔNG tải lên được', 'row-level security');
select t.as_user('T');
select t.ok((select count(*) = 13 and count(distinct split_part(name, '/', 1)) = 2 from storage.objects where bucket_id = 'chord-sheet-sources'), 'thầy đọc được file nguồn của mọi người (3 của A + 10 của B)');
select t.as_user('X');
select t.ok((select count(*) = 13 from storage.objects where bucket_id = 'chord-sheet-sources'), 'admin đọc được file nguồn của mọi người');
select t.as_user('T');
select t.ok(public.chord_sheet_approve(t.id('s1')) ->> 'ok' = 'true', 'T approve bài có nguồn');
select t.as_user('B');
select t.ok(not (public.chord_sheet_get(t.id('s1')) ? 'sources')
  and (select count(*) = 0 from storage.objects where bucket_id = 'chord-sheet-sources' and name like t.u('A')::text || '/%'),
  'bài đã duyệt: B đọc lời + hợp âm nhưng file nguồn vẫn KHÔNG mở cho B');

-- ── Xoá tài khoản: đóng góp ở lại, không còn tên ──────────────────────────────
select t.reset();
delete from public.app_users where id = t.u('N');
delete from auth.users where id = t.u('N');
select t.ok((select contributed_by is null and review_status = 'approved' and text = 'bản của N [Em]'
               from public.chord_sheet_versions where id = t.id('n1')),
  'N xoá tài khoản → phiên bản còn nguyên, contributed_by = null (không chặn delete_my_account)');

-- ── Bất biến cấu trúc sau mọi thao tác ────────────────────────────────────────
select t.ok((select count(*) = 0 from public.chord_sheets s
              where s.canonical_version_id is not null and not exists (
                select 1 from public.chord_sheet_versions v
                 where v.id = s.canonical_version_id and v.sheet_id = s.id and v.review_status = 'approved')),
  'mọi con trỏ canonical đều trỏ tới phiên bản APPROVED của chính bài đó');
select t.ok((select count(*) = 0 from public.chord_sheet_versions where anchors is not null or anchors_status <> 'none'),
  'Lát 1: không phiên bản nào có neo — anchors_status = none toàn bộ');
select t.ok((select count(*) = 0 from pg_policies where schemaname = 'public' and tablename in ('chord_sheets', 'chord_sheet_versions')),
  '2 bảng: RLS bật, 0 policy');

select t.reset();
set local client_min_messages = warning;
drop schema t cascade;
commit;
\o
do $$ begin raise notice 'ALL PASS'; end $$;
