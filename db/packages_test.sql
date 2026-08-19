-- =====================================================================
-- TEST — packages Đợt 1 (bản 2 — invariant của production)
-- CHẠY TRONG TRANSACTION cùng các object (combined: begin + setup + test
-- + rollback) — KHÔNG để lại gì trên DB thật.
--
-- KHÔNG giả định học sinh có 0 quyền (NM là is_free → ai cũng có thể đã có).
-- Assert theo INVARIANT, không cộng số cứng nhắc:
--   • NM tồn tại sau activation (path đệm hát: NM + DH1).
--   • DH1 tồn tại sau activation khi kích hoạt mã DH1.
--   • Không có duplicate active access.
--   • Quyền ĐÃ CÓ TRƯỚC không bị ghi đè (note giữ nguyên).
--   • Quyền KHÔNG thuộc package không bị thay đổi.
--   • granted_codes ⊆ mã đã truyền và mọi mã granted đều active.
--   • Chạy lần 2 idempotent (số quyền không đổi, vẫn 1 gói active).
--   • renews_at gia hạn đúng (~1 tháng).
--   • Non-teacher bị chặn.
--   • Config mặc định (null codes) và mã course không tồn tại xử lý đúng.
-- =====================================================================
begin;

-- Mô phỏng caller là Thầy (is_teacher() đọc auth.uid() từ claim này)
select set_config('request.jwt.claims',
  json_build_object('sub', (select u.id from public.app_users u where u.role = 'teacher' limit 1))::text,
  true);

do $$
declare
  v_stu      uuid;
  v_uid      uuid;
  v_teacher  uuid;
  v_before   jsonb;
  v_after    jsonb;
  r          jsonb;
  v_n1       int;
  v_n2       int;
  v_start    timestamptz;
  v_ren1     timestamptz;
  v_ren2     timestamptz;
begin
  -- ── Chọn học sinh active, ƯU TIÊN chưa có DH1 ──
  select s.id into v_stu from public.edu_students s
  where s.is_active
    and not exists (
      select 1 from public.edu_course_access a
      join public.edu_courses c on c.id = a.course_id
      where a.student_id = s.id and a.active and c.code = 'DH1'
    )
  limit 1;
  if v_stu is null then
    select id into v_stu from public.edu_students where is_active limit 1;
  end if;
  if v_stu is null then raise exception 'KHÔNG CÓ HỌC SINH NÀO ĐỂ TEST'; end if;
  select user_id into v_uid from public.edu_students where id = v_stu;
  select u.id into v_teacher from public.app_users u where u.role = 'teacher' limit 1;

  -- Snapshot quyền TRƯỚC
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'active', a.active, 'note', a.note) order by c.code), '[]'::jsonb)
    into v_before
  from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
  where a.student_id = v_stu;

  -- ═══ TEST 1: kích hoạt NM + DH1 (path đệm hát) ═══
  r := public.activate_student_package(v_stu, 'DONG_HANH_396K', ARRAY['NM','DH1']);

  -- NM & DH1 đều active
  if not exists (select 1 from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
                 where a.student_id = v_stu and a.active and c.code = 'NM') then
    raise exception 'FAIL 1: thiếu quyền NM';
  end if;
  if not exists (select 1 from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
                 where a.student_id = v_stu and a.active and c.code = 'DH1') then
    raise exception 'FAIL 1: thiếu quyền DH1';
  end if;

  -- granted_codes ⊆ {NM,DH1} và mọi mã granted đều active
  if exists (select 1 from jsonb_array_elements_text(r->'granted_codes') gc
             where gc <> all (ARRAY['NM','DH1'])) then
    raise exception 'FAIL 1: granted_codes ngoài mã đã truyền';
  end if;
  if exists (select 1 from jsonb_array_elements_text(r->'granted_codes') gc
             where not exists (
               select 1 from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
               where a.student_id = v_stu and a.active and c.code = gc)) then
    raise exception 'FAIL 1: mã trong granted_codes không active';
  end if;

  -- Không duplicate active access
  select count(*)::int, count(distinct course_id)::int into v_n1, v_n2
    from public.edu_course_access where student_id = v_stu and active;
  if v_n1 <> v_n2 then raise exception 'FAIL 1: duplicate active access'; end if;

  -- Snapshot SAU → quyền ngoài package không đổi; note của quyền đã có không bị ghi đè
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'active', a.active, 'note', a.note) order by c.code), '[]'::jsonb)
    into v_after
  from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
  where a.student_id = v_stu;

  if (select coalesce(jsonb_agg(x order by x->>'code'), '[]'::jsonb) from jsonb_array_elements(v_before) x
      where x->>'code' not in ('NM','DH1'))
     is distinct from
     (select coalesce(jsonb_agg(x order by x->>'code'), '[]'::jsonb) from jsonb_array_elements(v_after) x
      where x->>'code' not in ('NM','DH1')) then
    raise exception 'FAIL 1: quyền KHÔNG thuộc package bị thay đổi';
  end if;

  if exists (select 1 from jsonb_array_elements(v_before) x where x->>'code' = 'NM') then
    if (select x->>'note' from jsonb_array_elements(v_before) x where x->>'code' = 'NM')
       is distinct from
       (select x->>'note' from jsonb_array_elements(v_after) x where x->>'code' = 'NM') then
      raise exception 'FAIL 1: note quyền NM có sẵn bị ghi đè';
    end if;
  end if;

  -- renews_at gia hạn đúng (~1 tháng từ starts_at)
  select starts_at, renews_at into v_start, v_ren1
    from public.student_packages
    where student_id = v_stu and status = 'active'
      and package_id = (select id from public.packages where package_code = 'DONG_HANH_396K');
  if v_ren1 is null or v_ren1 < v_start + interval '29 days' or v_ren1 > v_start + interval '32 days' then
    raise exception 'FAIL 1: renews_at không đúng ~1 tháng (start %, renew %)', v_start, v_ren1;
  end if;

  -- ═══ TEST 2: idempotent — chạy lại cùng mã ═══
  v_n1 := (select count(*) from public.edu_course_access where student_id = v_stu and active);
  r := public.activate_student_package(v_stu, 'DONG_HANH_396K', ARRAY['NM','DH1']);
  v_n2 := (select count(*) from public.edu_course_access where student_id = v_stu and active);
  if v_n1 <> v_n2 then raise exception 'FAIL 2: số quyền đổi khi chạy lại (% → %)', v_n1, v_n2; end if;
  if (select count(*) from public.student_packages
      where student_id = v_stu and status = 'active'
        and package_id = (select id from public.packages where package_code = 'DONG_HANH_396K')) <> 1 then
    raise exception 'FAIL 2: tạo trùng gói active';
  end if;
  select renews_at into v_ren2 from public.student_packages
    where student_id = v_stu and status = 'active'
      and package_id = (select id from public.packages where package_code = 'DONG_HANH_396K');
  if v_ren2 < v_ren1 then raise exception 'FAIL 2: renews_at không gia hạn'; end if;

  -- ═══ TEST 3: bổ sung mã khác — không thu quyền cũ ═══
  r := public.activate_student_package(v_stu, 'DONG_HANH_396K', ARRAY['NM','TN1']);
  if not exists (select 1 from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
                 where a.student_id = v_stu and a.active and c.code = 'TN1') then
    raise exception 'FAIL 3: không mở thêm TN1';
  end if;
  if not exists (select 1 from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
                 where a.student_id = v_stu and a.active and c.code = 'DH1') then
    raise exception 'FAIL 3: mất quyền DH1 đã cấp';
  end if;

  -- ═══ TEST 4: config mặc định (codes = null) ═══
  r := public.activate_student_package(v_stu, 'DONG_HANH_396K', null);
  if not exists (select 1 from jsonb_array_elements_text(r->'granted_codes') gc where gc = 'NM') then
    raise exception 'FAIL 4: default không cấp NM';
  end if;
  if exists (select 1 from jsonb_array_elements_text(r->'granted_codes') gc
             where not exists (
               select 1 from public.edu_course_access a join public.edu_courses c on c.id = a.course_id
               where a.student_id = v_stu and a.active and c.code = gc)) then
    raise exception 'FAIL 4: mã default không active';
  end if;

  -- ═══ TEST 5: mã course không tồn tại → skipped, không lỗi ═══
  r := public.activate_student_package(v_stu, 'DONG_HANH_396K', ARRAY['NM','CODE_KHONG_TON_TAI']);
  if not exists (select 1 from jsonb_array_elements_text(r->'skipped_codes') s where s = 'CODE_KHONG_TON_TAI') then
    raise exception 'FAIL 5: mã không tồn tại không nằm trong skipped_codes';
  end if;

  -- ═══ TEST 6: gói không tồn tại → lỗi rõ ràng ═══
  begin
    perform public.activate_student_package(v_stu, 'GOI_KHONG_CO', null);
    raise exception 'FAIL 6: gói không tồn tại nhưng không báo lỗi';
  exception when others then
    if sqlerrm not like '%không tồn tại%' and sqlerrm not like '%Gói%' then
      raise exception 'FAIL 6: lỗi sai loại: %', sqlerrm;
    end if;
  end;

  -- ═══ TEST 7: non-teacher bị chặn ═══
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  begin
    perform public.activate_student_package(v_stu, 'DONG_HANH_396K', null);
    raise exception 'FAIL 7: non-teacher không bị chặn';
  exception when others then
    if sqlerrm not like '%Chỉ Thầy%' then
      raise exception 'FAIL 7: lỗi sai loại: %', sqlerrm;
    end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_teacher)::text, true);

  raise notice 'ALL PACKAGE TESTS PASS ✔ (student %, granted %)', v_stu, r;
end $$;

rollback;
-- =====================================================================
-- Nếu RAISE EXCEPTION xuất hiện → đọc dòng FAIL để biết test nào hỏng.
-- =====================================================================
