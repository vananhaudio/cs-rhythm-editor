-- ═══ TEST Class Social — FEED V1 (social_feed_scoped) — cluster PostgreSQL TẠM (scripts/test-learning-threads-db.sh) ═══
-- Nạp SAU fixture + P1 + P2 + social_classes_v1 + social_feed_v1. KHÔNG chạy production.
-- Người: A (xem) · B (bạn của A) · C (A gửi lời mời, CHƯA chấp nhận) · T (Thầy) · N (ngoài Class)
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
-- Nhãn các mục của một góc nhìn (toàn bộ, không phân trang): 't:<nhãn>' / 'p:<nhãn>' theo thứ tự trả về
create table t.label (id uuid primary key, name text not null);
create function t.feed(p_scope text) returns text[] language sql as $$
  select coalesce(array_agg(coalesce(l.name, f.sort_key) order by f.sort_at desc, f.sort_key desc), '{}')
  from public.social_feed_scoped(p_scope, null, null, 50) f
  left join t.label l on 't:' || l.id::text = f.sort_key or 'p:' || l.id::text = f.sort_key
$$;
grant select on t.label to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- ── Dữ liệu ─────────────────────────────────────────────────────────────────────
-- Lớp: X = DH2.KD18 (fixture, A) · Y, Z (A) · W đã huỷ (A vẫn trong nhóm) · Q (không có A)
insert into public.edu_groups (id, name, group_type, code) values
  ('f0000000-0000-4000-8000-0000000000e1', 'Y', 'class', 'SOLO01.TH01'),
  ('f0000000-0000-4000-8000-0000000000e2', 'Z', 'class', 'HT2027.TH01'),
  ('f0000000-0000-4000-8000-0000000000e3', 'W', 'class', 'DH1.OLD'),
  ('f0000000-0000-4000-8000-0000000000e4', 'Q', 'class', 'DH3.NC02');
insert into public.class_schedule (id, code, name, status, is_active, start_date, cohort_group_id) values
  ('b0000000-0000-4000-8000-0000000000e1', 'SOLO01.TH01', 'Solo Guitar 01', 'active', true, current_date - 5, 'f0000000-0000-4000-8000-0000000000e1'),
  ('b0000000-0000-4000-8000-0000000000e2', 'HT2027.TH01', 'Hành trình 2027 — 40 buổi', 'active', true, current_date - 9, 'f0000000-0000-4000-8000-0000000000e2'),
  ('b0000000-0000-4000-8000-0000000000e3', 'DH1.OLD', 'Lớp đã huỷ', 'cancelled', true, current_date - 400, 'f0000000-0000-4000-8000-0000000000e3'),
  ('b0000000-0000-4000-8000-0000000000e4', 'DH3.NC02', 'Nâng cao', 'active', true, current_date - 3, 'f0000000-0000-4000-8000-0000000000e4');
insert into public.edu_group_members (user_id, group_id, source, status) values
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000e1', 'admin', 'active'),
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000e2', 'admin', 'active'),
  (t.u('A'), 'f0000000-0000-4000-8000-0000000000e3', 'admin', 'active'),
  (t.u('C'), 'f0000000-0000-4000-8000-0000000000e4', 'admin', 'active');
-- Bạn bè: A–B chấp nhận · A→C đang chờ · B–C chấp nhận
insert into public.friendships (requester_id, addressee_id, status) values
  (t.u('A'), t.u('B'), 'accepted'), (t.u('A'), t.u('C'), 'pending'), (t.u('C'), t.u('B'), 'accepted');

create function t.thread(p_label text, p_learner uuid, p_class uuid, p_vis text, p_at timestamptz,
                         p_hidden boolean default false, p_archived boolean default false) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into public.learning_threads (id, learner_user_id, content_key, identity, class_schedule_id, visibility, status,
                                       last_event_at, last_student_event_at, event_count, hidden_at, archived_at)
  values (v, p_learner, 'L:' || gen_random_uuid(), jsonb_build_object('lesson', jsonb_build_object('title', p_label)),
          p_class, p_vis, case when p_archived then 'archived' else 'waiting_teacher' end, p_at, p_at, 1,
          case when p_hidden then now() end, case when p_archived then now() end);
  insert into t.label values (v, 't:' || p_label);
  return v;
end $$;
create function t.post(p_label text, p_author uuid, p_type text, p_audience text, p_at timestamptz, p_hidden boolean default false) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into public.class_posts (id, author_user_id, type, audience, body, created_at, hidden_at)
  values (v, p_author, p_type, p_audience, p_label, p_at, case when p_hidden then now() end);
  insert into t.label values (v, 'p:' || p_label);
  return v;
end $$;

do $$ begin
  perform t.thread('B-X',        t.u('B'), 'b0000000-0000-4000-8000-0000000000c1', 'community', '2026-09-20 10:00+00');
  perform t.thread('B-X-private',t.u('B'), 'b0000000-0000-4000-8000-0000000000c1', 'private',   '2026-09-20 11:00+00');
  perform t.thread('C-Y',        t.u('C'), 'b0000000-0000-4000-8000-0000000000e1', 'community', '2026-09-20 12:00+00');
  perform t.thread('C-selfstudy',t.u('C'), null,                                   'community', '2026-09-20 13:00+00');
  perform t.thread('A-Z',        t.u('A'), 'b0000000-0000-4000-8000-0000000000e2', 'community', '2026-09-20 14:00+00');
  perform t.thread('B-W-cancel', t.u('B'), 'b0000000-0000-4000-8000-0000000000e3', 'community', '2026-09-20 15:00+00');
  perform t.thread('C-Q',        t.u('C'), 'b0000000-0000-4000-8000-0000000000e4', 'community', '2026-09-20 16:00+00');
  perform t.thread('B-X-hidden', t.u('B'), 'b0000000-0000-4000-8000-0000000000c1', 'community', '2026-09-20 17:00+00', true);
  perform t.thread('B-X-archiv', t.u('B'), 'b0000000-0000-4000-8000-0000000000c1', 'community', '2026-09-20 18:00+00', false, true);
  perform t.thread('B-self',     t.u('B'), null,                                   'community', '2026-09-20 09:00+00');
  perform t.post('B-status',  t.u('B'), 'status',     'friends', '2026-09-20 10:30+00');
  perform t.post('B-assign',  t.u('B'), 'assignment', 'class',   '2026-09-20 10:40+00');
  perform t.post('B-hidden',  t.u('B'), 'assignment', 'class',   '2026-09-20 10:50+00', true);
  perform t.post('C-status',  t.u('C'), 'status',     'friends', '2026-09-20 10:35+00');
  perform t.post('A-status',  t.u('A'), 'status',     'friends', '2026-09-20 10:45+00');
end $$;

-- ── Kiểm ───────────────────────────────────────────────────────────────────────
do $$
declare mc text[]; fr text[]; fy text[]; base text[];
begin
  perform t.as_user('A');
  mc := t.feed('my_classes');
  perform t.ok(mc = array['t:A-Z', 't:C-Y', 't:B-X'],
    'Lớp của tôi (A ở X, Y, Z): gộp mọi lớp HIỆN TẠI, mới nhất trước — không Tự học, không lớp huỷ W, không lớp Q của người khác, không private/ẩn/lưu trữ, không bài Social: ' || mc::text);
  fr := t.feed('friends');
  perform t.ok(fr = array['t:B-W-cancel', 'p:B-assign', 'p:B-status', 't:B-X', 't:B-self'],
    'Bạn bè (A–B đã là bạn): bài + thread community của B (cả Tự học) — không thread "Chỉ Thầy", không bài đã ẩn, không C (mới chờ), không chính mình: ' || fr::text);
  fy := t.feed('for_you');
  select coalesce(array_agg(coalesce(l.name, f.sort_key) order by f.sort_at desc, f.sort_key desc), '{}') into base
    from public.social_feed(null, null, 50) f left join t.label l on 't:' || l.id::text = f.sort_key or 'p:' || l.id::text = f.sort_key;
  perform t.ok(fy = base and cardinality(fy) > 0, 'Dành cho bạn = ĐÚNG social_feed() hiện có (không đổi ngữ nghĩa)');
  perform t.ok(not ('t:B-X-private' = any(fy)) and not ('p:C-status' = any(fy)), 'Dành cho bạn vẫn không có thread "Chỉ Thầy" / bài chỉ-bạn-bè của người chưa là bạn');
  perform t.ok((select count(*) from unnest(fy) x where x = 't:B-X') = 1 and (select count(*) from unnest(mc) x where x = 't:B-X') = 1
               and (select count(*) from unnest(fr) x where x = 't:B-X') = 1,
    'B vừa là bạn vừa cùng lớp X: thread B-X xuất hiện ĐÚNG 1 lần trong mỗi góc nhìn');

  perform t.as_user('C');
  perform t.ok(t.feed('my_classes') = array['t:C-Q'], 'C (lớp Q): chỉ hoạt động lớp Q — C-Y không vào vì C không thuộc Y');
  perform t.ok(t.feed('friends') = array['t:B-W-cancel', 'p:B-assign', 'p:B-status', 't:B-X', 't:B-self'],
    'C–B là bạn: C thấy bài + thread community của B (không thread "Chỉ Thầy", không bài ẩn)');
  perform t.ok(not ('t:A-Z' = any(t.feed('friends'))), 'A→C còn chờ: hoạt động của A KHÔNG vào tab Bạn bè của C');

  perform t.as_user('T');
  perform t.ok(t.feed('my_classes') = '{}', 'Thầy không thuộc nhóm lớp nào → Lớp của tôi trống (KHÔNG hard-code "Thầy thấy mọi lớp")');
  perform t.ok(t.feed('friends') = '{}', 'Thầy chưa có bạn → Bạn bè trống (không phải bộ lọc kiểm duyệt)');

  perform t.as_user('N');
  perform t.ok(t.feed('my_classes') = '{}' and t.feed('friends') = '{}', 'Ngoài Class: không thấy gì');
  perform t.reset();
end $$;

-- Tham số sai / khách
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$ select * from public.social_feed_scoped('everything') $q$, 'góc nhìn lạ bị từ chối', 'SF_BAD_SCOPE');
  perform t.fails($q$ select * from public.social_feed_scoped(null) $q$, 'góc nhìn null bị từ chối', 'SF_BAD_SCOPE');
  perform t.as_anon();
  perform t.fails($q$ select * from public.social_feed_scoped('friends') $q$, 'khách không gọi được', 'permission denied');
  perform t.fails($q$ select public.social_post_card(gen_random_uuid()) $q$, 'hàm nội bộ social_post_card: khách bị chặn', 'permission denied');
  perform t.as_user('A');
  perform t.fails($q$ select public.social_post_card(gen_random_uuid()) $q$, 'hàm nội bộ social_post_card: học sinh không gọi thẳng', 'permission denied');
  perform t.reset();
end $$;

-- Phân trang: 25 thread cùng lớp X, 5 cặp TRÙNG thời điểm → trang 7 mục: không trùng, không sót, cursor theo góc nhìn
do $$
declare i int; seen text[] := '{}'; pg record; cur_at timestamptz; cur_key text; n int; total int;
begin
  for i in 1..25 loop
    perform t.thread('page-' || i, t.u('B'), 'b0000000-0000-4000-8000-0000000000c1', 'community',
                     '2026-09-10 00:00+00'::timestamptz + ((i + 1) / 2) * interval '1 hour');
  end loop;
  perform t.as_user('A');
  select count(*) into total from public.social_feed_scoped('my_classes', null, null, 50);
  loop
    n := 0;
    for pg in select * from public.social_feed_scoped('my_classes', cur_at, cur_key, 7) loop
      seen := seen || pg.sort_key; cur_at := pg.sort_at; cur_key := pg.sort_key; n := n + 1;
    end loop;
    exit when n < 7;
  end loop;
  perform t.ok(cardinality(seen) = total and (select count(distinct x) from unnest(seen) x) = total and total = 28,
    format('phân trang 7/trang: %s mục, không trùng, không sót (kể cả mốc trùng thời điểm)', cardinality(seen)));
  perform t.reset();
end $$;

-- Hoạt động mới: thread nổi lên đầu, vẫn MỘT mục
do $$ begin
  update public.learning_threads set last_event_at = '2026-09-25 00:00+00'
   where id = (select id from t.label where name = 't:B-X');
  perform t.as_user('A');
  perform t.ok((t.feed('my_classes'))[1] = 't:B-X' and (select count(*) from unnest(t.feed('my_classes')) x where x = 't:B-X') = 1,
    'B-X có lượt mới → lên đầu Lớp của tôi, vẫn một mục');
  perform t.ok((t.feed('friends'))[1] = 't:B-X', 'và lên đầu tab Bạn bè');
  perform t.reset();
end $$;

-- Huỷ kết bạn → biến khỏi Bạn bè (vẫn ở Lớp của tôi vì cùng lớp) · Rời lớp → biến khỏi Lớp của tôi, snapshot KHÔNG đổi
do $$
declare snap uuid;
begin
  delete from public.friendships where least(requester_id, addressee_id) = least(t.u('A'), t.u('B'))
                                   and greatest(requester_id, addressee_id) = greatest(t.u('A'), t.u('B'));
  perform t.as_user('A');
  perform t.ok(t.feed('friends') = '{}', 'huỷ kết bạn với B → tab Bạn bè của A không còn gì của B');
  perform t.ok('t:B-X' = any(t.feed('my_classes')), 'B-X vẫn ở Lớp của tôi (A còn trong lớp X)');
  perform t.reset();
  update public.edu_group_members set status = 'inactive' where user_id = t.u('A') and group_id = 'f0000000-0000-4000-8000-0000000000c1';
  perform t.as_user('A');
  perform t.ok(not ('t:B-X' = any(t.feed('my_classes'))) and t.feed('my_classes') = array['t:A-Z', 't:C-Y'],
    'A rời lớp X → hoạt động lớp X không còn ở Lớp của tôi');
  perform t.reset();
  select class_schedule_id into snap from public.learning_threads where id = (select id from t.label where name = 't:B-X');
  perform t.ok(snap = 'b0000000-0000-4000-8000-0000000000c1', 'snapshot lớp của thread KHÔNG đổi');
end $$;

drop schema t cascade;
