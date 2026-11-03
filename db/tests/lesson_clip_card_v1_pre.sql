-- ═══ G3 lesson_clip_card_v1 — TIỀN MIGRATION: helper, dữ liệu thử (ID video GIẢ), ảnh chụp Feed bằng hàm CŨ. Cluster PG TẠM. KHÔNG production. ═══
-- Người: A, B (SOLO01.TH01, có quyền giáo trình) · C (SOLO01.TH02) · T (Thầy) · N (ngoài Class)
\set ON_ERROR_STOP on
\o /dev/null
do $$ begin if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if; end $$;
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
create function t.fails(q text, msg text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
-- thời điểm ISO UTC như công cụ chèn ghi (new Date().toISOString())
create function t.iso(p_ago interval) returns text language sql stable as $$
  select to_char((now() - p_ago) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
-- toàn bộ Feed người k thấy qua hàm _safe THẬT (client gọi hàm này), mọi trang
create function t.feed(k text, p_scope text default 'for_you', p_page int default 50) returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language plpgsql as $$
declare v_t timestamptz := null; v_k text := null; n int; r record; i int;
begin
  perform t.as_user(k);
  for i in 1..200 loop
    n := 0;
    for r in select * from public.social_feed_scoped_safe(p_scope, v_t, v_k, p_page) loop
      n := n + 1; v_t := r.sort_at; v_k := r.sort_key;
      kind := r.kind; sort_at := r.sort_at; sort_key := r.sort_key; post := r.post; thread := r.thread; return next;
    end loop;
    exit when n < p_page;
  end loop;
  perform t.reset();
end $$;
create function t.feed_you(k text, p_page int default 50) returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language plpgsql as $$
declare v_t timestamptz := null; v_k text := null; n int; r record; i int;
begin
  perform t.as_user(k);
  for i in 1..200 loop
    n := 0;
    for r in select * from public.social_feed_safe(v_t, v_k, p_page) loop
      n := n + 1; v_t := r.sort_at; v_k := r.sort_key;
      kind := r.kind; sort_at := r.sort_at; sort_key := r.sort_key; post := r.post; thread := r.thread; return next;
    end loop;
    exit when n < p_page;
  end loop;
  perform t.reset();
end $$;
-- chạy q với danh tính who ('anon' hoặc A/B/…) và PHẢI bị chặn (đặt vai trò trong CÙNG lệnh vì set_config(…, true) chỉ sống trong một transaction)
create function t.fails_as(who text, q text, msg text) returns void language plpgsql as $$ begin
  if who = 'anon' then perform t.as_anon(); else perform t.as_user(who); end if;
  begin execute q; exception when others then
    perform t.reset(); raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  perform t.reset();
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Dữ liệu thử: bài Social + khối video GIẢ (không phải video thật) ───────────────────────────
insert into public.class_posts (id, author_user_id, type, audience, body, created_at) values
  ('90000000-0000-4000-8000-000000000001', t.u('A'), 'practice', 'class', 'bài lớp 1', now() - interval '30 hours'),
  ('90000000-0000-4000-8000-000000000002', t.u('B'), 'question', 'class', 'bài lớp 2', now() - interval '5 hours'),
  ('90000000-0000-4000-8000-000000000003', t.u('A'), 'status', 'friends', 'bài bạn bè', now() - interval '3 hours');
-- S1 TH01#1: 1 video hợp lệ (1 ngày trước) · S2 TH01#2: hợp lệ (2 giờ) + thiếu added_at + sai định dạng + ngày không tồn tại + tương lai
-- S3 TH01#3: video 100 ngày trước (ngoài cửa sổ 90 ngày) · S4 TH01#4 NHÁP: video hợp lệ · TH02#1: video hợp lệ (lớp của C)
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object(
  'kind', 'video', 'title', 'Ôn nhanh S1', 'url', 'https://youtu.be/ZZfakeVID01', 'duration', '2:07', 'note', 'NOTE_SENTINEL_1', 'added_at', t.iso('1 day')))
 where session_id = '51000000-0000-4000-8000-000000000001';
update public.class_lesson_content set blocks = blocks || jsonb_build_array(
  jsonb_build_object('kind', 'video', 'title', 'Ôn nhanh S2', 'url', 'https://youtu.be/ZZfakeVID02', 'duration', '1:30', 'added_at', t.iso('2 hours')),
  jsonb_build_object('kind', 'video', 'title', 'S2 thiếu added_at', 'url', 'https://youtu.be/ZZfakeVID03'),
  jsonb_build_object('kind', 'video', 'title', 'S2 sai định dạng', 'url', 'https://youtu.be/ZZfakeVID04', 'added_at', 'hôm qua'),
  jsonb_build_object('kind', 'video', 'title', 'S2 ngày không tồn tại', 'url', 'https://youtu.be/ZZfakeVID05', 'added_at', '2026-02-31T00:00:00.000Z'),
  jsonb_build_object('kind', 'video', 'title', 'S2 tương lai', 'url', 'https://youtu.be/ZZfakeVID06', 'added_at', t.iso('-10 days')),
  jsonb_build_object('kind', 'video', 'title', '   ', 'url', 'https://youtu.be/ZZfakeVID07', 'added_at', t.iso('1 hour')),
  jsonb_build_object('kind', 'video', 'title', 'added_at không phải chuỗi', 'added_at', 12345))
 where session_id = '51000000-0000-4000-8000-000000000002';
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object(
  'kind', 'video', 'title', 'S3 quá cũ', 'url', 'https://youtu.be/ZZfakeVID08', 'added_at', t.iso('100 days')))
 where session_id = '51000000-0000-4000-8000-000000000003';
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object(
  'kind', 'video', 'title', 'S4 bản nháp', 'url', 'https://youtu.be/ZZfakeVID09', 'added_at', t.iso('1 hour')))
 where session_id = '51000000-0000-4000-8000-000000000004';
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object(
  'kind', 'video', 'title', 'Ôn nhanh TH02', 'url', 'https://youtu.be/ZZfakeVID10', 'duration', '3:00', 'added_at', t.iso('30 minutes')))
 where session_id = '52000000-0000-4000-8000-000000000001';
select t.ok((select count(*) from public.class_lesson_content where status = 'published' and blocks @> '[{"kind":"video"}]') = 4, 'dữ liệu thử: 4 buổi published có khối video, 1 nháp');

-- ── Ảnh chụp Feed bằng hàm CŨ (trước migration): mọi người × mọi góc nhìn ───────────────────────────
create table t.snap (who text, scope text, rows jsonb);
insert into t.snap
select w, s, coalesce((select jsonb_agg(jsonb_build_object('kind', f.kind, 'at', f.sort_at, 'key', f.sort_key, 'post', f.post, 'thread', f.thread) order by f.sort_at desc, f.sort_key desc)
                        from t.feed(w, s, 3) f), '[]'::jsonb)
  from unnest(array['A','B','C','T']) w cross join unnest(array['for_you','my_classes','friends']) s;
insert into t.snap
select w, 'you_safe', coalesce((select jsonb_agg(jsonb_build_object('kind', f.kind, 'at', f.sort_at, 'key', f.sort_key, 'post', f.post, 'thread', f.thread) order by f.sort_at desc, f.sort_key desc)
                        from t.feed_you(w, 3) f), '[]'::jsonb)
  from unnest(array['A','B','C','T']) w;
select t.ok((select count(*) from t.snap) = 16, 'ảnh chụp trước migration: 16 (người × góc nhìn)');
select t.ok((select count(*) from t.snap where jsonb_array_length(rows) > 0) >= 6, 'ảnh chụp có nội dung thật (bài Social/thread)');
