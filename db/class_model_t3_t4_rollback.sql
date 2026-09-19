-- ROLLBACK cho db/class_model_t3_t4.sql — CHỈ chạy khi phải quay lại mô hình trước. Không xoá dữ liệu.
-- Ẩn 4 lớp mới (huỷ mềm) và khôi phục 6 lớp phương án trước đúng như trước migration.
-- Trước khi chạy: kiểm 4 lớp mới CHƯA có học viên (có rồi thì KHÔNG rollback — báo Thầy).
begin;
do $$ declare n int; begin
  select count(*) into n from edu_group_members m join class_schedule c on c.group_id = m.group_id
   where c.code in ('CB1.T3','CB2.T3','SOLO.T4','DEM.T4');
  if n > 0 then raise exception 'Lớp mới đã có % thành viên — không rollback tự động', n; end if;
end $$;
update class_schedule set status = 'cancelled', public_enroll = false where code in ('CB1.T3','CB2.T3','SOLO.T4','DEM.T4');
update class_sessions set status = 'cancelled' where class_id in (select id from class_schedule where code in ('CB1.T3','CB2.T3','SOLO.T4','DEM.T4')) and status = 'scheduled';
-- 6 lớp cũ: trở lại 'upcoming'; 4 lớp T3/T4 cũ công khai lại như trước; 2 lớp T6 rỗng giữ không công khai
update class_schedule set status = 'upcoming', public_enroll = (code in ('DH1.KD20','TN1.GL14','DH2.KD21','TN2.GL15'))
 where code in ('DH1.KD20','TN1.GL14','DH2.KD21','TN2.GL15','SOLO01.TH02','DHNC01.TH01');
update class_sessions set status = 'scheduled', note = nullif(replace(note, 'Huỷ 09/2026: chuyển sang mô hình lớp mới', ''), '')
 where class_id in (select id from class_schedule where code in ('DH1.KD20','TN1.GL14','DH2.KD21','TN2.GL15','SOLO01.TH02','DHNC01.TH01'))
   and note like '%Huỷ 09/2026: chuyển sang mô hình lớp mới%';
commit;
-- Code: revert commit landing trên main (git revert) để landing về bản "Các lớp đang tuyển sinh" trước.
