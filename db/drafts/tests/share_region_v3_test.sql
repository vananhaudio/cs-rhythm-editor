-- Test DB Contextual Share V3 (khoanh vùng hỗn hợp) — DB TẠM sau khi áp V2 + db/drafts/share_region_v3_setup.sql. KHÔNG production.
-- Người dùng: A=tác giả (có quyền), B=bạn cùng lớp có quyền, C=lớp khác. Mọi sửa giáo trình nằm trong transaction và ROLLBACK.
\set ON_ERROR_STOP on
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$ begin if c is not true then raise exception 'FAIL: %', m; end if; raise notice 'PASS: %', m; end $$;
create function pg_temp.who(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, false); end $$;
create function pg_temp.try(q text) returns text language plpgsql as $$ begin execute q; return 'OK'; exception when others then return sqlstate || '|' || sqlerrm; end $$;
create function pg_temp.sec(s uuid, k text, title text) returns integer language sql as $$
  select (e.i - 1)::integer from public.class_lesson_content c cross join lateral jsonb_array_elements(c.blocks) with ordinality e(v, i)
   where c.session_id = s and e.v ->> 'kind' = k and (title is null or e.v ->> 'title' = title) limit 1 $$;

begin;
update public.share_notes set created_at = created_at - interval '1 hour';
do $$
declare
  s uuid := '51000000-0000-4000-8000-000000000001'; a text := 'aaaaaaaa-0000-4000-8000-00000000000a'; b text := 'bbbbbbbb-0000-4000-8000-00000000000b'; c text := 'cccccccc-0000-4000-8000-00000000000c';
  i_sc integer; i_st integer; i_fr integer; i_st2 integer; parts jsonb; nid uuid; o record; r text; post uuid; payload jsonb; blk jsonb; n0 integer;
begin
  execute 'reset role';
  i_sc := pg_temp.sec(s, 'score', 'Thành phố buồn'); i_st := pg_temp.sec(s, 'study', 'Ôn tập 7 ngày'); i_fr := pg_temp.sec(s, 'fretboard', null); i_st2 := pg_temp.sec(s, 'study', 'Luyện tập sau sơ đồ');
  parts := jsonb_build_array(
    jsonb_build_object('sec', i_st, 'box', jsonb_build_array(0, 100, 1000, 600), 'leaves', jsonb_build_array(jsonb_build_array('blocks','1','text'), jsonb_build_array('blocks','2','items','0')), 'scores', '[]'::jsonb),
    jsonb_build_object('sec', i_sc, 'box', jsonb_build_array(0, 0, 1000, 1000), 'leaves', '[]'::jsonb, 'scores', jsonb_build_array(jsonb_build_object('p', jsonb_build_array('tex'), 'from', 2, 'to', 4))),
    jsonb_build_object('sec', i_fr, 'box', jsonb_build_array(100, 100, 900, 900), 'leaves', '[]'::jsonb, 'scores', '[]'::jsonb));
  perform pg_temp.ok(i_sc is not null and i_st is not null and i_fr is not null and i_st2 is not null, 'R0 fixture có đủ khối chữ / nhạc / hình');

  -- R1 tạo
  perform pg_temp.who(a); execute 'set local role authenticated';
  nid := public.share_region_create(s, parts, 'Em khoanh cả chữ, nhạc và hình', 'ck-r1-aaaaaaaa');
  perform pg_temp.ok(nid is not null, 'R1 tạo vùng hỗn hợp (chữ + nhạc + hình) → id');
  perform pg_temp.ok(public.share_region_create(s, parts, 'Em khoanh cả chữ, nhạc và hình', 'ck-r1-aaaaaaaa') = nid, 'R1b bấm đúp / thử lại cùng khoá → cùng id');
  execute 'reset role';
  select region into parts from public.share_notes where id = nid;
  perform pg_temp.ok(jsonb_array_length(parts) = 3 and (select bool_and(x ->> 'sha' ~ '^[0-9a-f]{64}$' and x ->> 'fp' ~ '^[0-9a-f]{64}$') from jsonb_array_elements(parts) x), 'R2 server TỰ tính fp + sha cho từng khối');
  perform pg_temp.ok(parts::text not like '%chùm ba%' and parts::text not like '%Thành phố%' and parts::text not like '%Sơ đồ%', 'R3 neo KHÔNG chứa nội dung giáo trình');
  perform pg_temp.ok((select anchor_kind = 'region' and score_path is null and text_path is null and bar_from is null from public.share_notes where id = nid), 'R4 hàng: anchor_kind=region, cột V1/V2 NULL');

  -- chia sẻ Feed
  perform pg_temp.who(a); execute 'set local role authenticated';
  post := public.social_share_share_region(nid);
  perform pg_temp.ok(post is not null and public.social_share_share_region(nid) = post, 'R5 đăng Feed: một bài mỗi vùng (idempotent)');
  execute 'reset role';
  select tool_share into payload from public.class_posts where id = post;
  perform pg_temp.ok(payload ->> 'anchor' = 'region' and payload::text not like '%chùm ba%' and not payload ? 'bar_from', 'R6 payload Feed: anchor=region, không nội dung giáo trình, không bar_from');

  -- mở
  execute 'set local role authenticated'; perform pg_temp.who(b);
  select * into o from public.share_region_open(nid);
  perform pg_temp.ok(o.status = 'ok' and jsonb_array_length(o.region) = 3 and o.note = 'Em khoanh cả chữ, nhạc và hình', 'R7 B (có quyền) mở → ok + 3 phần');
  perform pg_temp.ok(not (o.region -> 0) ? 'sha' and not (o.region -> 0) ? 'fp', 'R8 phần trả về KHÔNG lộ băm nội bộ (chỉ sec/box/leaves/scores)');
  perform pg_temp.ok(not exists (select 1 from public.share_note_open_v2(nid) v where v.status = 'ok' and v.score_path is not null), 'R8b open_v2 cho vùng region không trả toạ độ nhạc/văn bản (bundle V2 cũ → không hiểu, an toàn)');
  perform pg_temp.who(c);
  select * into o from public.share_region_open(nid);
  perform pg_temp.ok(o.status = 'no_access' and o.region is null and o.note = 'Em khoanh cả chữ, nhạc và hình', 'R9 C (ngoài lớp, thấy bài Feed) → no_access: chỉ câu hỏi, KHÔNG toạ độ / đường dẫn');

  -- R10 payload giả
  execute 'reset role'; n0 := (select count(*) from public.share_notes);
  perform pg_temp.who(a); execute 'set local role authenticated';
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, 'x', 'ck-r10-00000001')$q$, s, jsonb_build_array(jsonb_build_object('sec', i_st, 'box', jsonb_build_array(0,0,1000,1000), 'leaves', jsonb_build_array(jsonb_build_array('blocks','99','text')), 'scores', '[]'::jsonb))));
  perform pg_temp.ok(r like '22023%', 'R10 lá không tồn tại bị từ chối: ' || left(r, 30));
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, 'x', 'ck-r10-00000002')$q$, s, jsonb_build_array(jsonb_build_object('sec', i_st, 'box', jsonb_build_array(0,0,1000,1000), 'leaves', '[]'::jsonb, 'scores', jsonb_build_array(jsonb_build_object('p', jsonb_build_array('tex'), 'from', 1, 'to', 2))))));
  perform pg_temp.ok(r like '22023%', 'R11 "bản nhạc" ở khối không có nhạc bị từ chối');
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, 'x', 'ck-r10-00000003')$q$, s, jsonb_build_array(jsonb_build_object('sec', i_sc, 'box', jsonb_build_array(0,0,1000,1000), 'leaves', '[]'::jsonb, 'scores', jsonb_build_array(jsonb_build_object('p', jsonb_build_array('tex'), 'from', 1, 'to', 80))))));
  perform pg_temp.ok(r like '22023%', 'R12 dải ô > 64 bị từ chối');
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, 'x', 'ck-r10-00000004')$q$, s, jsonb_build_array(jsonb_build_object('sec', 999, 'box', jsonb_build_array(0,0,1000,1000), 'leaves', '[]'::jsonb, 'scores', '[]'::jsonb))));
  perform pg_temp.ok(r like '22023%', 'R13 khối ngoài giáo trình bị từ chối');
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, 'x', 'ck-r10-00000005')$q$, s, jsonb_build_array(jsonb_build_object('sec', i_fr, 'box', jsonb_build_array(500,0,400,1000), 'leaves', '[]'::jsonb, 'scores', '[]'::jsonb))));
  perform pg_temp.ok(r like '22023%', 'R14 hộp ‰ sai (x0 ≥ x1) bị từ chối');
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, 'x', 'ck-r10-00000006')$q$, s, jsonb_build_array(jsonb_build_object('sec', i_fr, 'box', jsonb_build_array(0,0,1000,1000)), jsonb_build_object('sec', i_fr, 'box', jsonb_build_array(0,0,1000,1000)))));
  perform pg_temp.ok(r like '22023%', 'R15 hai phần cùng khối bị từ chối');
  r := pg_temp.try(format($q$select public.share_region_create(%L, '[]'::jsonb, 'x', 'ck-r10-00000007')$q$, s));
  perform pg_temp.ok(r like '22023%', 'R16 không có phần nào bị từ chối');
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, '', 'ck-r10-00000008')$q$, s, jsonb_build_array(jsonb_build_object('sec', i_fr, 'box', jsonb_build_array(0,0,1000,1000)))));
  perform pg_temp.ok(r like '22023%', 'R17 lời nhắn rỗng bị từ chối');
  perform pg_temp.who(c);
  r := pg_temp.try(format($q$select public.share_region_create(%L, %L::jsonb, 'x', 'ck-r10-00000009')$q$, s, jsonb_build_array(jsonb_build_object('sec', i_fr, 'box', jsonb_build_array(0,0,1000,1000)))));
  perform pg_temp.ok(r like '22023%' or r like '42501%', 'R18 C (không có quyền giáo trình) không tạo được: ' || left(r, 25));
  execute 'reset role';
  perform pg_temp.ok((select count(*) from public.share_notes) = n0, 'R19 các lần tạo sai không để lại hàng');
  perform pg_temp.ok(not has_function_privilege('anon', 'public.share_region_create(uuid,jsonb,text,text)', 'execute') and not has_function_privilege('anon', 'public.share_region_open(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.share_region_resolve(uuid,jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.share_region_build(uuid,jsonb)', 'execute'), 'R20 quyền: anon không gọi; hàm nội bộ không ai gọi');

end $$;
rollback;

-- ───────────── sửa giáo trình: mỗi kịch bản một transaction, ROLLBACK cuối ─────────────
create function pg_temp.mk(ck text) returns uuid language plpgsql as $$
declare s uuid := '51000000-0000-4000-8000-000000000001'; i_sc integer := pg_temp.sec(s, 'score', 'Thành phố buồn'); i_st integer := pg_temp.sec(s, 'study', 'Ôn tập 7 ngày'); i_fr integer := pg_temp.sec(s, 'fretboard', null); v_id uuid;
begin
  perform pg_temp.who('aaaaaaaa-0000-4000-8000-00000000000a'); execute 'set local role authenticated';
  v_id := public.share_region_create(s, jsonb_build_array(
    jsonb_build_object('sec', i_st, 'box', jsonb_build_array(0, 100, 1000, 600), 'leaves', jsonb_build_array(jsonb_build_array('blocks','1','text')), 'scores', '[]'::jsonb),
    jsonb_build_object('sec', i_sc, 'box', jsonb_build_array(0, 0, 1000, 1000), 'leaves', '[]'::jsonb, 'scores', jsonb_build_array(jsonb_build_object('p', jsonb_build_array('tex'), 'from', 2, 'to', 4))),
    jsonb_build_object('sec', i_fr, 'box', jsonb_build_array(100, 100, 900, 900), 'leaves', '[]'::jsonb, 'scores', '[]'::jsonb)), 'ghi chú', ck);
  perform public.social_share_share_region(v_id);          -- đăng Feed để B THẤY
  execute 'reset role'; return v_id; end $$;
create function pg_temp.opn(u text, id uuid) returns record language plpgsql as $$ declare o record; begin
  perform pg_temp.who(u); execute 'set local role authenticated'; select * into o from public.share_region_open(id); execute 'reset role'; return o; end $$;
create function pg_temp.secs(j jsonb) returns text language sql as $$ select string_agg(x ->> 'sec', ',' order by (x ->> 'sec')::int) from jsonb_array_elements(j) x $$;

\set B '\'bbbbbbbb-0000-4000-8000-00000000000b\''
begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; i_st integer := pg_temp.sec(s, 'study', 'Ôn tập 7 ngày');
begin n := pg_temp.mk('ck-s1-00000001'); execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[i_st::text, 'blocks', '1', 'text'], to_jsonb('Câu đã bị Thầy sửa lại hoàn toàn.'::text)) where session_id = s;
  select * into o from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz);
  perform pg_temp.ok(o.status = 'stale' and o.region is null and o.note is not null, 'S1 sửa một câu trong khối được khoanh → stale, KHÔNG trả toạ độ (vẫn có câu hỏi)');
end $$; rollback;

begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; i_n integer := pg_temp.sec(s, 'note', 'Ghi chú của Thầy');
begin n := pg_temp.mk('ck-s2-00000001'); execute 'reset role';
  update public.class_lesson_content set blocks = jsonb_set(blocks, array[i_n::text, 'text'], to_jsonb('Ghi chú khác hoàn toàn.'::text)) where session_id = s;
  select * into o from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz);
  perform pg_temp.ok(o.status = 'ok' and jsonb_array_length(o.region) = 3, 'S2 sửa khối KHÁC (không được khoanh) → vẫn ok');
end $$; rollback;

begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; b0 text; sc0 text;
begin n := pg_temp.mk('ck-s3-00000001'); execute 'reset role';
  select string_agg(x ->> 'sec', ',' order by (x ->> 'sec')::int) into b0 from public.share_notes sn cross join lateral jsonb_array_elements(sn.region) x where sn.id = n;
  update public.class_lesson_content set blocks = jsonb_build_array(jsonb_build_object('kind', 'note', 'title', 'Chèn đầu', 'text', 'Khối mới chèn lên đầu buổi.')) || blocks where session_id = s;
  select * into o from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz);
  select string_agg((x::int + 1)::text, ',' order by x::int) into sc0 from unnest(string_to_array(b0, ',')) x;
  perform pg_temp.ok(o.status = 'moved' and pg_temp.secs(o.region) = sc0, 'S3 chèn khối lên đầu → moved, mọi phần dời đúng +1 (' || b0 || ' → ' || coalesce(pg_temp.secs(o.region), '?') || ')');
end $$; rollback;

begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; i_st integer; i_fr integer;
begin n := pg_temp.mk('ck-s4-00000001'); execute 'reset role';
  i_st := pg_temp.sec(s, 'study', 'Ôn tập 7 ngày'); i_fr := pg_temp.sec(s, 'fretboard', null);
  -- hoán đổi vị trí hai khối
  update public.class_lesson_content c set blocks = jsonb_set(jsonb_set(c.blocks, array[i_st::text], c.blocks -> i_fr), array[i_fr::text], c.blocks -> i_st) where session_id = s;
  select * into o from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz);
  perform pg_temp.ok(o.status = 'moved' and exists (select 1 from jsonb_array_elements(o.region) x where (x ->> 'sec')::int = i_fr and jsonb_array_length(x -> 'leaves') = 1), 'S4 hoán đổi hai khối → moved, phần chữ theo khối chữ về chỗ mới');
end $$; rollback;

begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; i_fr integer;
begin n := pg_temp.mk('ck-s5-00000001'); execute 'reset role';
  i_fr := pg_temp.sec(s, 'fretboard', null);
  -- khối hình bị xoá → stale
  update public.class_lesson_content c set blocks = c.blocks - i_fr where session_id = s;
  select * into o from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz);
  perform pg_temp.ok(o.status = 'stale' and o.region is null, 'S5 một khối trong vùng bị xoá → stale (không tô phần còn lại)');
end $$; rollback;

begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; i_fr integer; blk jsonb;
begin n := pg_temp.mk('ck-s6-00000001'); execute 'reset role';
  i_fr := pg_temp.sec(s, 'fretboard', null);
  select c.blocks -> i_fr into blk from public.class_lesson_content c where c.session_id = s;
  -- khối hình bị xoá khỏi chỗ cũ rồi xuất hiện HAI bản giống hệt ở chỗ khác ⇒ mơ hồ ⇒ stale
  update public.class_lesson_content c set blocks = (c.blocks - i_fr) || jsonb_build_array(blk, blk) where session_id = s;
  select * into o from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz);
  perform pg_temp.ok(o.status = 'stale', 'S6 khối chuyển đi thành HAI bản giống hệt (mơ hồ) → stale, không đoán');
end $$; rollback;

begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; blk jsonb; i_fr integer;
begin n := pg_temp.mk('ck-s7-00000001'); execute 'reset role';
  i_fr := pg_temp.sec(s, 'fretboard', null);
  select c.blocks -> i_fr into blk from public.class_lesson_content c where c.session_id = s;
  -- thêm một bản sao ở cuối nhưng bản gốc VẪN ở chỗ cũ ⇒ vẫn ok (đúng chỗ gợi ý thắng)
  update public.class_lesson_content c set blocks = c.blocks || jsonb_build_array(blk) where session_id = s;
  select * into o from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz);
  perform pg_temp.ok(o.status = 'ok', 'S7 thêm bản sao nhưng bản gốc còn nguyên chỗ cũ → ok');
end $$; rollback;

begin; update public.share_notes set created_at = created_at - interval '1 hour';
do $$ declare s uuid := '51000000-0000-4000-8000-000000000001'; n uuid; o record; t0 timestamptz := clock_timestamp(); ms numeric;
begin n := pg_temp.mk('ck-s8-00000001'); execute 'reset role';
  t0 := clock_timestamp();
  for i in 1 .. 20 loop perform * from pg_temp.opn('bbbbbbbb-0000-4000-8000-00000000000b', n) as (status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz); end loop;
  ms := extract(epoch from clock_timestamp() - t0) * 1000 / 20;
  raise notice 'PERF: mở vùng 3 phần ≈ % ms/lần', round(ms, 1);
  perform pg_temp.ok(ms < 200, 'S8 mở vùng nhanh (< 200 ms/lần trên giáo trình thử)');
end $$; rollback;
do $$ begin raise notice 'ALL_SHARE_REGION_DB_TESTS_DONE'; end $$;
