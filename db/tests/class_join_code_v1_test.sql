-- ═══ TEST JOIN CLASS BY CODE V1 + class_learning_entry — cluster PostgreSQL TẠM. KHÔNG chạy production. ═══
-- Nạp SAU môi trường test canonical (scripts/test-class-membership-canonical-db.sh) + class_join_code_v1_setup.
-- Người: E (học sinh mới, chưa thuộc lớp nào) · C (thành viên ZZ.T9) · B (ngoài ZZ.T9) · T (thầy) · N (không hồ sơ học sinh).
\set ON_ERROR_STOP on
insert into auth.users (id, email) values ('eeee0000-0000-4000-8000-0000000000e1', 'e2@test.local');
insert into public.app_users (id, role, name, email) values ('eeee0000-0000-4000-8000-0000000000e1', 'student', 'Em', 'e2@test.local');
insert into public.edu_students (user_id, full_name, email) values ('eeee0000-0000-4000-8000-0000000000e1', 'Trần Em', 'e2@test.local');

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid
                when 'E' then 'eeee0000-0000-4000-8000-0000000000e1'::uuid end $$;
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
create function t.cls(code text) returns uuid language sql stable security definer as $$ select id from public.class_schedule where class_schedule.code = cls.code $$;
grant execute on function t.cls(text) to anon, authenticated;

do $$
declare zz uuid := t.cls('ZZ.T9'); code1 text; code2 text; cxl text; j jsonb; n0 int; n1 int;
begin
  -- ── Admin: lấy / đổi mã ──
  perform t.as_user('T');
  code1 := public.admin_class_join_code(zz);
  perform t.ok(code1 ~ '^[A-HJ-KM-NP-Z2-9]{8}$', 'mã tham gia 8 ký tự, không I/L/O/0/1: ' || code1);
  perform t.ok(public.admin_class_join_code(zz) = code1, 'gọi lại không đổi mã');
  code2 := public.admin_class_join_code(zz, true);
  perform t.ok(code2 <> code1 and public.admin_class_join_code(zz) = code2, 'Đổi mã → mã mới, mã cũ hết hiệu lực');
  perform t.reset();
  perform t.ok(exists (select 1 from public.edu_group_claim_tokens where token = code2 and is_active
                       and group_id = (select cohort_group_id from public.class_schedule where id = zz)), 'mã nằm trong edu_group_claim_tokens, gắn nhóm canonical');
  perform t.as_user('T');
  cxl := public.admin_class_join_code(t.cls('CXL.T1'));
  perform t.fails(format('select public.admin_class_join_code(%L)', t.cls('NOGRP.T1')), 'lớp chưa có nhóm → không phát mã', 'class has no member group');
  perform t.as_user('C');
  perform t.fails(format('select public.admin_class_join_code(%L)', zz), 'học sinh không lấy mã Admin', 'teacher/admin required');

  -- ── Học sinh E: xem trước → tham gia (gõ thường + gạch nối vẫn nhận) ──
  perform t.as_user('E');
  j := public.class_join_preview(lower(substr(code2, 1, 4)) || '-' || lower(substr(code2, 5)));
  perform t.ok(j ->> 'code' = 'ZZ.T9' and not (j ->> 'already_member')::boolean, 'xem trước: đúng lớp ZZ.T9, chưa là thành viên');
  perform t.fails(format('select public.class_join(%L)', code1), 'mã cũ (đã đổi) bị từ chối', 'JOIN_INVALID');
  perform t.fails($q$ select public.class_join('ZZ.T9') $q$, 'mã lớp thô KHÔNG dùng để vào lớp', 'JOIN_INVALID');
  perform t.fails($q$ select public.class_join('ABCDEFGH') $q$, 'mã không tồn tại', 'JOIN_INVALID');
  perform t.reset(); select count(*) into n0 from public.edu_group_members; perform t.as_user('E');
  j := public.class_join(code2);
  perform t.ok((j ->> 'class_id')::uuid = zz and not (j ->> 'already_member')::boolean, 'E tham gia ZZ.T9 bằng mã');
  perform t.ok(exists (select 1 from public.my_class_memberships() m where m.class_id = zz), 'App: E thấy ZZ.T9 ngay');
  perform t.ok(exists (select 1 from public.social_my_classes() c where (c ->> 'id')::uuid = zz), 'Social: Lớp của tôi của E có ZZ.T9');
  perform t.ok((select memberships from public.social_learning_identities(array[t.u('E')])) @> '[{"class_code":"ZZ.T9"}]', 'Learning Identity của E có ZZ.T9');
  j := public.class_join(code2);
  perform t.ok((j ->> 'already_member')::boolean, 'tham gia lại: idempotent');
  perform t.reset(); select count(*) into n1 from public.edu_group_members;
  perform t.ok(n1 = n0 + 1, 'đúng MỘT hàng thành viên mới');
  perform t.ok((select source from public.edu_group_members where user_id = t.u('E') and group_id = (select cohort_group_id from public.class_schedule where id = zz)) = 'join_code',
    'ghi vào nhóm canonical với nguồn join_code');
  perform t.as_user('T');
  select s.member_count into n1 from public.admin_class_member_summary() s where s.class_id = zz;
  perform t.reset();
  perform t.ok(n1 = (public.social_class_card(zz) ->> 'member_count')::int
               and n1 = (select count(*) from tva_private.class_memberships m where m.class_id = zz)::int,
    'sau khi E tham gia: Admin = Social = canonical (' || n1 || ')');

  -- ── Chặn ──
  perform t.as_user('E');
  perform t.fails(format('select public.class_join(%L)', cxl), 'lớp đã huỷ không nhận người', 'JOIN_CLOSED');
  perform t.as_user('N');
  perform t.fails(format('select public.class_join(%L)', code2), 'chưa có hồ sơ học sinh → báo rõ', 'JOIN_NO_PROFILE');
  perform t.as_user('T');
  perform public.manage_class_membership(zz, t.u('E'), 'remove');
  perform t.as_user('E');
  perform t.fails(format('select public.class_join(%L)', code2), 'Thầy đã bỏ khỏi lớp → không tự vào lại bằng mã', 'JOIN_REMOVED');
  perform t.as_anon();
  perform t.fails(format('select public.class_join(%L)', code2), 'khách không gọi được', 'permission denied');
  perform t.fails(format('select public.class_join_preview(%L)', code2), 'khách không xem trước', 'permission denied');

  -- ── Lối vào học của lớp ──
  perform t.as_user('C');
  j := public.class_learning_entry(zz);
  perform t.ok(j #>> '{course,id}' = 'c0000000-0000-4000-8000-0000000000d2' and (j ->> 'is_member')::boolean, 'thành viên thấy khoá chính của lớp (route học sẵn có)');
  perform t.ok(j #> '{curriculum,has_access}' is not null and not (j #>> '{curriculum,published}')::boolean, 'Giáo trình lớp báo riêng (chưa xuất bản)');
  perform t.as_user('B');
  perform t.fails(format('select public.class_learning_entry(%L)', zz), 'người ngoài lớp không xem lối vào học', 'SC_MEMBERS_ONLY');
  perform t.as_user('T');
  perform t.ok((public.class_learning_entry(zz) #>> '{course,has_access}')::boolean, 'Thầy xem trước được');
end $$;

drop schema t cascade;
