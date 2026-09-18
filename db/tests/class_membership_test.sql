-- Test Phase 2 membership. CHẠY TRONG TRANSACTION ROLLBACK, không sửa dữ liệu thật:
--   begin; <phần SNAPSHOT dưới> ; \i db/class_membership_setup.sql ; <phần TEST> ; rollback;
-- (runner: scripts/run-class-membership-test.sh ghép đúng thứ tự này.)

-- ═══ SNAPSHOT (chạy TRƯỚC migration) ═══
-- @@SNAPSHOT
select set_config('request.jwt.claims', jsonb_build_object('sub', (select id from public.app_users where role in ('teacher','admin') limit 1), 'role', 'authenticated')::text, true);
create temp table _snap_tier on commit drop as
  select s.id sid, (select effective_tier from public.get_effective_student_entitlement(s.id)) tier
  from public.edu_students s
  where exists (select 1 from public.student_packages sp where sp.student_id = s.id)
     or exists (select 1 from public.student_entitlements e where e.student_id = s.id and e.source <> 'legacy_99_lifetime')
     or s.id in (select student_id from public.student_entitlements where source = 'legacy_99_lifetime' order by student_id limit 40);
create temp table _snap_access on commit drop as
  select sp.student_id sid, c.id cid, public.has_course_access(sp.student_id, c.id) ok
  from (select distinct student_id from public.student_packages) sp cross join public.edu_courses c;
create temp table _snap_counts on commit drop as select
  (select count(*) from public.student_entitlements where source = 'legacy_99_lifetime' and status = 'active') legacy,
  (select count(*) from public.edu_students where ht_member) ht,
  (select count(*) from public.edu_course_access) acc,
  (select count(*) from public.edu_enrollments) enr,
  (select count(*) from public.student_entitlements) ent;
-- @@END_SNAPSHOT

-- ═══ TEST (chạy SAU migration) ═══
-- @@TEST
do $$
declare
  teacher uuid; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid(); u4 uuid := gen_random_uuid();
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; l1 bigint; l1b bigint; l2 bigint; l3 bigint; r jsonb; m jsonb; st jsonb;
  dh1 uuid; dh2 uuid; tn1 uuid; solo uuid; lesson uuid; n int; t text; v_end timestamptz; ht_sid uuid;
  function_ok boolean; uu uuid;
begin
  select id into teacher from public.app_users where role in ('teacher', 'admin') limit 1;
  select id into dh1 from public.edu_courses where code = 'DH1';
  select id into dh2 from public.edu_courses where code = 'DH2';
  select id into tn1 from public.edu_courses where code = 'TN1';
  select id into solo from public.edu_courses where code = 'SOLO';

  -- fixture: 4 tài khoản test (auth.users có thể có trigger tự tạo edu_students)
  insert into auth.users (id, email) values (u1, 'mb-t1@example.test'), (u2, 'mb-t2@example.test'), (u3, 'mb-t3@example.test'), (u4, 'mb-t4@example.test');
  foreach uu in array array[u1, u2, u3, u4] loop
    if not exists (select 1 from public.edu_students where user_id = uu) then
      insert into public.edu_students (full_name, email, user_id, is_active) values ('TEST membership', uu::text || '@example.test', uu, true);
    end if;
  end loop;
  select id into s1 from public.edu_students where user_id = u1;
  select id into s2 from public.edu_students where user_id = u2;
  select id into s3 from public.edu_students where user_id = u3;
  select id into s4 from public.edu_students where user_id = u4;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', teacher, 'role', 'authenticated')::text, true);

  -- ── A. Monthly · Đệm hát căn bản (DH1.KD20) ──
  insert into public.leads (name, email, class_name, path, intent, note, source, status, student_id)
  values ('T1', 'mb-t1@example.test', 'Đệm hát căn bản · DH1.KD20', 'dem_hat', 'dang_ky',
          '[public-product:dem_hat_can_ban][plan:monthly]', 'landing', 'Mới đăng ký', s1) returning id into l1;
  r := public.activate_class_membership(l1);
  if r->>'package_code' <> 'CLASS_MONTHLY' or (r->>'already_done')::boolean then raise exception 'A1 %', r; end if;
  if r->'granted_codes' <> '["DH1"]'::jsonb then raise exception 'A2 codes %', r; end if;
  if not exists (select 1 from public.edu_group_members m join public.edu_groups g on g.id = m.group_id where m.user_id = u1 and g.code = 'DH1.KD20' and m.status = 'active') then raise exception 'A3 group'; end if;
  if (select count(*) from public.edu_course_access where student_id = s1) <> 0 then raise exception 'A4 PERMANENT course access created'; end if;
  if (select count(*) from public.edu_enrollments where student_id = s1) <> 0 then raise exception 'A5 PERMANENT enrollment created'; end if;
  if not public.has_course_access(s1, dh1) then raise exception 'A6 DH1 via package'; end if;
  if public.has_course_access(s1, tn1) or public.has_course_access(s1, dh2) then raise exception 'A7 extra course'; end if;
  if (select effective_tier from public.get_effective_student_entitlement(s1)) <> 'free' then raise exception 'A8 tier not free'; end if;
  v_end := (select renews_at from public.student_packages where id = (r->>'student_package_id')::bigint);
  if v_end <> ((now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 month') at time zone 'Asia/Ho_Chi_Minh' then raise exception 'A9 expiry %', v_end; end if;
  if (select status from public.leads where id = l1) <> 'Đã đóng phí' then raise exception 'A10 lead status'; end if;
  -- idempotent: bấm lại / retry
  r := public.activate_class_membership(l1);
  if not (r->>'already_done')::boolean then raise exception 'A11 not idempotent'; end if;
  if (select count(*) from public.student_packages where student_id = s1) <> 1 then raise exception 'A12 duplicate package'; end if;
  if (select count(*) from public.edu_group_members where user_id = u1) <> 1 then raise exception 'A13 duplicate member'; end if;
  -- học viên nhìn từ my_learning_state: DH1 mở, DH2 (không policy) KHÔNG mở ⇒ không mở toàn kho
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u1, 'role', 'authenticated')::text, true);
  st := public.my_learning_state();
  if (select c->>'access' from jsonb_array_elements(st->'courses') c where c->>'code' = 'DH1') <> 'open' then raise exception 'A14 DH1 not open in learning state'; end if;
  if (select c->>'access' from jsonb_array_elements(st->'courses') c where c->>'code' = 'DH2') = 'open' then raise exception 'A15 library open for monthly'; end if;
  m := public.my_membership();
  if m->'membership'->>'plan' <> 'monthly' or m->'membership'->>'status' <> 'active' or m->>'app_tier' <> 'free' then raise exception 'A16 %', m->'membership'; end if;
  if (m->'membership'->>'days_left')::int not between 28 and 31 then raise exception 'A17 days_left'; end if;
  if jsonb_array_length(m->'classes') <> 1 or m->'classes'->0->>'code' <> 'DH1.KD20' or m->'classes'->0->'next_session' = 'null'::jsonb then raise exception 'A18 classes %', m->'classes'; end if;
  select b->>'active' into t from jsonb_array_elements(m->'benefits') b where b->>'key' = 'pdf_thang';
  if t <> 'true' then raise exception 'A19 pdf_thang'; end if;
  if (select b->>'reason' from jsonb_array_elements(m->'benefits') b where b->>'key' = 'pdf_thang') <> 'plan' then raise exception 'A20 pdf reason'; end if;
  if (select (b->>'active')::boolean from jsonb_array_elements(m->'benefits') b where b->>'key' = 'kho_bai_giang') then raise exception 'A21 kho open'; end if;
  if (select (b->>'active')::boolean from jsonb_array_elements(m->'benefits') b where b->>'key' = 'hoi_thay') then raise exception 'A22 hoi_thay for monthly'; end if;
  if not (select (b->>'active')::boolean from jsonb_array_elements(m->'benefits') b where b->>'key' = 'lop_hang_tuan') then raise exception 'A23 lop'; end if;
  -- học viên KHÔNG xem được của người khác
  begin
    perform public.my_membership(s2);
    raise exception 'A24 guard' using errcode = 'XX999';
  exception when raise_exception then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', teacher, 'role', 'authenticated')::text, true);

  -- ── B. Monthly · Guitar căn bản (TN1.GL14) ──
  insert into public.leads (name, email, class_name, path, intent, note, source, status, student_id)
  values ('T2', 'mb-t2@example.test', 'Guitar căn bản · TN1.GL14', 'tia_not', 'dang_ky',
          '[public-product:guitar_can_ban][plan:monthly]', 'landing', 'Mới đăng ký', s2) returning id into l2;
  r := public.activate_class_membership(l2);
  if r->'granted_codes' <> '["TN1"]'::jsonb or r->>'class_code' <> 'TN1.GL14' then raise exception 'B1 %', r; end if;
  if (select count(*) from public.edu_course_access where student_id = s2) + (select count(*) from public.edu_enrollments where student_id = s2) <> 0 then raise exception 'B2 permanent'; end if;
  if not public.has_course_access(s2, tn1) or public.has_course_access(s2, dh1) then raise exception 'B3'; end if;
  if (select effective_tier from public.get_effective_student_entitlement(s2)) <> 'free' then raise exception 'B4'; end if;

  -- ── C. Six-month (TN1.GL14) ──
  insert into public.leads (name, email, class_name, path, intent, note, source, status, student_id)
  values ('T3', 'mb-t3@example.test', 'Guitar căn bản · TN1.GL14', 'tia_not', 'dang_ky',
          '[public-product:guitar_can_ban][plan:six_month]', 'landing', 'Mới đăng ký', s3) returning id into l3;
  r := public.activate_class_membership(l3);
  if r->>'package_code' <> 'CLASS_SIXMONTH' then raise exception 'C1 %', r; end if;
  v_end := (r->>'renews_at')::timestamptz;
  if v_end <> ((now() at time zone 'Asia/Ho_Chi_Minh') + interval '6 months') at time zone 'Asia/Ho_Chi_Minh' then raise exception 'C2 expiry %', v_end; end if;
  if (select effective_tier from public.get_effective_student_entitlement(s3)) <> 'can_ban_396' then raise exception 'C3 tier'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u3, 'role', 'authenticated')::text, true);
  st := public.my_learning_state();
  if st->>'effective_tier' <> 'can_ban_396' then raise exception 'C4 ls tier'; end if;
  if (select c->>'access' from jsonb_array_elements(st->'courses') c where c->>'code' = 'DH2') <> 'open' then raise exception 'C5 library'; end if;
  if (select c->>'access' from jsonb_array_elements(st->'courses') c where c->>'code' = 'SOLO') not in ('open', 'prereq') then raise exception 'C6 SOLO %', (select c->>'access' from jsonb_array_elements(st->'courses') c where c->>'code' = 'SOLO'); end if;
  m := public.my_membership();
  if m->'membership'->>'plan' <> 'six_month' or m->>'app_tier' <> 'can_ban_396' then raise exception 'C7'; end if;
  if exists (select 1 from jsonb_array_elements(m->'benefits') b where (b->>'in_plan')::boolean and not (b->>'active')::boolean) then raise exception 'C8 inactive six-month benefit %', m->'benefits'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', teacher, 'role', 'authenticated')::text, true);

  -- ── D. Expiry + renew (monthly T1) ──
  select id into lesson from public.edu_course_lessons l where l.module_id in (select id from public.edu_modules where course_id = dh1) limit 1;
  insert into public.edu_lesson_progress (student_id, lesson_id, status, completed_at) values (s1, lesson, 'completed', now());
  update public.student_packages set starts_at = now() - interval '40 days', renews_at = now() - interval '10 days' where student_id = s1;
  if public.has_course_access(s1, dh1) then raise exception 'D1 expired package still grants'; end if;
  m := public.my_membership(s1);
  if m->'membership'->>'status' <> 'expired' or m->'membership'->'days_left' <> 'null'::jsonb then raise exception 'D2 %', m->'membership'; end if;
  if (select (b->>'active')::boolean from jsonb_array_elements(m->'benefits') b where b->>'key' = 'pdf_thang') then raise exception 'D3 plan benefit after expiry'; end if;
  if (select count(*) from public.edu_lesson_progress where student_id = s1) <> 1 then raise exception 'D4 progress lost'; end if;
  insert into public.leads (name, email, class_name, path, intent, note, source, status, student_id)
  values ('T1 tháng 2', 'mb-t1@example.test', 'Đệm hát căn bản · DH1.KD20', 'dem_hat', 'dang_ky',
          '[public-product:dem_hat_can_ban][plan:monthly]', 'landing', 'Mới đăng ký', s1) returning id into l1b;
  r := public.activate_class_membership(l1b);
  if not public.has_course_access(s1, dh1) then raise exception 'D5 renew did not restore'; end if;
  if (r->>'renews_at')::timestamptz < now() + interval '27 days' then raise exception 'D6 late renew must start from now %', r; end if;
  if (select count(*) from public.student_packages where student_id = s1 and status = 'active') <> 1 then raise exception 'D7 active rows'; end if;
  if (select count(*) from public.student_package_history where student_id = s1) < 2 then raise exception 'D8 history'; end if;

  -- ── E. Lead lỗi / không thuộc mô hình mới ──
  begin
    insert into public.leads (name, email, class_name, note, source, status, student_id)
    values ('T4', 'mb-t4@example.test', 'Khởi đầu đam mê · DH1.KD18', '[plan:monthly]', 'landing', 'Mới đăng ký', s4) returning id into l2;
    perform public.activate_class_membership(l2);
    raise exception 'E1 legacy class accepted' using errcode = 'XX999';
  exception when raise_exception then null; end;
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u4, 'role', 'authenticated')::text, true);
    perform public.activate_class_membership(l1);
    raise exception 'E2 student activated' using errcode = 'XX999';
  exception when raise_exception then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', teacher, 'role', 'authenticated')::text, true);

  -- ── F. Lớp legacy vẫn cấp quyền như cũ (trigger) ──
  insert into public.edu_group_members (user_id, group_id, source, status)
  select u4, g.id, 'admin', 'active' from public.edu_groups g where g.code = 'DH1.KD18';
  if not exists (select 1 from public.edu_course_access where student_id = s4 and note = 'Vào lớp DH1.KD18') then raise exception 'F1 legacy class grant broken'; end if;

  -- ── G. Legacy không đổi ──
  if exists (select 1 from _snap_tier x where x.tier is distinct from (select effective_tier from public.get_effective_student_entitlement(x.sid))) then
    raise exception 'G1 tier changed for existing students'; end if;
  if exists (select 1 from _snap_access x where x.ok is distinct from public.has_course_access(x.sid, x.cid)) then
    raise exception 'G2 course access changed for existing package students'; end if;
  if (select legacy from _snap_counts) <> (select count(*) from public.student_entitlements where source = 'legacy_99_lifetime' and status = 'active') then raise exception 'G3 legacy99'; end if;
  if (select ht from _snap_counts) <> (select count(*) from public.edu_students where ht_member) then raise exception 'G4 ht_member'; end if;
  if (select ent from _snap_counts) <> (select count(*) from public.student_entitlements) then raise exception 'G5 entitlements'; end if;
  -- edu_course_access chỉ tăng đúng 1 dòng (fixture lớp legacy ở F), enrollments tăng tương ứng
  if (select count(*) from public.edu_course_access) - (select acc from _snap_counts) <> (select count(*) from public.edu_course_access where student_id = s4) then raise exception 'G6 unexpected access rows'; end if;

  -- ── H. my_membership cho HT2027 thật (xem bằng quyền Thầy) + legacy + Apple ──
  select sp.student_id into ht_sid from public.student_packages sp join public.packages p on p.id = sp.package_id
   where p.package_code = 'HT2027_SIXMONTH' and sp.status = 'active' limit 1;
  m := public.my_membership(ht_sid);
  if m->'membership'->>'plan' <> 'six_month' or m->'membership'->>'package_code' <> 'HT2027_SIXMONTH' then raise exception 'H1 %', m->'membership'; end if;
  if m->>'app_tier' <> (select tier from _snap_tier where sid = ht_sid) then raise exception 'H2 HT tier changed'; end if;
  m := public.my_membership((select student_id from public.student_entitlements where source = 'legacy_99_lifetime' and student_id not in (select student_id from public.student_packages) limit 1));
  if m->'membership' <> 'null'::jsonb or m->>'app_tier' <> 'khoi_dau_99' then raise exception 'H3 legacy %', m; end if;
  if not (select (b->>'active')::boolean from jsonb_array_elements(m->'benefits') b where b->>'key' = 'kho_bai_giang') then raise exception 'H4 legacy library'; end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.student_entitlements (student_id, tier, source, source_ref, starts_at, ends_at, status)
  values (s4, 'can_ban_396', 'apple_subscription', 'test-apple:' || s4, now(), now() + interval '1 month', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', teacher, 'role', 'authenticated')::text, true);
  m := public.my_membership(s4);
  if m->>'app_tier' <> 'can_ban_396' or m->'membership' <> 'null'::jsonb then raise exception 'H5 apple %', m; end if;

  -- ── I. membership_benefits chỉ là catalog: không function quyền nào đọc nó ──
  select not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('my_learning_state', 'has_course_access', 'get_effective_student_entitlement', 'can_student_access_lesson')
      and pg_get_functiondef(p.oid) ilike '%membership_benefits%') into function_ok;
  if not function_ok then raise exception 'I1 benefits catalog used for authorization'; end if;

  raise notice 'CLASS MEMBERSHIP TEST: ALL PASS';
end $$;
select 'CLASS MEMBERSHIP TEST: ALL PASS' as result;
-- @@END_TEST
