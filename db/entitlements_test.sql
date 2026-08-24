-- =====================================================================
-- TEST — Student Entitlements A -> O
--
-- Chay sau db/entitlements_setup.sql tren DB test/staging.
-- KHONG chay production neu chua co backup/duyet.
-- =====================================================================

do $$
declare
  v_teacher uuid := (select id from public.app_users where role in ('teacher','admin') limit 1);
  v_old uuid := gen_random_uuid();
  v_new uuid := gen_random_uuid();
  v_course uuid := (select id from public.edu_courses limit 1);
  r record;
  n1 integer;
  n2 integer;
begin
  if v_teacher is null then
    raise exception 'Can co teacher/admin trong app_users de test';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_teacher)::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.edu_students (id, full_name, email, is_active, level, enrolled_at, created_at)
    values (v_old, 'TEST entitlement old', 'entitlement-old@example.test', true, 'beginner', now() - interval '10 days', now() - interval '10 days')
    on conflict do nothing;
  insert into public.edu_students (id, full_name, email, is_active, level, enrolled_at, created_at)
    values (v_new, 'TEST entitlement new', 'entitlement-new@example.test', true, 'beginner', now(), now())
    on conflict do nothing;

  if v_course is not null then
    insert into public.edu_course_access (student_id, course_id, active, note, granted_by)
      values (v_old, v_course, true, 'TEST existing access before entitlement', v_teacher)
      on conflict (student_id, course_id) do update set active = true;
    select count(*) into n1 from public.edu_course_access where student_id = v_old;
  else
    n1 := 0;
  end if;

  -- A. User cu: legacy 99 -> effective 99
  insert into public.student_entitlements (student_id, tier, source, is_lifetime, status)
    values (v_old, 'khoi_dau_99', 'legacy_99_lifetime', true, 'active')
    on conflict do nothing;
  select * into r from public.get_effective_student_entitlement(v_old);
  if r.effective_tier <> 'khoi_dau_99' or r.source <> 'legacy_99_lifetime' then
    raise exception 'FAIL A: %/%', r.effective_tier, r.source;
  end if;

  -- B. User cu + 396 active -> effective 396
  insert into public.student_entitlements (student_id, tier, source, source_ref, starts_at, ends_at, status)
    values (v_old, 'can_ban_396', 'apple_subscription', 'test-old-396', now(), now() + interval '1 month', 'active');
  select * into r from public.get_effective_student_entitlement(v_old);
  if r.effective_tier <> 'can_ban_396' then raise exception 'FAIL B: %', r.effective_tier; end if;

  -- C. User cu + 396 cancelled -> fallback 99
  update public.student_entitlements set status = 'cancelled' where source_ref = 'test-old-396';
  select * into r from public.get_effective_student_entitlement(v_old);
  if r.effective_tier <> 'khoi_dau_99' then raise exception 'FAIL C: %', r.effective_tier; end if;

  -- D. User cu + 499 active -> effective 499
  insert into public.student_entitlements (student_id, tier, source, source_ref, starts_at, ends_at, status)
    values (v_old, 'nang_cao_499', 'google_subscription', 'test-old-499', now(), now() + interval '1 month', 'active');
  select * into r from public.get_effective_student_entitlement(v_old);
  if r.effective_tier <> 'nang_cao_499' then raise exception 'FAIL D: %', r.effective_tier; end if;

  -- E. User cu + 499 expired -> fallback 99
  update public.student_entitlements set status = 'expired' where source_ref = 'test-old-499';
  select * into r from public.get_effective_student_entitlement(v_old);
  if r.effective_tier <> 'khoi_dau_99' then raise exception 'FAIL E: %', r.effective_tier; end if;

  -- F. User moi: no paid entitlement -> free
  select * into r from public.get_effective_student_entitlement(v_new);
  if r.effective_tier <> 'free' or r.source <> 'free' then
    raise exception 'FAIL F: %/%', r.effective_tier, r.source;
  end if;

  -- G. User moi + 99 active -> 99
  insert into public.student_entitlements (student_id, tier, source, source_ref, starts_at, ends_at, status)
    values (v_new, 'khoi_dau_99', 'apple_subscription', 'test-new-99', now(), now() + interval '1 month', 'active');
  select * into r from public.get_effective_student_entitlement(v_new);
  if r.effective_tier <> 'khoi_dau_99' then raise exception 'FAIL G: %', r.effective_tier; end if;

  -- H. User moi + 396 active -> 396
  insert into public.student_entitlements (student_id, tier, source, source_ref, starts_at, ends_at, status)
    values (v_new, 'can_ban_396', 'google_subscription', 'test-new-396', now(), now() + interval '1 month', 'active');
  select * into r from public.get_effective_student_entitlement(v_new);
  if r.effective_tier <> 'can_ban_396' then raise exception 'FAIL H: %', r.effective_tier; end if;

  -- I. User moi + 396 expired -> free (sau khi tat ca paid khong hop le)
  update public.student_entitlements set status = 'expired'
    where student_id = v_new and source in ('apple_subscription','google_subscription');
  select * into r from public.get_effective_student_entitlement(v_new);
  if r.effective_tier <> 'free' then raise exception 'FAIL I: %', r.effective_tier; end if;

  -- J. User moi + 499 active -> 499
  insert into public.student_entitlements (student_id, tier, source, source_ref, starts_at, ends_at, status)
    values (v_new, 'nang_cao_499', 'google_subscription', 'test-new-499', now(), now() + interval '1 month', 'active');
  select * into r from public.get_effective_student_entitlement(v_new);
  if r.effective_tier <> 'nang_cao_499' then raise exception 'FAIL J: %', r.effective_tier; end if;

  -- K. Multiple source cung luc: lay tier cao nhat
  insert into public.student_entitlements (student_id, tier, source, source_ref, starts_at, ends_at, status)
    values (v_new, 'can_ban_396', 'manual_admin', 'test-new-manual-396', now(), null, 'active');
  select * into r from public.get_effective_student_entitlement(v_new);
  if r.effective_tier <> 'nang_cao_499' then raise exception 'FAIL K: %', r.effective_tier; end if;

  -- L. Legacy lifetime khong co expiry
  if exists (
    select 1 from public.student_entitlements
    where student_id = v_old and source = 'legacy_99_lifetime'
      and (not is_lifetime or ends_at is not null)
  ) then raise exception 'FAIL L: legacy expiry shape sai'; end if;

  -- M. Migration/idempotent shape: insert legacy lan 2 khong duplicate
  insert into public.student_entitlements (student_id, tier, source, is_lifetime, status)
    values (v_old, 'khoi_dau_99', 'legacy_99_lifetime', true, 'active')
    on conflict do nothing;
  if (select count(*) from public.student_entitlements
      where student_id = v_old and source = 'legacy_99_lifetime'
        and tier = 'khoi_dau_99' and is_lifetime
        and status in ('active','trialing')) <> 1 then
    raise exception 'FAIL M: duplicate legacy';
  end if;

  -- N. Khong mat edu_course_access/enrollment hien co
  if v_course is not null then
    select count(*) into n2 from public.edu_course_access where student_id = v_old;
    if n2 < n1 then raise exception 'FAIL N: course_access bi mat % -> %', n1, n2; end if;
  end if;

  -- O. IAP cu khong bi pha: test logic DB khong drop/sua object IAP native.
  -- Neu can map IAP cu, lam migration rieng sau khi co bang chung mapping.

  raise notice 'PASS entitlements A-O';
end $$;
