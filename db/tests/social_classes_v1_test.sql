-- ═══ TEST Social UX + Lớp học V1 — cluster PostgreSQL TẠM (scripts/test-learning-threads-db.sh) ═══
-- Nạp SAU fixture + P1 + P2 + social_classes_v1. A (lớp DH2.KD18) · B (tự học) · C (lớp SOLO01.TH01) · T (thầy) · N (ngoài Class)
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

-- ── Dữ liệu lớp thật trong fixture: DH2.KD18 (A). Thêm: SOLO01.TH01 (C), lớp huỷ, lớp tắt; Thầy thuộc nhóm KD18 ──
insert into public.edu_groups (id, name, group_type, code) values
  ('f0000000-0000-4000-8000-0000000000c2', 'SOLO01.TH01', 'class', 'SOLO01.TH01'),
  ('f0000000-0000-4000-8000-0000000000c3', 'DH1.OLD', 'class', 'DH1.OLD');
insert into public.class_schedule (id, code, name, status, is_active, start_date, cohort_group_id, zoom_url, price, schedule) values
  ('b0000000-0000-4000-8000-0000000000c2', 'SOLO01.TH01', 'Solo Guitar 01', 'recruiting', true, current_date + 10, 'f0000000-0000-4000-8000-0000000000c2', 'https://zoom.us/j/SECRET', '9.999.000đ', 'Thứ 4 · 20:00'),
  ('b0000000-0000-4000-8000-0000000000c3', 'DH1.OLD', 'Lớp đã huỷ', 'cancelled', true, current_date - 400, 'f0000000-0000-4000-8000-0000000000c3', null, null, null),
  ('b0000000-0000-4000-8000-0000000000c4', 'DH9.OFF', 'Lớp tắt', 'active', false, current_date, null, null, null, null);
update public.class_schedule set zoom_url = 'https://zoom.us/j/KD18SECRET', schedule = 'Thứ 3 · 20:00' where code = 'DH2.KD18';
insert into public.edu_group_members (user_id, group_id, source, status) values
  ('cccccccc-0000-4000-8000-00000000000c', 'f0000000-0000-4000-8000-0000000000c2', 'admin', 'active'),
  ('dddddddd-0000-4000-8000-00000000000d', 'f0000000-0000-4000-8000-0000000000c1', 'admin', 'active'),
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000c3', 'admin', 'active');

-- Thread: A (lớp KD18, community) · B (tự học, private) · bài tường của A (friends)
do $$ begin
  perform t.as_user('T');
  perform public.lt_set_lesson_settings('e0000000-0000-4000-8000-000000000001', 'allowed', 'allowed');
  perform t.as_user('A');
  perform public.lt_submit('e0000000-0000-4000-8000-000000000001', 'question', 'A hỏi trong lớp');
  insert into public.class_posts (type, audience, body) values ('status', 'friends', 'A: 🎸 Đang tập Bolero');
  perform t.as_user('B');
  perform public.lt_submit('e0000000-0000-4000-8000-000000000001', 'submission', 'B tự học', null, null, null, 'private');
  perform t.reset();
end $$;

-- ── 1) Quyền gọi ────────────────────────────────────────────────────────────
do $$ begin
  perform t.as_anon();
  perform t.fails($q$select * from public.social_my_classes()$q$, 'khách không gọi được social_my_classes', 'permission denied');
  perform t.fails($q$select public.social_class_detail('b0000000-0000-4000-8000-0000000000c1')$q$, 'khách không gọi được social_class_detail', 'permission denied');
  perform t.as_user('A');
  perform t.fails($q$select public.social_class_card('b0000000-0000-4000-8000-0000000000c1')$q$, 'social_class_card là hàm nội bộ', 'permission denied');
  perform t.fails($q$select * from public.social_class_members_of('b0000000-0000-4000-8000-0000000000c1')$q$, 'social_class_members_of là hàm nội bộ', 'permission denied');
  perform t.as_user('N');
  perform t.ok((select count(*) from public.social_my_classes()) = 0 and (select count(*) from public.social_discover_classes()) = 0, 'ngoài Class: không có lớp nào');
  perform t.fails($q$select public.social_class_detail('b0000000-0000-4000-8000-0000000000c1')$q$, 'ngoài Class: không xem lớp', 'SC_NOT_MEMBER');
  perform t.reset();
end $$;

-- ── 2) Lớp của tôi / Khám phá ───────────────────────────────────────────────
do $$ declare mine jsonb; card jsonb; begin
  perform t.as_user('A');
  select jsonb_agg(x ->> 'code') into mine from public.social_my_classes() x;
  perform t.ok(mine = '["DH2.KD18"]'::jsonb, 'A: Lớp của tôi = DH2.KD18 (lớp đã huỷ không hiện dù còn là thành viên nhóm)');
  perform t.ok((select jsonb_agg(x ->> 'code') from public.social_discover_classes() x) = '["SOLO01.TH01"]'::jsonb,
               'A: Khám phá = lớp active/tuyển sinh CHƯA tham gia (không lớp của mình, không lớp huỷ/tắt)');
  select x into card from public.social_my_classes() x limit 1;
  perform t.ok((card ->> 'member_count')::int = 1 and card -> 'teachers' -> 0 ->> 'name' = 'Thầy Văn Anh' and (card ->> 'is_member')::boolean
               and (card ->> 'activity_count')::int = 1 and card #>> '{course,code}' = 'DH2' and card ->> 'schedule' = 'Thứ 3 · 20:00',
               'thẻ lớp: 1 học viên (không đếm Thầy) · Thầy từ thành viên nhóm (tên thật) · khoá chính · lịch · 1 hoạt động');
  perform t.ok(position('SECRET' in card::text) = 0 and position('zoom' in card::text) = 0 and position('9.999' in card::text) = 0,
               'thẻ lớp KHÔNG lộ zoom_url / giá');
  perform t.as_user('C');
  perform t.ok((select jsonb_agg(x ->> 'code') from public.social_my_classes() x) = '["SOLO01.TH01"]'::jsonb, 'C: Lớp của tôi = SOLO01.TH01');
  perform t.reset();
end $$;

-- ── 3) Người ngoài xem lớp khác ─────────────────────────────────────────────
do $$ declare d jsonb; begin
  perform t.as_user('C');
  d := public.social_class_detail('b0000000-0000-4000-8000-0000000000c1');
  perform t.ok(d ->> 'code' = 'DH2.KD18' and not (d ->> 'is_member')::boolean and not (d ->> 'can_view_members')::boolean,
               'C (ngoài lớp) xem được trang công khai KD18: không phải thành viên, không xem danh sách thành viên');
  perform t.ok((select count(*) from public.social_class_activity('b0000000-0000-4000-8000-0000000000c1')) = 1
               and (select thread #>> '{identity,class,code}' from public.social_class_activity('b0000000-0000-4000-8000-0000000000c1')) = 'DH2.KD18',
               'C thấy hoạt động công khai của KD18: 1 thread community có snapshot thuộc lớp');
  perform t.fails($q$select * from public.social_class_members('b0000000-0000-4000-8000-0000000000c1')$q$, 'C không xem danh sách thành viên KD18', 'SC_MEMBERS_ONLY');
  perform t.fails($q$select public.social_class_detail('b0000000-0000-4000-8000-0000000000c3')$q$, 'lớp đã huỷ: không có trang', 'SC_NOT_FOUND');
  perform t.as_user('A');
  perform public.lt_set_visibility((select id from public.lt_my_threads() limit 1), 'private');
  perform t.as_user('C');
  perform t.ok((select count(*) from public.social_class_activity('b0000000-0000-4000-8000-0000000000c1')) = 0, 'thread chuyển "Chỉ Thầy" → biến khỏi hoạt động lớp');
  perform t.as_user('A');
  perform public.lt_set_visibility((select id from public.lt_my_threads() limit 1), 'community');
  perform t.ok(not exists (select 1 from public.social_class_activity('b0000000-0000-4000-8000-0000000000c1') x where x.thread #>> '{learner,name}' = 'Bình'),
               'thread tự học (private) của B không thuộc lớp nào');
  perform t.reset();
end $$;

-- ── 4) Thành viên lớp ───────────────────────────────────────────────────────
do $$ begin
  perform t.as_user('A');
  perform t.ok((select array_agg(name order by role desc, name) from public.social_class_members('b0000000-0000-4000-8000-0000000000c1')) = array['Thầy Văn Anh', 'An'],
               'A (thành viên) thấy thành viên KD18: Thầy + An');
  perform t.ok((select relationship from public.social_class_members('b0000000-0000-4000-8000-0000000000c1') where user_id = t.u('A')) = 'self'
               and (select relationship from public.social_class_members('b0000000-0000-4000-8000-0000000000c1') where user_id = t.u('T')) = 'none',
               'quan hệ bạn bè đi kèm (self / none) để nút Kết bạn dùng flow sẵn có');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.social_class_members('b0000000-0000-4000-8000-0000000000c2')) = 1, 'Thầy xem thành viên lớp khác (kiểm duyệt)');
  perform t.reset();
end $$;

-- ── 5) Feed "Dành cho bạn": bài tường chính mình + bạn bè; người ngoài không thấy ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(exists (select 1 from public.social_feed() where post ->> 'body' = 'A: 🎸 Đang tập Bolero'), 'A thấy bài vừa chia sẻ ngay trên Home');
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.social_feed() where post ->> 'body' = 'A: 🎸 Đang tập Bolero'), 'C (chưa là bạn) KHÔNG thấy bài tường của A');
  perform t.as_user('A'); perform public.send_friend_request(t.u('C'));
  perform t.as_user('C'); perform public.respond_friend_request(t.u('A'), true);
  perform t.ok(exists (select 1 from public.social_feed() where post ->> 'body' = 'A: 🎸 Đang tập Bolero' and post ->> 'audience' = 'friends'),
               'C (bạn bè) thấy bài tường của A trên Home, nhãn audience=friends');
  perform t.as_user('B');
  perform t.ok(not exists (select 1 from public.social_feed() where post ->> 'audience' = 'friends'), 'B (không phải bạn) không thấy bài friends nào');
  perform t.as_user('T');
  perform public.class_moderate('post', (select id from public.class_posts where body = 'A: 🎸 Đang tập Bolero'), true);
  perform t.as_user('C');
  perform t.ok(not exists (select 1 from public.social_feed() where post ->> 'body' = 'A: 🎸 Đang tập Bolero'), 'bài tường bị Thầy ẩn → không lên Home');
  perform t.reset();
end $$;

select 'ALL SOCIAL CLASSES V1 SQL TESTS PASS' as result;
