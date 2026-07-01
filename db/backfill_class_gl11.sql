-- Cấp bù khoá cho học sinh ĐÃ ở trong lớp (trigger chỉ chạy cho người mới vào).
-- 1) Đặt GL11 gồm 3 khoá: NM + NL1 + TN3 (khoá chính = TN3 để hiển thị).
-- 2) Hàm backfill_class(mã lớp) — cấp đủ khoá của lớp cho MỌI học sinh đang trong nhóm đó. Dùng lại được.
-- 3) Chạy backfill cho GL11.
-- Chạy trong Supabase SQL Editor. Idempotent.

-- 1) GL11 = NM + NL1 + TN3
update public.class_schedule
set course_ids = array[
      'fd23a7a2-bfce-44c6-8bde-6d76289a3625',   -- NM  (Khởi Đầu Đam Mê — Nhập Môn)
      '79706056-ddf5-4741-8811-1f33f4ee0d48',   -- NL1 (Chìa Khoá Nhạc Lý Cơ Bản)
      'efeababa-fdad-4eab-a88a-a80dab1da2af'    -- TN3 (Tỉa Nốt 3)
    ]::uuid[],
    main_course_id = 'efeababa-fdad-4eab-a88a-a80dab1da2af'   -- TN3
where code = 'GL11';

-- 2) Hàm cấp bù cho 1 lớp (theo mã lớp = mã nhóm Zalo)
create or replace function public.backfill_class(p_code text)
returns int language plpgsql security definer set search_path = '' as $$
declare cids uuid[]; n int := 0;
begin
  select course_ids into cids from public.class_schedule where code = p_code limit 1;
  if cids is null or array_length(cids, 1) is null then return 0; end if;

  insert into public.edu_enrollments (student_id, course_id, is_active)
  select s.id, cid, true
  from public.edu_group_members m
  join public.edu_groups   g on g.id = m.group_id and g.code = p_code
  join public.edu_students s on s.user_id = m.user_id
  cross join unnest(cids) as cid
  where m.status = 'active'
  on conflict (student_id, course_id) do update set is_active = true;

  insert into public.edu_course_access (student_id, course_id, active, note)
  select s.id, cid, true, 'Vào lớp ' || p_code
  from public.edu_group_members m
  join public.edu_groups   g on g.id = m.group_id and g.code = p_code
  join public.edu_students s on s.user_id = m.user_id
  cross join unnest(cids) as cid
  where m.status = 'active'
  on conflict (student_id, course_id) do update set active = true;
  get diagnostics n = row_count;
  return n;
end; $$;

-- 3) Cấp bù cho GL11 (trả về số dòng quyền đã ghi)
select public.backfill_class('GL11') as so_quyen_da_cap;

notify pgrst, 'reload schema';
