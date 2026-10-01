-- ═══ TEST NHỊP & PHÁCH ARTIFACT SHARE V1 — cluster PostgreSQL TẠM. KHÔNG chạy production. ═══
-- Nạp SAU fixture + P1 + P2 + classes + feed + tool_share_v1 + bms_artifact_v1 + nhipphach_artifact_v1 (+ rls_setup).
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
delete from public.edu_students where user_id = 'eeeeeeee-0000-4000-8000-00000000000e';

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
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
-- MusicXML mẫu (có DOCTYPE như file thật, lời tiếng Việt, 3/4)
create function t.xml() returns text language sql immutable as $x$ select
'<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>Đàn Gà Con</work-title></work>
<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><type>half</type><dot/><lyric><text>Gà</text></lyric></note></measure></part>
</score-partwise>' $x$;
create function t.score(p_xml text default null, p_settings jsonb default null) returns jsonb language sql immutable as $$
  select jsonb_build_object('kind', 'score', 'score', jsonb_build_object('title', 'Đàn Gà Con', 'composer', 'Phan Huỳnh Điểu',
    'musicxml', coalesce(p_xml, t.xml()),
    'settings', coalesce(p_settings, '{"showBeats":true,"countingLevel":"eighths","compoundCountingMode":"pulses","orientation":"portrait","color":"#DC2626","sizePt":7,"distance":2,"grouping":{"byMeter":{"7/8":[2,2,3]}},"evil":"<script>"}'::jsonb),
    'svg', '<svg/>')) $$;
grant execute on all functions in schema t to anon, authenticated;
create table t.ids (k text primary key, id uuid);
grant all on t.ids to authenticated;

do $$
declare p1 uuid; p2 uuid; art uuid; n int; ts jsonb; r record;
begin
  perform t.ok(not exists (select 1 from public.tool_artifacts where tool = 'nhipphach'), 'ban đầu không có bản Nhịp & Phách nào trên server (chưa bấm Chia sẻ)');
  perform t.as_user('A');
  p1 := public.social_share_tool_result('nhipphach', t.score(), '33333333-0000-4000-8000-000000000001');
  p2 := public.social_share_tool_result('nhipphach', t.score(), '33333333-0000-4000-8000-000000000001');
  perform t.ok(p1 = p2, 'bấm Chia sẻ 2 lần → cùng MỘT bài');
  perform t.reset();
  select count(*) into n from public.tool_artifacts where tool = 'nhipphach'; perform t.ok(n = 1, 'đúng 1 artifact Nhịp & Phách');
  select count(*) into n from public.class_posts where type = 'tool_share' and tool_share ->> 'tool' = 'nhipphach'; perform t.ok(n = 1, 'đúng 1 Tool Share Nhịp & Phách');
  select tool_share into ts from public.class_posts where id = p1;
  art := (ts ->> 'artifact_id')::uuid;
  insert into t.ids values ('p1', p1), ('a1', art);
  perform t.ok(ts - 'artifact_id' - 'client_key' = '{"v":1,"tool":"nhipphach","kind":"score","title":"Đàn Gà Con","meter":"3/4","counting_level":"eighths"}'::jsonb,
    'Feed chỉ giữ tham chiếu + tóm tắt (nhịp đọc từ XML ở server): ' || ts::text);
  perform t.ok(position('score-partwise' in ts::text) = 0 and position('<' in ts::text) = 0, 'tool_share KHÔNG chứa MusicXML');
  select * into r from public.tool_artifacts where id = art;
  perform t.ok(r.owner_id = t.u('A') and r.kind = 'score' and r.schema_version = 1 and r.visibility = 'class', 'artifact: owner A · score v1 · Class');
  perform t.ok(r.content = t.xml() and r.content_sha256 = encode(sha256(convert_to(t.xml(), 'UTF8')), 'hex'), 'MusicXML lưu NGUYÊN BYTE + sha256 do server tính');
  perform t.ok(r.data = '{"schema":"nhipphach.score","v":1,"title":"Đàn Gà Con","composer":"Phan Huỳnh Điểu","meter":"3/4","settings":{"showBeats":true,"countingLevel":"eighths","compoundCountingMode":"pulses","orientation":"portrait","color":"#dc2626","sizePt":7,"distance":2,"grouping":{"byMeter":{"7/8":[2,2,3]}}}}'::jsonb,
    'thiết lập chuẩn hoá (bỏ "evil", "svg"): ' || r.data::text);

  -- Dữ liệu sai → từ chối, không tạo gì
  perform t.as_user('A');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score('<score-partwise><part'), gen_random_uuid()) $q$, 'XML hỏng', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score('<?xml version="1.0"?><html><body>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</body></html>'), gen_random_uuid()) $q$, 'không phải score-partwise', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaaaaaaaa">]><score-partwise>&a;&a;&a;&a;&a;&a;&a;</score-partwise>'), gen_random_uuid()) $q$, 'có <!ENTITY> (bom XML)', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score(t.xml() || repeat(' ', 1048577)), gen_random_uuid()) $q$, 'MusicXML > 1 MB', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score(null, '{"showBeats":false,"color":"#dc2626","sizePt":7,"distance":2}'), gen_random_uuid()) $q$, 'không hiện số phách → không phải bản đã đánh số', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score(null, '{"showBeats":true,"countingLevel":"x","color":"#dc2626","sizePt":7,"distance":2}'), gen_random_uuid()) $q$, 'mức đếm lạ', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score(null, '{"showBeats":true,"color":"red;x","sizePt":7,"distance":2}'), gen_random_uuid()) $q$, 'màu lạ', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score(null, '{"showBeats":true,"color":"#dc2626","sizePt":7,"distance":2,"grouping":{"byMeter":{"7/8":[2,"x"]}}}'), gen_random_uuid()) $q$, 'cách chia lạ', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', jsonb_set(t.score(), '{score,title}', '""'), gen_random_uuid()) $q$, 'tên bài rỗng', 'TS_BAD_RESULT');
  perform t.fails($q$ insert into public.tool_artifacts (owner_id, tool, kind, schema_version, title, data, client_key, content, content_sha256) values (auth.uid(), 'nhipphach', 'score', 1, 'x', '{}', gen_random_uuid(), 'x', repeat('a', 64)) $q$, 'không chèn thẳng artifact', 'permission denied');
  perform t.fails($q$ update public.tool_artifacts set content = 'x' $q$, 'chủ bài cũng không sửa thẳng MusicXML đã chia sẻ', 'permission denied');
  perform t.reset();
  perform t.ok((select count(*) from public.tool_artifacts where tool = 'nhipphach') = 1, 'dữ liệu sai không tạo artifact nào');

  -- B (cùng Class) đọc đúng bản; không sửa/xoá
  perform t.as_user('B');
  perform t.ok((select content from public.tool_artifacts where id = (select id from t.ids where k = 'a1')) = t.xml(), 'B đọc được ĐÚNG MusicXML đã chia sẻ');
  perform t.ok(exists (select 1 from public.social_feed(null, null, 50) f where f.sort_key = 'p:' || (select id from t.ids where k = 'p1')::text), 'B thấy bài trong Dành cho bạn');
  perform t.ok(not exists (select 1 from public.social_feed_scoped('my_classes', null, null, 50) f where f.sort_key = 'p:' || (select id from t.ids where k = 'p1')::text), 'không vào Lớp của tôi');
  perform t.fails($q$ update public.tool_artifacts set content = 'B' $q$, 'B không sửa', 'permission denied');
  perform t.fails($q$ delete from public.tool_artifacts $q$, 'B không xoá', 'permission denied');
  perform t.fails($q$ select public.social_delete_tool_artifact((select id from t.ids where k = 'a1')) $q$, 'B không gỡ qua RPC', 'TS_NOT_OWNER');
  -- Thầy đọc, không sửa/gỡ
  perform t.as_user('T');
  perform t.ok(exists (select 1 from public.tool_artifacts where id = (select id from t.ids where k = 'a1')), 'Thầy đọc được');
  perform t.fails($q$ select public.social_delete_tool_artifact((select id from t.ids where k = 'a1')) $q$, 'Thầy không gỡ bài học sinh', 'TS_NOT_OWNER');
  -- Ngoài Class / khách
  perform t.as_user('N');
  perform t.ok(not exists (select 1 from public.tool_artifacts), 'ngoài Class không đọc được');
  perform t.fails($q$ select public.social_share_tool_result('nhipphach', t.score(), gen_random_uuid()) $q$, 'ngoài Class không chia sẻ', 'TS_NOT_MEMBER');
  perform t.as_anon();
  perform t.fails($q$ select content from public.tool_artifacts $q$, 'khách không đọc', 'permission denied');
  perform t.reset();
  perform t.ok((select content from public.tool_artifacts where id = (select id from t.ids where k = 'a1')) = t.xml(), 'bản gốc của A nguyên vẹn');

  -- Hồi quy: Metronome + BMS vẫn chạy
  perform t.as_user('B');
  perform t.ok(public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":600}', gen_random_uuid()) is not null, 'Metronome vẫn chia sẻ được');
  perform t.ok(public.social_share_tool_result('bms', jsonb_build_object('kind', 'song', 'song', jsonb_build_object('title', 'Bài BMS', 'video_id', 'dQw4w9WgXcQ',
    'lyrics', 'a b c', 'fit', '{"bpm":80,"beat_duration":0.75,"grid_offset":0}'::jsonb, 'time_signature', 4, 'downbeat_position', 1,
    'anchors', '[{"word_index":0,"beat_index":0}]'::jsonb, 'chords', '[]'::jsonb)), gen_random_uuid()) is not null, 'BMS vẫn chia sẻ được');
  perform t.reset();
  perform t.ok((select count(*) from public.tool_artifacts where tool = 'bms' and content is null) = 1, 'artifact BMS không có content (ràng buộc theo loại)');

  -- A gỡ → artifact + bài Feed biến mất
  perform t.as_user('A');
  perform t.ok(public.social_delete_tool_artifact((select id from t.ids where k = 'a1')), 'A gỡ chia sẻ');
  perform t.reset();
  perform t.ok(not exists (select 1 from public.tool_artifacts where tool = 'nhipphach') and not exists (select 1 from public.class_posts where id = (select id from t.ids where k = 'p1')),
    'gỡ: artifact + bài Feed cùng biến mất');
end $$;

-- Hàm ghi KHÔNG chạm kho master / kho Nhịp Phách
do $$ begin
  perform t.ok((select position('musicxml_library' in prosrc) = 0 and position('nhipphach_score' in prosrc) = 0 from pg_proc where proname = 'social_share_tool_result'),
    'social_share_tool_result không nhắc tới musicxml_library / nhipphach_scores');
end $$;

drop schema t cascade;
