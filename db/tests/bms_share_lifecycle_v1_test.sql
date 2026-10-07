-- ═══ TEST BMS Share Lifecycle V1 (db/bms_share_lifecycle_v1_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-bms-share-lifecycle-db.sh (nạp SAU … + dm_v1 + dm_share_v1 + lifecycle).
-- A = chủ bài · B, C = học sinh · T = Thầy · N = ngoài Class.
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
  insert into public.friendships (requester_id, addressee_id, status, responded_at) values (t.u(x), t.u(y), st, case when st = 'pending' then null else now() end) $$;
create function t.unfriend_row(x text, y text) returns void language sql security definer as $$
  delete from public.friendships where least(requester_id, addressee_id) = least(t.u(x), t.u(y)) and greatest(requester_id, addressee_id) = greatest(t.u(x), t.u(y)) $$;
create function t.song(p_title text default 'Có Chàng Trai Viết Lên Cây') returns jsonb language sql immutable as $$
  select jsonb_build_object('title', p_title, 'video_id', 'dQw4w9WgXcQ', 'lyrics', E'Có chàng trai viết lên cây\nlời yêu thương',
    'fit', jsonb_build_object('bpm', 76.4, 'beat_duration', 0.7853, 'grid_offset', 1.25, 'assign', '[1,2,3]'::jsonb),
    'time_signature', 4, 'downbeat_position', 1, 'group_beats', true,
    'anchors', '[{"word_index":0,"beat_index":0,"word":"Có"},{"word_index":6,"beat_index":8}]'::jsonb,
    'chords', '[{"word_index":0,"name":"Am"},{"word_index":3,"name":"F"},{"word_index":6,"name":"Am"},{"word_index":7,"name":"G/B"}]'::jsonb,
    'draft_id', 'd_local123', 'youtubeUrl', 'https://youtu.be/x?t=<script>') $$;
create function t.n_art() returns bigint language sql security definer as $$ select count(*) from public.tool_artifacts $$;
create function t.n_post() returns bigint language sql security definer as $$ select count(*) from public.class_posts where type = 'tool_share' $$;
create function t.vis(p uuid) returns text language sql security definer as $$ select visibility from public.tool_artifacts where id = p $$;
create table t.ids (k text primary key, id uuid);
grant all on t.ids to authenticated, anon;
grant execute on all functions in schema t to anon, authenticated;

-- ── 0. Quyền gọi + schema ──
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select public.bms_save_for_share(t.song())$q$, '0 anon không gọi bms_save_for_share');
  perform t.fails($q$select public.social_publish_tool_artifact(gen_random_uuid())$q$, '0 anon không gọi social_publish_tool_artifact');
  perform t.as_user('N');
  perform t.ok(t.err($q$select public.bms_save_for_share(t.song())$q$) like '42501:%', '0 ngoài Class không lưu được (42501)');
  perform t.ok(t.err($q$select public.social_publish_tool_artifact(gen_random_uuid())$q$) like '42501:%', '0 ngoài Class không đăng được');
  perform t.reset();
  perform t.ok((select pg_get_constraintdef(oid) from pg_constraint where conname = 'tool_artifacts_visibility_check') like '%class%shared%', '0 CHECK visibility nhận class + shared');
  perform t.ok((select count(*) from information_schema.role_table_grants where table_name = 'tool_artifacts' and grantee in ('anon','PUBLIC')) = 0
               and (select string_agg(privilege_type, ',') from information_schema.role_table_grants where table_name = 'tool_artifacts' and grantee = 'authenticated') = 'SELECT', '0 tool_artifacts: authenticated chỉ SELECT, anon không gì');
  perform t.ok((select count(*) from pg_policies where tablename = 'tool_artifacts') = 1, '0 vẫn đúng 1 policy trên tool_artifacts');
  perform t.ok(not has_function_privilege('anon', 'public.dm_artifact_granted(uuid)', 'execute'), '0 anon không EXECUTE dm_artifact_granted');
end $$;

-- ── 1. Lưu riêng: idempotent theo NỘI DUNG, không tạo Feed ──
do $$ declare a1 uuid; a2 uuid; a3 uuid; n0 bigint; p0 bigint; begin
  n0 := t.n_art(); p0 := t.n_post();
  perform t.as_user('A');
  a1 := public.bms_save_for_share(t.song());
  a2 := public.bms_save_for_share(t.song());
  perform t.reset();
  insert into t.ids values ('A1', a1);
  perform t.ok(a1 = a2, '1 lưu hai lần cùng nội dung → CÙNG một artifact');
  perform t.ok(t.n_art() = n0 + 1 and t.n_post() = p0, '1 chỉ +1 artifact, KHÔNG có bài Feed');
  perform t.ok(t.vis(a1) = 'shared', '1 artifact mới ở trạng thái riêng (shared)');
  perform t.ok((select data ->> 'title' = 'Có Chàng Trai Viết Lên Cây' and not (data ? 'draft_id') and not (data ? 'youtubeUrl') from public.tool_artifacts where id = a1), '1 server dựng lại dữ liệu (bỏ trường lạ)');
  perform t.as_user('A');
  a3 := public.bms_save_for_share(t.song('Bài khác'));
  perform t.reset();
  perform t.ok(a3 <> a1 and t.n_art() = n0 + 2, '1 đổi nội dung (tên) → artifact MỚI (bài mới)');
  perform t.as_user('B');
  perform t.ok(public.bms_save_for_share(t.song()) not in (a1, a3), '1 người khác cùng nội dung → artifact riêng của họ (không dùng chung)');
  perform t.ok(t.err($q$select public.bms_save_for_share('{"title":"x"}'::jsonb)$q$) like '22023:%', '1 dữ liệu thiếu → 22023');
  perform t.ok(t.err($q$select public.bms_save_for_share(null)$q$) like '22023:%', '1 null → 22023');
  perform t.reset();
  delete from public.tool_artifacts where owner_id = t.u('B');
end $$;

-- ── 2. Quyền đọc 'shared': chủ bài · người đã NHẬN qua DM · không ai khác ──
do $$ declare a1 uuid := (select id from t.ids where k = 'A1'); r record; begin
  perform t.friends('A', 'B', 'accepted'); perform t.friends('A', 'C', 'accepted');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 1, '2 chủ bài đọc được artifact shared');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 0, '2 B (thành viên Class, chưa nhận) KHÔNG đọc được');
  perform t.ok((select count(*) from public.tool_artifacts where visibility = 'shared') = 0, '2 B không liệt kê được artifact shared nào');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 0, '2 C chưa nhận → không đọc được');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 0, '2 cả Thầy/admin cũng không đọc được (riêng tư thật)');
  perform t.as_anon();
  perform t.fails($q$select * from public.tool_artifacts$q$, '2 anon không đọc');
  perform t.as_user('A');
  select * into r from public.dm_share(t.u('B'), 'tool_artifact', a1::text);
  perform t.ok(r.seq = 1, '2 A gửi artifact shared cho B qua DM (dm_share chấp nhận chủ bài)');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 1, '2 B NHẬN qua DM → đọc được (tin DM = grant)');
  perform t.ok((select data ->> 'video_id' from public.tool_artifacts where id = a1) = 'dQw4w9WgXcQ', '2 B đọc đủ dữ liệu để luyện');
  perform t.ok(public.dm_artifact_granted(a1), '2 dm_artifact_granted(B) = true');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 0 and not public.dm_artifact_granted(a1), '2 C (không nhận) vẫn KHÔNG đọc được dù B đã nhận');
  perform t.reset();
  perform t.ok(t.n_post() = (select count(*) from public.class_posts where type = 'tool_share'), '2 (kiểm đếm)');
end $$;

-- ── 3. Không forward; tin giả không cấp quyền; không Feed ──
do $$ declare a1 uuid := (select id from t.ids where k = 'A1'); p0 bigint := t.n_post(); begin
  perform t.as_user('B');
  perform t.ok(t.err(format($q$select * from public.dm_share(%L, 'tool_artifact', %L)$q$, t.u('A'), a1)) like '22023:%', '3 người nhận KHÔNG forward artifact shared (cả về lại chủ bài)');
  perform t.reset();
  perform t.friends('B', 'C', 'accepted');
  perform t.as_user('B');
  perform t.ok(t.err(format($q$select * from public.dm_share(%L, 'tool_artifact', %L)$q$, t.u('C'), a1)) like '22023:%', '3 B không forward cho C');
  perform t.reset();
  -- tin do KHÔNG phải chủ bài gửi (giả lập chèn trực tiếp) không cấp quyền
  insert into public.dm_conversations (user_lo, user_hi, last_seq) values (least(t.u('B'), t.u('C')), greatest(t.u('B'), t.u('C')), 0) on conflict do nothing;
  insert into public.dm_participants (conversation_id, user_id) select c.id, u from public.dm_conversations c, unnest(array[t.u('B'), t.u('C')]) u
    where c.user_lo = least(t.u('B'), t.u('C')) and c.user_hi = greatest(t.u('B'), t.u('C')) on conflict do nothing;
  insert into public.dm_messages (conversation_id, seq, sender_id, body, ref_type, ref_key)
    select c.id, 1, t.u('B'), 'Đã chia sẻ một nội dung', 'tool_artifact', a1::text from public.dm_conversations c where c.user_lo = least(t.u('B'), t.u('C')) and c.user_hi = greatest(t.u('B'), t.u('C'));
  perform t.as_user('C');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 0, '3 tin giả do B (không phải chủ bài) gửi KHÔNG cấp quyền cho C');
  perform t.reset();
  perform t.ok(t.n_post() = p0, '3 gửi/nhận artifact shared KHÔNG tạo bài Feed');
  delete from public.dm_messages where conversation_id in (select id from public.dm_conversations where user_lo = least(t.u('B'), t.u('C')) and user_hi = greatest(t.u('B'), t.u('C')));
  delete from public.dm_conversations where user_lo = least(t.u('B'), t.u('C')) and user_hi = greatest(t.u('B'), t.u('C'));
  perform t.unfriend_row('B', 'C');
end $$;

-- ── 4. Huỷ kết bạn: không gửi thêm; người đã nhận vẫn mở được; lịch sử còn ──
do $$ declare a1 uuid := (select id from t.ids where k = 'A1'); begin
  perform t.unfriend_row('A', 'B');
  perform t.as_user('A');
  perform t.ok(t.err(format($q$select * from public.dm_share(%L, 'tool_artifact', %L)$q$, t.u('B'), a1)) like '42501:%', '4 unfriend: A không gửi thêm cho B');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 1, '4 unfriend: B (đã nhận) VẪN đọc được artifact');
  perform t.ok((select count(*) from public.dm_messages(public.dm_find(t.u('A'))) where ref_type is not null) >= 1, '4 lịch sử Chat còn');
  perform t.reset();
  perform t.friends('A', 'B', 'accepted');
end $$;

-- ── 5. Đăng cộng đồng = PROMOTE chính artifact (một bài = một artifact) ──
do $$ declare a1 uuid := (select id from t.ids where k = 'A1'); p1 uuid; p2 uuid; n0 bigint := t.n_art(); p0 bigint := t.n_post(); begin
  perform t.as_user('B');
  perform t.ok(t.err(format($q$select public.social_publish_tool_artifact(%L)$q$, a1)) like '42501:%', '5 người nhận KHÔNG đăng được bài của người khác (42501)');
  perform t.as_user('C');
  perform t.ok(t.err(format($q$select public.social_publish_tool_artifact(%L)$q$, a1)) like '42501:%', '5 người không liên quan không đăng được');
  perform t.as_user('A');
  perform t.ok(t.err($q$select public.social_publish_tool_artifact(gen_random_uuid())$q$) like '42501:%', '5 id lạ ≡ không phải chủ (cùng lỗi, không lộ tồn tại)');
  p1 := public.social_publish_tool_artifact(a1);
  p2 := public.social_publish_tool_artifact(a1);
  perform t.reset();
  perform t.ok(p1 = p2, '5 đăng hai lần → CÙNG một bài Feed (idempotent)');
  perform t.ok(t.n_art() = n0 and t.n_post() = p0 + 1, '5 KHÔNG tạo artifact thứ hai; đúng +1 bài Feed');
  perform t.ok(t.vis(a1) = 'class', '5 artifact được PROMOTE shared → class (cùng id)');
  perform t.ok((select tool_share ->> 'artifact_id' = a1::text and tool_share ->> 'tool' = 'bms' and (tool_share ->> 'bpm')::int = 76 and (tool_share ->> 'chord_count')::int = 3
                  and tool_share ->> 'title' = 'Có Chàng Trai Viết Lên Cây' and not (tool_share ? 'lyrics') from public.class_posts where id = p1), '5 bài Feed: tham chiếu + tóm tắt (BPM làm tròn, 3 hợp âm khác nhau), KHÔNG có lời');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.tool_artifacts where id = a1) = 1, '5 sau khi đăng: mọi thành viên Class đọc được');
  perform t.as_user('A');
  perform t.ok(public.bms_save_for_share(t.song()) = a1, '5 lưu lại cùng nội dung sau khi đăng → vẫn CÙNG artifact (không nhân bản)');
  perform t.reset();
  perform t.ok(t.n_art() = n0, '5 vẫn đúng một artifact cho bài này');
end $$;

-- ── 6. Gửi bài đã 'class': chỉ tham chiếu, không đổi visibility; bạn khác dùng lại chính artifact ──
do $$ declare a1 uuid := (select id from t.ids where k = 'A1'); r record; begin
  perform t.as_user('A');
  select * into r from public.dm_share(t.u('C'), 'tool_artifact', a1::text);
  perform t.reset();
  perform t.ok(t.vis(a1) = 'class' and r.seq = 1, '6 gửi bài class cho C: visibility giữ nguyên, hội thoại mới seq 1');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.dm_share(t.u('A'), 'tool_artifact', a1::text)) = 1, '6 bài class: người nhận forward ĐƯỢC (theo quyền class hiện tại)');
  perform t.reset();
end $$;

-- ── 7. Gỡ bài riêng: artifact xoá, tin Chat KHÔNG xoá ──
do $$ declare a9 uuid; n bigint; r record; begin
  perform t.as_user('A');
  a9 := public.bms_save_for_share(t.song('Bài sẽ gỡ'));
  perform public.dm_share(t.u('B'), 'tool_artifact', a9::text);
  select count(*) into n from public.dm_messages(public.dm_find(t.u('B')));
  perform t.ok(public.social_delete_tool_artifact(a9), '7 chủ bài gỡ artifact shared');
  perform t.reset();
  perform t.ok(not exists (select 1 from public.tool_artifacts where id = a9), '7 artifact bị xoá');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.dm_messages(public.dm_find(t.u('A')))) = n, '7 tin Chat KHÔNG bị xoá (card sẽ hiện "không còn khả dụng")');
  perform t.ok((select count(*) from public.dm_messages(public.dm_find(t.u('A'))) where ref_key = a9::text) = 1, '7 tin tham chiếu bài đã gỡ vẫn còn');
  perform t.ok((select count(*) from public.tool_artifacts where id = a9) = 0, '7 người nhận không còn đọc được');
  perform t.ok(t.err(format($q$select public.social_delete_tool_artifact(%L)$q$, a9)) like '42501:%', '7 người khác không gỡ được');
  perform t.as_user('B');
  perform t.ok(t.err(format($q$select public.social_delete_tool_artifact(%L)$q$, (select id from t.ids where k = 'A1'))) like '42501:%', '7 người nhận không gỡ được bài của chủ');
  perform t.reset();
end $$;

-- ── 8. Đăng thẳng bài chưa lưu: save + publish = MỘT artifact, MỘT bài; cổng cũ vẫn chạy ──
do $$ declare a uuid; p uuid; n0 bigint := t.n_art(); p0 bigint := t.n_post(); old uuid; begin
  perform t.as_user('A');
  a := public.bms_save_for_share(t.song('Đăng thẳng'));
  p := public.social_publish_tool_artifact(a);
  perform t.reset();
  perform t.ok(t.n_art() = n0 + 1 and t.n_post() = p0 + 1 and t.vis(a) = 'class', '8 đăng thẳng: +1 artifact (class), +1 bài Feed');
  -- RPC cũ của Tool Share/BMS (client cũ) vẫn hoạt động và không đụng artifact mới
  perform t.as_user('B');
  old := public.social_share_tool_result('bms', jsonb_build_object('kind', 'song', 'song', t.song('Đăng bằng đường cũ')), gen_random_uuid());
  perform t.reset();
  perform t.ok(old is not null and t.n_art() = n0 + 2 and t.n_post() = p0 + 2, '8 RPC cũ social_share_tool_result vẫn tạo artifact class + bài Feed (client cũ không hỏng)');
  perform t.as_user('B');
  perform t.ok(public.social_publish_tool_artifact((select (tool_share ->> 'artifact_id')::uuid from public.class_posts where id = old)) = old, '8 publish bài do RPC cũ tạo → trả đúng bài Feed có sẵn (không nhân bản)');
  perform t.reset();
  perform t.ok(t.n_post() = p0 + 2, '8 không thêm bài');
end $$;

-- ── 9. Feed: xoá bài Feed (đường hiện có) → artifact đi cùng (semantics cũ giữ nguyên) ──
do $$ declare a uuid; p uuid; begin
  perform t.as_user('A');
  a := public.bms_save_for_share(t.song('Đăng rồi xoá'));
  p := public.social_publish_tool_artifact(a);
  perform t.reset();
  delete from public.class_posts where id = p;
  perform t.ok(not exists (select 1 from public.tool_artifacts where id = a), '9 xoá bài Feed → trigger xoá artifact (semantics hiện tại, không đổi)');
end $$;

-- ── 10. Rate limit lưu riêng ──
do $$ declare i int; e text; begin
  perform t.as_user('C');
  for i in 1..30 loop perform public.bms_save_for_share(t.song('Bài số ' || i)); end loop;
  e := t.err($q$select public.bms_save_for_share(t.song('Bài số 31'))$q$);
  perform t.ok(e like '54000:%', '10 lưu riêng quá 30 bài/giờ → 54000');
  perform t.ok(public.bms_save_for_share(t.song('Bài số 5')) is not null, '10 lưu lại bài ĐÃ có vẫn được (không đếm bài mới)');
  perform t.reset();
  delete from public.tool_artifacts where owner_id = t.u('C') and visibility = 'shared';
end $$;
