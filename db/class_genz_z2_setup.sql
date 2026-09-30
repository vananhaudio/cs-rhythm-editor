-- ═══════════════════════════════════════════════════════════════════════════
-- LỚP "Gen Z — Z2" (Owner xác nhận 30/09/2026): nhóm Zalo Z2 hiện có = nhóm học sinh của lớp.
-- Theo docs/QUY-TAC-MA.md ("Lớp ngoài hệ năng lực (vd Z2 'Gen Z'): gắn code riêng + tạo lớp lịch tương ứng";
-- bất biến edu_groups.code = class_schedule.code; "nhóm code NULL nhưng mã nằm trong tên → gắn code"):
--   1) edu_groups Z2 (8874c845…): code NULL → 'Z2'   (KHÔNG tạo nhóm mới, KHÔNG đụng thành viên)
--   2) class_schedule: 1 lớp code 'Z2', group_id = nhóm Z2 (field Admin → Lịch lớp quản lý cho nhóm Zalo)
-- Lớp DÀI HẠN: total_sessions = 0 (không giới hạn số buổi — Admin hiểu qua isOpenEnded), không sinh buổi,
-- end_date NULL. start_date NULL: không có nguồn đáng tin cho ngày khai giảng (nhóm tạo 05/07/2026 chỉ là ngày tạo
-- nhóm) — status 'active' đã đủ để là "Đang học". Không khoá chính / không khoá (không bịa giáo trình).
-- Không trigger nào trên class_schedule / edu_groups (chỉ edu_group_members) → không cấp khoá, không đổi thành viên.
-- Idempotent. CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- Rollback: db/class_genz_z2_rollback.sql.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare g public.edu_groups; n int;
begin
  select * into g from public.edu_groups where id = '8874c845-78eb-430d-9159-926cda00203b';
  if g.id is null then raise exception 'DỪNG: không thấy nhóm Z2 (8874c845…)'; end if;
  if g.name is distinct from 'Z2' or g.group_type is distinct from 'zalo' or g.is_active is not true then
    raise exception 'DỪNG: nhóm Z2 khác dữ liệu đã kiểm (name/type/active): % / % / %', g.name, g.group_type, g.is_active;
  end if;
  if g.code is not null and upper(g.code) <> 'Z2' then raise exception 'DỪNG: nhóm Z2 đã có mã khác: %', g.code; end if;
  select count(*) into n from public.edu_group_members m where m.group_id = g.id and m.status = 'active';
  if n <> 9 then raise exception 'DỪNG: nhóm Z2 có % thành viên active (kỳ vọng 9)', n; end if;
  if exists (select 1 from public.edu_groups x where upper(coalesce(x.code, '')) = 'Z2' and x.id <> g.id) then
    raise exception 'DỪNG: đã có NHÓM KHÁC mang mã Z2';
  end if;
  if exists (select 1 from public.class_schedule c where upper(coalesce(c.code, '')) = 'Z2'
             and not (c.name = 'Gen Z — Z2' and c.group_id = g.id)) then
    raise exception 'DỪNG: đã có LỚP KHÁC mang mã Z2';
  end if;
  if exists (select 1 from public.class_schedule c where (c.group_id = g.id or c.cohort_group_id = g.id)
             and upper(coalesce(c.code, '')) <> 'Z2') then
    raise exception 'DỪNG: nhóm Z2 đã gắn với một lớp khác';
  end if;
end $gate$;

-- 1) Nhóm Zalo ≡ mã lớp (chỉ khi còn trống)
update public.edu_groups set code = 'Z2'
 where id = '8874c845-78eb-430d-9159-926cda00203b' and code is null;

-- 2) Lớp — đúng các field Admin → Lịch lớp ghi (ScheduleManager), không field lạ
insert into public.class_schedule (
  code, name, section, schedule, start_text, duration, price, course_ids, main_course_id, group_id, zoom_url,
  sort_order, is_active, start_date, weekday, start_time, duration_minutes, total_sessions, end_date, status,
  timezone, program_code, breaks_after, show_on_practice_schedule, stage, practice_type, metadata,
  public_product, public_enroll)
select 'Z2', 'Gen Z — Z2', 'active', 'Chủ nhật · 14:00–15:00', null,
       'Hàng tuần · mỗi buổi 60 phút · không giới hạn số buổi', null, '{}'::uuid[], null,
       '8874c845-78eb-430d-9159-926cda00203b', null,
       0, true, null, 0, '14:00', 60, 0, null, 'active',
       'Asia/Ho_Chi_Minh', null, null, false, null, null, '{}'::jsonb,
       null, false
where not exists (select 1 from public.class_schedule c where upper(coalesce(c.code, '')) = 'Z2');

notify pgrst, 'reload schema';
