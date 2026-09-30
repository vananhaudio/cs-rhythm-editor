-- ═══ TEST TOOL SHARE V1 (social_share_tool_result + class_posts.tool_share) — cluster PostgreSQL TẠM ═══
-- Nạp SAU fixture + P1 + P2 + social_classes_v1 + social_feed_v1 + social_tool_share_v1. KHÔNG chạy production.
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
delete from public.edu_students where user_id = 'eeeeeeee-0000-4000-8000-00000000000e';

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
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
grant execute on all functions in schema t to anon, authenticated;
create table t.ids (k text primary key, id uuid);
grant all on t.ids to authenticated;

do $$
declare id1 uuid; id2 uuid; n int; row jsonb;
begin
  -- A chia sẻ một phiên Metronome thật → đúng MỘT bài, payload chuẩn hoá do server dựng
  perform t.as_user('A');
  id1 := public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":600,"extra":"<script>"}',
                                          '11111111-0000-4000-8000-000000000001');
  id2 := public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":600}',
                                          '11111111-0000-4000-8000-000000000001');
  perform t.ok(id1 = id2, 'bấm Chia sẻ 2 lần cùng kết quả (client_key) → CÙNG một bài, không bản thứ hai');
  insert into t.ids values ('a1', id1);
  perform t.reset();
  select count(*) into n from public.class_posts where type = 'tool_share';
  select to_jsonb(p) - 'id' - 'created_at' - 'updated_at' into row from public.class_posts p where p.id = id1;
  perform t.ok(n = 1, 'đúng 1 bài tool_share');
  perform t.ok(row ->> 'author_user_id' = t.u('A')::text and row ->> 'audience' = 'class' and row ->> 'type' = 'tool_share' and row ->> 'body' = '',
    'tác giả = A (server lấy auth.uid) · Cộng đồng học tập (audience class)');
  perform t.ok(row -> 'tool_share' = '{"v":1,"tool":"metronome","kind":"practice_session","bpm":80,"seconds":600,"client_key":"11111111-0000-4000-8000-000000000001"}'::jsonb,
    'payload do server dựng (bỏ trường lạ như "extra"): ' || (row -> 'tool_share')::text);

  -- Người khác không "chiếm" key của A
  perform t.as_user('B');
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":90,"seconds":600}', '11111111-0000-4000-8000-000000000001') $q$,
    'B dùng lại client_key của A bị từ chối', 'TS_BAD_RESULT');
  -- Payload sai / ngoài dải / công cụ lạ → từ chối an toàn
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":999,"seconds":600}', gen_random_uuid()) $q$, 'BPM ngoài 30–260', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":30}', gen_random_uuid()) $q$, 'phiên < 60 giây', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":"80; drop table x","seconds":600}', gen_random_uuid()) $q$, 'BPM không phải số', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"award","bpm":80,"seconds":600}', gen_random_uuid()) $q$, 'kind lạ', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('metronome', '[1,2]', gen_random_uuid()) $q$, 'payload không phải object', 'TS_BAD_RESULT');
  perform t.fails($q$ select public.social_share_tool_result('bms', '{"score":10}', gen_random_uuid()) $q$, 'công cụ chưa đăng ký', 'TS_UNKNOWN_TOOL');
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":600}', null) $q$, 'thiếu client_key', 'TS_BAD_RESULT');
  -- Không tự chèn thẳng bài tool_share (policy insert hiện có không cho type này)
  perform t.fails($q$ insert into public.class_posts (type, audience, body, tool_share) values ('tool_share', 'class', '', '{"v":1,"tool":"metronome","bpm":80,"seconds":600}') $q$,
    'chèn thẳng tool_share qua bảng bị chặn (chỉ qua RPC)');
  -- B (thành viên Class) THẤY bài của A ở Dành cho bạn + đọc được payload qua RLS
  perform t.ok(exists (select 1 from public.social_feed(null, null, 50) f where f.sort_key = 'p:' || (select id from t.ids where k = 'a1')::text and f.post ->> 'type' = 'tool_share'),
    'B thấy chia sẻ của A trong Dành cho bạn (social_feed)');
  perform t.ok((select tool_share ->> 'bpm' from public.class_posts where id = (select id from t.ids where k = 'a1')) = '80', 'B đọc được payload (RLS đọc hiện có)');
  perform t.ok(not exists (select 1 from public.social_feed_scoped('my_classes', null, null, 50) f where f.sort_key = 'p:' || (select id from t.ids where k = 'a1')::text),
    'chia sẻ KHÔNG có ngữ cảnh lớp → không vào Lớp của tôi');
  -- B không sửa/xoá bài của A
  update public.class_posts set tool_share = jsonb_set(tool_share, '{bpm}', '200') where id = (select id from t.ids where k = 'a1');
  delete from public.class_posts where id = (select id from t.ids where k = 'a1');
  perform t.reset();
  perform t.ok((select tool_share ->> 'bpm' from public.class_posts where id = (select id from t.ids where k = 'a1')) = '80', 'B không sửa/xoá được bài của A');

  -- Ngoài Class / khách
  perform t.as_user('N');
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":600}', gen_random_uuid()) $q$, 'ngoài Class không chia sẻ', 'TS_NOT_MEMBER');
  perform t.ok(not exists (select 1 from public.class_posts where type = 'tool_share'), 'ngoài Class không đọc được chia sẻ');
  perform t.as_anon();
  perform t.fails($q$ select public.social_share_tool_result('metronome', '{"kind":"practice_session","bpm":80,"seconds":600}', gen_random_uuid()) $q$, 'khách không gọi được', 'permission denied');
  -- A xoá bài của mình (hành vi xoá bài hiện có)
  perform t.as_user('A');
  delete from public.class_posts where id = (select id from t.ids where k = 'a1');
  perform t.reset();
  perform t.ok(not exists (select 1 from public.class_posts where type = 'tool_share'), 'A xoá được chia sẻ của chính mình');
end $$;

drop schema t cascade;
