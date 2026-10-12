\set ON_ERROR_STOP on
-- Sau rollback V1.5: hành vi gốc trở lại, dữ liệu giữ nguyên.
select t.as_user('ED2');
select t.fails($q$select public.chord_sheet_contribute_publish('x [C]', 't', null, '{"beats":4,"beatType":4}')$q$, 'sau rollback: hàm đăng-công-khai không còn', 'does not exist');
select t.reset();
select t.as_user('ED1');
select t.fails(format($q$select public.chord_sheet_update_info(%L, 'x', null)$q$, (select v ->> 'sheet_id' from t.kv where k = 'e1_new')), 'sau rollback: update_info chỉ người review', 'CHORDLIB_FORBIDDEN');
select t.reset();
select t.ok((select review_status = 'approved' and reviewed_by = t.u('ED1') from public.chord_sheet_versions where id = t.id('e1_v2')), 'sau rollback: bài Biên tập đã đăng GIỮ NGUYÊN (approved)');
select t.ok(to_regprocedure('public.chord_sheet_archive(uuid)') is null, 'sau rollback: hàm gỡ bài đã gỡ khỏi hệ thống');
