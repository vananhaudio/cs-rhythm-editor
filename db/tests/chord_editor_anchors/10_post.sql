-- Sau V1.6: Biên tập lưu vạch nhịp bài của mình. Nền: 00_pre.sql của chord_editor_publish (đã chạy V1.5).
\set ON_ERROR_STOP on
-- anchors hợp lệ cho lời 'Con đường [C] xưa em [Am] đi' (dòng 0 có 5 chữ: Con đường xưa em đi): 2 ô.
create table t.fpa as select md5(string_agg(v::text, '|' order by v.id)) fp, count(*) n from public.chord_sheet_versions v;
select t.ok((select fp from t.fp0) = (select fp from t.fpa), 'phiên bản hiện có KHÔNG đổi sau migrate V1.6');

-- 1) Biên tập tạo bài mới có lời + hợp âm + vạch nhịp → MỘT lần lưu
select t.as_user('ED1');
select t.put('a_new', public.chord_sheet_contribute_publish('Con đường [C] xưa em [Am] đi', 'Bài vạch nhịp', 'NS', '{"beats":4,"beatType":4}',
  null, '[]', null, null, null, '{"measures":[{"line":0,"token":0},{"line":0,"token":3}]}'));
select t.reset();
select t.ok((select v.review_status = 'approved' and v.anchors_status = 'ready' and v.anchors is not null and v.contributed_by = t.u('ED1')
                    and s.canonical_version_id = v.id and s.created_by = t.u('ED1') and v.version_number = 1
               from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('a_new')),
  'Biên tập tạo bài mới + vạch nhịp: MỘT phiên bản approved, anchors ready, là bản chuẩn');
select t.ok((select count(*) from public.chord_sheet_versions where sheet_id = (t.val('a_new') ->> 'sheet_id')::uuid) = 1, 'chỉ 1 phiên bản (không có bản trung gian)');
-- 2) học viên thường thấy bài + vạch nhịp
select t.as_user('ST');
select t.put('a_get', public.chord_sheet_get(t.id('a_new')));
select t.reset();
select t.ok(t.val('a_get') ->> 'text' like '%Con đường%' and t.val('a_get') -> 'anchors' is not null and t.val('a_get') ->> 'editor_name' = 'Tên ED1',
  'học viên thường xem được bài + vạch nhịp + tên Người biên tập');

-- 3) Biên tập sửa vạch nhịp bài của mình (accept_anchors_publish) → bản mới công khai
select t.as_user('ED1');
select t.put('a_fix', public.chord_sheet_accept_anchors_publish(t.id('a_new'), '{"measures":[{"line":0,"token":0},{"line":0,"token":2}]}', '{"mode":"manual"}'));
select t.reset();
select t.ok((select v.review_status = 'approved' and v.version_number = 2 and s.canonical_version_id = v.id and v.anchors_status = 'ready'
               from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('a_fix')) and (t.val('a_fix') ->> 'published') = 'true',
  'Biên tập sửa vạch nhịp bài mình: phiên bản 2 công khai, thành bản chuẩn');
select t.ok((select review_status = 'approved' and anchors = '{"measures":[{"line":0,"token":0},{"line":0,"token":3}]}'::jsonb from public.chord_sheet_versions where id = t.id('a_new')),
  'phiên bản 1 giữ nguyên (bất biến)');
-- sửa bằng đường contribute_publish (lưu lại cả bài + vạch khác) cũng được
select t.as_user('ED1');
select t.put('a_fix2', public.chord_sheet_contribute_publish('Con đường [C] xưa em [Am] đi', null, null, '{"beats":4,"beatType":4}',
  null, '[]', null, (t.val('a_new') ->> 'sheet_id')::uuid, t.id('a_fix'), '{"measures":[{"line":0,"token":0},{"line":0,"token":1}]}'));
select t.reset();
select t.ok((select s.canonical_version_id = t.id('a_fix2') and v.review_status = 'approved' from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('a_fix2')),
  'contribute_publish kèm vạch lên bài của mình: công khai');

-- 4) KHÔNG sửa vạch nhịp bài của người khác / bài Admin
select t.as_user('ED2');
select t.fails(format($q$select public.chord_sheet_contribute_publish('Con đường [C] xưa em [Am] đi', null, null, '{"beats":4,"beatType":4}', null, '[]', null, %L, null, '{"measures":[{"line":0,"token":0}]}')$q$,
  t.val('a_new') ->> 'sheet_id'), 'Biên tập khác KHÔNG lưu vạch lên bài của Biên tập 1', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_accept_anchors_publish(%L, '{"measures":[{"line":0,"token":0}]}')$q$, t.id('a_new')), 'Biên tập khác KHÔNG accept_anchors bài của Biên tập 1', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_accept_anchors(%L, '{"measures":[{"line":0,"token":0}]}')$q$, t.id('a_new')), 'Biên tập khác KHÔNG gọi thẳng accept_anchors bài người khác', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_contribute_publish('Chiều [Am] nao tiễn nhau [E7] đi', null, null, '{"beats":4,"beatType":4}', null, '[]', null, %L, null, '{"measures":[{"line":0,"token":0}]}')$q$,
  t.val('admin_sheet') ->> 'sheet_id'), 'Biên tập KHÔNG lưu vạch lên bài của Admin', 'CHORDLIB_FORBIDDEN');
select t.fails(format($q$select public.chord_sheet_accept_anchors_publish(%L, '{"measures":[{"line":0,"token":0}]}')$q$, t.id('admin_sheet')), 'Biên tập KHÔNG accept_anchors bài của Admin', 'CHORDLIB_FORBIDDEN');
select t.reset();

-- 5) học viên thường / Teacher: không tự lưu vạch (Trưởng Band = quyền Biên tập, kiểm ở mục 5b) (cả lần lưu bị từ chối, không để lại bài)
create table t.cnt0 as select (select count(*) from public.chord_sheets) s, (select count(*) from public.chord_sheet_versions) v;
select t.as_user('ST');
select t.fails($q$select public.chord_sheet_contribute_publish('Lời [C] của học viên', 'Học viên vạch', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, '{"measures":[{"line":0,"token":0}]}')$q$,
  'học viên thường KHÔNG lưu được vạch nhịp', 'vạch nhịp');
select t.reset();

select t.ok((select s from t.cnt0) = (select count(*) from public.chord_sheets) and (select v from t.cnt0) = (select count(*) from public.chord_sheet_versions),
  'lưu bị từ chối KHÔNG để lại bài/phiên bản nào');
-- 5b) Trưởng Band = quyền Biên tập: lưu được vạch nhịp cho bài MỚI của mình (cùng đường với Biên tập)
select t.as_user('LD');
select t.put('ld_anchor', public.chord_sheet_contribute_publish('Lời [C] của trưởng', 'Trưởng vạch', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, '{"measures":[{"line":0,"token":0}]}'));
select t.reset();
select t.ok((select s.created_by = t.u('LD') and s.canonical_version_id = v.id from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = t.id('ld_anchor')),
  'Trưởng Band (= Biên tập) lưu được vạch nhịp, đăng công khai, ghi công mình');
drop table t.cnt0;
create table t.cnt0 as select (select count(*) from public.chord_sheets) s, (select count(*) from public.chord_sheet_versions) v;   -- mốc mới sau bài hợp lệ của Trưởng Band

-- 6) lưu vạch SAI của Biên tập → từ chối cả lần, không để lại bài dở dang
select t.as_user('ED1');
select t.fails($q$select public.chord_sheet_contribute_publish('Lời [C] một dòng', 'Vạch sai', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, '{"measures":[{"line":9,"token":0}]}')$q$,
  'vạch nhịp sai → từ chối', 'vạch nhịp không hợp lệ');
select t.reset();
select t.ok((select s from t.cnt0) = (select count(*) from public.chord_sheets) and (select v from t.cnt0) = (select count(*) from public.chord_sheet_versions),
  'vạch sai KHÔNG để lại bài/phiên bản công khai dở dang');
select t.ok(not exists (select 1 from public.chord_sheets where title = 'Vạch sai'), 'không có bài "Vạch sai"');

-- 7) Admin / Teacher có review: hành vi cũ — bản nháp, vẫn duyệt được
select t.as_user('AD');
select t.put('ad_anch', public.chord_sheet_contribute_publish('Em [C] về [G] đây', 'Bài Admin vạch', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, '{"measures":[{"line":0,"token":0}]}'));
select t.reset();
select t.ok((select v.review_status = 'private' and v.anchors_status = 'ready' from public.chord_sheet_versions v where v.id = t.id('ad_anch')),
  'Admin: lưu kèm vạch = bản nháp (như cũ), chưa tự công khai');
select t.as_user('AD');
select public.chord_sheet_approve(t.id('ad_anch'));
select t.put('ad_acc', public.chord_sheet_accept_anchors_publish(t.id('ad_anch'), '{"measures":[{"line":0,"token":0},{"line":0,"token":1}]}', '{"mode":"manual"}'));
select t.reset();
select t.ok((select v.review_status = 'private' and v.version_number = 2 from public.chord_sheet_versions v where v.id = t.id('ad_acc')) and (t.val('ad_acc') ->> 'published') is null,
  'Admin: accept_anchors_publish = bản nháp như cũ (không tự công khai)');
select t.as_user('AD');
select t.ok(public.chord_sheet_accept_anchors(t.id('ad_anch'), '{"measures":[{"line":0,"token":0}]}') ->> 'duplicate' = 'true', 'Admin: accept_anchors gốc vẫn chạy (dup)');
select t.reset();

-- 8) học viên thường vẫn không accept_anchors; anon không gọi được hàm mới
select t.as_user('ST');
select t.fails(format($q$select public.chord_sheet_accept_anchors_publish(%L, '{"measures":[{"line":0,"token":0}]}')$q$, t.id('ad_anch')), 'học viên thường KHÔNG accept_anchors', 'CHORDLIB_FORBIDDEN');
select t.reset();
select t.ok(not has_function_privilege('anon', 'public.chord_sheet_accept_anchors_publish(uuid,jsonb,jsonb)', 'execute')
        and has_function_privilege('authenticated', 'public.chord_sheet_accept_anchors_publish(uuid,jsonb,jsonb)', 'execute')
        and not has_function_privilege('authenticated', 'public.chordlib_can_anchors(uuid)', 'execute'), 'quyền hàm: anon ✗, authenticated gọi wrapper ✓, helper không gọi trực tiếp');
