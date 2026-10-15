-- Sau V1.5.
\set ON_ERROR_STOP on
select t.ok((select fp from t.fp0) = (select md5(string_agg(v::text, '|' order by v.id)) from public.chord_sheet_versions v),
  'phiên bản hiện có KHÔNG đổi sau migrate');
select t.ok((select fp from t.fps0) = (select md5(string_agg(s.id::text || s.title || coalesce(s.composer,'') || coalesce(s.canonical_version_id::text,'') || s.created_by::text || s.updated_at::text, '|' order by s.id)) from public.chord_sheets s),
  'bài hiện có KHÔNG đổi sau migrate (kể cả updated_at)');
select t.ok((select count(*) from public.chord_sheets where archived_at is not null) = 0, 'không bài nào bị gỡ sau migrate');

-- caps: Biên tập KHÔNG có review
select t.as_user('ED1');
select t.ok(public.chordlib_can('review') = false and public.chordlib_can('search') and public.chordlib_can('contribute'), 'Biên tập: search ✓ contribute ✓ review ✗ (không cấp đại trà review)');
-- 1) Biên tập đăng bài mới → công khai ngay
select t.put('e1_new', public.chord_sheet_contribute_publish('Con đường [C] xưa em [Am] đi', 'Bài của Biên tập 1', 'Nhạc sĩ B', '{"beats":4,"beatType":4}'));
select t.reset();
select t.ok((select v ->> 'published' from t.kv where k = 'e1_new') = 'true' and (select v ->> 'review_status' from t.kv where k = 'e1_new') = 'approved', 'Biên tập đăng bài: trả published=true, approved');
select t.ok((select v.review_status = 'approved' and v.reviewed_by = t.u('ED1') and v.contributed_by = t.u('ED1') and s.canonical_version_id = v.id and s.created_by = t.u('ED1')
               from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('e1_new')),
  'DB: phiên bản approved, là bản chuẩn của bài, created_by/contributed_by = Biên tập');
-- 2) mọi người tìm thấy + ghi công
select t.as_user('ST');
select t.put('st_search', public.chord_sheet_search('bien tap 1'));
select t.put('st_get', public.chord_sheet_get(t.id('e1_new')));
select t.reset();
select t.ok(jsonb_array_length(t.val('st_search')) = 1 and t.val('st_search') -> 0 ->> 'editor_name' = 'Tên ED1' and (t.val('st_search') -> 0 ->> 'is_canonical')::boolean,
  'học viên thường tìm thấy bài ngay, hiện Người biên tập = "Tên ED1"');
select t.ok(not (t.val('st_search') -> 0 ? 'contributed_by') and not (t.val('st_get') ? 'contributed_by'), 'không lộ uid người đóng góp cho học viên thường');
select t.ok(t.val('st_get') ->> 'editor_name' = 'Tên ED1' and (t.val('st_get') ->> 'sheet_mine')::boolean = false, 'get: editor_name đúng, sheet_mine=false với người khác');
select t.as_user('LD');
select t.put('ld_search', public.chord_sheet_search('bien tap 1'));
select t.put('ld_get', public.chord_sheet_get(t.id('e1_new')));
select t.reset();
select t.ok(jsonb_array_length(t.val('ld_search')) = 1 and t.val('ld_get') ->> 'text' like '%Con đường%', 'Trưởng Band (= quyền Biên tập) tìm và xem được bài');
select t.as_user('ED2');
select t.ok(jsonb_array_length(public.chord_sheet_search('bien tap 1')) = 1, 'Biên tập khác cũng thấy bài');
select t.reset();
-- tên không lộ email: đặt app_users.name là email
update public.app_users set name = 'abc@example.com' where id = t.u('ED2');
select t.ok((select name from public.class_public_identity(t.u('ED2'))) = 'abc', 'tên dạng email bị cắt phần sau @ (class_public_identity)');
update public.app_users set name = 'Tên ED2' where id = t.u('ED2');

-- 3) sửa bài của mình: phiên bản mới công khai; bản cũ bất biến
select t.as_user('ED1');
select t.put('e1_v2', public.chord_sheet_contribute_publish('Con đường [C] xưa em [Am] đi [F]', null, null, '{"beats":4,"beatType":4}', null, '[]', null, (select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new'), t.id('e1_new')));
select t.reset();
select t.ok((select s.canonical_version_id = t.id('e1_v2') and v.review_status = 'approved' and v.version_number = 2 and v.parent_version_id = t.id('e1_new')
               from public.chord_sheets s join public.chord_sheet_versions v on v.id = t.id('e1_v2') where s.id = (select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new')),
  'sửa nội dung bài của mình = phiên bản 2 công khai, thành bản chuẩn');
select t.ok((select text = 'Con đường [C] xưa em [Am] đi' and review_status = 'approved' from public.chord_sheet_versions where id = t.id('e1_new')),
  'phiên bản 1 giữ nguyên (bất biến, vẫn approved)');
-- sửa thông tin
select t.as_user('ED1');
select t.put('e1_info', public.chord_sheet_update_info((select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new'), 'Bài đổi tên', 'Tác giả mới'));
select t.reset();
select t.ok((select title = 'Bài đổi tên' and composer = 'Tác giả mới' and title_key = public.chord_fold_vi('Bài đổi tên') and created_by = t.u('ED1')
               from public.chord_sheets where id = (select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new')), 'Biên tập sửa tên/tác giả bài của mình; created_by giữ nguyên');
select t.as_user('ST');
select t.ok(public.chord_sheet_get(t.id('e1_v2')) ->> 'editor_name' = 'Tên ED1' and public.chord_sheet_get(t.id('e1_v2')) ->> 'title' = 'Bài đổi tên', 'sau khi sửa vẫn ghi công người biên tập gốc, tên mới hiện ngay');
select t.reset();

-- 4) không sửa/gỡ bài của người khác
select t.as_user('ED2');
select t.fails(format($q$select public.chord_sheet_update_info(%L, 'HACK', null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')), 'Biên tập khác KHÔNG sửa thông tin bài của Biên tập 1', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_archive(%L)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')), 'Biên tập khác KHÔNG gỡ bài của Biên tập 1', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_contribute_publish('Lời [C] khác', null, null, '{"beats":4,"beatType":4}', null, '[]', null, %L, null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')),
  'Biên tập khác KHÔNG ghi phiên bản công khai lên bài của Biên tập 1', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_update_info(%L, 'HACK', null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'admin_sheet')), 'Biên tập KHÔNG sửa bài của Admin', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_archive(%L)$q$, (select v ->> 'sheet_id' from t.kv where k = 'admin_sheet')), 'Biên tập KHÔNG gỡ bài của Admin', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_contribute_publish('Lời [C] khác', null, null, '{"beats":4,"beatType":4}', null, '[]', null, %L, null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'admin_sheet')),
  'Biên tập KHÔNG công khai phiên bản lên bài của Admin', 'CHORDLIB_FORBIDDEN');
select t.fails($q$select public.chord_sheet_approve(gen_random_uuid())$q$, 'Biên tập KHÔNG có quyền duyệt', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_reject(%L, 'x')$q$, t.id('st_draft')), 'Biên tập KHÔNG từ chối bản của người khác', 'CHORDLIB_FORBIDDEN');
select t.reset();
select t.ok((select title = 'Bài của Admin' from public.chord_sheets where id = (select (v ->> 'sheet_id')::uuid from t.kv where k = 'admin_sheet')) and
            (select archived_at is null from public.chord_sheets where id = (select (v ->> 'sheet_id')::uuid from t.kv where k = 'admin_sheet')), 'bài của Admin không bị thay đổi');

-- 5) học viên thường / Trưởng Band: KHÔNG tự công khai
select t.as_user('ST');
select t.put('st_try', public.chord_sheet_contribute_publish('Lời [C] của học viên', 'Học viên thử', null, '{"beats":4,"beatType":4}'));
select t.reset();
select t.ok((select v.review_status = 'private' and s.canonical_version_id is null from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('st_try')),
  'học viên thường qua đường mới: chỉ ra BẢN NHÁP, không công khai');
select t.as_user('LD');
select t.put('ld_try', public.chord_sheet_contribute_publish('Lời [C] của Trưởng Band', 'Trưởng Band thử', null, '{"beats":4,"beatType":4}'));
select t.put('ld_search2', public.chord_sheet_search('truong band'));
select t.fails(format($q$select public.chord_sheet_archive(%L)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')), 'Trưởng Band KHÔNG gỡ bài của Biên tập khác', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_update_info(%L, 'HACK', null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')), 'Trưởng Band KHÔNG sửa bài của Biên tập khác', 'CHORDLIB_FORBIDDEN');
select t.ok((public.chord_sheet_update_info((select (v ->> 'sheet_id')::uuid from t.kv where k = 'ld_try'), 'Trưởng Band thử (sửa)', null) ->> 'ok')::boolean, 'Trưởng Band sửa được bài của MÌNH');
select t.reset();
select t.ok((select v.review_status = 'approved' and s.canonical_version_id = v.id and s.created_by = t.u('LD') from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('ld_try')),
  'Trưởng Band = quyền Biên tập: đăng công khai NGAY, ghi công created_by = mình');
select t.ok(jsonb_array_length(t.val('ld_search2')) = 1 and (t.val('ld_search2') -> 0 ->> 'review_status') = 'approved', 'Trưởng Band thấy bài công khai của mình');
select t.as_user('ED2');
select t.ok(jsonb_array_length(public.chord_sheet_search('hoc vien thu')) = 0 and jsonb_array_length(public.chord_sheet_search('truong band')) = 1, 'nháp của học viên không lộ cho Biên tập; bài công khai của Trưởng Band thì thấy');
select t.reset();
select t.as_user('LD');
select t.ok(jsonb_array_length(public.chord_sheet_search('doi ten')) = 1, 'bài công khai vẫn tìm được');
select t.reset();

-- 6) gỡ bài của mình
select t.as_user('ED1');
select t.put('e1_arch', public.chord_sheet_archive((select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new')));
select t.reset();
select t.as_user('ST');
select t.ok(jsonb_array_length(public.chord_sheet_search('doi ten')) = 0, 'bài đã gỡ KHÔNG còn trong tìm kiếm của học viên');
select t.reset();
select t.as_user('ED1');
select t.ok(jsonb_array_length(public.chord_sheet_search('doi ten')) = 0, 'bài đã gỡ không còn trong danh sách của chính Biên tập');
select t.reset();
select t.as_user('AD');
select t.ok(jsonb_array_length(public.chord_sheet_search('doi ten')) = 1 and (public.chord_sheet_get(t.id('e1_v2')) ->> 'archived')::boolean, 'Admin vẫn thấy bài đã gỡ (cờ archived)');
select t.reset();
select t.ok((select count(*) from public.chord_sheet_versions where sheet_id = (select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new')) = 2, 'gỡ không xoá phiên bản nào');
-- đăng lại y hệt → hiện lại
select t.as_user('ED1');
select t.put('e1_repost', public.chord_sheet_contribute_publish('Con đường [C] xưa em [Am] đi [F]', 'Bài đổi tên', 'Tác giả mới', '{"beats":4,"beatType":4}'));
select t.reset();
select t.as_user('ST');
select t.ok(jsonb_array_length(public.chord_sheet_search('doi ten')) = 1, 'đăng lại bài đã gỡ → hiện lại, không tạo bản trùng');
select t.reset();

-- 7) Admin/Teacher giữ nguyên
select t.as_user('AD');
select t.put('ad_new', public.chord_sheet_contribute('Lời [G] admin', 'Admin đăng', null, '{"beats":4,"beatType":4}'));
select t.ok((public.chord_sheet_get(t.id('ad_new')) ->> 'review_status') = 'private', 'Admin: contribute vẫn ra bản nháp (cơ chế cũ), không bị công khai ngầm');
select public.chord_sheet_approve(t.id('ad_new'));
select public.chord_sheet_update_info((select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new'), 'Admin đổi', null);
select public.chord_sheet_archive((select (v ->> 'sheet_id')::uuid from t.kv where k = 'admin_sheet'));
select t.reset();
select t.ok((select title = 'Admin đổi' from public.chord_sheets where id = (select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new')), 'Admin sửa/duyệt/gỡ bất kỳ bài nào như trước');
select t.as_user('AD');
select public.chord_sheet_update_info((select (v ->> 'sheet_id')::uuid from t.kv where k = 'admin_sheet'), 'Bài của Admin', 'Nhạc sĩ A');
select t.reset();
update public.chord_sheets set archived_at = null, archived_by = null where id = (select (v ->> 'sheet_id')::uuid from t.kv where k = 'admin_sheet');
select t.as_user('TE');
select t.ok(jsonb_array_length(public.chord_sheet_search('')) >= 2, 'Teacher tìm kiếm bình thường');
select public.chord_sheet_update_info((select (v ->> 'sheet_id')::uuid from t.kv where k = 'e1_new'), 'Teacher sửa', null);
select t.reset();

-- 8) mất vai Biên tập → mất quyền ngay; ghi công + bài công khai giữ nguyên
delete from public.teamlab_band_roles where user_id = t.u('ED1');
select t.as_user('ED1');
select t.fails(format($q$select public.chord_sheet_update_info(%L, 'HACK', null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')), 'mất vai Biên tập: không sửa thông tin nữa', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_archive(%L)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')), 'mất vai Biên tập: không gỡ nữa', 'CHORDLIB_FORBIDDEN');
select t.put('e1_after', public.chord_sheet_contribute_publish('Lời [C] sau khi mất vai', 'Sau mất vai', null, '{"beats":4,"beatType":4}'));
select t.reset();
select t.ok((select review_status = 'private' from public.chord_sheet_versions where id = t.id('e1_after')), 'mất vai Biên tập: bài mới chỉ ra bản nháp');
select t.as_user('ST');
select t.ok(public.chord_sheet_get(t.id('e1_v2')) ->> 'editor_name' = 'Tên ED1', 'bài đã đăng vẫn công khai và còn ghi công người biên tập');
select t.reset();
