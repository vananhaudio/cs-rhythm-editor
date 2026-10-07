-- ═══ TEST Class Universal Share V1 (db/universal_share_v1_setup.sql) ═══
-- Chạy trên cluster PostgreSQL TẠM qua scripts/test-universal-share-db.sh (SAU … dm_v1 + dm_share_v1 + lifecycle + universal). A = thành viên lớp c1 · B, C = học sinh ngoài lớp · T = Thầy · N = ngoài Class.
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
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
create function t.fails(q text, msg text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn: %', msg, q;
end $$;
create function t.err(q text) returns text language plpgsql as $$ begin execute q; return 'OK'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create function t.friends(x text, y text, st text) returns void language sql security definer as $$
  insert into public.friendships (requester_id, addressee_id, status, responded_at) values (t.u(x), t.u(y), st, case when st = 'pending' then null else now() end) on conflict do nothing $$;
create function t.unfriend_row(x text, y text) returns void language sql security definer as $$
  delete from public.friendships where least(requester_id, addressee_id) = least(t.u(x), t.u(y)) and greatest(requester_id, addressee_id) = greatest(t.u(x), t.u(y)) $$;
create function t.xml(p_title text default 'Đàn Gà Con') returns text language sql immutable as $x$ select
'<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<score-partwise version="4.0"><work><work-title>' || p_title || '</work-title></work>
<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><type>half</type><dot/><lyric><text>Gà</text></lyric></note></measure></part>
</score-partwise>' $x$;
create function t.np(p_title text default 'Đàn Gà Con', p_level text default 'eighths', p_xml text default null) returns jsonb language sql immutable as $$
  select jsonb_build_object('title', p_title, 'composer', 'Phan Huỳnh Điểu', 'musicxml', coalesce(p_xml, t.xml(p_title)),
    'settings', jsonb_build_object('showBeats', true, 'countingLevel', p_level, 'compoundCountingMode', 'pulses', 'orientation', 'portrait', 'color', '#DC2626', 'sizePt', 7, 'distance', 2,
                                   'grouping', '{"byMeter":{"7/8":[2,2,3]}}'::jsonb), 'svg', '<svg/>') $$;
create function t.song(p_title text default 'Có Chàng Trai') returns jsonb language sql immutable as $$
  select jsonb_build_object('title', p_title, 'video_id', 'dQw4w9WgXcQ', 'lyrics', E'Có chàng trai viết lên cây\nlời yêu thương',
    'fit', jsonb_build_object('bpm', 76.4, 'beat_duration', 0.7853, 'grid_offset', 1.25), 'time_signature', 4, 'downbeat_position', 1, 'group_beats', true,
    'anchors', '[{"word_index":0,"beat_index":0},{"word_index":6,"beat_index":8}]'::jsonb, 'chords', '[{"word_index":0,"name":"Am"},{"word_index":3,"name":"F"}]'::jsonb) $$;
create function t.is_member(c uuid, u uuid) returns boolean language sql security definer as $$ select public.social_class_is_member(c, u) $$;
create function t.n_art() returns bigint language sql security definer as $$ select count(*) from public.tool_artifacts $$;
create function t.n_post() returns bigint language sql security definer as $$ select count(*) from public.class_posts where type = 'tool_share' $$;
create function t.vis(p uuid) returns text language sql security definer as $$ select visibility from public.tool_artifacts where id = p $$;
create table t.ids (k text primary key, id uuid);
grant all on t.ids to authenticated, anon;
grant execute on all functions in schema t to anon, authenticated;

-- ── 0. Quyền gọi + schema ──
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select public.tool_artifact_save_for_share('nhipphach', t.np())$q$, '0 anon không lưu được');
  perform t.as_user('N');
  perform t.ok(t.err($q$select public.tool_artifact_save_for_share('nhipphach', t.np())$q$) like '42501:%', '0 ngoài Class không lưu được (42501)');
  perform t.as_user('A');
  perform t.ok(t.err($q$select public.tool_artifact_save_for_share('lạ', '{}'::jsonb)$q$) like '22023:%', '0 tool lạ → 22023');
  perform t.reset();
  perform t.ok((select pg_get_constraintdef(oid) from pg_constraint where conname = 'dm_messages_ref_valid_check') like '%class_session%', '0 CHECK nhận class_session');
  perform t.ok(has_function_privilege('authenticated', 'public.tool_artifact_save_for_share(text,jsonb)', 'execute') and not has_function_privilege('anon', 'public.tool_artifact_save_for_share(text,jsonb)', 'execute'), '0 chỉ authenticated gọi được');
end $$;

-- ── 1. Nhịp & Phách: lưu riêng idempotent, không Feed, server dựng lại dữ liệu ──
do $$ declare a1 uuid; a2 uuid; a3 uuid; a4 uuid; n0 bigint := t.n_art(); p0 bigint := t.n_post(); begin
  perform t.as_user('A');
  a1 := public.tool_artifact_save_for_share('nhipphach', t.np());
  a2 := public.tool_artifact_save_for_share('nhipphach', t.np());
  perform t.reset();
  insert into t.ids values ('NP1', a1);
  perform t.ok(a1 = a2 and t.n_art() = n0 + 1 and t.n_post() = p0, '1 lưu hai lần cùng bản → MỘT artifact, KHÔNG có bài Feed');
  perform t.ok(t.vis(a1) = 'shared', '1 artifact mới là riêng tư (shared)');
  perform t.ok((select tool = 'nhipphach' and kind = 'score' and content like '<?xml%' and content_sha256 ~ '^[0-9a-f]{64}$' and data ->> 'schema' = 'nhipphach.score'
                  and data ->> 'meter' = '3/4' and not (data ? 'svg') and not (data -> 'settings' ? 'svg') from public.tool_artifacts where id = a1), '1 server dựng lại: MusicXML ở cột content + sha256, meter 3/4, bỏ trường lạ');
  perform t.as_user('A');
  a3 := public.tool_artifact_save_for_share('nhipphach', t.np('Đàn Gà Con', 'beats'));
  a4 := public.tool_artifact_save_for_share('nhipphach', t.np('Đàn Gà Con', 'eighths', replace(t.xml(), 'Gà', 'Vịt')));
  perform t.reset();
  perform t.ok(a3 <> a1 and a4 <> a1 and a3 <> a4, '1 đổi thiết lập đếm hoặc nội dung MusicXML → bản MỚI (phiên bản khác)');
  perform t.as_user('A');
  perform t.ok(t.err($q$select public.tool_artifact_save_for_share('nhipphach', t.np(p_xml => '<score-partwise><!ENTITY x "y"/></score-partwise>'))$q$) like '22023:%', '1 XML có ENTITY bị chặn');
  perform t.ok(t.err($q$select public.tool_artifact_save_for_share('nhipphach', jsonb_set(t.np(), '{settings,showBeats}', 'false'))$q$) like '22023:%', '1 chưa hiện số phách → không phải bản đã đánh số');
  perform t.ok(t.err($q$select public.tool_artifact_save_for_share('nhipphach', jsonb_set(t.np(), '{title}', '""'))$q$) like '22023:%', '1 thiếu tên → 22023');
  perform t.ok(t.err($q$select public.tool_artifact_save_for_share('nhipphach', null)$q$) like '22023:%', '1 payload null → 22023');
  perform t.ok(t.err($q$select public.tool_artifact_save_for_share('nhipphach', jsonb_set(t.np(), '{musicxml}', to_jsonb(repeat('x', 1048577))))$q$) like '22023:%', '1 > 1 MB bị chặn');
  perform t.reset();
  delete from public.tool_artifacts where id in (a3, a4);
end $$;

-- ── 2. Riêng tư thật + grant qua DM + không forward (Nhịp & Phách) ──
do $$ declare np uuid := (select id from t.ids where k = 'NP1'); r record; begin
  perform t.friends('A', 'B', 'accepted'); perform t.friends('A', 'C', 'accepted');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 0, '2 B (chưa nhận) KHÔNG đọc được bản riêng (kể cả content)');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 0, '2 Thầy cũng không đọc được');
  perform t.as_user('A');
  select * into r from public.dm_share(t.u('B'), 'tool_artifact', np::text);
  perform t.ok(r.seq is not null, '2 A gửi bản riêng cho B');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = np and content is not null) = 1, '2 B (đã nhận) đọc được đủ MusicXML để dựng lại');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 0, '2 C (không nhận) vẫn không đọc được');
  perform t.reset();
  perform t.friends('B', 'C', 'accepted');
  perform t.as_user('B');
  perform t.ok(t.err(format($q$select * from public.dm_share(%L, 'tool_artifact', %L)$q$, t.u('C'), np)) like '22023:%', '2 B KHÔNG forward bản riêng');
  perform t.reset(); perform t.unfriend_row('B', 'C');
  perform t.ok(t.n_post() = (select count(*) from public.class_posts where type = 'tool_share'), '2 (đếm)');
  perform t.unfriend_row('A', 'B');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 1, '2 unfriend: B vẫn mở được (grant lịch sử)');
  perform t.as_user('A');
  perform t.ok(t.err(format($q$select * from public.dm_share(%L, 'tool_artifact', %L)$q$, t.u('B'), np)) like '42501:%', '2 unfriend: A không gửi thêm');
  perform t.reset(); perform t.friends('A', 'B', 'accepted');
end $$;

-- ── 3. Đăng cộng đồng = promote chính artifact; payload Feed đúng chuẩn Nhịp & Phách; gỡ khỏi cộng đồng giữ DM ──
do $$ declare np uuid := (select id from t.ids where k = 'NP1'); p1 uuid; p2 uuid; n0 bigint := t.n_art(); pst0 bigint := t.n_post(); r text; begin
  perform t.as_user('B');
  perform t.ok(t.err(format($q$select public.social_publish_tool_artifact(%L)$q$, np)) like '42501:%', '3 người nhận không đăng được');
  perform t.as_user('A');
  p1 := public.social_publish_tool_artifact(np);
  p2 := public.social_publish_tool_artifact(np);
  perform t.reset();
  perform t.ok(p1 = p2 and t.n_art() = n0 and t.n_post() = pst0 + 1 and t.vis(np) = 'class', '3 đăng 2 lần: cùng bài Feed, artifact KHÔNG nhân bản, shared → class');
  perform t.ok((select tool_share ->> 'tool' = 'nhipphach' and tool_share ->> 'kind' = 'score' and tool_share ->> 'artifact_id' = np::text and tool_share ->> 'meter' = '3/4'
                  and tool_share ->> 'counting_level' = 'eighths' and tool_share ->> 'title' = 'Đàn Gà Con' and not (tool_share ? 'musicxml') from public.class_posts where id = p1), '3 bài Feed Nhịp & Phách: tham chiếu + tóm tắt, KHÔNG MusicXML');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 1, '3 sau đăng: thành viên Class đọc được');
  perform t.as_user('A');
  r := public.social_unpublish_tool_artifact(np);
  perform t.reset();
  perform t.ok(r = 'private' and t.vis(np) = 'shared' and not exists (select 1 from public.class_posts where id = p1), '3 gỡ khỏi cộng đồng khi đã gửi DM → hạ shared, Feed hết bài');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 1, '3 B (đã nhận) vẫn mở');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 0, '3 C không còn đọc được');
  perform t.as_user('A');
  perform t.ok(public.social_publish_tool_artifact(np) <> p1 and t.vis(np) = 'class', '3 đăng lại = chính artifact, bài Feed mới');
  perform t.reset();
  perform t.ok(t.n_art() = n0 and (select count(*) from public.class_posts where tool_share ->> 'artifact_id' = np::text) = 1, '3 đúng một artifact và một bài Feed');
  perform t.as_user('A');
  perform public.social_unpublish_tool_artifact(np);   -- về shared để test xoá
  perform t.ok(public.social_delete_tool_artifact(np), '3 chủ xoá bài riêng');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = np) = 0 and (select count(*) from public.dm_messages(public.dm_find(t.u('A'))) where ref_key = np::text) = 1, '3 artifact xoá, tin DM còn (card unavailable)');
  perform t.reset();
end $$;

-- Chưa từng gửi DM: đăng rồi gỡ = xoá (không mồ côi)
do $$ declare a uuid; p uuid; r text; begin
  perform t.as_user('A');
  a := public.tool_artifact_save_for_share('nhipphach', t.np('Chỉ đăng'));
  p := public.social_publish_tool_artifact(a);
  r := public.social_unpublish_tool_artifact(a);
  perform t.reset();
  perform t.ok(r = 'deleted' and not exists (select 1 from public.tool_artifacts where id = a) and not exists (select 1 from public.class_posts where id = p), '3b Nhịp & Phách chưa từng gửi DM: gỡ khỏi cộng đồng → xoá cả hai');
  -- RPC đăng cũ vẫn chạy (client cũ)
  perform t.as_user('B');
  perform t.ok(public.social_share_tool_result('nhipphach', jsonb_build_object('kind', 'score', 'score', t.np('Đăng đường cũ')), gen_random_uuid()) is not null, '3b RPC cũ social_share_tool_result (nhipphach) vẫn chạy');
  perform t.reset();
  delete from public.tool_artifacts where owner_id = t.u('B');
end $$;

-- ── 4. BMS qua lớp bọc: cùng hành vi (id ổn định, dedupe) ──
do $$ declare a uuid; b uuid; begin
  perform t.as_user('A');
  a := public.bms_save_for_share(t.song()); b := public.tool_artifact_save_for_share('bms', t.song());
  perform t.reset();
  perform t.ok(a = b and t.vis(a) = 'shared', '4 bms_save_for_share (lớp bọc) ≡ tool_artifact_save_for_share(bms): cùng artifact');
  perform t.as_user('A');
  perform t.ok(t.err($q$select public.bms_save_for_share('{"x":1}'::jsonb)$q$) like '22023:%', '4 lớp bọc BMS giữ lỗi 22023');
  perform t.reset();
  delete from public.tool_artifacts where id = a;
end $$;

-- ── 5. Lớp học (class) & Buổi học (class_session): CHỈ tham chiếu, KHÔNG cấp quyền ──
do $$ declare c uuid := 'b0000000-0000-4000-8000-0000000000c1'; s1 uuid := '51000000-0000-4000-8000-000000000001'; s2 uuid := '51000000-0000-4000-8000-000000000002'; r record; n0 bigint := t.n_art(); p0 bigint := t.n_post(); e_fake text; begin
  perform t.as_user('A');
  perform t.ok(t.is_member(c, t.u('A')), '5 (nền) A là thành viên lớp');
  select * into r from public.dm_share(t.u('B'), 'class', c::text);
  perform t.ok(r.seq is not null, '5 thành viên lớp gửi LỚP cho bạn');
  select * into r from public.dm_share(t.u('B'), 'class_session', s1::text);
  perform t.ok(r.seq is not null, '5 thành viên lớp gửi BUỔI HỌC cho bạn (cùng hội thoại canonical)');
  perform t.reset();
  perform t.ok(t.n_art() = n0 and t.n_post() = p0, '5 KHÔNG tạo artifact, KHÔNG tạo bài Feed');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.dm_messages(public.dm_find(t.u('A'))) where ref_type in ('class', 'class_session')) = 2, '5 B thấy 2 tin tham chiếu');
  perform t.ok(not t.is_member(c, t.u('B')), '5 B KHÔNG thành viên lớp: tin share KHÔNG cấp quyền thành viên');
  perform t.ok(not t.is_member(c, t.u('B')) and not t.is_member(c, t.u('C')), '5 sau khi nhận share B, C vẫn không phải thành viên (share không cấp quyền)');
  perform t.ok((select bool_and(body = 'Đã chia sẻ một nội dung') from public.dm_messages(public.dm_find(t.u('A'))) where ref_type is not null), '5 mọi tin tham chiếu có body cố định');
  -- người gửi không có quyền
  perform t.reset(); perform t.friends('B', 'C', 'accepted');
  perform t.as_user('B');
  e_fake := t.err($q$select * from public.dm_share(t.u('C'), 'class', 'b0000000-0000-4000-8000-0000000000c1')$q$);
  perform t.ok(e_fake like '22023:%', '5 B (không thành viên) KHÔNG gửi được lớp (22023)');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('C'), 'class_session', '51000000-0000-4000-8000-000000000001')$q$) = e_fake, '5 B không gửi được buổi học — cùng lỗi');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('C'), 'class', '99999999-0000-4000-8000-000000000999')$q$) = e_fake, '5 lớp không tồn tại ≡ cùng lỗi (không lộ)');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('C'), 'class', 'khong-uuid')$q$) = e_fake and t.err($q$select * from public.dm_share(t.u('C'), 'class', null)$q$) = e_fake, '5 khoá sai/null ≡ cùng lỗi');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('C'), 'profile', 'b0000000-0000-4000-8000-0000000000c1')$q$) = e_fake, '5 loại ngoài allowlist ≡ cùng lỗi');
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'class_session', '51000000-0000-4000-8000-000000000002')$q$) = e_fake, '5 buổi KHÔNG phải lesson (nghỉ) bị từ chối');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('N'), 'class', 'b0000000-0000-4000-8000-0000000000c1')$q$) like '42501:%', '5 người nhận ngoài Class bị chặn (42501)');
  perform t.reset(); perform t.unfriend_row('B', 'C');
  -- Thầy gửi lớp bất kỳ
  perform t.friends('T', 'B', 'accepted');
  perform t.as_user('T');
  perform t.ok((select seq from public.dm_share(t.u('B'), 'class', c::text)) is not null, '5 Thầy/admin gửi lớp (is_teacher) được');
  perform t.reset(); perform t.unfriend_row('T', 'B');
  -- unfriend: không gửi thêm
  perform t.unfriend_row('A', 'B');
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'class', 'b0000000-0000-4000-8000-0000000000c1')$q$) like '42501:%', '5 unfriend: không gửi thêm');
  perform t.reset(); perform t.friends('A', 'B', 'accepted');
  -- đối tượng bị xoá: tin còn, tham chiếu không còn resolve
  delete from public.class_sessions where id = s2;
  perform t.ok((select count(*) from public.dm_messages) >= 3, '5 (tin vẫn còn khi object gốc biến mất — resolver trả unavailable)');
end $$;

-- ── 6. Rate limit chung + canonical conversation/seq ──
do $$ declare i int; c uuid := 'b0000000-0000-4000-8000-0000000000c1'; conv uuid; begin
  perform t.as_user('A');
  conv := public.dm_find(t.u('B'));
  perform t.reset();
  delete from public.dm_messages where conversation_id = conv;
  update public.dm_conversations set last_seq = 0 where id = conv;
  perform t.as_user('A');
  for i in 1..30 loop perform public.dm_share(t.u('B'), 'class', c::text); end loop;
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'class', 'b0000000-0000-4000-8000-0000000000c1')$q$) like '54000:%', '6 tin thứ 31 trong 1 phút (share lớp) bị chặn — chung bộ đếm');
  perform t.reset();
  perform t.ok((select count(*) from public.dm_messages where conversation_id = conv) = 30 and (select max(seq) from public.dm_messages where conversation_id = conv) = 30, '6 seq liên tục 1..30 trong CÙNG hội thoại canonical');
end $$;
