-- Test sau migration class_public_products_trung_cap.sql. Chạy trong transaction ROLLBACK:
--   begin; <migration không begin/commit> ; <file này> ; rollback;   (scripts/run-class-membership-test.sh public)
do $$
declare teacher uuid := (select id from public.app_users where role in ('teacher','admin') limit 1);
  pub text; bad_check boolean := false; u uuid; s uuid; l bigint; r jsonb; st jsonb; plan text; cls text; n int := 0;
begin
  -- 1) đúng 4 lớp public: 2 T3 + 2 T4
  select string_agg(code || '=' || public_product, ',' order by code) into pub from public.class_schedule where public_enroll;
  if pub <> 'DH1.KD20=dem_hat_can_ban,DH2.KD21=dem_hat_trung_cap,TN1.GL14=guitar_can_ban,TN2.GL15=guitar_trung_cap' then
    raise exception 'P1 public classes: %', pub; end if;
  -- 2) CHECK nhận key mới, vẫn chặn key lạ
  begin update public.class_schedule set public_product = 'khong_hop_le' where code = 'DH2.KD21';
  exception when check_violation then bad_check := true; end;
  if not bad_check then raise exception 'P2 CHECK không chặn key lạ'; end if;
  -- 3) anon đọc được đúng dữ liệu landing cần
  set local role anon;
  select count(*) into n from public.class_schedule where is_active and public_enroll and public_product is not null;
  reset role;
  if n <> 4 then raise exception 'P3 anon thấy % lớp', n; end if;
  -- 4) kích hoạt 4 tổ hợp T4 × plan: đúng gói, đúng khoá, KHÔNG quyền vĩnh viễn
  foreach cls in array array['Đệm hát trung cấp · DH2.KD21', 'Guitar trung cấp · TN2.GL15'] loop
    foreach plan in array array['monthly', 'six_month'] loop
      u := gen_random_uuid();
      insert into auth.users (id, email) values (u, u::text || '@example.test');
      if not exists (select 1 from public.edu_students where user_id = u) then
        insert into public.edu_students (full_name, email, user_id, is_active) values ('T4 test', u::text || '@example.test', u, true);
      end if;
      select id into s from public.edu_students where user_id = u;
      insert into public.leads (name, email, class_name, path, intent, note, source, status, student_id)
      values ('T4', u::text || '@example.test', cls, 'x', 'dang_ky', '[public-product:x][plan:' || plan || ']', 'landing', 'Mới đăng ký', s) returning id into l;
      perform set_config('request.jwt.claims', jsonb_build_object('sub', teacher, 'role', 'authenticated')::text, true);
      r := public.activate_class_membership(l);
      if r->>'package_code' <> (case plan when 'monthly' then 'CLASS_MONTHLY' else 'CLASS_SIXMONTH' end) then raise exception 'P4 % % gói %', cls, plan, r; end if;
      if r->'granted_codes' <> (case when cls like '%DH2%' then '["DH2"]' else '["TN2"]' end)::jsonb then raise exception 'P5 % khoá %', cls, r; end if;
      if (select count(*) from public.edu_course_access where student_id = s) + (select count(*) from public.edu_enrollments where student_id = s) <> 0 then
        raise exception 'P6 % % tạo quyền VĨNH VIỄN', cls, plan; end if;
      if not public.has_course_access(s, (select id from public.edu_courses where code = (case when cls like '%DH2%' then 'DH2' else 'TN2' end))) then raise exception 'P7 không mở khoá lớp'; end if;
      if (select effective_tier from public.get_effective_student_entitlement(s)) <> (case plan when 'monthly' then 'free' else 'can_ban_396' end) then raise exception 'P8 tier sai'; end if;
      perform set_config('request.jwt.claims', jsonb_build_object('sub', u, 'role', 'authenticated')::text, true);
      st := public.my_membership();
      if st->'classes'->0->>'code' <> split_part(cls, ' · ', 2) or st->'classes'->0->>'public_product' not like '%trung_cap' then raise exception 'P9 my_membership %', st->'classes'; end if;
    end loop;
  end loop;
  raise notice 'CLASS PUBLIC PRODUCTS TEST: PASS';
end $$;
select 'CLASS PUBLIC PRODUCTS TEST: PASS' as result;
