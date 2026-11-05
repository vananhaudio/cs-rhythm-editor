-- ═══ TEST Share Note V1 (db/share_note_v1_setup.sql) ═══
-- Chạy trên cluster PostgreSQL TẠM qua scripts/test-share-note-db.sh. KHÔNG production.
-- A, B: SOLO01.TH01 (có quyền giáo trình) · C: SOLO01.TH02 (không quyền TH01) · T: Thầy · N: ngoài Class.
-- CUR01.TH01: A có quyền, B là thành viên KHÔNG quyền giáo trình.
\set ON_ERROR_STOP on
do $$ begin if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if; end $$;
-- MỘT giao dịch: t.as_user() dùng set_config(..., is_local = true) → role/claims giữ qua các câu lệnh cho tới t.reset()
begin;
create schema t; grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true); end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true); end $$;
create function t.reset() returns void language plpgsql as $$ begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true); end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg; end $$;
create function t.err(q text) returns text language plpgsql as $$ begin execute q; return 'OK'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create table t.ids (k text primary key, v text); grant all on t.ids to authenticated, anon;
create function t.id(p text) returns uuid language sql stable as $$ select v::uuid from t.ids where k = p $$;
create function t.put(p text, v uuid) returns void language sql as $$ insert into t.ids values (p, v::text) on conflict (k) do update set v = excluded.v $$;
-- Ảnh chụp giáo trình + số tin Chat (postgres) — chứng minh chia sẻ KHÔNG chạm asset gốc
create function t.snap() returns text language sql security definer as $$ select md5(string_agg(c::text, '|' order by session_id)) from public.class_lesson_content c $$;
create function t.open(p uuid) returns table(status text, note text, is_author boolean, session_no integer, section_idx integer, score_path text[], bar_from integer, bar_to integer)
  language sql as $$ select o.status, o.note, o.is_author, o.session_no, o.section_idx, o.score_path, o.bar_from, o.bar_to from public.share_note_open(p) o $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Chuẩn bị (postgres): bạn bè A↔B, A↔C, A↔T, B↔C · 3 khối có bản nhạc vào buổi 1 TH01 (chỉ số 5 score · 6 repertoire · 7 layers)
--    + 1 khối score vào CUR01 buổi 1 (A có quyền, B thì không)
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  (t.u('A'), t.u('B'), 'accepted', now()), (t.u('A'), t.u('C'), 'accepted', now()), (t.u('A'), t.u('T'), 'accepted', now()), (t.u('B'), t.u('C'), 'accepted', now())
  on conflict do nothing;
update public.class_lesson_content set blocks = blocks || $j$[
  {"kind":"score","title":"Tình ca","tex":"\\ts 4 4\n:4 c4 d4 e4 f4 | g4 a4 b4 c5 | c5 b4 a4 g4 | f4 e4 d4 c4"},
  {"kind":"repertoire","title":"Tác phẩm","pieces":[{"title":"Bài 1","tex":"\\ts 3 4\n:4 e4 e4 e4 | d4 d4 d4"},{"title":"Bài 2","tex":"\\ts 2 4\n:4 a4 a4 | b4 b4"}]},
  {"kind":"layers","title":"Chồng lớp","layers":[{"label":"L1","what":"giai điệu","tex":"\\ts 4 4\n:1 c4"},{"label":"L2","what":"bass","tex":"\\ts 4 4\n:1 c3"}]}]$j$::jsonb
 where session_id = '51000000-0000-4000-8000-000000000001';
update public.class_lesson_content set blocks = blocks || $j$[{"kind":"score","title":"CUR","tex":"\\ts 4 4\n:4 c4 c4 c4 c4"}]$j$::jsonb
 where session_id = '54000000-0000-4000-8000-000000000001';
select t.put('S1', '51000000-0000-4000-8000-000000000001'), t.put('S4', '51000000-0000-4000-8000-000000000004'),
       t.put('X1', '52000000-0000-4000-8000-000000000001'), t.put('CU', '54000000-0000-4000-8000-000000000001');
create function t.cnt_msgs() returns bigint language sql security definer as $$ select count(*) from public.dm_messages $$;
grant execute on function t.cnt_msgs() to authenticated;
create table t.base as select t.snap() as snap, (select count(*) from public.class_lesson_content) as n;

-- ══ 1. Bề mặt quyền
select t.as_anon();
select t.ok(t.err($q$select public.share_note_create('51000000-0000-4000-8000-000000000001', 5, array['tex'], 1, 1, 'x', 'anon-key-01')$q$) like '42501:%', 'anon không gọi được share_note_create');
select t.ok(t.err($q$select * from public.share_note_open(gen_random_uuid())$q$) like '42501:%', 'anon không gọi được share_note_open');
select t.as_user('A');
select t.ok(t.err('select * from public.share_notes') like '42501:%', 'đăng nhập vẫn KHÔNG đọc thẳng bảng share_notes (chỉ qua RPC)');
select t.ok(t.err($q$select public.share_note_tex('51000000-0000-4000-8000-000000000001', 5, array['tex'])$q$) like '42501:%', 'share_note_tex là hàm nội bộ (không gọi được)');
select t.ok(t.err($q$select public.share_note_score_ok('51000000-0000-4000-8000-000000000001')$q$) like '42501:%', 'share_note_score_ok là hàm nội bộ (không gọi được)');

-- ══ 2. Tạo: neo dựng ở server, sha từ chuỗi alphaTex THẬT, idempotent, kiểm đầu vào
select t.put('N1', public.share_note_create(t.id('S1'), 5, array['tex'], 2, 3, '  Thầy ơi ô 2–3 em bấm chưa tròn tiếng  ', 'note-key-0001'));
select t.ok(public.share_note_create(t.id('S1'), 5, array['tex'], 2, 3, 'khác', 'note-key-0001') = t.id('N1'), 'bấm đúp / thử lại cùng khoá → CÙNG một note');
select t.put('N2', public.share_note_create(t.id('S1'), 6, array['pieces','1','tex'], 1, 2, 'Bài 2 ô 1–2 đếm thế nào?', 'note-key-0002'));
select t.put('N3', public.share_note_create(t.id('S1'), 7, array['layers','1','tex'], 1, 1, 'Lớp bass', 'note-key-0003'));
select t.ok(t.id('N2') is not null and t.id('N3') is not null, 'tạo được neo vào pieces[k].tex và layers[k].tex');
select t.reset();
select t.ok((select n.note from public.share_notes n where n.id = t.id('N1')) = 'Thầy ơi ô 2–3 em bấm chưa tròn tiếng', 'lời nhắn được cắt khoảng trắng hai đầu');
select t.ok((select n.tex_sha = encode(sha256(convert_to((c.blocks -> 5) ->> 'tex', 'UTF8')), 'hex') from public.share_notes n, public.class_lesson_content c
              where n.id = t.id('N1') and c.session_id = n.session_id), 'tex_sha = sha256 của CHÍNH chuỗi alphaTex (server tính)');
select t.ok((select max(octet_length(n::text)) < 1024 from public.share_notes n), 'mỗi tham chiếu < 1 KB (không chứa nội dung nhạc)');
select t.ok((select bool_and(position('\ts' in n::text) = 0) from public.share_notes n), 'hàng share_notes KHÔNG chứa alphaTex');
select t.as_user('A');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['blocks','0','tex'], 1, 1, 'x', 'bad-path-001')$q$) like '22023:%', 'đường dẫn ngoài danh sách cho phép → từ chối');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 6, array['pieces','x','tex'], 1, 1, 'x', 'bad-path-002')$q$) like '22023:%', 'chỉ số pieces không phải số → từ chối');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 0, 1, 'x', 'bad-bars-001')$q$) like '22023:%', 'ô 0 → từ chối (ô đánh số từ 1)');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 3, 2, 'x', 'bad-bars-002')$q$) like '22023:%', 'dải ngược → từ chối');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 1, 65, 'x', 'bad-bars-003')$q$) like '22023:%', 'dải > 64 ô → từ chối');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 1, 1, '   ', 'bad-note-001')$q$) like '22023:%', 'lời nhắn rỗng → từ chối');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 1, 1, repeat('a', 501), 'bad-note-002')$q$) like '22023:%', 'lời nhắn 501 ký tự → từ chối');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 1, 1, 'x', 'short')$q$) like '22023:%', 'khoá chống trùng quá ngắn → từ chối');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 0, array['tex'], 1, 1, 'x', 'no-score-001')$q$) = '22023:Nội dung này không thể chia sẻ', 'khối KHÔNG có bản nhạc → thông báo chung');
select t.ok(t.err($q$select public.share_note_create(t.id('S4'), 0, array['tex'], 1, 1, 'x', 'draft-00001')$q$) = '22023:Nội dung này không thể chia sẻ', 'buổi NHÁP → thông báo chung');
select t.ok(t.err($q$select public.share_note_create(t.id('X1'), 0, array['tex'], 1, 1, 'x', 'other-cls-01')$q$) = '22023:Nội dung này không thể chia sẻ', 'lớp KHÔNG có quyền giáo trình → CÙNG thông báo chung (không lộ)');
select t.ok(t.err($q$select public.share_note_create(gen_random_uuid(), 0, array['tex'], 1, 1, 'x', 'no-sess-001')$q$) = '22023:Nội dung này không thể chia sẻ', 'buổi không tồn tại → CÙNG thông báo chung');
select t.as_user('N');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 1, 1, 'x', 'outsider-01')$q$) like '42501:%', 'người ngoài Class không tạo được');
select t.as_user('C');
select t.ok(t.err($q$select public.share_note_create(t.id('S1'), 5, array['tex'], 1, 1, 'x', 'c-no-acc-01')$q$) = '22023:Nội dung này không thể chia sẻ', 'thành viên lớp khác (không quyền giáo trình TH01) không tạo được');
select t.as_user('B');
select t.ok(t.err($q$select public.share_note_create(t.id('CU'), 2, array['tex'], 1, 1, 'x', 'b-cur-00001')$q$) = '22023:Nội dung này không thể chia sẻ', 'thành viên KHÔNG có quyền giáo trình (CUR01) không tạo được');
select t.as_user('T');
select t.put('NT', public.share_note_create(t.id('S1'), 5, array['tex'], 4, 4, 'Thầy đánh dấu ô 4', 'teacher-0001'));
select t.ok(t.id('NT') is not null, 'Thầy tạo được (mọi lớp)');

-- ══ 3. THẤY & MỞ — qua Chat
select t.as_user('B');
select t.ok((select count(*) from t.open(t.id('N1'))) = 0, 'B CHƯA được gửi → 0 hàng (không lộ)');
select t.ok((select count(*) from public.share_note_card(array[t.id('N1')])) = 0, 'B CHƯA được gửi → thẻ 0 hàng');
-- tin GIẢ: B tự chèn tham chiếu note của A vào hội thoại B–C (không phải tác giả) → C vẫn KHÔNG thấy
select t.reset();
do $$ declare cid uuid; begin
  insert into public.dm_conversations (user_lo, user_hi, last_seq, last_message_at) values (least(t.u('B'), t.u('C')), greatest(t.u('B'), t.u('C')), 1, now()) returning id into cid;
  insert into public.dm_participants (conversation_id, user_id, last_read_seq) values (cid, t.u('B'), 1), (cid, t.u('C'), 0);
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body, ref_type, ref_key) values (cid, 1, 'user', t.u('B'), 'Đã chia sẻ một nội dung', 'share_note', t.id('N1')::text);
end $$;
select t.as_user('C');
select t.ok((select count(*) from t.open(t.id('N1'))) = 0, 'tin share_note GIẢ (không do tác giả gửi) KHÔNG cấp quyền thấy');
select t.as_user('B');
select t.ok(t.err($q$select public.dm_share(t.u('C'), 'share_note', t.id('N1')::text)$q$) = '22023:Nội dung này không thể chia sẻ', 'người KHÔNG phải tác giả không chuyển tiếp được (dm_share)');
select t.as_user('A');
select t.ok((select count(*) from public.dm_share(t.u('B'), 'share_note', t.id('N1')::text)) = 1, 'A (tác giả) gửi note cho B qua Chat');
select t.ok((select count(*) from public.dm_share(t.u('C'), 'share_note', t.id('N1')::text)) = 1, 'A gửi note cho C (lớp khác)');
select t.ok((select count(*) from public.dm_share(t.u('T'), 'share_note', t.id('N1')::text)) = 1, 'A gửi note cho Thầy (là bạn)');
select t.ok(t.err($q$select public.dm_share(t.u('N'), 'share_note', t.id('N1')::text)$q$) like '42501:%', 'không gửi được cho người ngoài Class (dm_rule)');
select t.ok(t.err($q$select public.dm_share(t.u('B'), 'share_note', gen_random_uuid()::text)$q$) = '22023:Nội dung này không thể chia sẻ', 'note không tồn tại → từ chối chung');
select t.as_user('B');
select t.ok((select status = 'ok' and bar_from = 2 and bar_to = 3 and section_idx = 5 and score_path = array['tex'] and not is_author and session_no = 1 from t.open(t.id('N1'))),
            'B (cùng lớp, có quyền) mở: ok + đúng khối/đường dẫn/ô 2–3');
select t.ok((select count(*) = 1 and bool_and(note like 'Thầy ơi%' and bar_from = 2 and session_no = 1) from public.share_note_card(array[t.id('N1')])), 'B thấy thẻ (lời nhắn, buổi, ô)');
select t.as_user('C');
select t.ok((select status = 'no_access' and note like 'Thầy ơi%' and bar_from is null and score_path is null and section_idx is null from t.open(t.id('N1'))),
            'C (lớp khác) THẤY câu hỏi nhưng no_access: KHÔNG trả khối/đường dẫn/ô');
select t.as_user('T');
select t.ok((select status = 'ok' and bar_from = 2 from t.open(t.id('N1'))), 'Thầy mở được (ok)');
select t.as_user('A');
select t.ok((select status = 'ok' and is_author from t.open(t.id('N1'))), 'tác giả mở được (is_author)');
select t.ok((select count(*) from t.open(t.id('N2'))) = 1 and (select score_path = array['pieces','1','tex'] from t.open(t.id('N2'))), 'tác giả mở note chưa gửi ai (N2)');
select t.as_user('N');
select t.ok((select count(*) from t.open(t.id('N1'))) = 0, 'người ngoài Class: 0 hàng');
-- regression dm_share các loại cũ
select t.as_user('A');
select t.ok((select count(*) from public.dm_share(t.u('B'), 'class_session', t.id('S1')::text)) = 1, 'HỒI QUY: dm_share class_session vẫn chạy');
select t.ok(t.err($q$select public.dm_share(t.u('B'), 'unknown_type', t.id('N1')::text)$q$) = '22023:Nội dung này không thể chia sẻ', 'HỒI QUY: loại lạ vẫn bị từ chối');

-- ══ 4. Feed: chỉ tác giả, một bài mỗi note, payload không chứa nội dung giáo án
select t.as_user('B');
select t.ok(t.err($q$select public.social_share_share_note(t.id('N2'))$q$) like '22023:%', 'không phải tác giả không đăng Feed được');
select t.as_user('A');
select t.put('P2', public.social_share_share_note(t.id('N2')));
select t.ok(public.social_share_share_note(t.id('N2')) = t.id('P2'), 'đăng lại cùng note → CÙNG một bài (không trùng)');
select t.reset();
select t.ok((select type = 'tool_share' and audience = 'class' and tool_share ->> 'tool' = 'share_note' and tool_share ->> 'note_id' = t.id('N2')::text
                    and (tool_share ->> 'bar_from')::int = 1 and position('\ts' in tool_share::text) = 0 and pg_column_size(tool_share) <= 2048
               from public.class_posts where id = t.id('P2')), 'bài Feed: tool_share/share_note, chỉ tham chiếu + lời nhắn + ô, KHÔNG alphaTex');
select t.as_user('B');
select t.ok((select status = 'ok' and bar_from = 1 and bar_to = 2 from t.open(t.id('N2'))), 'Feed: B (có quyền) mở N2 đúng ô 1–2 dù KHÔNG nhận qua Chat');
select t.as_user('C');
select t.ok((select status = 'no_access' and bar_from is null from t.open(t.id('N2'))), 'Feed: C (lớp khác) thấy câu hỏi, no_access');
select t.as_user('N');
select t.ok((select count(*) from t.open(t.id('N2'))) = 0, 'Feed: người ngoài Class 0 hàng');
select t.as_user('B');
select t.ok((select count(*) from t.open(t.id('N3'))) = 0, 'N3 chưa gửi/đăng → B không thấy');

-- ══ 5. Bản nhạc đổi → stale (KHÔNG trả ô) · đổi chữ trong khối KHÔNG làm stale · thu hồi quyền → no_access
select t.reset();
update public.class_lesson_content set blocks = jsonb_set(blocks, '{6,title}', '"Tác phẩm (đổi tên)"') where session_id = t.id('S1');
select t.as_user('B');
select t.ok((select status = 'ok' from t.open(t.id('N2'))), 'đổi TIÊU ĐỀ khối (không đổi bản nhạc) → vẫn ok');
select t.reset();
update public.class_lesson_content set blocks = jsonb_set(blocks, '{5,tex}', to_jsonb(((blocks -> 5) ->> 'tex') || ' | c4 c4 c4 c4')) where session_id = t.id('S1');
select t.as_user('B');
select t.ok((select status = 'stale' and note like 'Thầy ơi%' and bar_from is null and score_path is null from t.open(t.id('N1'))), 'bản nhạc ĐỔI → stale, giữ câu hỏi, KHÔNG trả ô/đường dẫn');
select t.as_user('A');
select t.ok((select status = 'stale' from t.open(t.id('N1'))), 'tác giả cũng thấy stale');
select t.ok((select status = 'ok' from t.open(t.id('N2'))), 'note ở bản nhạc KHÁC trong cùng buổi vẫn ok');
select t.ok(t.err($q$select public.dm_share(t.u('B'), 'share_note', t.id('N1')::text)$q$) = 'OK', 'note stale vẫn gửi lại được (câu hỏi giữ lịch sử)');
select t.reset();
update public.class_lesson_content set blocks = blocks - 7 where session_id = t.id('S1');
select t.as_user('A');
select t.ok((select status = 'stale' from t.open(t.id('N3'))), 'khối bản nhạc bị XOÁ → stale');
select t.reset();
update public.class_curriculum_access set status = 'revoked' where class_id = 'b1000000-0000-4000-8000-000000000001' and user_id = t.u('B');
select t.as_user('B');
select t.ok((select status = 'no_access' and bar_from is null from t.open(t.id('N2'))), 'B bị THU HỒI quyền giáo trình → no_access');
select t.reset();
update public.class_curriculum_access set status = 'active' where class_id = 'b1000000-0000-4000-8000-000000000001' and user_id = t.u('B');
update public.class_lesson_content set status = 'draft' where session_id = t.id('S1');
select t.as_user('B');
select t.ok((select status = 'no_access' from t.open(t.id('N2'))), 'buổi chuyển về NHÁP → học viên no_access');
select t.as_user('T');
select t.ok((select status = 'stale' from t.open(t.id('N2'))), 'buổi nháp → Thầy thấy stale (không tô từ bản chưa xuất bản)');
select t.reset();
update public.class_lesson_content set status = 'published' where session_id = t.id('S1');

-- ══ 6. Giới hạn tốc độ
select t.as_user('A');
do $$ declare i int; begin for i in 1..20 loop perform public.share_note_create(t.id('S1'), 6, array['pieces','0','tex'], 1, 1, 'tốc độ ' || i, 'rate-key-' || lpad(i::text, 4, '0')); end loop;
  raise exception 'FAIL: không chặn tốc độ';
exception when others then if sqlstate = '54000' then raise notice 'PASS: quá 10 note/phút → 54000'; else raise; end if; end $$;

-- ══ 7. Gỡ: chỉ tác giả; xoá mềm + gỡ bài Feed; tin Chat còn; giáo trình không đổi
select t.as_user('B');
select t.ok(public.share_note_delete(t.id('N2')) = false, 'B không gỡ được note của A');
select t.as_user('A');
select t.reset(); create temp table m0 as select t.cnt_msgs() as n; select t.as_user('A');
select t.ok(public.share_note_delete(t.id('N2')) = true, 'A gỡ note N2');
select t.ok(public.share_note_delete(t.id('N2')) = false, 'gỡ lần 2 → false (idempotent)');
select t.reset();
select t.ok((select count(*) from public.class_posts where id = t.id('P2')) = 0, 'gỡ note → bài Feed của chính tác giả bị gỡ');
select t.ok((select deleted_at is not null from public.share_notes where id = t.id('N2')), 'note xoá MỀM (hàng còn, deleted_at)');
select t.ok(t.cnt_msgs() = (select n from m0), 'tin Chat KHÔNG bị xoá');
select t.as_user('B');
select t.ok((select count(*) from t.open(t.id('N2'))) = 0 and (select count(*) from public.share_note_card(array[t.id('N2')])) = 0, 'sau khi gỡ: B mở/thẻ 0 hàng (không khả dụng)');
select t.as_user('A');
select t.ok(t.err($q$select public.dm_share(t.u('B'), 'share_note', t.id('N2')::text)$q$) = '22023:Nội dung này không thể chia sẻ', 'note đã gỡ không gửi lại được');
select t.ok(t.err($q$select public.social_share_share_note(t.id('N2'))$q$) like '22023:%', 'note đã gỡ không đăng Feed được');

-- ══ 8. Không nhân đôi asset: giáo trình chỉ đổi do CHÍNH test sửa (Thầy), chia sẻ không chạm
select t.reset();
select t.ok((select count(*) from public.class_lesson_content) = (select n from t.base), 'số hàng giáo trình không đổi (chia sẻ không tạo bản sao)');
select t.ok(not exists (select 1 from public.share_notes n where pg_column_size(n.*) > 1024), 'mọi tham chiếu ≤ 1 KB');
do $$ begin raise notice 'PASS: kết thúc test Share Note V1'; end $$;
commit;
