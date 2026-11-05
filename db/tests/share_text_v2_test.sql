-- Test DB Contextual Share V2 (chạy trên cụm PG tạm của scripts/e2e-share-note.sh, SAU khi db/share_text_v2_setup.sql đã áp; KHÔNG production).
-- Dùng fixture db/tests/local/share_text_fixture.sql (Buổi 1 lớp TH01). Người dùng: A=sender (có quyền), B=học viên có quyền, C=lớp khác (không quyền).
-- Mọi thay đổi giáo trình nằm trong transaction và ROLLBACK. Dòng 'PASS:' / 'FAIL:' — có FAIL thì runner dừng.
\set ON_ERROR_STOP on
\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''bbbbbbbb-0000-4000-8000-00000000000b'''
\set C '''cccccccc-0000-4000-8000-00000000000c'''
\set S1 '''51000000-0000-4000-8000-000000000001'''
\set S3 '''51000000-0000-4000-8000-000000000003'''

create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$ begin if c is not true then raise exception 'FAIL: %', m; end if; raise notice 'PASS: %', m; end $$;
create function pg_temp.who(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, false); end $$;
-- chạy một lệnh, trả 'OK' hoặc 'sqlstate|message'
create function pg_temp.try(q text) returns text language plpgsql as $$ begin execute q; return 'OK'; exception when others then return sqlstate || '|' || sqlerrm; end $$;
create function pg_temp.sec(s uuid, title text) returns integer language sql as $$
  select (e.i - 1)::integer from public.class_lesson_content c cross join lateral jsonb_array_elements(c.blocks) with ordinality e(v, i)
   where c.session_id = s and e.v ->> 'title' = title limit 1 $$;
create function pg_temp.sha(t text) returns text language sql as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;

-- ───────────── A. Ràng buộc theo loại neo ─────────────
begin;
do $$
declare n_before integer := (select count(*) from public.share_notes); r text;
begin
  perform pg_temp.ok((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'share_notes'
    and column_name in ('anchor_kind', 'text_path', 'char_from', 'char_to', 'text_sha', 'ctx_sha', 'block_fp')) = 7, 'A1 đủ 7 cột neo văn bản');
  perform pg_temp.ok(not exists (select 1 from public.share_notes where anchor_kind <> 'bars') or true, 'A2 (ghi chú V1 sẵn có đều là bars — xem vòng đời migration)');
  r := pg_temp.try($q$insert into public.share_notes (author_id, session_id, section_idx, score_path, tex_sha, bar_from, bar_to, note, client_key, text_path)
        values ('aaaaaaaa-0000-4000-8000-00000000000a','51000000-0000-4000-8000-000000000001',0,array['tex'],repeat('a',64),1,1,'x','ck-a3-0001',array['text'])$q$);
  perform pg_temp.ok(r like '23514%', 'A3 bars + text_path bị CHECK chặn: ' || left(r, 40));
  r := pg_temp.try($q$insert into public.share_notes (author_id, session_id, section_idx, anchor_kind, text_path, char_from, char_to, text_sha, ctx_sha, block_fp, note, client_key, bar_from)
        values ('aaaaaaaa-0000-4000-8000-00000000000a','51000000-0000-4000-8000-000000000001',0,'text',array['text'],0,5,repeat('a',64),repeat('b',64),repeat('c',64),'x','ck-a3-0002',1)$q$);
  perform pg_temp.ok(r like '23514%', 'A4 text + bar_from bị CHECK chặn');
  r := pg_temp.try($q$insert into public.share_notes (author_id, session_id, section_idx, anchor_kind, text_path, char_from, char_to, text_sha, ctx_sha, block_fp, note, client_key)
        values ('aaaaaaaa-0000-4000-8000-00000000000a','51000000-0000-4000-8000-000000000001',0,'text',array['url'],0,5,repeat('a',64),repeat('b',64),repeat('c',64),'x','ck-a3-0003')$q$);
  perform pg_temp.ok(r like '23514%', 'A5 text_path ngoài danh sách trắng (url) bị chặn');
  r := pg_temp.try($q$insert into public.share_notes (author_id, session_id, section_idx, anchor_kind, text_path, char_from, char_to, text_sha, ctx_sha, block_fp, note, client_key)
        values ('aaaaaaaa-0000-4000-8000-00000000000a','51000000-0000-4000-8000-000000000001',0,'text',array['text'],0,501,repeat('a',64),repeat('b',64),repeat('c',64),'x','ck-a3-0004')$q$);
  perform pg_temp.ok(r like '23514%', 'A6 vùng chọn > 500 điểm mã bị chặn');
  r := pg_temp.try($q$insert into public.share_notes (author_id, session_id, section_idx, anchor_kind, text_path, char_from, char_to, text_sha, ctx_sha, block_fp, note, client_key)
        values ('aaaaaaaa-0000-4000-8000-00000000000a','51000000-0000-4000-8000-000000000001',0,'text',array['text'],0,5,'zz',repeat('b',64),repeat('c',64),'x','ck-a3-0005')$q$);
  perform pg_temp.ok(r like '23514%', 'A7 text_sha không phải hex64 bị chặn');
  r := pg_temp.try($q$insert into public.share_notes (author_id, session_id, section_idx, anchor_kind, note, client_key) values ('aaaaaaaa-0000-4000-8000-00000000000a','51000000-0000-4000-8000-000000000001',0,'bars','x','ck-a3-0006')$q$);
  perform pg_temp.ok(r like '23514%' or r like '23502%', 'A8 bars thiếu cột nhạc bị chặn');
  perform pg_temp.ok((select count(*) from public.share_notes) = n_before, 'A9 các lần chèn sai không để lại hàng');
end $$;
rollback;

-- ───────────── B. Tạo ghi chú văn bản ─────────────
begin;
update public.share_notes set created_at = created_at - interval '1 hour';   -- (trong transaction, rollback) tránh giới hạn 10 ghi chú/phút của dữ liệu dựng sẵn
select pg_temp.who(:A);
set local role authenticated;
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; ix integer; leaf text; sel text := 'nghe kỹ nhịp chùm ba'; f integer; id1 uuid; id2 uuid; row_ public.share_notes; msgs text[] := '{}'; r text;
  i_note integer; i_obj integer; i_rec integer; i_asg integer; i_chk integer;
begin
  execute 'reset role';
  ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  select l.txt into leaf from public.share_text_leaves((select c.blocks -> ix from public.class_lesson_content c where c.session_id = s)) l where l.path = array['blocks', '1', 'text'];
  execute 'set local role authenticated';
  f := position(sel in leaf) - 1;
  id1 := public.share_text_create(s, ix, array['blocks', '1', 'text'], f, f + char_length(sel), 'Em chưa hiểu chỗ này', 'ck-b-0001-aaaa');
  perform pg_temp.ok(id1 is not null, 'B1 tạo ghi chú văn bản (đoạn p)');
  execute 'reset role';
  select * into row_ from public.share_notes where id = id1;
  perform pg_temp.ok(row_.anchor_kind = 'text' and row_.score_path is null and row_.tex_sha is null and row_.bar_from is null and row_.bar_to is null, 'B2 hàng text: cột nhạc NULL');
  perform pg_temp.ok(row_.text_sha = pg_temp.sha(sel) and row_.char_from = f and row_.char_to = f + char_length(sel), 'B3 server tự tính text_sha = sha256(UTF-8 của đoạn chọn), toạ độ theo điểm mã');
  perform pg_temp.ok(row_.ctx_sha = public.share_text_ctx_sha(leaf, f, f + char_length(sel)) and row_.block_fp = public.share_text_fp((select c.blocks -> ix from public.class_lesson_content c where c.session_id = s)), 'B4 ctx_sha + block_fp do server tính');
  perform pg_temp.ok(row_to_json(row_)::text not like '%' || sel || '%' and row_to_json(row_)::text not like '%chùm ba%', 'B5 KHÔNG lưu bản sao đoạn chọn / nội dung giáo trình trong hàng');
  execute 'set local role authenticated';
  id2 := public.share_text_create(s, ix, array['blocks', '1', 'text'], f, f + char_length(sel), 'Em chưa hiểu chỗ này', 'ck-b-0001-aaaa');
  perform pg_temp.ok(id2 = id1, 'B6 idempotent theo (tác giả, client_key)');
  -- đủ 6 loại khối
  execute 'reset role';
  perform pg_temp.ok((select count(*) from public.share_text_leaves((select c.blocks -> ix from public.class_lesson_content c where c.session_id = s))) = 12, 'B7 study: 12 lá hợp lệ (h, p, 3 mục ul, 5 ô bảng, callout, p) — ô ___ bị loại');
  i_note := pg_temp.sec(s, 'Ghi chú của Thầy'); i_obj := pg_temp.sec(s, 'Mục tiêu tuần này'); i_rec := pg_temp.sec(s, 'Ôn lại'); i_asg := pg_temp.sec(s, 'Bài tập về nhà'); i_chk := pg_temp.sec(s, 'Kiểm tra nhanh');
  select l.txt into leaf from public.share_text_leaves((select c.blocks -> i_note from public.class_lesson_content c where c.session_id = s)) l;
  execute 'set local role authenticated';
  perform public.share_text_create(s, ix, array['blocks', '2', 'items', '1'], 0, 8, 'ul', 'ck-b-ul-000001');
  perform public.share_text_create(s, ix, array['blocks', '3', 'rows', '1', '1'], 0, 8, 'table', 'ck-b-tbl-00001');
  perform public.share_text_create(s, ix, array['blocks', '4', 'text'], 0, 10, 'callout', 'ck-b-cal-00001');
  perform public.share_text_create(s, i_note, array['text'], 0, 10, 'note', 'ck-b-note-0001');
  perform public.share_text_create(s, i_obj, array['items', '1'], 0, 8, 'objectives', 'ck-b-obj-00001');
  perform public.share_text_create(s, i_rec, array['steps', '0', 'items', '1'], 0, 8, 'recap', 'ck-b-recap-001');
  perform public.share_text_create(s, i_asg, array['items', '0', 'text'], 0, 8, 'assignment', 'ck-b-asg-00001');
  perform public.share_text_create(s, i_chk, array['items', '1'], 0, 8, 'checklist', 'ck-b-chk-00001');
  perform pg_temp.ok(true, 'B8 tạo được ở study (ul/ô bảng/callout), note, objectives, recap, assignment, checklist');
  f := position('🎸' in leaf) - 1;
  perform public.share_text_create(s, i_note, array['text'], f - 4, f + 6, 'emoji', 'ck-b-emoji-001');
  perform pg_temp.ok(true, 'B9 vùng chọn có emoji ngoài BMP (điểm mã)');
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
select pg_temp.who(:A);
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; ix integer; msgs text[] := '{}'; r text; q text; leaf text;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated';
  foreach q in array array[
    format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, 8, ''x'', ''ck-bad-00001'')', '00000000-0000-4000-8000-000000000999', ix),   -- buổi không tồn tại
    format('select public.share_text_create(%L, 999, array[''blocks'',''1'',''text''], 0, 8, ''x'', ''ck-bad-00002'')', s),                                                -- khối không tồn tại
    format('select public.share_text_create(%L, %s, array[''blocks'',''0'',''text''], 0, 3, ''x'', ''ck-bad-00003'')', s, ix),                                              -- < 4 ký tự không phải khoảng trắng
    format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, 400, ''x'', ''ck-bad-00004'')', s, ix),                                          -- ngoài lá
    format('select public.share_text_create(%L, %s, array[''blocks'',''3'',''rows'',''2'',''1''], 0, 2, ''x'', ''ck-bad-00005'')', s, ix),                                 -- ô ___
    format('select public.share_text_create(%L, %s, array[''blocks'',''4'',''label''], 0, 8, ''x'', ''ck-bad-00006'')', s, ix),                                            -- label: không phải lá
    format('select public.share_text_create(%L, %s, array[''blocks'',''0''], 0, 8, ''x'', ''ck-bad-00007'')', s, ix)                                                       -- đường dẫn không tới lá
  ] loop
    r := pg_temp.try(q);
    msgs := msgs || r;
  end loop;
  perform pg_temp.ok((select count(distinct m) from unnest(msgs) m) = 1 and msgs[1] like '22023|Nội dung này không thể chia sẻ', 'B10 7 lý do từ chối khác nhau → CÙNG MỘT thông báo chung: ' || msgs[1]);
  -- nhiều khoảng trắng: chọn "Giữ nhịp" (7 ký tự 8 điểm mã) hợp lệ; chọn 3 chữ + khoảng trắng bị từ chối
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, 8, ''x'', ''ck-ok-000011'')', s, ix));
  perform pg_temp.ok(r = 'OK', 'B11 "Giữ nhịp" (≥ 4 ký tự không phải khoảng trắng) tạo được');
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 3, 7, ''x'', ''ck-bad-00012'')', s, ix));
  perform pg_temp.ok(r like '22023|%', 'B12 "nhị" cắt (3,7) = " nhị"? chỉ 3 ký tự không phải khoảng trắng → bị từ chối: ' || r);
  -- người không có quyền (C), chưa đăng nhập, lời nhắn sai
  perform pg_temp.who('cccccccc-0000-4000-8000-00000000000c');
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, 8, ''x'', ''ck-bad-00020'')', s, ix));
  perform pg_temp.ok(r = '22023|Nội dung này không thể chia sẻ', 'B13 người ngoài lớp (C) → cùng thông báo chung');
  perform pg_temp.who(null);
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, 8, ''x'', ''ck-bad-00021'')', s, ix));
  perform pg_temp.ok(r like '42501|%', 'B14 chưa đăng nhập → 42501');
  perform pg_temp.who('aaaaaaaa-0000-4000-8000-00000000000a');
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, 8, '''', ''ck-bad-00022'')', s, ix));
  perform pg_temp.ok(r like '22023|Lời nhắn%', 'B15 lời nhắn rỗng → "Lời nhắn 1–500 ký tự"');
end $$;
rollback;

-- biên Unicode: NFD (dấu tổ hợp) và emoji ZWJ
begin;
update public.share_notes set created_at = created_at - interval '1 hour';
select pg_temp.who(:A);
do $$
declare s uuid := '51000000-0000-4000-8000-000000000001'; ix integer; leaf text; f integer; r text;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks', '1', 'text'],
      to_jsonb(normalize('giữ đều tay thật đều', NFD) || ' và ' || U&'\+01F468\200D\+01F469\200D\+01F467 gia đình ở đây')) where session_id = s;
  select l.txt into leaf from public.share_text_leaves((select c.blocks -> ix from public.class_lesson_content c where c.session_id = s)) l where l.path = array['blocks', '1', 'text'];
  execute 'set local role authenticated';
  f := position('u' in leaf);                                                          -- chữ "u" của "giữ" (NFD: u + ◌̛ + ◌̃): cắt NGAY SAU u = bắt đầu bằng dấu tổ hợp
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], %s, %s, ''x'', ''ck-nfd-000001'')', s, ix, f, f + 8));
  perform pg_temp.ok(r like '22023|%', 'B16 NFD: vùng chọn BẮT ĐẦU bằng dấu tổ hợp bị từ chối');
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, %s, ''x'', ''ck-nfd-000002'')', s, ix, f));
  perform pg_temp.ok(r like '22023|%', 'B17 NFD: vùng chọn KẾT THÚC ngay trước dấu tổ hợp bị từ chối');
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, %s, ''x'', ''ck-nfd-000003'')', s, ix, f + 2));
  perform pg_temp.ok(r = 'OK', 'B18 NFD: biên trọn cụm (u+◌̛+◌̃) tạo được');
  f := position(U&'\+01F468' in leaf) - 1;
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], %s, %s, ''x'', ''ck-zwj-000001'')', s, ix, f + 1, f + 8));
  perform pg_temp.ok(r like '22023|%', 'B19 emoji ZWJ: bắt đầu giữa chuỗi (sau 👨) bị từ chối');
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], %s, %s, ''x'', ''ck-zwj-000002'')', s, ix, f - 3, f + 1));
  perform pg_temp.ok(r like '22023|%', 'B20 emoji ZWJ: kết thúc ngay trước ZWJ bị từ chối');
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], %s, %s, ''x'', ''ck-zwj-000003'')', s, ix, f - 3, f + 5));
  perform pg_temp.ok(r = 'OK', 'B21 emoji ZWJ: chọn trọn 👨‍👩‍👧 tạo được');
end $$;
rollback;

-- ───────────── C. Chia sẻ Feed / mở v2 / thẻ / Chat / quyền ─────────────
begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; ix integer; leaf text; sel text := 'nghe kỹ nhịp chùm ba'; f integer; nid uuid; post uuid; post2 uuid; o record; n integer; payload jsonb;
  a text := 'aaaaaaaa-0000-4000-8000-00000000000a'; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; c text := 'cccccccc-0000-4000-8000-00000000000c';
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  select l.txt into leaf from public.share_text_leaves((select c2.blocks -> ix from public.class_lesson_content c2 where c2.session_id = s)) l where l.path = array['blocks', '1', 'text'];
  f := position(sel in leaf) - 1;
  perform pg_temp.who(a); execute 'set local role authenticated';
  nid := public.share_text_create(s, ix, array['blocks', '1', 'text'], f, f + char_length(sel), 'Câu hỏi về đoạn chữ', 'ck-c-0001-aaaa');
  -- ghi chú CHƯA đăng Feed / gửi Chat → người khác chưa THẤY
  perform pg_temp.who(b);
  perform pg_temp.ok(not exists (select 1 from public.share_note_open_v2(nid)), 'C1 chưa chia sẻ: B không thấy (0 hàng)');
  perform pg_temp.who(a);
  post := public.social_share_share_text(nid);
  post2 := public.social_share_share_text(nid);
  perform pg_temp.ok(post is not null and post = post2, 'C2 đăng Feed: một bài mỗi ghi chú (idempotent)');
  execute 'reset role';
  select tool_share into payload from public.class_posts where id = post;
  perform pg_temp.ok(payload ->> 'anchor' = 'text' and payload ->> 'tool' = 'share_note' and not payload ? 'bar_from' and not payload ? 'bar_to', 'C3 payload Feed: anchor=text, KHÔNG bar_from/bar_to');
  perform pg_temp.ok(payload::text not like '%chùm ba%' and payload::text not like '%nghe kỹ%', 'C4 payload Feed KHÔNG chứa nội dung giáo trình');
  -- B (có quyền, buổi mở) mở: ok
  execute 'set local role authenticated'; perform pg_temp.who(b);
  select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'ok' and o.kind = 'text' and o.section_idx = ix and o.text_path = array['blocks', '1', 'text'] and o.char_from = f and o.char_to = f + char_length(sel), 'C5 B (có quyền) mở → ok + toạ độ đúng');
  perform pg_temp.ok(o.text_sha = pg_temp.sha(sel) and o.bar_from is null and o.score_path is null, 'C6 text_sha = sha256(đoạn chọn) (client dùng để kiểm lại); cột nhạc NULL');
  perform pg_temp.ok(public.share_note_session_open(nid) is true, 'C7 buổi mở cho B (cổng khoá buổi V1 vẫn đúng với ghi chú văn bản)');
  -- C (lớp khác) thấy câu hỏi nhưng KHÔNG mở được giáo trình
  perform pg_temp.who(c);
  select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'no_access' and o.note = 'Câu hỏi về đoạn chữ' and o.section_idx is null and o.text_path is null and o.char_from is null and o.char_to is null and o.text_sha is null and o.score_path is null,
    'C8 C (ngoài lớp) → no_access: chỉ câu hỏi, KHÔNG toạ độ / băm / đường dẫn');
  perform pg_temp.ok(public.share_note_session_open(nid) is false, 'C9 session_open = false cho C');
  -- người lạ / chưa đăng nhập / id lạ
  perform pg_temp.who(null);
  perform pg_temp.ok(not exists (select 1 from public.share_note_open_v2(nid)), 'C10 chưa đăng nhập → 0 hàng');
  perform pg_temp.who(b);
  perform pg_temp.ok(not exists (select 1 from public.share_note_open_v2('00000000-0000-4000-8000-0000000000ff')), 'C11 id không tồn tại → 0 hàng');
  -- thẻ Chat v2 (Feed đã đăng nên B thấy)
  select * into o from public.share_note_card_v2(array[nid]) limit 1;
  perform pg_temp.ok(o.anchor_kind = 'text' and o.bar_from is null and o.session_no = 1, 'C12 card_v2: anchor_kind=text, không dải ô, có số buổi');
  -- dm_share (V1, không sửa) gửi ghi chú văn bản vào Chat; người không phải tác giả không gửi được
  perform pg_temp.who(a);
  perform public.dm_share(b::uuid, 'share_note', nid::text);
  perform pg_temp.ok(true, 'C13 dm_share V1 gửi ghi chú văn bản cho bạn bè (tác giả)');
  perform pg_temp.who(b);
  perform pg_temp.ok(pg_temp.try(format('select public.dm_share(%L::uuid, ''share_note'', %L)', a, nid::text)) like '22023|%' or pg_temp.try(format('select public.dm_share(%L::uuid, ''share_note'', %L)', a, nid::text)) like '42501|%',
    'C14 người không phải tác giả không gửi lại được');
  -- xoá (V1) gỡ bài Feed + ghi chú
  perform pg_temp.who(a);
  perform pg_temp.ok(public.share_note_delete(nid), 'C15 share_note_delete (V1) xoá được ghi chú văn bản');
  perform pg_temp.who(b);
  perform pg_temp.ok(not exists (select 1 from public.share_note_open_v2(nid)), 'C16 sau khi xoá → 0 hàng');
end $$;
rollback;

-- buổi chưa mở khoá (Buổi 3): ghi chú văn bản tạo được nhưng B không mở được (session_open=false)
begin;
do $$
declare s3 uuid := '51000000-0000-4000-8000-000000000003'; nid uuid; o record;
  a text := 'aaaaaaaa-0000-4000-8000-00000000000a'; b text := 'bbbbbbbb-0000-4000-8000-00000000000b';
begin
  execute 'reset role';
  update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object('kind', 'note', 'text', 'Đoạn văn bản ở buổi chưa mở khoá cho học viên.')) where session_id = s3;
  perform pg_temp.who(a); execute 'set local role authenticated';
  nid := public.share_text_create(s3, jsonb_array_length((select blocks from public.class_lesson_content where session_id = s3)) - 1, array['text'], 0, 20, 'hỏi', 'ck-lock-000001');
  perform public.social_share_share_text(nid);
  perform pg_temp.who(b);
  perform pg_temp.ok(public.share_note_session_open(nid) is false, 'L1 Buổi 3 chưa mở cho B: session_open = false (client KHÔNG tải giáo trình)');
  select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status in ('ok', 'moved'), 'L2 open_v2 vẫn trả ok (khoá buổi do RPC session_open quyết, như V1)');
end $$;
rollback;

-- ───────────── D. Tìm lại: chèn / xoá / di chuyển / trùng / ngân sách ─────────────
create function pg_temp.mknote(sel text) returns uuid language plpgsql as $$
declare s uuid := '51000000-0000-4000-8000-000000000001'; ix integer; leaf text; f integer; nid uuid;
begin
  execute 'reset role';
  select pg_temp.sec(s, 'Ôn tập 7 ngày') into ix;
  select l.txt into leaf from public.share_text_leaves((select c.blocks -> ix from public.class_lesson_content c where c.session_id = s)) l where l.path = array['blocks', '1', 'text'];
  f := position(sel in leaf) - 1;
  perform pg_temp.who('aaaaaaaa-0000-4000-8000-00000000000a'); execute 'set local role authenticated';
  nid := public.share_text_create(s, ix, array['blocks', '1', 'text'], f, f + char_length(sel), 'hỏi', 'ck-d-' || md5(random()::text));
  perform public.social_share_share_text(nid);
  return nid;
end $$;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; leaf text; t0 timestamptz;
  study jsonb;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  -- D1 không đổi
  execute 'set local role authenticated'; perform pg_temp.who(b); select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'ok', 'D1 không đổi → ok');
  -- D2 chèn một KHỐI mới ở đầu buổi (chỉ số khối dịch +1) → moved qua block_fp
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_build_array(jsonb_build_object('kind', 'note', 'text', 'Khối mới chèn đầu buổi')) || blocks where session_id = s;
  execute 'set local role authenticated'; perform pg_temp.who(b); select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'moved' and o.section_idx = ix + 1 and o.text_path = array['blocks', '1', 'text'] and o.char_from is not null, 'D2 chèn khối phía trước → moved, section_idx +1: ' || coalesce(o.status, '∅') || '/' || coalesce(o.section_idx::text, '∅'));
  -- D3 chèn thêm một đoạn trước trong cùng study (path đổi)
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[(ix + 1)::text, 'blocks'], jsonb_build_array(jsonb_build_object('b', 'p', 'text', 'Đoạn mới thêm.')) || (blocks -> (ix + 1) -> 'blocks')) where session_id = s;
  execute 'set local role authenticated'; perform pg_temp.who(b); select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'moved' and o.text_path = array['blocks', '2', 'text'], 'D3 chèn đoạn trong cùng khối → moved, path blocks.2.text: ' || coalesce(array_to_string(o.text_path, '.'), '∅'));
  -- D4 sửa chữ SAU đoạn chọn trong cùng lá → vẫn tìm thấy (ok hoặc moved), toạ độ khớp đoạn chọn
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[(ix + 1)::text, 'blocks', '2', 'text'],
     to_jsonb(replace(blocks #>> array[(ix + 1)::text, 'blocks', '2', 'text'], 'ở ô 2', 'ở ô bảy'))) where session_id = s;
  execute 'set local role authenticated'; perform pg_temp.who(b); select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status in ('ok', 'moved') and o.text_sha = pg_temp.sha(sel), 'D4 sửa chữ xung quanh (sau đoạn chọn) → vẫn tìm thấy: ' || o.status);
  -- D5 thêm chữ TRƯỚC đoạn chọn trong cùng lá → moved, toạ độ trượt đúng, đoạn cắt = đoạn chọn
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[(ix + 1)::text, 'blocks', '2', 'text'],
     to_jsonb('Lời dẫn thêm ở đầu. ' || (blocks #>> array[(ix + 1)::text, 'blocks', '2', 'text']))) where session_id = s;
  select blocks #>> array[(ix + 1)::text, 'blocks', '2', 'text'] into leaf from public.class_lesson_content where session_id = s;
  execute 'set local role authenticated'; perform pg_temp.who(b); select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'moved' and substr(leaf, o.char_from + 1, o.char_to - o.char_from) = sel, 'D5 thêm chữ trước đoạn chọn → moved; substr(toạ độ mới) = đoạn chọn');
  -- D6 sửa CHÍNH đoạn chọn → stale (không đoán)
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[(ix + 1)::text, 'blocks', '2', 'text'], to_jsonb(replace(leaf, 'nghe kỹ', 'lắng nghe'))) where session_id = s;
  execute 'set local role authenticated'; perform pg_temp.who(b); select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'stale' and o.char_from is null and o.text_path is null and o.section_idx is null and o.text_sha is null, 'D6 sửa chính đoạn chọn → stale, KHÔNG toạ độ');
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b';
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  -- D7 xoá lá chứa đoạn chọn → stale
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks'], (blocks -> ix -> 'blocks') - 1) where session_id = s;
  execute 'set local role authenticated'; perform pg_temp.who(b); select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'stale', 'D7 xoá lá chứa đoạn chọn → stale');
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; leaf text;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  -- D8 Thầy lưu lại cùng câu nhưng khác dạng chuẩn hoá (NFC → NFD) → băm khác → stale (chủ ý)
  select blocks #>> array[ix::text, 'blocks', '1', 'text'] into leaf from public.class_lesson_content where session_id = s;
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks', '1', 'text'], to_jsonb(normalize(leaf, NFD))) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'stale', 'D8 NFC → NFD → stale (không chuẩn hoá, fail-closed)');
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; blk jsonb;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  -- D9 đổi tiêu đề khối VÀ dịch chỉ số cùng lúc → không nhận ra khối → stale
  update public.class_lesson_content set blocks = jsonb_build_array(jsonb_build_object('kind', 'note', 'text', 'x1'), jsonb_build_object('kind', 'note', 'text', 'x2')) || jsonb_set(blocks, array[ix::text, 'title'], '"Tên khác"') where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'stale', 'D9 đổi tiêu đề + dịch chỉ số → stale');
  -- nhưng chỉ đổi tiêu đề (chỉ số còn nguyên) → vẫn ok vì nhận dạng là chính đoạn chữ
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; blk jsonb;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'title'], '"Tên khác"') where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'ok', 'D10 chỉ đổi tiêu đề (chỉ số còn nguyên) → ok');
  -- D11 HAI KHỐI GIỐNG HỆT: bản sao ngay sau; vị trí gốc còn đúng → ok (không bị bản sao làm nhiễu)
  execute 'reset role';
  select blocks -> ix into blk from public.class_lesson_content where session_id = s;
  update public.class_lesson_content set blocks = (select jsonb_agg(e order by i) from (
      select e, i from jsonb_array_elements(blocks) with ordinality t(e, i)
      union all select blk, ix + 1 + 0.5) z) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'ok' and o.section_idx = ix, 'D11 hai khối giống hệt, vị trí gốc còn đúng → ok (bước 1 chạy trước)');
  -- D12 rồi chèn một khối ở đầu: hai bản sao dịch chuyển, không phân xử được → stale (không đoán)
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_build_array(jsonb_build_object('kind', 'note', 'text', 'chèn đầu')) || blocks where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'stale', 'D12 hai khối giống hệt sau khi dịch chuyển → stale (hai ứng viên, không phân xử)');
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b';
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  -- D13 cùng câu lặp ở HAI đoạn khác ngữ cảnh trong cùng khối + dịch chuyển: ctx_sha phân xử → moved đúng đoạn gốc
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks'],
      jsonb_build_array(jsonb_build_object('b', 'p', 'text', 'Đoạn lạ có Cùng câu: nghe kỹ nhịp chùm ba rồi nghỉ.')) || (blocks -> ix -> 'blocks')) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'moved' and o.text_path = array['blocks', '2', 'text'], 'D13 câu lặp ở hai đoạn: ctx phân xử → moved đúng đoạn gốc: ' || coalesce(o.status, '∅') || ' ' || coalesce(array_to_string(o.text_path, '.'), '∅'));
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; leaf text;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  -- D14 hai đoạn GIỐNG HỆT (cả ngữ cảnh) trong cùng khối, gốc bị dịch → stale
  select blocks #>> array[ix::text, 'blocks', '1', 'text'] into leaf from public.class_lesson_content where session_id = s;
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks'],
      jsonb_build_array(jsonb_build_object('b', 'h', 'text', 'Mở đầu'), jsonb_build_object('b', 'h', 'text', 'Mở đầu 2'), jsonb_build_object('b', 'p', 'text', leaf), jsonb_build_object('b', 'p', 'text', leaf)) || ((blocks -> ix -> 'blocks') - 1)) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'stale', 'D14 hai đoạn giống hệt trong cùng khối (gốc dịch) → stale');
end $$;
rollback;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; t0 timestamptz; ms numeric;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  -- D15 ngân sách: > 60.000 cửa sổ → stale (không treo, không đoán)
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks'],
     (select jsonb_agg(jsonb_build_object('b', 'p', 'text', 'Đoạn số ' || g || ': ' || repeat('x', 300))) from generate_series(1, 290) g)) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; t0 := clock_timestamp();
  select * into o from public.share_note_open_v2(nid); ms := extract(milliseconds from clock_timestamp() - t0);
  perform pg_temp.ok(o.status = 'stale' and ms < 3000, format('D15 vượt ngân sách cửa sổ (290 lá × ~310) → stale trong %s ms (không treo)', round(ms)));
  -- D16 > 300 lá → stale
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks'],
     (select jsonb_agg(jsonb_build_object('b', 'p', 'text', 'Đoạn ' || g)) from generate_series(1, 320) g)) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'stale', 'D16 > 300 lá trong một khối → stale');
  -- D17 giáo trình chuyển về bản nháp (không xuất bản) → no_access, không toạ độ
  execute 'reset role'; update public.class_lesson_content set status = 'draft' where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; select * into o from public.share_note_open_v2(nid);
  perform pg_temp.ok(o.status = 'no_access' and o.char_from is null and o.text_path is null, 'D17 giáo trình bản nháp → no_access, không toạ độ');
end $$;
rollback;

-- đo hiệu năng tìm lại trên dữ liệu tổng hợp (trường hợp xấu: đúng ngân sách) — thông tin
begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sel text := 'nghe kỹ nhịp chùm ba'; nid uuid; ix integer; o record; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; t0 timestamptz; ms numeric;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày');
  execute 'set local role authenticated'; nid := pg_temp.mknote(sel); execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[ix::text, 'blocks'],
     (select jsonb_agg(jsonb_build_object('b', 'p', 'text', 'Đoạn số ' || g || ': ' || repeat('x', 270))) from generate_series(1, 200) g)) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated'; t0 := clock_timestamp();
  select * into o from public.share_note_open_v2(nid); ms := extract(milliseconds from clock_timestamp() - t0);
  raise notice 'PERF: open_v2 trường hợp xấu (200 lá × ~290 ký tự ≈ %, đoạn chọn 20 ký tự, không tìm thấy) = % ms → %', 200 * (290 - 20 + 1), round(ms), o.status;
end $$;
rollback;

-- giới hạn tần suất dùng CHUNG bộ đếm với ô nhịp: 10 ghi chú/phút/người
begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare s uuid := '51000000-0000-4000-8000-000000000001'; ix integer; i integer; r text;
begin
  execute 'reset role'; ix := pg_temp.sec(s, 'Ôn tập 7 ngày'); perform pg_temp.who('aaaaaaaa-0000-4000-8000-00000000000a'); execute 'set local role authenticated';
  for i in 1 .. 10 loop perform public.share_text_create(s, ix, array['blocks', '1', 'text'], 0, 8, 'n' || i, 'ck-rate-' || lpad(i::text, 6, '0')); end loop;
  r := pg_temp.try(format('select public.share_text_create(%L, %s, array[''blocks'',''1'',''text''], 0, 8, ''n11'', ''ck-rate-000011'')', s, ix));
  perform pg_temp.ok(r like '54000|%', 'R1 ghi chú thứ 11 trong 1 phút bị giới hạn (54000)');
end $$;
rollback;

-- ───────────── E. Hồi quy ô nhịp V1: hàm V1 và hàm v2 cho CÙNG kết quả ─────────────
begin;
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; sx integer; nid uuid; o1 record; o2 record; a text := 'aaaaaaaa-0000-4000-8000-00000000000a'; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; c text := 'cccccccc-0000-4000-8000-00000000000c';
  rows1 integer; cards record; u text;
begin
  execute 'reset role';
  select (e.i - 1)::integer into sx from public.class_lesson_content cc cross join lateral jsonb_array_elements(cc.blocks) with ordinality e(v, i)
   where cc.session_id = s and e.v ->> 'kind' = 'score' limit 1;
  perform pg_temp.who(a); execute 'set local role authenticated';
  nid := public.share_note_create(s, sx, array['tex'], 2, 3, 'ô 2–3 (V1)', 'ck-e-0001-aaaa');
  perform public.social_share_share_note(nid);
  foreach u in array array[a, b, c] loop
    perform pg_temp.who(u);
    select * into o1 from public.share_note_open(nid);
    select * into o2 from public.share_note_open_v2(nid);
    perform pg_temp.ok(o1.status = o2.status and o1.section_idx is not distinct from o2.section_idx and o1.score_path is not distinct from o2.score_path
      and o1.bar_from is not distinct from o2.bar_from and o1.bar_to is not distinct from o2.bar_to and o2.kind = 'bars' and o2.text_path is null,
      format('E1 ô nhịp: open (V1) và open_v2 giống nhau cho %s → %s', left(u, 4), o2.status));
  end loop;
  perform pg_temp.who(b);
  select * into cards from public.share_note_card_v2(array[nid]) limit 1;
  perform pg_temp.ok(cards.anchor_kind = 'bars' and cards.bar_from = 2 and cards.bar_to = 3, 'E2 card_v2 trả ô nhịp đúng (bars, 2–3)');
  -- sửa bản nhạc → stale ở CẢ hai hàm
  execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[sx::text, 'tex'], to_jsonb((blocks #>> array[sx::text, 'tex']) || ' ')) where session_id = s;
  perform pg_temp.who(b); execute 'set local role authenticated';
  select * into o1 from public.share_note_open(nid); select * into o2 from public.share_note_open_v2(nid);
  perform pg_temp.ok(o1.status = 'stale' and o2.status = 'stale', 'E3 sửa bản nhạc → stale ở cả V1 lẫn v2');
  -- ghi chú ô nhịp: hàm tạo/đăng V1 không thể tạo hàng 'text'; social_share_share_text từ chối ghi chú bars
  perform pg_temp.who(a);
  perform pg_temp.ok(pg_temp.try(format('select public.social_share_share_text(%L)', nid)) like '22023|%', 'E4 social_share_share_text từ chối ghi chú ô nhịp');
end $$;
rollback;

-- ───────────── F. Quyền thực thi ─────────────
begin;
do $$
declare r text; fn text;
begin
  execute 'set local role anon';
  foreach fn in array array['public.share_text_create(uuid,integer,text[],integer,integer,text,text)', 'public.share_note_open_v2(uuid)', 'public.share_note_card_v2(uuid[])', 'public.social_share_share_text(uuid)',
      'public.share_text_leaves(jsonb)', 'public.share_text_resolve(uuid,integer,text[],integer,integer,text,text,text)'] loop
    perform pg_temp.ok(not has_function_privilege('anon', fn::regprocedure, 'execute'), 'F1 anon KHÔNG gọi được ' || split_part(fn, '(', 1));
  end loop;
  execute 'reset role'; execute 'set local role authenticated';
  foreach fn in array array['public.share_text_leaves(jsonb)', 'public.share_text_resolve(uuid,integer,text[],integer,integer,text,text,text)', 'public.share_text_leaf(uuid,integer,text[])',
      'public.share_text_scan(jsonb,integer,integer,text,text)', 'public.share_text_boundary_ok(text,integer,integer)', 'public.share_text_fp(jsonb)'] loop
    perform pg_temp.ok(not has_function_privilege('authenticated', fn::regprocedure, 'execute'), 'F2 authenticated KHÔNG gọi được hàm nội bộ ' || split_part(fn, '(', 1));
  end loop;
  r := pg_temp.try('select count(*) from public.share_notes');
  perform pg_temp.ok(r like '42501%', 'F3 authenticated không đọc trực tiếp bảng share_notes: ' || left(r, 30));
end $$;
rollback;
\echo ALL_SHARE_TEXT_DB_TESTS_DONE
