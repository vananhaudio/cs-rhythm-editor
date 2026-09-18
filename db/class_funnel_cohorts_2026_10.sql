-- Hai lớp phễu đầu tiên (Phase 1 tuyển sinh public) — CHƯA CHẠY, chờ Thầy duyệt.
--   DH1.KD20 · Đệm hát căn bản · Thứ 3 19:00–20:30 · 4 buổi
--   TN1.GL14 · Guitar căn bản  · Thứ 3 20:30–22:00 · 4 buổi
-- Khai giảng: Thứ 3 06/10/2026 → 06/10, 13/10, 20/10, 27/10 (không trùng class_off_days).
-- Mã sinh theo buildClassCode (docs/QUY-TAC-MA.md): 1 lớp = 1 nhóm = 1 mã.
-- KHÔNG sửa / tái sử dụng cohort legacy.
--
-- CHỐT AN TOÀN: script tự huỷ (raise) nếu còn bất kỳ buổi học nào khác chạm
-- Thứ 3 19:00–22:00 trong 4 tuần này — hiện DH1.KD19 (20:30–22:00) đang chiếm khung Guitar căn bản.
-- ⚠ Chạy script = 2 lớp hiện NGAY trên landing cũ (main) vì landing cũ đọc mọi dòng is_active.
--   Chỉ chạy cùng lúc deploy Phase 1.
begin;

do $$
declare n int;
begin
  select count(*) into n
  from class_sessions s join class_schedule c on c.id = s.class_id
  where c.code not in ('DH1.KD20', 'TN1.GL14')
    and s.status not in ('cancelled', 'holiday')
    and (s.start_at at time zone 'Asia/Ho_Chi_Minh')::date in ('2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27')
    and (s.start_at at time zone 'Asia/Ho_Chi_Minh')::time < '22:00'
    and (s.end_at at time zone 'Asia/Ho_Chi_Minh')::time > '19:00';
  if n > 0 then
    raise exception 'Xung đột: % buổi khác đang chiếm Thứ 3 19:00–22:00 trong 4 tuần khai giảng', n;
  end if;
end $$;

-- Nhóm Zalo ≡ mã lớp (zalo_url để trống, Thầy dán sau trong Admin)
insert into edu_groups (code, name, group_type, is_active)
select v.code, v.code, 'zalo', true
from (values ('DH1.KD20'), ('TN1.GL14')) v(code)
where not exists (select 1 from edu_groups g where upper(g.code) = v.code);

insert into class_schedule (
  code, name, section, schedule, start_text, duration, price, course_ids, main_course_id, group_id,
  sort_order, is_active, start_date, weekday, start_time, duration_minutes, total_sessions, end_date,
  status, timezone, show_on_practice_schedule, metadata, public_product, public_enroll)
select v.code, v.name, 'upcoming', v.sched, '06/10/2026', '4 buổi · mỗi buổi 90 phút', '499.000đ',
       array[(select id from edu_courses where code = v.course)], (select id from edu_courses where code = v.course),
       (select id from edu_groups where upper(code) = v.code limit 1),
       0, true, '2026-10-06', 2, v.t::time, 90, 4, '2026-10-27',
       'upcoming', 'Asia/Ho_Chi_Minh', false, '{}'::jsonb, v.product, true
from (values
  ('DH1.KD20', 'Đệm hát căn bản · 4 buổi', 'Thứ 3 · 19h00', '19:00', 'DH1', 'dem_hat_can_ban'),
  ('TN1.GL14', 'Guitar căn bản · 4 buổi',  'Thứ 3 · 20h30', '20:30', 'TN1', 'guitar_can_ban')
) v(code, name, sched, t, course, product)
where not exists (select 1 from class_schedule c where c.code = v.code);

-- 4 buổi / lớp (giờ VN, lưu UTC)
insert into class_sessions (class_id, session_number, start_at, end_at, event_type, status)
select c.id, n,
       ((d::date + c.start_time) at time zone 'Asia/Ho_Chi_Minh'),
       ((d::date + c.start_time) at time zone 'Asia/Ho_Chi_Minh') + interval '90 minutes',
       'lesson', 'scheduled'
from class_schedule c
cross join lateral (values (1, date '2026-10-06'), (2, date '2026-10-13'), (3, date '2026-10-20'), (4, date '2026-10-27')) s(n, d)
where c.code in ('DH1.KD20', 'TN1.GL14')
  and not exists (select 1 from class_sessions x where x.class_id = c.id);

commit;
