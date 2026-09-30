-- ═══ TEST BMS ARTIFACT SHARE V1 (tool_artifacts + social_share_tool_result 'bms') — cluster PostgreSQL TẠM ═══
-- Nạp SAU fixture + P1 + P2 + classes + feed + tool_share_v1 + bms_artifact_v1 (+ rls_setup). KHÔNG chạy production.
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
-- Bài BMS mẫu hợp lệ (có trường lạ để kiểm server bỏ đi)
create function t.song(p_title text default 'Có Chàng Trai Viết Lên Cây') returns jsonb language sql immutable as $$
  select jsonb_build_object('kind', 'song', 'song', jsonb_build_object(
    'title', p_title, 'video_id', 'dQw4w9WgXcQ', 'lyrics', E'Có chàng trai viết lên cây\nlời yêu thương',
    'fit', jsonb_build_object('bpm', 76.4, 'beat_duration', 0.7853, 'grid_offset', 1.25, 'assign', '[1,2,3]'::jsonb),
    'time_signature', 4, 'downbeat_position', 1, 'group_beats', true,
    'anchors', '[{"word_index":0,"beat_index":0,"word":"Có"},{"word_index":6,"beat_index":8}]'::jsonb,
    'chords', '[{"word_index":0,"name":"Am"},{"word_index":3,"name":"F"},{"word_index":6,"name":"Am"},{"word_index":7,"name":"G/B"}]'::jsonb,
    'draft_id', 'd_local123', 'youtubeUrl', 'https://youtu.be/x?t=<script>'), 'extra', 1) $$;
grant execute on all functions in schema t to anon, authenticated;
create table t.ids (k text primary key, id uuid);
grant all on t.ids to authenticated;

do $$
declare p1 uuid; p2 uuid; art uuid; n int; ts jsonb; d jsonb;
begin
  -- Chưa bấm Chia sẻ → không có gì trên server (BMS local-first)
  perform t.ok(not exists (select 1 from public.tool_artifacts), 'ban đầu không có artifact nào (nháp ở máy, không tự upload)');

  -- A chia sẻ: ĐÚNG một artifact + ĐÚNG một bài; bấm đúp (cùng client_key) → cùng bài
  perform t.as_user('A');
  p1 := public.social_share_tool_result('bms', t.song(), '22222222-0000-4000-8000-000000000001');
  p2 := public.social_share_tool_result('bms', t.song(), '22222222-0000-4000-8000-000000000001');
  perform t.ok(p1 = p2, 'bấm Chia sẻ 2 lần → cùng MỘT bài');
  perform t.reset();
  select count(*) into n from public.tool_artifacts; perform t.ok(n = 1, 'đúng 1 artifact');
  select count(*) into n from public.class_posts where type = 'tool_share' and tool_share ->> 'tool' = 'bms'; perform t.ok(n = 1, 'đúng 1 Tool Share BMS');
  select tool_share into ts from public.class_posts where id = p1;
  art := (ts ->> 'artifact_id')::uuid;
  insert into t.ids values ('p1', p1), ('a1', art);
  perform t.ok(ts - 'artifact_id' - 'client_key' = '{"v":1,"tool":"bms","kind":"song","title":"Có Chàng Trai Viết Lên Cây","video_id":"dQw4w9WgXcQ","bpm":76,"beats_per_bar":4,"chord_count":3}'::jsonb,
    'Feed chỉ giữ tham chiếu + tóm tắt (KHÔNG lời bài hát): ' || ts::text);
  perform t.ok(not (ts ? 'lyrics') and position('yêu thương' in ts::text) = 0, 'tool_share không chứa lời bài hát');
  select data into d from public.tool_artifacts where id = art;
  perform t.ok((select owner_id from public.tool_artifacts where id = art) = t.u('A') and (select visibility from public.tool_artifacts where id = art) = 'class',
    'artifact: owner = A (auth.uid), chia sẻ cho Class');
  perform t.ok(d ->> 'schema' = 'bms.song' and (d ->> 'v')::int = 1 and d -> 'fit' = '{"bpm":76.400,"beat_duration":0.785300,"grid_offset":1.2500}'::jsonb
    and d -> 'anchors' = '[{"word_index":0,"beat_index":0},{"word_index":6,"beat_index":8}]'::jsonb
    and jsonb_array_length(d -> 'chords') = 4 and not (d ? 'draft_id') and not (d ? 'youtubeUrl'),
    'artifact: schema bms.song v1, server dựng lại (bỏ assign/word/draft_id/youtubeUrl/trường lạ): ' || d::text);

  -- Dữ liệu sai → từ chối, không tạo gì
  perform t.as_user('A');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,video_id}', '"javascript:x"'), gen_random_uuid()) $q$, 'video id lạ', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,fit,bpm}', '999'), gen_random_uuid()) $q$, 'BPM ngoài dải', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,fit}', 'null'), gen_random_uuid()) $q$, 'chưa có lưới nhịp', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,anchors}', '[]'), gen_random_uuid()) $q$, 'chưa gắn mốc', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,lyrics}', to_jsonb(repeat('a', 8001))), gen_random_uuid()) $q$, 'lời quá dài (> 8000)', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,chords}', '[{"word_index":0,"name":"<b>x</b>"}]'), gen_random_uuid()) $q$, 'tên hợp âm lạ', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,title}', '""'), gen_random_uuid()) $q$, 'tên bài rỗng', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{kind}', '"draft"'), gen_random_uuid()) $q$, 'kind lạ', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', jsonb_set(t.song(), '{song,anchors}', '[{"word_index":"1; drop","beat_index":0}]'), gen_random_uuid()) $q$, 'anchor không phải số', 'TS_BAD_RESULT');
  -- Không ghi thẳng bảng (chỉ qua RPC)
  perform t.fails($q$ insert into public.tool_artifacts (owner_id, tool, kind, schema_version, title, data, client_key) values (auth.uid(), 'bms', 'song', 1, 'x', '{}', gen_random_uuid()) $q$, 'A không chèn thẳng artifact', 'permission denied');
  perform t.fails($q$ update public.tool_artifacts set title = 'x' $q$, 'A không sửa thẳng artifact (kể cả của mình)', 'permission denied');
  perform t.reset();
  perform t.ok((select count(*) from public.tool_artifacts) = 1, 'dữ liệu sai không tạo artifact nào');

  -- B (cùng Class) ĐỌC được đúng bài; KHÔNG sửa/xoá được bản gốc
  perform t.as_user('B');
  perform t.ok((select data ->> 'title' from public.tool_artifacts where id = (select id from t.ids where k = 'a1')) = 'Có Chàng Trai Viết Lên Cây', 'B đọc được artifact đã chia sẻ');
  perform t.ok(exists (select 1 from public.social_feed(null, null, 50) f where f.sort_key = 'p:' || (select id from t.ids where k = 'p1')::text), 'B thấy bài BMS trong Dành cho bạn');
  perform t.fails($q$ update public.tool_artifacts set title = 'B sửa' $q$, 'B không UPDATE artifact của A', 'permission denied');
  perform t.fails($q$ delete from public.tool_artifacts $q$, 'B không DELETE artifact của A', 'permission denied');
  perform t.fails($q$ select public.social_delete_tool_artifact((select id from t.ids where k = 'a1')) $q$, 'B không gỡ artifact của A qua RPC', 'TS_NOT_OWNER');
  delete from public.class_posts where id = (select id from t.ids where k = 'p1');   -- RLS: không phải bài của B → 0 dòng
  perform t.reset();
  perform t.ok((select title from public.tool_artifacts where id = (select id from t.ids where k = 'a1')) = 'Có Chàng Trai Viết Lên Cây'
    and exists (select 1 from public.class_posts where id = (select id from t.ids where k = 'p1')), 'bản gốc + bài của A nguyên vẹn sau khi B thử sửa/xoá');

  -- Thầy: đọc được (thành viên Class), không sửa, không gỡ bài của học sinh qua RPC
  perform t.as_user('T');
  perform t.ok(exists (select 1 from public.tool_artifacts where id = (select id from t.ids where k = 'a1')), 'Thầy đọc được artifact');
  perform t.fails($q$ update public.tool_artifacts set title = 'T' $q$, 'Thầy không sửa artifact', 'permission denied');
  perform t.fails($q$ select public.social_delete_tool_artifact((select id from t.ids where k = 'a1')) $q$, 'Thầy không gỡ artifact của học sinh', 'TS_NOT_OWNER');

  -- Ngoài Class / khách
  perform t.as_user('N');
  perform t.ok(not exists (select 1 from public.tool_artifacts), 'ngoài Class không đọc được artifact');
  perform t.fails($q$ select public.social_share_tool_result('bms', t.song(), gen_random_uuid()) $q$, 'ngoài Class không chia sẻ', 'TS_NOT_MEMBER');
  perform t.as_anon();
  perform t.fails($q$ select count(*) from public.tool_artifacts $q$, 'khách không đọc bảng', 'permission denied');
  perform t.fails($q$ select public.social_delete_tool_artifact(gen_random_uuid()) $q$, 'khách không gọi RPC gỡ', 'permission denied');
  perform t.reset();

  -- Metronome (Tool Share V1) vẫn chạy như cũ
  perform t.as_user('B');
  perform t.ok(public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":600}', gen_random_uuid()) is not null, 'Metronome V1 vẫn chia sẻ được');
  perform t.reset();

  -- A gỡ chia sẻ qua RPC → artifact + bài Feed cùng biến mất; mở lại id cũ → không có dữ liệu (không crash)
  perform t.as_user('A');
  perform t.ok(public.social_delete_tool_artifact((select id from t.ids where k = 'a1')), 'A gỡ chia sẻ của mình');
  perform t.reset();
  perform t.ok(not exists (select 1 from public.tool_artifacts where id = (select id from t.ids where k = 'a1'))
    and not exists (select 1 from public.class_posts where id = (select id from t.ids where k = 'p1')), 'gỡ: artifact + bài Feed cùng biến mất');

  -- A xoá BÀI Feed (xoá bài hiện có) → artifact đi theo (trigger), không mồ côi
  perform t.as_user('A');
  p1 := public.social_share_tool_result('bms', t.song('Bài hai'), gen_random_uuid());
  delete from public.class_posts where id = p1;
  perform t.reset();
  perform t.ok(not exists (select 1 from public.tool_artifacts), 'xoá bài Feed → artifact cũng bị xoá (không mồ côi)');
end $$;

drop schema t cascade;
