\set ON_ERROR_STOP on
select t.as_user('ED1');
select t.fails($q$select public.chord_sheet_contribute_publish_band('x [C]', 't', null, '{"beats":4,"beatType":4}')$q$, 'sau rollback: hàm Band không còn', 'does not exist');
select t.ok(public.chord_sheet_search('band a') -> 0 ? 'band_name' = false, 'sau rollback: search không trả band_name (về V1.5)');
select t.reset();
select t.ok((select count(*) from public.chord_sheets where band_id is not null) >= 1, 'sau rollback: cột band_id và dữ liệu sở hữu được giữ');
select t.ok((select s.canonical_version_id is not null from public.chord_sheets s where id = t.id('a_new','sheet_id')), 'sau rollback: bài Band A vẫn công khai');
