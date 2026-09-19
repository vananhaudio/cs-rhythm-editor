-- Test mô hình lớp mới (chạy trong ROLLBACK, sau db/class_model_t3_t4.sql): scripts/run-class-membership-test.sh model
-- @@SNAPSHOT
select set_config('request.jwt.claims', jsonb_build_object('sub', (select id from public.app_users where role in ('teacher','admin') limit 1), 'role', 'authenticated')::text, true);
create temp table _m_acc on commit drop as
  select s.id sid, (select string_agg(c.code, ',' order by c.code) from public.edu_courses c where c.code is not null and public.has_course_access(s.id, c.id)) acc,
         (select effective_tier from public.get_effective_student_entitlement(s.id)) tier from public.edu_students s;
create temp table _m_keep on commit drop as
  select code, status, weekday, start_time, start_date, end_date, total_sessions, public_enroll, group_id,
         (select count(*) from public.class_sessions x where x.class_id = c.id and x.status not in ('cancelled')) live
  from public.class_schedule c where code in ('SOLO01.TH01','HT2027.TH01','DH1.KD18','DH2.KD0826','TN3.GL12');
-- @@END_SNAPSHOT
-- @@TEST
do $$
declare teacher uuid := (select id from public.app_users where role in ('teacher','admin') limit 1);
  pub text; u uuid; s uuid; l bigint; r jsonb; cls text; plan text; want text; n int;
begin
  -- 1) đúng 4 lớp công khai: 2 cửa vào T3 + 2 lớp chính T4
  select string_agg(code || '=' || public_product, ',' order by code) into pub from public.class_schedule where public_enroll and is_active;
  if pub <> 'CB1.T3=guitar_can_ban_1,CB2.T3=guitar_can_ban_2,DEM.T4=dem_hat_nang_cao,SOLO.T4=solo_guitar' then raise exception 'M1 public: %', pub; end if;
  -- 2) 6 lớp cũ đã huỷ mềm, không còn buổi sống
  if exists (select 1 from public.class_schedule where code in ('DH1.KD20','TN1.GL14','DH2.KD21','TN2.GL15','SOLO01.TH02','DHNC01.TH01') and status <> 'cancelled') then raise exception 'M2'; end if;
  if exists (select 1 from public.class_sessions x join public.class_schedule c on c.id = x.class_id where c.code in ('DH1.KD20','TN1.GL14','DH2.KD21','TN2.GL15','SOLO01.TH02','DHNC01.TH01') and x.status not in ('cancelled','completed')) then raise exception 'M2 sessions'; end if;
  -- 3) T5 + 2 lớp T6 đang học + TN3.GL12 không đổi
  if exists (select 1 from _m_keep k join public.class_schedule c using (code)
             where (k.status, k.weekday, k.start_time, k.start_date, k.end_date, k.total_sessions, k.public_enroll, k.group_id)
               is distinct from (c.status, c.weekday, c.start_time, c.start_date, c.end_date, c.total_sessions, c.public_enroll, c.group_id)
                or k.live <> (select count(*) from public.class_sessions x where x.class_id = c.id and x.status not in ('cancelled'))) then raise exception 'M3 lớp giữ nguyên bị đổi'; end if;
  -- 4) không trùng giờ với lớp khác trên các buổi mới
  select count(*) into n from public.class_sessions a join public.class_sessions b on a.id <> b.id and a.start_at = b.start_at
   join public.class_schedule ca on ca.id = a.class_id where ca.code in ('CB1.T3','CB2.T3','SOLO.T4','DEM.T4')
     and a.status not in ('cancelled','holiday') and b.status not in ('cancelled','holiday');
  if n > 0 then raise exception 'M4 trùng giờ %', n; end if;
  -- 5) không buổi nào rơi vào ngày nghỉ lễ
  if exists (select 1 from public.class_sessions x join public.class_schedule c on c.id = x.class_id join public.class_off_days o on o.is_active and o.off_date = (x.start_at at time zone 'Asia/Ho_Chi_Minh')::date
             where c.code in ('CB1.T3','CB2.T3','SOLO.T4','DEM.T4') and x.event_type = 'lesson') then raise exception 'M5 buổi rơi vào ngày nghỉ'; end if;
  -- 6) quyền học viên hiện có không đổi
  if exists (select 1 from _m_acc x where x.acc is distinct from (select string_agg(c.code, ',' order by c.code) from public.edu_courses c where c.code is not null and public.has_course_access(x.sid, c.id))
                                        or x.tier is distinct from (select effective_tier from public.get_effective_student_entitlement(x.sid))) then raise exception 'M6 quyền học viên cũ bị đổi'; end if;
  -- 7) kích hoạt 4 lớp × 2 gói: đúng khoá của chặng hiện tại, KHÔNG quyền vĩnh viễn
  foreach cls in array array['Guitar căn bản 1 · CB1.T3','Guitar căn bản 2 · CB2.T3','Solo Guitar 1 · SOLO.T4','Đệm hát 2 · DEM.T4'] loop
    want := case split_part(cls, ' · ', 2) when 'CB1.T3' then 'CB1' when 'CB2.T3' then 'CB2' when 'SOLO.T4' then 'SOLO' else 'DH2' end;
    foreach plan in array array['monthly','six_month'] loop
      u := gen_random_uuid();
      insert into auth.users (id, email) values (u, u::text || '@example.test');
      if not exists (select 1 from public.edu_students where user_id = u) then
        insert into public.edu_students (full_name, email, user_id, is_active) values ('model test', u::text || '@example.test', u, true); end if;
      select id into s from public.edu_students where user_id = u;
      insert into public.leads (name, email, class_name, path, intent, note, source, status, student_id)
      values ('M', u::text || '@example.test', cls, 'x', 'dang_ky', '[public-product:x][plan:' || plan || ']', 'landing', 'Mới đăng ký', s) returning id into l;
      perform set_config('request.jwt.claims', jsonb_build_object('sub', teacher, 'role', 'authenticated')::text, true);
      r := public.activate_class_membership(l);
      if r->>'course_code' <> want then raise exception 'M7 % khoá % (muốn %)', cls, r->>'course_code', want; end if;
      if (select count(*) from public.edu_course_access where student_id = s) + (select count(*) from public.edu_enrollments where student_id = s) <> 0 then raise exception 'M8 % quyền vĩnh viễn', cls; end if;
      if not public.has_course_access(s, (select id from public.edu_courses where code = want)) then raise exception 'M9 % không mở %', cls, want; end if;
      if (select effective_tier from public.get_effective_student_entitlement(s)) <> (case plan when 'monthly' then 'free' else 'can_ban_396' end) then raise exception 'M10 tier'; end if;
    end loop;
  end loop;
  -- 8) anon đọc được lớp + chặng (landing)
  set local role anon;
  select count(*) into n from public.class_stages st join public.class_schedule c on c.id = st.class_id where c.public_enroll;
  reset role;
  if n < 30 then raise exception 'M11 anon đọc chặng: %', n; end if;
  raise notice 'CLASS MODEL TEST: PASS';
end $$;
select 'CLASS MODEL TEST: PASS' as result;
-- @@END_TEST
