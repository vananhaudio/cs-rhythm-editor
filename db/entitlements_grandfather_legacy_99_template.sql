-- =====================================================================
-- GRANDFATHER MIGRATION TEMPLATE — KHONG CHAY TRUOC KHI DUYET
--
-- Muc dich: cap legacy_99_lifetime cho hoc vien cu hop le ton tai truoc cutoff.
-- Idempotent: chay lai khong duplicate nho unique index se_legacy_99_lifetime_uq.
--
-- BAT BUOC:
--   1) Chay db/entitlements_setup.sql truoc.
--   2) Chay db/entitlements_grandfather_audit.sql va bao so luong expected.
--   3) Thay duyet cutoff + expected count.
--   4) Moi thay cutoff ben duoi va chay migration nay.
-- =====================================================================

do $$
declare
  v_cutoff_at timestamptz := 'REPLACE_WITH_APPROVED_CUTOFF'::timestamptz;
  v_expected_count integer := -1; -- REPLACE_WITH_APPROVED_COUNT
  v_exact_excluded_student_ids uuid[] := array[]::uuid[]; -- REPLACE_WITH_EXACT_TEST_IDS_IF_ANY
  v_population_count integer;
  v_existing_count integer;
  v_inserted_count integer;
begin
  if v_expected_count < 0 then
    raise exception 'Chua dien expected count da duoc duyet';
  end if;

  with eligible as (
    select s.id
    from public.edu_students s
    left join auth.users u on u.id = s.user_id
    left join public.app_users au on au.id = s.user_id
    where coalesce(u.created_at, s.enrolled_at::timestamptz) < v_cutoff_at
      and not (s.id = any(v_exact_excluded_student_ids))
      and coalesce(au.role, 'student') not in ('teacher', 'admin')
  )
  select count(*) into v_population_count from eligible;

  if v_population_count <> v_expected_count then
    raise exception 'Grandfather count mismatch: expected %, actual %',
      v_expected_count, v_population_count;
  end if;

  select count(*) into v_existing_count
  from public.student_entitlements
  where source = 'legacy_99_lifetime'
    and tier = 'khoi_dau_99'
    and is_lifetime
    and status in ('active','trialing');

  if v_existing_count not in (0, v_expected_count) then
    raise exception 'Existing legacy count unsafe: expected 0 or %, actual %',
      v_expected_count, v_existing_count;
  end if;

  with eligible as (
    select s.id
    from public.edu_students s
    left join auth.users u on u.id = s.user_id
    left join public.app_users au on au.id = s.user_id
    where coalesce(u.created_at, s.enrolled_at::timestamptz) < v_cutoff_at
      and not (s.id = any(v_exact_excluded_student_ids))
      and coalesce(au.role, 'student') not in ('teacher', 'admin')
  ),
  inserted as (
    insert into public.student_entitlements
      (student_id, tier, source, source_ref, starts_at, ends_at,
       is_lifetime, status, metadata)
    select
      e.id,
      'khoi_dau_99',
      'legacy_99_lifetime',
      'legacy_99_lifetime:' || e.id::text,
      v_cutoff_at,
      null,
      true,
      'active',
      jsonb_build_object(
        'cutoff_at', v_cutoff_at,
        'migration', 'entitlements_grandfather_legacy_99_template'
      )
    from eligible e
    on conflict do nothing
    returning id
  )
  select count(*) into v_inserted_count from inserted;

  if (v_existing_count = 0 and v_inserted_count <> v_expected_count)
     or (v_existing_count = v_expected_count and v_inserted_count <> 0) then
    raise exception 'Inserted count unsafe: existing %, expected %, inserted %',
      v_existing_count, v_expected_count, v_inserted_count;
  end if;

  raise notice 'Grandfather legacy_99_lifetime done. cutoff=%, population=%, existing_before=%, inserted=%',
    v_cutoff_at, v_population_count, v_existing_count, v_inserted_count;
end $$;

notify pgrst, 'reload schema';
