-- ═══ TEST CLASS MEMBERSHIP CANONICAL V1 — cluster PostgreSQL TẠM. KHÔNG chạy production. ═══
-- Nạp SAU: fixture + P1/P2 + Lớp học V1 + Feed V1 + Lớp của tôi V1 + Identity V1 + class_membership_canonical_fixture
--          + bước "lớp Zalo cũ" (scripts/test-class-membership-canonical-db.sh) + class_membership_canonical_v1_setup.
-- Người: A, B (SOLO01.TH01) · C (SOLO01.TH02 + lớp Zalo cũ ZZ.T9) · D (học sinh mới) · T (thầy) · N (ngoài Class).
-- Mồi bẫy: nhóm Zalo mã 'SOLO01.TH02' (trùng mã lớp, KHÔNG canonical) có B → B KHÔNG được tính là thành viên.
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid when 'D' then 'dddd0000-0000-4000-8000-0000000000d1'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- hàm nội bộ (vd lt_identity_snapshot chỉ RPC lt_* SECURITY DEFINER gọi): chạy như postgres mang auth.uid() của k
create function t.as_claims(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
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
create function t.cls(code text) returns uuid language sql stable security definer as $$ select id from public.class_schedule where class_schedule.code = cls.code $$;
grant execute on function t.cls(text) to anon, authenticated;

do $$
declare zz uuid := t.cls('ZZ.T9'); solo2 uuid := t.cls('SOLO01.TH02'); n int; j jsonb; r record;
  sid_d uuid := (select id from public.edu_students where user_id = 'dddd0000-0000-4000-8000-0000000000d1');
  lead_d bigint := (select id from public.leads where note like '%ccm-test%');
begin
  -- ── 1) MỘT nguồn: view canonical ──
  perform t.ok((select count(*) from tva_private.class_memberships where class_id = zz) = 1, 'lớp Zalo cũ ZZ.T9: 1 thành viên canonical (C)');
  perform t.ok(not exists (select 1 from tva_private.class_memberships where class_id = solo2 and user_id = t.u('B')),
    'nhóm trùng MÃ lớp (không canonical) KHÔNG làm B thành thành viên SOLO01.TH02');
  perform t.ok((select count(*) from public.class_schedule where group_id is distinct from cohort_group_id) = 0, 'mọi lớp: group_id = cohort_group_id');

  -- ── 2) Học sinh lớp Zalo cũ: Social thấy · App thấy · Admin đếm — CÙNG một con số ──
  perform t.as_user('C');
  perform t.ok(exists (select 1 from public.social_my_classes() c where (c ->> 'id')::uuid = zz), 'Social: C thấy ZZ.T9 trong Lớp của tôi');
  perform t.ok(exists (select 1 from public.my_class_memberships() m where m.class_id = zz), 'App: my_class_memberships của C có ZZ.T9');
  perform t.ok((select count(*) from public.my_class_memberships()) = 2, 'App: C có đúng 2 lớp (SOLO01.TH02 cohort + ZZ.T9)');
  j := public.social_class_detail(zz);
  perform t.ok((j ->> 'member_count')::int = 1 and (j ->> 'is_member')::boolean, 'Social: thẻ lớp ZZ.T9 sĩ số 1, C là thành viên');
  perform t.fails('select * from tva_private.class_memberships', 'học sinh không đọc thẳng view canonical', 'permission denied for view class_memberships');
  perform t.fails('select * from public.admin_class_member_summary()', 'học sinh không gọi tóm tắt Admin', 'teacher/admin required');
  perform t.fails(format('select * from public.class_roster(%L)', zz), 'học sinh không xem roster Admin', 'teacher/admin required');
  perform t.as_user('B');
  perform t.ok(not (public.social_class_detail(solo2) ->> 'is_member')::boolean, 'Social: B KHÔNG thuộc SOLO01.TH02 (bỏ luật trùng mã)');
  perform t.ok(not exists (select 1 from public.my_class_memberships() m where m.class_id = solo2), 'App: B không có SOLO01.TH02');

  perform t.as_user('T');
  select jsonb_agg(to_jsonb(s)) into j from public.admin_class_member_summary() s;
  perform t.reset();
  for r in select x.class_id, x.member_count, (public.social_class_card(x.class_id) ->> 'member_count')::int as social_n,
                  (select count(*)::int from tva_private.class_memberships m where m.class_id = x.class_id
                     and not exists (select 1 from public.app_users a where a.id = m.user_id and a.role in ('teacher', 'admin'))) as view_n
           from jsonb_to_recordset(j) x(class_id uuid, member_count int) loop
    if r.member_count is distinct from r.social_n or r.member_count is distinct from r.view_n then
      raise exception 'FAIL: lớp % Admin % ≠ Social % ≠ canonical %', r.class_id, r.member_count, r.social_n, r.view_n;
    end if;
  end loop;
  perform t.ok(jsonb_array_length(j) = (select count(*) from public.class_schedule), 'Admin: tóm tắt có ĐỦ mọi lớp');
  perform t.ok(true, 'Admin = Social = canonical cho MỌI lớp (admin_class_member_summary)');
  perform t.as_user('T');
  select * into r from public.admin_class_member_summary() s where s.class_id = zz;
  perform t.ok(r.group_name = 'Nhóm Zalo ZZ' and r.member_count = 1 and r.zalo_url = 'https://zalo.me/g/zz', 'Admin: ZZ.T9 hiện rõ nhóm canonical "Nhóm Zalo ZZ" + link + sĩ số 1');

  -- ── 3) Learning Identity: chỉ từ membership canonical ──
  perform t.as_user('A');
  select memberships into j from public.social_learning_identities(array[t.u('C'), t.u('B')]) where user_id = t.u('C');
  perform t.ok(j @> jsonb_build_array(jsonb_build_object('class_code', 'ZZ.T9')), 'Learning Identity của C có ZZ.T9');
  select memberships into j from public.social_learning_identities(array[t.u('B')]) where user_id = t.u('B');
  perform t.ok(not (j @> jsonb_build_array(jsonb_build_object('class_code', 'SOLO01.TH02'))), 'Learning Identity của B KHÔNG có SOLO01.TH02 (trùng mã)');

  -- ── 4) Membership ≠ quyền Giáo trình ──
  perform t.as_user('C');
  perform t.ok(not tva_private.can_read_class_curriculum(zz), 'C thuộc ZZ.T9 nhưng Giáo trình CHƯA bật → không đọc');
  perform t.as_user('T');
  perform t.ok(public.manage_class_curriculum_access(zz, t.u('C'), 'grant') = 'active', 'Thầy bật Giáo trình ZZ.T9 cho C (không cần cohort CLASS.<mã>)');
  perform t.fails(format('select public.manage_class_curriculum_access(%L, %L, ''grant'')', zz, t.u('D')), 'không bật Giáo trình cho người ngoài lớp', 'active class membership required');
  perform t.as_user('C');
  perform t.ok(tva_private.can_read_class_curriculum(zz), 'C: thành viên + quyền → đọc được Giáo trình');
  perform t.as_user('A');
  perform t.ok(tva_private.can_read_class_curriculum(t.cls('SOLO01.TH01')), 'A: lớp cohort cũ SOLO01.TH01 vẫn đọc Giáo trình (không hồi quy)');

  -- ── 5) Đường ghi: Admin thêm/bỏ vào NHÓM CANONICAL; trigger cấp khoá theo lớp canonical ──
  perform t.as_user('T');
  perform t.ok(public.manage_class_membership(zz, t.u('D'), 'add') = 'active', 'Admin thêm D vào ZZ.T9 (lớp Zalo — trước V1 bị chặn)');
  perform t.reset();
  perform t.ok(exists (select 1 from public.edu_group_members where group_id = (select cohort_group_id from public.class_schedule where id = zz) and user_id = t.u('D') and status = 'active'),
    'D được ghi vào đúng nhóm canonical của lớp');
  perform t.ok(exists (select 1 from public.edu_course_access a join public.edu_students s on s.id = a.student_id
                       where s.user_id = t.u('D') and a.course_id = 'c0000000-0000-4000-8000-0000000000d2' and a.note = 'Vào lớp ZZ.T9'),
    'trigger cấp khoá: vào nhóm canonical → cấp course_ids của CHÍNH lớp ZZ.T9');
  perform t.as_user('D');
  perform t.ok(exists (select 1 from public.my_class_memberships() m where m.class_id = zz), 'App: D thấy ZZ.T9 ngay');
  perform t.as_user('C');
  perform t.ok((public.social_class_detail(zz) ->> 'member_count')::int = 2, 'Social: sĩ số ZZ.T9 = 2');
  perform t.ok(exists (select 1 from public.my_class_leaderboard() b where b.student_id = sid_d),
    'Bảng xếp hạng lớp của C có D (bạn cùng lớp canonical)');
  j := public.my_membership();
  perform t.ok(j -> 'classes' @> '[{"code":"ZZ.T9"}]'::jsonb, 'my_membership.classes của C có ZZ.T9');
  perform t.as_user('A');
  perform t.fails(format('select public.manage_class_membership(%L, %L, ''add'')', zz, t.u('N')), 'học sinh không tự thêm người', 'teacher/admin required');
  perform t.as_user('T');
  perform t.fails(format('select public.manage_class_membership(%L, %L, ''add'')', t.cls('CXL.T1'), t.u('D')), 'không thêm vào lớp đã huỷ', 'class is closed');
  perform t.fails(format('select public.manage_class_membership(%L, %L, ''add'')', t.cls('NOGRP.T1'), t.u('D')), 'lớp chưa có nhóm → báo rõ', 'class has no member group');
  perform t.fails(format('select public.manage_class_membership(%L, %L, ''add'')', zz, t.u('N')), 'không thêm người chưa có hồ sơ học sinh', 'active student account required');
  perform t.ok((select count(*) from public.class_roster(zz) x where x.status = 'active') = 2, 'roster Admin ZZ.T9: 2 người active');
  perform t.ok(public.manage_class_membership(zz, t.u('D'), 'remove') = 'removed', 'Admin bỏ D khỏi ZZ.T9');
  perform t.ok(exists (select 1 from public.class_roster(zz) x where x.user_id = t.u('D') and x.status = 'removed'), 'roster vẫn hiện D (đã bỏ) để thêm lại');
  perform t.ok((select member_count from public.admin_class_member_summary() s where s.class_id = zz) = 1, 'Admin: sĩ số về 1 sau khi bỏ');
  perform t.as_user('D');
  perform t.ok(not exists (select 1 from public.my_class_memberships() m where m.class_id = zz), 'App: D hết thấy ZZ.T9');

  -- ── 6) Gói membership (activate_class_membership) ghi vào nhóm canonical ──
  perform t.as_user('T');
  j := public.activate_class_membership(lead_d);
  perform t.ok(j ->> 'class_code' = 'ZZ.T9' and j ->> 'zalo_url' = 'https://zalo.me/g/zz', 'activate_class_membership: lớp ZZ.T9 + link nhóm canonical');
  perform t.as_user('D');
  perform t.ok(exists (select 1 from public.my_class_memberships() m where m.class_id = zz), 'sau kích hoạt gói: D thấy ZZ.T9 (không có membership "vô hình")');

  -- ── 7) backfill_class: chỉ Thầy/service; theo lớp canonical ──
  perform t.as_user('C');
  perform t.fails($q$ select public.backfill_class('ZZ.T9') $q$, 'học sinh không gọi backfill_class', 'teacher/admin required');
  perform t.as_user('T');
  perform t.ok(public.backfill_class('ZZ.T9') >= 2, 'Thầy: backfill_class(ZZ.T9) cấp khoá cho thành viên canonical');
  perform t.ok(public.backfill_class('Z-CODE-ZZ') >= 2, 'backfill_class nhận cả mã của nhóm canonical (admin-ai gửi mã nhóm)');
  perform t.as_anon();
  perform t.fails($q$ select public.backfill_class('ZZ.T9') $q$, 'khách không gọi backfill_class', 'permission denied');
  perform t.fails($q$ select * from public.my_class_memberships() $q$, 'khách không gọi my_class_memberships', 'permission denied');

  -- ── 8) Learning Thread: thread MỚI đóng dấu lớp canonical ──
  perform t.as_claims('C');
  j := public.lt_identity_snapshot('e0000000-0000-4000-8000-000000000001');
  perform t.ok(j #>> '{class,code}' = 'ZZ.T9', 'lt_identity_snapshot của C (bài khoá DH2) → lớp canonical ZZ.T9: ' || coalesce(j #>> '{class,code}', 'null'));
  perform t.as_claims('B');
  j := public.lt_identity_snapshot('e0000000-0000-4000-8000-000000000001');
  perform t.ok(j -> 'class' = 'null'::jsonb or j -> 'class' is null, 'B (không thuộc lớp nào dạy DH2) → Tự học');
  perform t.as_claims('A');
  j := public.lt_identity_snapshot('e0000000-0000-4000-8000-000000000001');
  perform t.ok(j #>> '{class,code}' = 'DH2.KD18', 'A vẫn đóng dấu DH2.KD18 (cohort cũ, không hồi quy)');

  -- ── 9) Một lớp → một nhóm: trigger đồng bộ + CHECK ──
  perform t.reset();
  update public.class_schedule set group_id = (select id from public.edu_groups where code = 'Z-CODE-ZZ') where code = 'NOGRP.T1';
  perform t.ok((select cohort_group_id from public.class_schedule where code = 'NOGRP.T1') = (select id from public.edu_groups where code = 'Z-CODE-ZZ'),
    'Lịch lớp cũ ghi group_id → cohort_group_id (canonical) đi theo');
  update public.class_schedule set cohort_group_id = null where code = 'NOGRP.T1';
  perform t.ok((select group_id from public.class_schedule where code = 'NOGRP.T1') is null, 'bỏ canonical → group_id cũng bỏ');
  perform t.fails($q$ insert into public.class_schedule (code, name, group_id, cohort_group_id)
                      values ('BAD.T1', 'x', (select id from public.edu_groups where code = 'Z-CODE-ZZ'), (select id from public.edu_groups where code = 'CLASS.SOLO01.TH01')) $q$,
    'không tạo được lớp có HAI nhóm khác nhau', 'class_schedule_one_member_group');
  perform t.fails($q$ update public.class_schedule set group_id = '00000000-dead-4000-8000-000000000000' where code = 'NOGRP.T1' $q$,
    'không gắn được nhóm không tồn tại (FK của cohort)', 'foreign key');
end $$;

drop schema t cascade;
