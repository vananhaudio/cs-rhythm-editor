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
    -- 'BLOCKED_WRITE': lượt ghi storage bị chặn bởi policy (RLS) HOẶC bởi trigger N1 — trigger BEFORE chạy trước
    -- WITH CHECK nên lý do nào hiện ra tuỳ thứ tự; cái cần chứng minh là dòng KHÔNG được ghi.
    if p_expect = 'BLOCKED_WRITE' then
      if sqlerrm not like '%row-level security%' and sqlerrm not like '%CHORDLIB_SOURCE%' then raise exception 'FAIL: % — sai lý do: %', msg, sqlerrm; end if;
    elsif p_expect is not null and position(p_expect in sqlerrm) = 0 then raise exception 'FAIL: % — sai lý do: %', msg, sqlerrm; end if;
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
select t.ok(public.chord_sheet_contribute(p_text => t.loi(), p_title => 'CON ĐƯỜNG XƯA EM ĐI', p_meter => '{"beats": 4, "beatType": 4}', p_suggested_bpm => 66)
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
select t.ok(public.chord_sheet_contribute(p_text => t.loi(), p_sheet_id => t.id('a1', 'sheet_id'), p_meter => '{"beats": 4, "beatType": 4}', p_suggested_bpm => 66) ->> 'version_id' = t.id('a1')::text,
  'gửi nội dung trùng bản chuẩn (lời + nhịp + BPM) → duplicate, trả bản chuẩn');
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

-- ── Bàn biên tập (lát 3): sửa tên bài/tác giả · trùng = lời + nhịp + BPM · bản nháp mới hơn ──
select t.as_user('A');
select t.fails(format('select public.chord_sheet_update_info(%L, %L, %L)', t.id('a1', 'sheet_id'), 'Tên do học viên đổi', null),
  'học viên KHÔNG sửa được tên bài/tác giả (kể cả bài mình đóng góp)', 'CHORDLIB_FORBIDDEN');
select t.as_anon();
select t.fails(format('select public.chord_sheet_update_info(%L, %L)', t.id('a1', 'sheet_id'), 'x'), 'khách KHÔNG gọi được update_info', 'permission denied');
select t.as_user('T');
select t.put('before_info', (select jsonb_build_object('canon', public.chord_sheet_get(t.id('n1')) ->> 'canonical_version_id',
  'hash', public.chord_sheet_get(t.id('n1')) ->> 'text_hash', 'text', public.chord_sheet_get(t.id('n1')) ->> 'text')));
select t.ok(public.chord_sheet_update_info(t.id('a1', 'sheet_id'), E'  Con Đường Xưa Em Đi  ', '  Châu Kỳ – Hồ Đình Phương ')
  = jsonb_build_object('ok', true, 'sheet_id', t.id('a1', 'sheet_id'), 'title', 'Con Đường Xưa Em Đi', 'composer', 'Châu Kỳ – Hồ Đình Phương'),
  'thầy sửa tên bài + tác giả → trả giá trị đã cắt khoảng trắng');
select t.ok(public.chord_sheet_get(t.id('n1')) ->> 'title' = 'Con Đường Xưa Em Đi'
  and public.chord_sheet_get(t.id('a1')) ->> 'composer' = 'Châu Kỳ – Hồ Đình Phương'
  and public.chord_sheet_get(t.id('n1')) ->> 'canonical_version_id' = (select v ->> 'canon' from t.kv where k = 'before_info')
  and public.chord_sheet_get(t.id('n1')) ->> 'text_hash' = (select v ->> 'hash' from t.kv where k = 'before_info')
  and public.chord_sheet_get(t.id('n1')) ->> 'text' = (select v ->> 'text' from t.kv where k = 'before_info'),
  'đổi tên: MỌI phiên bản của bài thấy tên mới; con trỏ canonical, lời, hash KHÔNG đổi');
select t.ok(jsonb_array_length(public.chord_sheet_search('HO DINH phuong')) >= 1
  and jsonb_array_length(public.chord_sheet_search('CON DUONG XUA')) >= 1, 'tìm không dấu theo tên/tác giả MỚI → thấy (khoá tự cập nhật)');
select t.reset();
select t.ok((select title_key = 'con duong xua em di' and composer_key = 'chau ky – ho dinh phuong' and created_by = t.u('A')
               and (select count(*) from public.chord_sheet_versions v where v.sheet_id = s.id) = 5
               from public.chord_sheets s where s.id = t.id('a1', 'sheet_id')),
  'title_key/composer_key chuẩn hoá lại sau khi đổi tên; created_by và số phiên bản không đổi');
select t.as_user('T');
select t.ok(public.chord_sheet_update_info(t.id('a1', 'sheet_id'), 'Con Đường Xưa Em Đi', '   ') ->> 'composer' is null, 'tác giả toàn khoảng trắng → null');
select t.fails(format('select public.chord_sheet_update_info(%L, %L)', t.id('a1', 'sheet_id'), '   '), 'tên bài rỗng → chặn', 'CHORDLIB_INVALID');
select t.fails(format('select public.chord_sheet_update_info(%L, %L)', t.id('a1', 'sheet_id'), repeat('x', 201)), 'tên bài > 200 ký tự → chặn', 'CHORDLIB_INVALID');
select t.fails(format('select public.chord_sheet_update_info(%L, %L)', gen_random_uuid(), 'x'), 'bài không tồn tại → NOT_FOUND', 'CHORDLIB_NOT_FOUND');
select t.ok(public.chord_sheet_update_info(t.id('a1', 'sheet_id'), 'Con đường xưa em đi', 'Châu Kỳ') ->> 'ok' = 'true', 'trả tên bài về như cũ');
select t.as_user('X');
select t.ok(public.chord_sheet_update_info(t.id('x1', 'sheet_id'), 'Nắng Thuỷ Tinh', 'Trịnh Công Sơn') ->> 'ok' = 'true', 'admin sửa tên bài/tác giả PASS');

-- Trùng = lời + nhịp + BPM. text_hash vẫn chỉ băm LỜI.
select t.put('d1', public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_title => 'Đo Trùng', p_meter => '{"beats": 4, "beatType": 4}', p_suggested_bpm => 80));
select t.ok(public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_title => 'Đo Trùng', p_meter => '{"beats": 4, "beatType": 4}', p_suggested_bpm => 80)
  ->> 'duplicate' = 'true', 'bài mới: cùng lời + cùng nhịp + cùng BPM → duplicate');
select t.ok(public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_sheet_id => t.id('d1', 'sheet_id'), p_meter => '{"beatType": 4, "beats": 4}', p_suggested_bpm => 80)
  ->> 'version_id' = t.id('d1')::text, 'bài đã có: cùng lời + cùng nhịp (khoá JSON khác thứ tự) + cùng BPM → duplicate, trả bản cũ');
select t.put('d2', public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_sheet_id => t.id('d1', 'sheet_id'), p_meter => '{"beats": 3, "beatType": 4}', p_suggested_bpm => 80));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'version_number' = '2' from t.kv where k = 'd2'), 'cùng lời, KHÁC nhịp → phiên bản mới (v2)');
select t.put('d3', public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_sheet_id => t.id('d1', 'sheet_id'), p_meter => '{"beats": 3, "beatType": 4}', p_suggested_bpm => 96));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'version_number' = '3' from t.kv where k = 'd3'), 'cùng lời, KHÁC BPM → phiên bản mới (v3)');
select t.put('d4', public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_sheet_id => t.id('d1', 'sheet_id'), p_meter => '{"beats": 3, "beatType": 4}'));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'version_number' = '4' from t.kv where k = 'd4'), 'BPM có giá trị → BPM null → phiên bản mới (v4)');
select t.put('d5', public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_sheet_id => t.id('d1', 'sheet_id'), p_suggested_bpm => 96));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'version_number' = '5' from t.kv where k = 'd5'), 'nhịp có giá trị → nhịp null (BPM null → 96) → phiên bản mới (v5)');
select t.ok(public.chord_sheet_contribute(p_text => E'bài đo trùng [C]  \r\n', p_sheet_id => t.id('d1', 'sheet_id'), p_suggested_bpm => 96) ->> 'version_id' = t.id('d5')::text,
  'lời chỉ khác khoảng trắng cuối dòng + cùng nhịp/BPM → vẫn duplicate (so trên lời đã chuẩn hoá)');
select t.reset();
select t.ok((select count(distinct v.text_hash) = 1 and count(*) = 5 from public.chord_sheet_versions v where v.sheet_id = t.id('d1', 'sheet_id')),
  '5 phiên bản cùng lời → CÙNG text_hash (text_hash vẫn chỉ băm lời, không trộn nhịp/BPM)');
select t.as_user('X');
select t.ok(public.chord_sheet_get(t.id('d1')) ->> 'draft_version_id' = t.id('d5')::text
  and public.chord_sheet_get(t.id('d5')) -> 'draft_version_id' = 'null', 'người review: get trả bản nháp MỚI NHẤT mới hơn bản đang xem; bản mới nhất thì null');
select t.ok(public.chord_sheet_approve(t.id('d3')) ->> 'canonical_version_id' = t.id('d3')::text, 'duyệt v3 (chỉ khác BPM so với v2)');
select t.ok(public.chord_sheet_contribute(p_text => 'bài đo trùng [C]', p_sheet_id => t.id('d1', 'sheet_id'), p_meter => '{"beats": 3, "beatType": 4}', p_suggested_bpm => 96)
  ->> 'version_id' = t.id('d3')::text, 'gửi lại đúng nội dung của bản chuẩn → duplicate, trả bản chuẩn');
select t.ok(public.chord_sheet_get(t.id('d3')) ->> 'draft_version_id' = t.id('d5')::text
  and public.chord_sheet_get(t.id('d2')) ->> 'suggested_bpm' = '80' and public.chord_sheet_get(t.id('d2')) ->> 'review_status' = 'private',
  'bản chuẩn v3 vẫn báo còn nháp v5 mới hơn; v2 cũ nguyên vẹn');
select t.as_user('A');
select t.ok(not (public.chord_sheet_get(t.id('d3')) ? 'draft_version_id'), 'học viên đọc bản chuẩn: KHÔNG có trường draft_version_id');

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
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.p('A', '3.heic')), 'HEIC → chặn', 'BLOCKED_WRITE');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.p('B', '1.png')), 'A KHÔNG tải vào thư mục của B', 'BLOCKED_WRITE');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.u('A')::text || '/tu-do/1.png'), 'đường dẫn sai khuôn → chặn', 'BLOCKED_WRITE');
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
  'phiên bản đã ghi → KHÔNG thêm được file nguồn nữa', 'BLOCKED_WRITE');
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
  'H2: số file hai chữ số ({n} = 10) → chặn (tối đa 0–9 = 10 file một phiên bản)', 'BLOCKED_WRITE');
insert into storage.objects (bucket_id, name) select 'chord-sheet-sources', t.q('v1', n || '.png') from generate_series(0, 9) n;
insert into storage.objects (bucket_id, name) select 'chord-sheet-sources', t.q('v2', n || '.pdf') from generate_series(0, 9) n;
select t.ok((select count(*) = 20 from storage.objects where name like t.u('B')::text || '/%'), 'H2: B tải được 20 file chưa gắn phiên bản');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.q('v3', '0.png')),
  'H2: file thứ 21 chưa gắn phiên bản → chặn (hết hạn mức)', 'BLOCKED_WRITE');
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
  'H2: …nhưng vẫn không vượt 20 file chưa gắn phiên bản', 'BLOCKED_WRITE');
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
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.p('A', '5.png')), 'khách KHÔNG tải lên được', 'BLOCKED_WRITE');
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

-- ── N1) Trigger ở LƯỢT GHI THẬT (thư mục của T — C đã chạm trần 30 bản chờ ở ca trước): ghi bằng postgres (đi vòng RLS như Storage API ghi bằng superuser) vẫn bị ép luật ──
select t.reset();
select t.put('n1t', jsonb_build_object('v1', gen_random_uuid(), 'v2', gen_random_uuid(), 'v3', gen_random_uuid()));
create function t.c(k text, v text, n text) returns text language sql as $$ select t.u(k)::text || '/' || t.id('n1t', v)::text || '/' || n $$;
grant execute on function t.c(text, text, text) to anon, authenticated;
select t.ok((select count(*) = 1 from pg_trigger where tgrelid = 'storage.objects'::regclass and tgname = 'chord_source_guard_trg'), 'N1: đúng MỘT trigger chord_source_guard_trg trên storage.objects');
-- bucket khác: không bị ảnh hưởng (tên tuỳ ý, kể cả tên lạ, chủ tuỳ ý)
insert into storage.buckets (id, name, public) values ('bucket-khac', 'bucket-khac', true) on conflict do nothing;
insert into storage.objects (bucket_id, name, owner) values ('bucket-khac', 'không-theo-khuôn/../ảnh.heic', t.u('B')), ('bucket-khac', t.c('A', 'v1', '1.png'), t.u('B'));
insert into storage.objects (bucket_id, name) select 'bucket-khac', 'nhieu/' || g || '.png' from generate_series(1, 30) g;
update storage.objects set name = 'doi-ten.png' where bucket_id = 'bucket-khac' and name = 'nhieu/1.png';
select t.ok((select count(*) = 32 from storage.objects where bucket_id = 'bucket-khac'), 'N1: bucket khác ghi/đổi tên tự do — trigger trả NEW ngay, không áp luật');
-- đường dẫn
select t.fails($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', 'khong-phai-uuid/x/1.png')$q$, 'N1: lượt ghi thật — đường dẫn không bắt đầu bằng uid → chặn', 'CHORDLIB_SOURCE');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.c('A', 'v1', '10.png')), 'N1: lượt ghi thật — n = 10 → chặn', 'CHORDLIB_SOURCE');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.c('A', 'v1', '1.heic')), 'N1: lượt ghi thật — đuôi .heic → chặn', 'CHORDLIB_SOURCE');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, upper(t.c('A', 'v1', '1.png'))), 'N1: lượt ghi thật — uuid viết HOA → chặn', 'CHORDLIB_SOURCE');
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('chord-sheet-sources', %L, %L)$q$, t.c('A', 'v1', '1.png'), t.u('B')),
  'N1: chủ file (owner do Storage ghi từ JWT) ≠ uid trong đường dẫn → chặn', 'chủ file không khớp');
-- C) tối đa 10 file / phiên bản (kể cả khi đổi đuôi: 0.png + 0.pdf + …)
insert into storage.objects (bucket_id, name, owner) select 'chord-sheet-sources', t.c('T', 'v1', n || '.' || e), t.u('T')
  from generate_series(0, 4) n, unnest(array['png', 'pdf']) e;
select t.ok((select count(*) = 10 from storage.objects where name like t.u('T')::text || '/' || t.id('n1t', 'v1')::text || '/%'), 'N1: 10 file (5 số × 2 đuôi) vào một thư mục phiên bản');
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('chord-sheet-sources', %L, %L)$q$, t.c('T', 'v1', '9.webp'), t.u('T')),
  'N1: file thứ 11 trong cùng thư mục phiên bản → chặn (dù tên khác)', 'tối đa 10 file nguồn');
-- B) hạn mức 20 file chưa gắn — kể cả MỘT câu lệnh chèn nhiều dòng
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) select 'chord-sheet-sources', %L || n || '.png', %L::uuid from generate_series(0, 9) n
  union all select 'chord-sheet-sources', %L || n || '.png', %L::uuid from generate_series(0, 9) n$q$,
  t.u('T')::text || '/' || t.id('n1t', 'v2')::text || '/', t.u('T'), t.u('T')::text || '/' || t.id('n1t', 'v3')::text || '/', t.u('T')),
  'N1: MỘT câu INSERT 20 dòng khi đã có 10 → chặn cả câu (trigger thấy các dòng trước trong cùng câu)', 'đã có 20 file');
select t.ok((select count(*) = 10 from storage.objects where bucket_id = 'chord-sheet-sources' and name like t.u('T')::text || '/%'), 'N1: …và không dòng nào của câu đó được ghi');
insert into storage.objects (bucket_id, name, owner) select 'chord-sheet-sources', t.c('T', 'v2', n || '.png'), t.u('T') from generate_series(0, 9) n;
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('chord-sheet-sources', %L, %L)$q$, t.c('T', 'v3', '0.png'), t.u('T')),
  'N1: lượt ghi thật — file thứ 21 chưa gắn phiên bản → chặn', 'đã có 20 file');
-- A + D) thư mục đã thành phiên bản → không thêm được (lượt ghi thật)
select t.as_user('T');
delete from storage.objects where name like t.u('T')::text || '/' || t.id('n1t', 'v2')::text || '/%';
select t.ok(public.chord_sheet_contribute(p_text => 'n1 đã ghi', p_title => 'N1 đã ghi', p_version_id => t.id('n1t', 'v1'),
  p_sources => (select jsonb_agg(jsonb_build_object('path', o.name, 'mime', case when o.name like '%.pdf' then 'application/pdf' else 'image/png' end, 'sha256', repeat('f', 64)) order by o.name)
                  from storage.objects o where o.name like t.u('T')::text || '/' || t.id('n1t', 'v1')::text || '/%')) ->> 'ok' = 'true', 'T đóng góp phiên bản v1 với 10 file nguồn');
select t.reset();
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('chord-sheet-sources', %L, %L)$q$, t.c('T', 'v1', '9.png'), t.u('T')),
  'N1: lượt ghi thật vào thư mục của phiên bản ĐÃ GHI → chặn (kể cả bằng postgres)', 'phiên bản đã ghi');
select t.fails(format($q$insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', %L)$q$, t.c('T', 'v1', '9.webp')),
  'N1: …kể cả không có chủ (owner null)', 'phiên bản đã ghi');
-- UPDATE: đổi tên / dời bucket
select t.fails(format($q$update storage.objects set name = %L where name = %L$q$, t.c('T', 'v3', '0.png'), t.c('T', 'v1', '0.png')),
  'N1: đổi tên file trong bucket nguồn → chặn', 'CHORDLIB_SOURCE');
select t.fails(format($q$update storage.objects set bucket_id = 'bucket-khac' where name = %L$q$, t.c('T', 'v1', '0.png')),
  'N1: dời file nguồn sang bucket khác → chặn', 'không đổi tên / không dời');
select t.fails(format($q$update storage.objects set bucket_id = 'chord-sheet-sources' where bucket_id = 'bucket-khac' and name = %L$q$, t.c('A', 'v1', '1.png')),
  'N1: dời file TỪ bucket khác VÀO bucket nguồn → xét như tải lên mới (chủ ≠ uid → chặn)', 'chủ file không khớp');
update storage.objects set metadata = '{"mimetype": "image/png", "size": 1}' where name = t.c('T', 'v1', '0.png');
select t.ok((select metadata ->> 'size' = '1' from storage.objects where name = t.c('T', 'v1', '0.png')), 'N1: cập nhật metadata (không đổi tên/bucket) KHÔNG bị trigger đụng tới');
select t.ok((select count(*) = 0 from storage.objects o where o.bucket_id = 'chord-sheet-sources' and o.name like t.u('T')::text || '/' || t.id('n1t', 'v1')::text || '/%'
              and not exists (select 1 from public.chord_sheet_versions v, jsonb_array_elements(v.sources) e where v.id = t.id('n1t', 'v1') and e ->> 'path' = o.name)),
  'N1: thư mục phiên bản đã ghi không có file nào nằm ngoài sources');
select t.as_user('A');
select t.fails($q$select public.chord_source_rule(gen_random_uuid(), 'x', 'insert')$q$, 'N1: luật ghi không gọi thẳng được từ client', 'permission denied');
select t.reset();

-- ── V1.1) Bộ file nguồn tính vào phép dò trùng: chỉ thay sheet nguồn = phiên bản mới ──
select t.reset();
select t.put('src', jsonb_build_object('v1', gen_random_uuid(), 'v2', gen_random_uuid(), 'v3', gen_random_uuid(), 'v4', gen_random_uuid()));
create function t.sp(v text, n text) returns text language sql as $$ select t.u('T')::text || '/' || t.id('src', v)::text || '/' || n $$;
create function t.sj(v text, n text, sha text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('path', t.sp(v, n), 'mime', 'image/png', 'sha256', sha)) $$;
grant execute on function t.sp(text, text), t.sj(text, text, text) to anon, authenticated;
select t.ok(public.chord_source_key('[]') = '' and public.chord_source_key(null) = ''
  and public.chord_source_key(jsonb_build_array(jsonb_build_object('sha256', 'b'), jsonb_build_object('sha256', 'a'))) = 'a,b',
  'V1.1: chord_source_key = sha256 đã sắp xếp (thứ tự file không làm khác khoá); rỗng/null → ''''');
insert into storage.objects (bucket_id, name, owner) values
  ('chord-sheet-sources', t.sp('v1', '0.png'), t.u('T')), ('chord-sheet-sources', t.sp('v2', '0.png'), t.u('T')),
  ('chord-sheet-sources', t.sp('v3', '0.png'), t.u('T')), ('chord-sheet-sources', t.sp('v4', '0.png'), t.u('T'));
select t.as_user('T');
select t.put('s1', public.chord_sheet_contribute(p_text => 'nguồn [C] một', p_title => 'Bài có nguồn V1.1', p_version_id => t.id('src', 'v1'),
  p_sources => t.sj('v1', '0.png', repeat('1', 64))));
select t.put('s2', public.chord_sheet_contribute(p_text => 'nguồn [C] một', p_sheet_id => t.id('s1', 'sheet_id'), p_version_id => t.id('src', 'v2'),
  p_sources => t.sj('v2', '0.png', repeat('2', 64))));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'version_number' = '2' from t.kv where k = 's2'),
  'V1.1: cùng lời + nhịp + BPM nhưng KHÁC file nguồn → phiên bản mới (trước đây bị coi là trùng)');
select t.put('s3', public.chord_sheet_contribute(p_text => 'nguồn [C] một', p_sheet_id => t.id('s1', 'sheet_id'), p_version_id => t.id('src', 'v3'),
  p_sources => t.sj('v3', '0.png', repeat('2', 64))));
select t.ok((select v ->> 'duplicate' = 'true' and v ->> 'version_id' = t.id('s2')::text from t.kv where k = 's3'),
  'V1.1: cùng lời + nhịp + BPM + CÙNG sha256 nguồn (khác đường dẫn) → trùng, trả bản đã có');
select t.fails(format($q$select public.chord_sheet_contribute(p_text => 'nguồn [C] một', p_sheet_id => %L, p_version_id => %L)$q$, t.id('s1', 'sheet_id'), t.id('src', 'v4')),
  'V1.1: thư mục phiên bản còn file chưa khai → đóng góp không kèm nguồn bị chặn (không để file mồ côi)', 'chưa được khai');
select t.put('s5', public.chord_sheet_contribute(p_text => 'nguồn [C] một', p_sheet_id => t.id('s1', 'sheet_id')));
select t.ok((select v ->> 'duplicate' = 'false' from t.kv where k = 's5'), 'V1.1: cùng lời + nhịp + BPM, KHÔNG nguồn (so với bản có nguồn) → phiên bản mới');
select t.ok(public.chord_sheet_get(t.id('s2')) -> 'sources' -> 0 ->> 'sha256' = repeat('2', 64)
  and public.chord_sheet_get(t.id('s1')) -> 'sources' -> 0 ->> 'sha256' = repeat('1', 64),
  'V1.1: mỗi phiên bản giữ đúng bộ nguồn của nó (bất biến)');
select t.reset();

-- ── V1.2) Vạch nhịp thủ công: chấp nhận → phiên bản MỚI (cùng nội dung + nguồn của cha), không ghi vào bản cũ ──
select t.reset();
select t.ok(public.chord_lyric_token_counts(E'1. Chiều [Am] nao, tiễn nhau [E7] đi\nĐK: [Dm] Hoàng hôn\n\n[C][G]\nti[Am]ễn\nhết câu [G]\nDạo: [C] la\n[C] 1. không phải nhãn')
  = '{5,2,0,1,2,3,1,4}'::integer[],
  'V1.2 tách chữ: bỏ nhãn "1." / "ĐK:" / "Dạo:"; [hợp âm] không phải chữ; hợp âm giữa chữ tách 2; hợp âm cuối dòng = 1 vị trí; dòng trống = 0; có hợp âm trước thì "1." là lời');
select t.ok(public.chord_lyric_token_counts(E'a\u00a0b\u3000c  d') = '{4}' and public.chord_lyric_token_counts('') = '{0}', 'V1.2 tách chữ: NBSP / khoảng trắng Unicode là ranh giới chữ (như \s của JavaScript)');
select t.put('anc', jsonb_build_object('text', E'1. Chiều [Am] nao, tiễn nhau [E7] đi\nKhi [C] bóng ngả [G] xế\nĐK: [Dm] Hoàng hôn [G] xuống'));
-- bài + phiên bản 1 (có 1 file nguồn) do thầy T đóng góp
select t.put('anc', (select v from t.kv where k = 'anc') || jsonb_build_object('v1', gen_random_uuid()));
create function t.ap(n text) returns text language sql as $$ select t.u('T')::text || '/' || ((select v ->> 'v1' from t.kv where k = 'anc'))::text || '/' || n $$;
grant execute on function t.ap(text) to anon, authenticated;
insert into storage.objects (bucket_id, name, owner, metadata) values ('chord-sheet-sources', t.ap('0.png'), t.u('T'), '{"mimetype": "image/png", "size": 70}');
select t.as_user('T');
select t.put('a1', public.chord_sheet_contribute(p_text => (select v ->> 'text' from t.kv where k = 'anc'), p_title => 'Bài vạch nhịp', p_meter => '{"beats": 3, "beatType": 4}', p_suggested_bpm => 66,
  p_version_id => ((select v ->> 'v1' from t.kv where k = 'anc'))::uuid,
  p_sources => jsonb_build_array(jsonb_build_object('path', t.ap('0.png'), 'mime', 'image/png', 'sha256', repeat('9', 64), 'size_bytes', 70, 'page', 1))));
select t.ok(public.chord_sheet_approve(t.id('a1')) ->> 'ok' = 'true', 'V1.2: phiên bản 1 (chưa có vạch nhịp) được duyệt làm bản đang dùng');
select t.reset();
create function t.acc(p jsonb) returns text language sql as $$ select format('select public.chord_sheet_accept_anchors(%L, %L)', t.id('a1'), p) $$;
grant execute on function t.acc(jsonb) to anon, authenticated;
-- quyền
select t.as_user('A');
select t.fails(t.acc('{"measures": [{"line": 0, "token": 1}]}'), 'V1.2: học viên KHÔNG chấp nhận vạch nhịp được', 'CHORDLIB_FORBIDDEN');
select t.as_anon();
select t.fails(t.acc('{"measures": [{"line": 0, "token": 1}]}'), 'V1.2: khách KHÔNG gọi được', 'permission denied');
select t.as_user('T');
-- dữ liệu sai → không tạo phiên bản
select t.fails(t.acc('[]'), 'V1.2: không phải object → chặn', 'vạch nhịp phải là một object');
select t.fails(t.acc('{"measures": []}'), 'V1.2: measures rỗng → chặn', 'chưa có vạch nhịp nào');
select t.fails(t.acc('{"measures": [{"line": 0, "token": 1}], "x": 1}'), 'V1.2: khoá lạ ở gốc → chặn', 'chỉ gồm pickup và measures');
select t.fails(t.acc('{"measures": [{"line": 0, "token": 1, "px": 30}]}'), 'V1.2: khoá lạ trong ô (pixel…) → chặn', 'phải là {line, token}');
select t.fails(t.acc('{"measures": [{"line": 0}]}'), 'V1.2: thiếu token → chặn', 'phải là {line, token}');
select t.fails(t.acc('{"measures": [{"line": "0", "token": 1}]}'), 'V1.2: line là chuỗi → chặn', 'số nguyên ≥ 0');
select t.fails(t.acc('{"measures": [{"line": 0, "token": 1.5}]}'), 'V1.2: token không nguyên → chặn', 'số nguyên ≥ 0');
select t.fails(t.acc('{"measures": [{"line": 0, "token": -1}]}'), 'V1.2: token âm → chặn', 'số nguyên ≥ 0');
select t.fails(t.acc('{"measures": [{"line": 3, "token": 0}]}'), 'V1.2: dòng ngoài phạm vi → chặn', 'không có trong lời');
select t.fails(t.acc('{"measures": [{"line": 0, "token": 6}]}'), 'V1.2: token vượt số chữ của dòng (dòng 1 có 5 chữ, nhãn "1." không tính) → chặn', 'chỉ có 5 chữ');
select t.fails(t.acc('{"measures": [{"line": 0, "token": 5}, {"line": 0, "token": 6}]}'), 'V1.2: token = số chữ (vạch cuối dòng) hợp lệ, vượt 1 thì chặn', 'chỉ có 5 chữ');
select t.fails(t.acc('{"measures": [{"line": null, "token": 0}]}'), 'V1.2: ô không lời mà token khác null → chặn', 'token cũng phải null');
select t.fails(t.acc('{"pickup": {"line": null, "token": null}, "measures": [{"line": 0, "token": 1}]}'), 'V1.2: nhịp lấy đà không lời → chặn', 'nhịp lấy đà phải nằm trên một chữ');
select t.fails(t.acc(jsonb_build_object('measures', (select jsonb_agg(jsonb_build_object('line', 0, 'token', 0)) from generate_series(1, 2001)))), 'V1.2: hơn 2000 ô → chặn', 'tối đa 2000');
select t.fails(format('select public.chord_sheet_accept_anchors(%L, %L, %L)', t.id('a1'), '{"measures": [{"line": 0, "token": 1}]}', '{"mode": "manual", "reviewedBy": "giả"}'),
  'V1.2: client không tự khai người duyệt / giờ duyệt', 'anchor_review chỉ nhận');
select t.fails(format('select public.chord_sheet_accept_anchors(%L, %L)', gen_random_uuid(), '{"measures": [{"line": 0, "token": 1}]}'), 'V1.2: phiên bản nguồn không tồn tại → NOT_FOUND', 'CHORDLIB_NOT_FOUND');
select t.reset();
select t.ok((select count(*) = 1 from public.chord_sheet_versions where sheet_id = t.id('a1', 'sheet_id')), 'V1.2: mọi lượt bị chặn không tạo phiên bản nào');
-- hợp lệ: nhịp lấy đà "Chiều", ô 1 ở "nao,", ô ngân, ô không lời (gian tấu), điệp khúc QUAY LẠI dòng 1
select t.put('anchors', '{"pickup": {"line": 0, "token": 0}, "measures": [{"line": 0, "token": 1}, {"line": 0, "token": 3}, {"line": 0, "token": 3},
  {"line": 1, "token": 0}, {"line": 1, "token": 2}, {"line": 2, "token": 0}, {"line": 2, "token": 2}, {"line": null, "token": null}, {"line": 2, "token": 0}, {"line": 2, "token": 3}]}');
select t.as_user('T');
select t.put('a2', public.chord_sheet_accept_anchors(t.id('a1'), (select v from t.kv where k = 'anchors'), '{"mode": "manual"}'));
select t.ok((select v ->> 'duplicate' = 'false' and v ->> 'version_number' = '2' and v ->> 'review_status' = 'private' and v ->> 'anchors_status' = 'ready' from t.kv where k = 'a2'),
  'V1.2: chấp nhận → phiên bản 2 MỚI, private (KHÔNG tự duyệt), anchors_status = ready');
select t.put('g2', public.chord_sheet_get(t.id('a2')));
select t.put('g1', public.chord_sheet_get(t.id('a1')));
select t.ok((select g2.v -> 'anchors' = (select v from t.kv where k = 'anchors')
  and g2.v ->> 'text' = g1.v ->> 'text' and g2.v ->> 'text_hash' = g1.v ->> 'text_hash' and g2.v -> 'meter' = g1.v -> 'meter' and g2.v ->> 'suggested_bpm' = g1.v ->> 'suggested_bpm'
  and g2.v -> 'sources' = g1.v -> 'sources' and g2.v ->> 'parent_version_id' = t.id('a1')::text and g2.v ->> 'is_canonical' = 'false'
  from t.kv g1, t.kv g2 where g1.k = 'g1' and g2.k = 'g2'),
  'V1.2: phiên bản 2 = cùng lời / hash / nhịp / BPM, TRỎ LẠI đúng file nguồn của phiên bản 1, cha = 1, chưa là bản đang dùng; vạch nhịp lưu đúng thứ tự dòng thời gian (gồm ô ngân, ô không lời, quay lại dòng cũ)');
select t.ok((select g1.v -> 'anchors' = 'null' and g1.v ->> 'anchors_status' = 'none' and g1.v ->> 'is_canonical' = 'true' from t.kv g1 where g1.k = 'g1'),
  'V1.2: phiên bản 1 bất biến — vẫn không có vạch nhịp, vẫn là bản đang dùng (bản chuẩn cũ không tự đổi)');
select t.ok((select g2.v -> 'anchor_review' ->> 'mode' = 'manual' and g2.v -> 'anchor_review' ->> 'reviewedBy' = t.u('T')::text
  and (g2.v -> 'anchor_review' ->> 'measureCount')::int = 10 and (g2.v -> 'anchor_review' ->> 'hasPickup')::boolean from t.kv g2 where g2.k = 'g2'),
  'V1.2: anchor_review do MÁY CHỦ dựng (người duyệt = người gọi, số ô, có lấy đà)');
-- trùng: chấp nhận lại đúng bộ vạch (kể cả từ phiên bản 2) → trả bản đã có
select t.ok(public.chord_sheet_accept_anchors(t.id('a1'), (select v from t.kv where k = 'anchors')) ->> 'version_id' = t.id('a2')::text
  and public.chord_sheet_accept_anchors(t.id('a2'), (select v from t.kv where k = 'anchors')) ->> 'duplicate' = 'true', 'V1.2: chấp nhận lại đúng bộ vạch → trả phiên bản 2, không tạo bản rác');
select t.put('a3', public.chord_sheet_accept_anchors(t.id('a2'), '{"measures": [{"line": 0, "token": 1}, {"line": 1, "token": 0}]}'));
select t.ok((select v ->> 'version_number' = '3' from t.kv where k = 'a3') and public.chord_sheet_get(t.id('a3')) ->> 'parent_version_id' = t.id('a2')::text
  and public.chord_sheet_get(t.id('a2')) -> 'anchors' = (select v from t.kv where k = 'anchors'),
  'V1.2: sửa vạch rồi chấp nhận → phiên bản 3 (cha = 2); phiên bản 2 giữ nguyên bộ vạch cũ');
select t.ok(public.chord_sheet_approve(t.id('a2')) ->> 'canonical_version_id' = t.id('a2')::text, 'V1.2: duyệt phiên bản 2 → bản đang dùng có vạch nhịp');
-- tham chiếu file nguồn sang thư mục cha: thư mục phiên bản 1 vẫn đóng băng
select t.reset();
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('chord-sheet-sources', %L, %L)$q$, t.ap('1.png'), t.u('T')),
  'V1.2: thư mục file của phiên bản 1 (đang được phiên bản 2/3 trỏ tới) vẫn không thêm được', 'phiên bản đã ghi');
select t.as_user('T');
select t.fails(format($q$select public.chord_sheet_contribute(p_text => 'x', p_sheet_id => %L, p_sources => %L)$q$, t.id('a1', 'sheet_id'),
  jsonb_build_array(jsonb_build_object('path', t.ap('0.png'), 'mime', 'image/png', 'sha256', repeat('9', 64)))),
  'V1.2: client KHÔNG tự tạo tham chiếu file sang thư mục phiên bản khác qua contribute', 'file nguồn không hợp lệ');
select t.reset();
select t.ok((select count(*) = 1 from storage.objects where name like t.u('T')::text || '/' || ((select v ->> 'v1' from t.kv where k = 'anc'))::text || '/%'), 'V1.2: không chép file — vẫn đúng 1 object');
select t.fails(format('update public.chord_sheet_versions set anchors = null, anchors_status = %L where id = %L', 'none', t.id('a2')), 'V1.2: vạch nhịp của phiên bản đã ghi không sửa được (trigger)', 'CHORDLIB_VERSION_IMMUTABLE');
select t.as_user('T');
select t.fails(format('select public.chord_sheet_reject(%L, %L)', t.id('a3'), 'x') || '; select public.chord_sheet_accept_anchors(' || quote_literal(t.id('a3')) || ', ''{"measures": [{"line": 0, "token": 2}]}'')',
  'V1.2: không gắn vạch nhịp vào bản đã bỏ', 'không gắn vạch nhịp vào bản đã bỏ');
select t.reset();

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
select t.ok((select count(*) = 0 from public.chord_sheet_versions v
              where (v.anchors is not null) and (v.anchors_status <> 'ready'
                     or public.chord_anchors_problem(v.anchors, public.chord_lyric_token_counts(v.text)) is not null
                     or v.anchor_review ->> 'mode' is distinct from 'manual')),
  'mọi phiên bản có vạch nhịp: trạng thái ready, vạch hợp lệ với CHÍNH lời của nó, anchor_review do máy chủ ghi');
select t.ok((select count(*) = 0 from pg_policies where schemaname = 'public' and tablename in ('chord_sheets', 'chord_sheet_versions')),
  '2 bảng: RLS bật, 0 policy');

select t.reset();
set local client_min_messages = warning;
drop schema t cascade;
commit;
\o
do $$ begin raise notice 'ALL PASS'; end $$;
