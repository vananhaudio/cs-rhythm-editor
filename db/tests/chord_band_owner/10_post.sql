-- Sau V1.7 (Band sở hữu). Dùng helper t.* của 00_pre.sql.
\set ON_ERROR_STOP on
\set BA '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set BB '''bbbbbbbb-0000-4000-8000-00000000000b'''
select t.ok((select fp from t.fp0) = (select md5(string_agg(v::text, '|' order by v.id)) from public.chord_sheet_versions v), 'phiên bản hiện có KHÔNG đổi');
select t.ok((select fp from t.fps0) = (select md5(string_agg(s.id::text || s.title || coalesce(s.composer,'') || coalesce(s.canonical_version_id::text,'') || s.created_by::text || s.updated_at::text, '|' order by s.id)) from public.chord_sheets s),
  'bài hiện có KHÔNG đổi (kể cả updated_at)');
select t.ok((select count(*) from public.chord_sheets where band_id is not null) = 0, 'bài cũ: band_id = NULL (không backfill)');
select t.ok((select count(*) from information_schema.columns where table_name = 'chord_sheets' and column_name = 'band_id' and is_nullable = 'YES') = 1, 'cột band_id nullable');

-- 1) RPC CŨ (không Band) vẫn chạy y như V1.5
select t.as_user('ED1');
select t.put('old_api', public.chord_sheet_contribute_publish('Bài cũ [C] API cũ', 'API cũ', null, '{"beats":4,"beatType":4}'));
select t.reset();
select t.ok((t.val('old_api') ->> 'published')::boolean and (select band_id is null from public.chord_sheets where id = t.id('old_api','sheet_id')), 'RPC cũ: đăng được, band_id NULL');

-- 2) Biên tập Band A lưu vào Band của mình
select t.as_user('ED1');
select t.put('a_new', public.chord_sheet_contribute_publish_band('Một [C] bài Band A', 'Bài Band A', 'TG', '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, :BA));
select t.reset();
select t.ok((select s.band_id = :BA::uuid and s.created_by = t.u('ED1') and v.review_status = 'approved' and s.canonical_version_id = v.id
               from public.chord_sheets s join public.chord_sheet_versions v on v.id = t.id('a_new') where s.id = t.id('a_new','sheet_id')),
  'Biên tập A lưu vào Band A: band_id đúng, created_by = mình, vẫn approved + canonical (logic duyệt không đổi)');

-- 3) Biên tập A KHÔNG ghi vào Band B (bắt buộc)
select t.as_user('ED1');
select t.fails(format($q$select public.chord_sheet_contribute_publish_band('Hai [C] bài chui', 'Chui vào B', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, %L)$q$, 'bbbbbbbb-0000-4000-8000-00000000000b'),
  'Biên tập Band A KHÔNG lưu được vào Band B', 'CHORDLIB_FORBIDDEN');
select t.reset();
select t.ok((select count(*) from public.chord_sheets where title = 'Chui vào B') = 0, 'bị từ chối thì KHÔNG tạo bài nào');

-- 4) Biên tập B: Band B được, Band A không
select t.as_user('ED2');
select t.put('b_new', public.chord_sheet_contribute_publish_band('Ba [Am] bài Band B', 'Bài Band B', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, :BB));
select t.fails(format($q$select public.chord_sheet_contribute_publish_band('Bốn [C] chui A', 'Chui vào A', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, %L)$q$, 'aaaaaaaa-0000-4000-8000-00000000000a'),
  'Biên tập Band B KHÔNG lưu được vào Band A', 'CHORDLIB_FORBIDDEN');
select t.reset();
select t.ok((select band_id = :BB::uuid from public.chord_sheets where id = t.id('b_new','sheet_id')), 'Biên tập B lưu vào Band B');

-- 5) học viên thường / Giáo viên (không phải Biên tập, không phải Trưởng Band) KHÔNG gán Band
select t.as_user('ST');
select t.fails(format($q$select public.chord_sheet_contribute_publish_band('Năm [C]', 'HV chui', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, %L)$q$, 'aaaaaaaa-0000-4000-8000-00000000000a'),
  'học viên thường KHÔNG gán Band', 'CHORDLIB_FORBIDDEN');
select t.as_user('TE');
select t.fails(format($q$select public.chord_sheet_contribute_publish_band('Bảy [C]', 'GV chui', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, %L)$q$, 'aaaaaaaa-0000-4000-8000-00000000000a'),
  'Giáo viên (không phải Biên tập) KHÔNG gán Band', 'CHORDLIB_FORBIDDEN');
select t.as_user('ST');
select t.put('st_nb', public.chord_sheet_contribute_publish_band('Tám [C] HV không Band', 'HV không Band', null, '{"beats":4,"beatType":4}'));
select t.reset();
select t.ok((select s.band_id is null and v.review_status = 'private' from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('st_nb')),
  'học viên không chọn Band: ra bản nháp như cũ, band_id NULL');
select t.as_user('ED1');
select t.fails($q$select public.chord_sheet_contribute_publish_band('Chín [C]', 'Band ma', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, gen_random_uuid())$q$, 'Band không tồn tại bị từ chối', 'CHORDLIB_INVALID');
select t.reset();

-- 6) Admin chọn Band bất kỳ
select t.as_user('AD');
select t.put('ad_b', public.chord_sheet_contribute_publish_band('Mười [G] Admin vào B', 'Admin vào Band B', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, :BB));
select t.reset();
select t.ok((select s.band_id = :BB::uuid and s.created_by = t.u('AD') from public.chord_sheets s where s.id = t.id('ad_b','sheet_id')), 'Admin lưu vào Band bất kỳ');

-- 7) Không đổi Band của bài đã có qua RPC; sửa bài không đổi Band
select t.as_user('ED1');
select t.fails(format($q$select public.chord_sheet_contribute_publish_band('Một [C] bài Band A mới', null, null, '{"beats":4,"beatType":4}', null, '[]', null, %L, null, null, %L)$q$,
  (select v ->> 'sheet_id' from t.kv where k = 'a_new'), 'aaaaaaaa-0000-4000-8000-00000000000a'), 'sửa bài đã có kèm Band bị từ chối', 'CHORDLIB_INVALID');
select t.put('a_v2', public.chord_sheet_contribute_publish_band('Một [C] bài Band A v2', null, null, '{"beats":4,"beatType":4}', null, '[]', null, (select (v ->> 'sheet_id')::uuid from t.kv where k = 'a_new'), t.id('a_new')));
select t.reset();
select t.ok((select s.band_id = :BA::uuid and v.version_number = 2 and s.canonical_version_id = v.id from public.chord_sheets s join public.chord_sheet_versions v on v.id = t.id('a_v2') where s.id = t.id('a_new','sheet_id')),
  'sửa bài (không Band): phiên bản 2, Band giữ nguyên');
-- bài cũ (không Band) của chính mình: sửa không tự gán Band
select t.as_user('ED1');
select t.put('old_v2', public.chord_sheet_contribute_publish_band('Bài cũ [C] API cũ sửa', null, null, '{"beats":4,"beatType":4}', null, '[]', null, t.id('old_api','sheet_id'), t.id('old_api')));
select t.reset();
select t.ok((select band_id is null from public.chord_sheets where id = t.id('old_api','sheet_id')), 'sửa bài cũ không tự gán Band');
-- gửi lại y hệt → duplicate, Band không đổi
select t.as_user('ED1');
select t.put('a_dup', public.chord_sheet_contribute_publish_band('Một [C] bài Band A', 'Bài Band A', 'TG', '{"beats":4,"beatType":4}', null, '[]', null, null, null, null, :BA));
select t.reset();
select t.ok((t.val('a_dup') ->> 'duplicate')::boolean and (select band_id = :BA::uuid from public.chord_sheets where id = t.id('a_new','sheet_id')), 'gửi lại y hệt: duplicate, Band giữ nguyên');

-- 8) Trigger: không đổi Band đã có (không phải Admin), kể cả khi chạm được bảng
do $$ begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u('ED1'), 'role', 'authenticated')::text, false);
end $$;
select t.fails(format($q$update public.chord_sheets set band_id = 'bbbbbbbb-0000-4000-8000-00000000000b' where id = %L$q$, (select v ->> 'sheet_id' from t.kv where k = 'a_new')),
  'trigger: Biên tập không đổi được Band đã gán', 'CHORDLIB_FORBIDDEN');
select t.reset();
select t.as_user('ED1');
select t.fails(format($q$update public.chord_sheets set band_id = null, created_by = %L where id = %L$q$, t.u('ED2'), (select v ->> 'sheet_id' from t.kv where k = 'a_new')),
  'client không UPDATE trực tiếp bảng chord_sheets', 'permission denied');
select t.reset();
do $$ begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u('AD'), 'role', 'authenticated')::text, false);
end $$;
update public.chord_sheets set band_id = 'bbbbbbbb-0000-4000-8000-00000000000b' where id = t.id('a_new','sheet_id');
select t.ok((select band_id = :BB::uuid from public.chord_sheets where id = t.id('a_new','sheet_id')), 'Admin đổi được Band (đường quản trị)');
update public.chord_sheets set band_id = :BA where id = t.id('a_new','sheet_id');
select t.reset();

-- 9) Band sở hữu KHÔNG phải quyền sửa/gỡ: Trưởng Band A và Biên tập khác không sửa bài của Biên tập A
select t.as_user('LD');
select t.fails(format($q$select public.chord_sheet_update_info(%L, 'HACK', null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'a_new')), 'Trưởng Band A KHÔNG sửa bài của Biên tập (chỉ bài do chính mình tạo)', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_archive(%L)$q$, (select v ->> 'sheet_id' from t.kv where k = 'a_new')), 'Trưởng Band A KHÔNG gỡ bài của Biên tập (chỉ bài do chính mình tạo)', 'CHORDLIB_FORBIDDEN');
select t.as_user('ED2');
select t.fails(format($q$select public.chord_sheet_archive(%L)$q$, (select v ->> 'sheet_id' from t.kv where k = 'a_new')), 'Biên tập B KHÔNG gỡ bài Band A', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_contribute_publish_band('Lời [C] chen', null, null, '{"beats":4,"beatType":4}', null, '[]', null, %L, null, null, %L)$q$,
  (select v ->> 'sheet_id' from t.kv where k = 'a_new'), 'bbbbbbbb-0000-4000-8000-00000000000b'), 'Biên tập B KHÔNG chen phiên bản vào bài Band A (kể cả kèm Band B)', null);
select t.as_user('ED1');
select t.ok((public.chord_sheet_update_info(t.id('a_new','sheet_id'), 'Bài Band A (sửa)', 'TG') ->> 'ok')::boolean, 'người tạo (Biên tập A) vẫn sửa được bài của mình');
select t.reset();

-- 10) Đọc: mọi người thấy bài mọi Band, kèm Band + Người biên tập; bài cũ band null
select t.as_user('ST');
select t.put('s_a', public.chord_sheet_search('band a'));
select t.put('s_old', public.chord_sheet_search('api cu'));
select t.put('s_get', public.chord_sheet_get(t.id('a_new')));
select t.put('s_get_old', public.chord_sheet_get(t.id('old_api')));
select t.reset();
select t.ok(jsonb_array_length(t.val('s_a')) >= 1 and t.val('s_a') -> 0 ->> 'band_name' = 'Band A' and t.val('s_a') -> 0 ->> 'editor_name' = 'Tên ED1', 'tìm: học viên thấy bài Band A, band_name + editor_name');
select t.ok(t.val('s_get') ->> 'band_name' = 'Band A' and (t.val('s_get') ->> 'band_id')::uuid = :BA::uuid and t.val('s_get') ->> 'editor_name' = 'Tên ED1', 'get: band_name/editor_name');
select t.ok(jsonb_array_length(t.val('s_old')) = 1 and t.val('s_old') -> 0 -> 'band_id' = 'null'::jsonb and t.val('s_old') -> 0 -> 'band_name' = 'null'::jsonb, 'bài cũ: band_id/band_name = null');
select t.ok(t.val('s_get_old') -> 'band_name' = 'null'::jsonb, 'get bài cũ: band_name null');
select t.as_user('ED2');
select t.ok(jsonb_array_length(public.chord_sheet_search('bai band a')) = 1, 'Biên tập Band B vẫn tìm thấy bài Band A');
select t.reset();

-- 11) Duyệt: học viên gửi nháp → Admin duyệt như cũ
select t.as_user('AD');
select t.put('ad_app', public.chord_sheet_approve(t.id('st_draft')));
select t.reset();
select t.ok((select review_status = 'approved' from public.chord_sheet_versions where id = t.id('st_draft')), 'cơ chế duyệt không đổi');

-- 12) Xoá Band → bài giữ nguyên, band_id NULL
delete from public.teamlab_bands where id = :BB;
select t.ok((select count(*) from public.chord_sheets where id in (t.id('b_new','sheet_id'), t.id('ad_b','sheet_id')) and band_id is null) = 2, 'xoá Band: bài còn nguyên, band_id → NULL');
select t.ok((select count(*) from public.chord_sheet_versions where sheet_id in (t.id('b_new','sheet_id'), t.id('ad_b','sheet_id'))) = 2, 'xoá Band: phiên bản còn nguyên');
