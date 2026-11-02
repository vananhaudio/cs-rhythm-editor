-- ═══ G3 backfill added_at — chạy SAU lesson_clip_card_v1_test.sql trên cùng DB (cluster PG TẠM). KHÔNG production. ═══
\set ON_ERROR_STOP on
\o /dev/null
-- Buổi TH02#2 (lớp của C; dòng có sẵn trong fixture): đặt lại thành bài xuất bản TRƯỚC G3 — khối video KHÔNG có added_at, kèm khối khác + một khối video đã có added_at sai định dạng
update public.class_lesson_content set status = 'published', updated_at = now() - interval '2 hours', blocks =
  '[{"kind":"study","title":"Khối A","text":"giữ nguyên"},
    {"kind":"video","title":"Ôn nhanh trước G3","url":"https://youtu.be/ZZfakeBF01","duration":"2:07","note":"NOTE_SENTINEL_BF"},
    {"kind":"checkpoint","id":"2.1","title":"Bài trả"},
    {"kind":"video","title":"Sai định dạng giữ nguyên","url":"https://youtu.be/ZZfakeBF02","added_at":"hôm qua"},
    {"kind":"note","text":"cuối"}]'::jsonb
 where session_id = '52000000-0000-4000-8000-000000000002';
select t.ok((select count(*) from t.clips('C', 'for_you') where post ->> 'title' = 'Ôn nhanh trước G3') = 0, 'trước backfill: khối chưa có added_at KHÔNG hiện thẻ');
create temp table bf_before as select blocks, status, updated_at, updated_by from public.class_lesson_content where session_id = '52000000-0000-4000-8000-000000000002';
create temp table bf_others as select session_id, md5(blocks::text) m, status, updated_at from public.class_lesson_content where session_id not in ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002');
\o
begin;
\i db/lesson_clip_card_v1_backfill_added_at.sql
commit;
\o /dev/null
select t.ok((select count(*) from public.class_lesson_content where session_id = '52000000-0000-4000-8000-000000000002'
               and (blocks -> 1 ->> 'added_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') = 1, 'khối video chưa có added_at → được gắn added_at ISO UTC (Z)');
select t.ok(abs(extract(epoch from (public.social_clip_added_at((select blocks -> 1 ->> 'added_at' from public.class_lesson_content where session_id = '52000000-0000-4000-8000-000000000002')) - (select updated_at from bf_before)))) < 0.001,
  'added_at = updated_at của dòng (sai số < 1 mili-giây)');
select t.ok((select (b.blocks -> 0) = (a.blocks -> 0) and (b.blocks -> 2) = (a.blocks -> 2) and (b.blocks -> 3) = (a.blocks -> 3) and (b.blocks -> 4) = (a.blocks -> 4)
               and (b.blocks -> 1) - 'added_at' = (a.blocks -> 1) and jsonb_array_length(b.blocks) = jsonb_array_length(a.blocks)
               from public.class_lesson_content b, bf_before a where b.session_id = '52000000-0000-4000-8000-000000000002'), 'mọi khối khác NGUYÊN VĂN; khối video chỉ thêm đúng trường added_at');
select t.ok((select b.status = a.status and b.updated_at = a.updated_at and b.updated_by is not distinct from a.updated_by
               from public.class_lesson_content b, bf_before a where b.session_id = '52000000-0000-4000-8000-000000000002'), 'status / updated_at / updated_by KHÔNG đổi');
select t.ok((select (blocks -> 3 ->> 'added_at') = 'hôm qua' from public.class_lesson_content where session_id = '52000000-0000-4000-8000-000000000002'), 'added_at sai định dạng sẵn có được GIỮ NGUYÊN (không đoán), thẻ đó vẫn ẩn');
select t.ok((select count(*) from public.class_lesson_content o join bf_others x on x.session_id = o.session_id where md5(o.blocks::text) = x.m and o.status = x.status and o.updated_at = x.updated_at) = (select count(*) from bf_others),
  'mọi buổi KHÁC (đã có added_at / không có video thiếu added_at) nguyên vẹn');
select t.ok((select (e ->> 'added_at') is not null from public.class_lesson_content lc, jsonb_array_elements(lc.blocks) e where lc.session_id = '51000000-0000-4000-8000-000000000002' and e ->> 'title' = 'S2 thiếu added_at'),
  'buổi khác có khối video thiếu khoá added_at cũng được gắn (đúng phạm vi: mọi khối video thiếu khoá)');
select t.ok((select (e ->> 'added_at') = 'hôm qua' from public.class_lesson_content lc, jsonb_array_elements(lc.blocks) e where lc.session_id = '51000000-0000-4000-8000-000000000002' and e ->> 'title' = 'S2 sai định dạng'),
  'khối có added_at sai định dạng ở buổi khác cũng được GIỮ NGUYÊN');
select t.ok((select count(*) from t.clips('C', 'for_you') where post ->> 'title' = 'Ôn nhanh trước G3') = 1 and (select count(*) from t.clips('C', 'my_classes') where post ->> 'title' = 'Ôn nhanh trước G3') = 1,
  'sau backfill: thẻ hiện cho C (đúng lớp) ở for_you và my_classes — KHÔNG cần xuất bản lại');
select t.ok((select count(*) from t.clips('A', 'for_you') where post ->> 'title' = 'Ôn nhanh trước G3') = 0, 'A (lớp khác) vẫn KHÔNG thấy thẻ vừa backfill');
select t.ok((select count(*) from t.clips('C', 'for_you') where post::text ~* '(youtu|http|ZZfakeBF|NOTE_SENTINEL_BF)') = 0, 'payload thẻ backfill sạch URL / video id / ghi chú');
create temp table bf_mid as select md5(blocks::text) m from public.class_lesson_content where session_id = '52000000-0000-4000-8000-000000000002';
\o
begin;
\i db/lesson_clip_card_v1_backfill_added_at.sql
commit;
\o /dev/null
select t.ok((select md5(blocks::text) from public.class_lesson_content where session_id = '52000000-0000-4000-8000-000000000002') = (select m from bf_mid), 'chạy lại backfill: idempotent (0 thay đổi)');
-- sửa giáo trình sau backfill không làm thẻ nổi lại
create temp table bf_pos as select sort_at from t.clips('C', 'for_you') where post ->> 'title' = 'Ôn nhanh trước G3';
update public.class_lesson_content set updated_at = now(), blocks = blocks || '[{"kind":"note","text":"sửa sau"}]'::jsonb where session_id = '52000000-0000-4000-8000-000000000002';
select t.ok((select sort_at from t.clips('C', 'for_you') where post ->> 'title' = 'Ôn nhanh trước G3') = (select sort_at from bf_pos), 'sửa giáo trình sau backfill → vị trí thẻ KHÔNG đổi');
\o
