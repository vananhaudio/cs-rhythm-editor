-- ═══ TEST Learning Thread P2 (Feed · Tường · Hành trình) — cluster PostgreSQL TẠM (scripts/test-learning-threads-db.sh) ═══
-- Nạp SAU fixture + migration P1 + P2. Tạo dữ liệu bằng CHÍNH các RPC P1 dưới đúng identity.
-- A (lớp DH2.KD18) · B, C (tự học) · T (thầy) · N (ngoài Class)
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
create function t.l(n int) returns uuid language sql immutable as $$
  select case n when 1 then 'e0000000-0000-4000-8000-000000000001'::uuid when 2 then 'e0000000-0000-4000-8000-000000000002'::uuid
                when 3 then 'e0000000-0000-4000-8000-000000000003'::uuid end $$;
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
create table t.ids (k text primary key, v uuid);
grant all on t.ids to anon, authenticated;
-- Thứ tự thời gian rõ ràng giữa các bước (clock_timestamp)
create function t.tick() returns void language sql as $$ select pg_sleep(0.02) $$;
grant execute on function t.tick() to anon, authenticated;

-- ── Dữ liệu ─────────────────────────────────────────────────────────────────
do $$
declare nv uuid;
begin
  perform t.as_user('T');
  perform public.lt_set_lesson_settings(t.l(1), 'allowed', 'allowed');
  perform public.lt_set_lesson_settings(t.l(2), 'allowed', 'allowed');
  perform public.lt_set_lesson_settings(t.l(3), 'allowed', 'allowed');
  perform t.as_user('A');
  insert into public.class_posts (type, body, media_type, media_provider, media_url)
    values ('assignment', 'Trả bài cũ của A (class_posts)', 'external_video', 'youtube', 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
  perform t.tick();
  nv := public.lt_submit(t.l(1), 'question', 'A hỏi bài 4.3'); insert into t.ids values ('TA', nv);
  perform t.tick();
  perform t.as_user('B');
  nv := public.lt_submit(t.l(1), 'submission', 'B tự học, chỉ Thầy', null, null, null, 'private'); insert into t.ids values ('TB', nv);
  perform t.tick();
  perform t.as_user('C');
  nv := public.lt_submit(t.l(2), 'submission', 'C nộp bài 2'); insert into t.ids values ('TC', nv);
  perform t.tick();
  nv := public.lt_submit(t.l(3), 'question', 'C hỏi bài 3 (sẽ bị ẩn)'); insert into t.ids values ('TH', nv);
  perform t.tick();
  perform t.as_user('A');
  nv := public.lt_submit(t.l(2), 'submission', 'A nộp bài 2 (sẽ lưu trữ)'); insert into t.ids values ('TX', nv);
  perform t.tick();
  perform t.as_user('T');
  perform public.lt_moderate('thread', (select v from t.ids where k = 'TH'), true);
  perform public.lt_archive((select v from t.ids where k = 'TX'));
  perform public.lt_respond((select v from t.ids where k = 'TA'), 'teacher_feedback', 'Cần làm lại', 'retry', '{}',
    '[{"resource_type":"kho_video","resource_id":"kho123","title_snapshot":"Bolero"}]');
  perform t.reset();
end $$;

-- ── 1) Feed ─────────────────────────────────────────────────────────────────
do $$
declare ta uuid := (select v from t.ids where k = 'TA'); tb uuid := (select v from t.ids where k = 'TB');
        tc uuid := (select v from t.ids where k = 'TC'); th uuid := (select v from t.ids where k = 'TH');
        tx uuid := (select v from t.ids where k = 'TX'); card jsonb; keys text[]; k text; b timestamptz; bk text; n int := 0;
begin
  perform t.as_anon();
  perform t.fails($q$select * from public.social_feed()$q$, 'khách không gọi được social_feed', 'permission denied');
  perform t.fails($q$select * from public.learning_journey('aaaaaaaa-0000-4000-8000-00000000000a')$q$, 'khách không gọi được learning_journey', 'permission denied');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.social_feed()) = 0, 'ngoài Class: Feed rỗng');
  perform t.as_user('C');
  perform t.fails($q$select public.lt_thread_card('aaaaaaaa-0000-4000-8000-00000000000a')$q$, 'lt_thread_card là hàm nội bộ', 'permission denied');
  perform t.ok((select count(*) from public.social_feed() where kind = 'post') = 1, 'Feed có bài class_posts cũ (không đổi luật class_feed)');
  perform t.ok(exists (select 1 from public.social_feed() where kind = 'learning_thread' and (thread->>'id')::uuid = ta), 'Feed có thread community của A');
  perform t.ok(exists (select 1 from public.social_feed() where (thread->>'id')::uuid = tc), 'Feed có thread community của C');
  perform t.ok(not exists (select 1 from public.social_feed() where (thread->>'id')::uuid = tb), 'thread PRIVATE của B KHÔNG lên Feed');
  perform t.ok(not exists (select 1 from public.social_feed() where (thread->>'id')::uuid = th), 'thread bị ẨN KHÔNG lên Feed');
  perform t.ok(not exists (select 1 from public.social_feed() where (thread->>'id')::uuid = tx), 'thread LƯU TRỮ KHÔNG lên Feed');
  perform t.ok((select count(*) from public.social_feed() where (thread->>'id')::uuid = ta) = 1, 'MỘT thread = MỘT item (2 event vẫn 1 thẻ)');
  perform t.ok((select (thread->>'id')::uuid from public.social_feed() limit 1) = ta, 'thread có hoạt động mới nhất (Thầy vừa nhận xét) nổi lên đầu');
  select thread into card from public.social_feed() where (thread->>'id')::uuid = ta;
  perform t.ok(card->>'first_kind' = 'question' and card#>>'{last_event,kind}' = 'teacher_feedback' and card#>>'{last_event,verdict}' = 'retry'
               and card#>>'{last_event,author,name}' = 'Thầy Văn Anh' and (card#>>'{last_event,has_resources}')::boolean
               and card->>'status' = 'needs_retry' and card#>>'{identity,class,code}' = 'DH2.KD18' and card#>>'{learner,name}' = 'An',
               'thẻ Feed: Hỏi bài · Thầy (tên thật) vừa nhận xét Cần làm lại + bài giảng · danh tính lịch sử');
  perform t.as_user('T');
  perform t.ok(not exists (select 1 from public.social_feed() where (thread->>'id')::uuid in (tb, th)), 'Thầy cũng KHÔNG thấy private/ẩn trên Feed (đã có hàng đợi)');
  -- Phân trang keyset 1 item/trang: đủ, không trùng, đúng thứ tự
  perform t.as_user('C');
  loop
    select sort_at, sort_key into b, bk from public.social_feed(b, bk, 1);
    exit when not found;
    n := n + 1; keys := keys || bk;
    exit when n > 50;
  end loop;
  perform t.ok(n = (select count(*) from public.social_feed(null, null, 50)) and n = (select count(distinct x) from unnest(keys) x),
               format('phân trang 1/trang: %s item, không trùng, khớp trang lớn', n));
  -- Thầy phản hồi thêm → thread nổi lên nhưng KHÔNG nhân bản
  perform t.as_user('A');
  perform public.lt_submit(t.l(2), 'submission', 'A nộp lại lần mới (thread mới vì TX đã lưu trữ)');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.social_feed() where kind = 'learning_thread')
               = (select count(distinct thread->>'id') from public.social_feed() where kind = 'learning_thread'), 'không có thread lặp trong Feed');
  perform t.reset();
end $$;

-- ── 2) Tường ────────────────────────────────────────────────────────────────
do $$
declare ta uuid := (select v from t.ids where k = 'TA'); tx uuid := (select v from t.ids where k = 'TX');
begin
  perform t.as_user('C');
  perform t.ok((select count(*) from public.user_wall(t.u('A'))) = 0, 'chưa là bạn: tường A khoá (0 item, như get_user_wall)');
  perform t.as_user('A'); perform public.send_friend_request(t.u('C'));
  perform t.as_user('C'); perform public.respond_friend_request(t.u('A'), true);
  perform t.ok(exists (select 1 from public.user_wall(t.u('A')) where kind = 'post'), 'bạn bè: thấy Trả bài cũ của A trên tường');
  perform t.ok(exists (select 1 from public.user_wall(t.u('A')) where (thread->>'id')::uuid = ta), 'bạn bè: thấy thread community của A trên tường');
  perform t.ok(not exists (select 1 from public.user_wall(t.u('A')) where kind = 'post' and post->>'author_user_id' <> t.u('A')::text), 'tường chỉ có bài của A');
  perform t.as_user('A'); perform public.lt_set_visibility(ta, 'private');
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.user_wall(t.u('A')) where (thread->>'id')::uuid = ta), 'A chuyển "Chỉ Thầy" → bạn bè KHÔNG thấy trên tường');
  perform t.as_user('A');
  perform t.ok(exists (select 1 from public.user_wall(t.u('A')) where (thread->>'id')::uuid = ta), 'chính chủ thấy thread private trên tường mình');
  perform t.ok(exists (select 1 from public.user_wall(t.u('A')) where (thread->>'id')::uuid = tx), 'chính chủ thấy cả thread đã lưu trữ (lịch sử)');
  perform t.as_user('T');
  perform t.ok(exists (select 1 from public.user_wall(t.u('A')) where (thread->>'id')::uuid = ta), 'Thầy thấy thread private trên tường (kiểm duyệt)');
  perform t.as_user('A'); perform public.lt_set_visibility(ta, 'community');
  perform t.reset();
end $$;

-- ── 3) Hành trình ───────────────────────────────────────────────────────────
do $$
declare ta uuid := (select v from t.ids where k = 'TA'); tb uuid := (select v from t.ids where k = 'TB');
        th uuid := (select v from t.ids where k = 'TH');
begin
  perform t.as_user('A');
  perform t.ok((select count(*) from public.learning_journey(t.u('A'))) = 3, 'chính chủ: Hành trình có mọi thread (kể cả lưu trữ)');
  perform t.ok((select jsonb_array_length(events) from public.learning_journey(t.u('A')) where id = ta) = 2
               and (select events->1->>'verdict' from public.learning_journey(t.u('A')) where id = ta) = 'retry'
               and (select (events->1->>'has_resources')::boolean from public.learning_journey(t.u('A')) where id = ta),
               'mỗi mốc có tóm tắt event: Hỏi bài → Thầy nhận xét (làm lại, có bài giảng)');
  perform t.ok((select identity#>>'{class,code}' from public.learning_journey(t.u('A')) where id = ta) = 'DH2.KD18', 'Hành trình dùng danh tính LỊCH SỬ (snapshot)');
  perform t.ok((select array_agg(id order by created_at) from public.learning_journey(t.u('A'))) = (select array_agg(id) from public.learning_journey(t.u('A'))), 'theo thứ tự thời gian');
  perform t.as_user('B');
  perform t.ok((select count(*) from public.learning_journey(t.u('B'))) = 1 and (select identity->'class' from public.learning_journey(t.u('B'))) = 'null'::jsonb,
               'tự học (không lớp) vẫn có Hành trình; lớp = null');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.learning_journey(t.u('B'))) = 0, 'người khác KHÔNG thấy thread private của B trong Hành trình');
  perform t.ok(exists (select 1 from public.learning_journey(t.u('A')) where id = ta), 'thành viên Class thấy thread community của A trong Hành trình');
  perform t.ok(exists (select 1 from public.learning_journey(t.u('C')) where id = th), 'chính chủ C vẫn thấy thread bị ẩn của mình');
  perform t.as_user('A');
  perform t.ok(not exists (select 1 from public.learning_journey(t.u('C')) where id = th), 'người khác KHÔNG thấy thread bị ẩn');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.learning_journey(t.u('A'))) = 0, 'ngoài Class: Hành trình rỗng');
  perform t.as_user('T');
  perform t.ok(exists (select 1 from public.learning_journey(t.u('B')) where id = tb), 'Thầy thấy thread private trong Hành trình');
  perform t.reset();
  perform t.ok((select count(*) from public.class_posts) = 1 and not exists (select 1 from public.class_posts where type not in ('assignment', 'status')),
               'KHÔNG tạo class_posts nào từ Learning Thread');
end $$;

select 'ALL LEARNING THREAD P2 SQL TESTS PASS' as result;
