-- Phase 2 (a): lớp mô hình mới KHÔNG tự cấp course access vĩnh viễn.
-- Class/group = lịch học + cohort. Package = quyền nội dung có thời hạn.
-- Trigger tg_grant_class_courses + backfill_class chỉ cấp theo class_schedule.course_ids,
-- nên course_ids rỗng ⇒ vào nhóm KHÔNG sinh edu_course_access/edu_enrollments.
-- main_course_id GIỮ NGUYÊN (activate_class_membership dùng nó để biết khoá của lớp).
-- Chỉ đụng DH1.KD20 / TN1.GL14; tự huỷ nếu lớp đã có thành viên. Không đụng lớp legacy.
begin;
do $$
declare n int;
begin
  select count(*) into n from edu_group_members m join class_schedule c on c.group_id = m.group_id
  where c.code in ('DH1.KD20', 'TN1.GL14');
  if n > 0 then raise exception 'Đã có % thành viên — dừng, cần xem lại quyền đã cấp', n; end if;
end $$;
update class_schedule set course_ids = '{}' where code in ('DH1.KD20', 'TN1.GL14');
commit;
