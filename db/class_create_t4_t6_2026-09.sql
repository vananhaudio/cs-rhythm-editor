-- Tạo 4 lớp theo mô hình vận hành mới (19/09/2026) — CHƯA CHẠY, chờ Thầy duyệt.
--   T4 19:00 DH2.KD21  Đệm hát trung cấp · 4 buổi từ 14/10/2026 (tuyển sinh, vòng 4 buổi)
--   T4 20:30 TN2.GL15  Guitar trung cấp  · 4 buổi từ 14/10/2026
--   T6 19:00 SOLO01.TH02 Solo Guitar      · 3 chặng × 8 = 24 buổi từ 30/10/2026
--   T6 20:30 DHNC01.TH01 Đệm hát nâng cao · 3 chặng × 8 = 24 buổi từ 18/12/2026
-- Mô hình mới: course_ids RỖNG (quyền nội dung đến từ gói có hạn), 1 lớp = 1 nhóm = 1 mã.
-- public_enroll=false cho CẢ 4 (landing sẽ đổi sang "Các lớp đang tuyển sinh" ở bước sau).
-- T4 chưa có public_product (CHECK hiện chỉ nhận 4 sản phẩm cũ — mở ở bước landing).
-- Ngày buổi đã sinh theo luật hệ thống: bỏ class_off_days, nghỉ 2 tuần sau buổi 8 và 16.
-- Chốt chặn: tự huỷ nếu có bất kỳ buổi nào khác chiếm cùng slot vào cùng ngày.
begin;
create temp table _new_sess (code text, n int, d date, ev text) on commit drop;
insert into _new_sess values
('DH2.KD21',1,'2026-10-14','lesson'),
('DH2.KD21',2,'2026-10-21','lesson'),
('DH2.KD21',3,'2026-10-28','lesson'),
('DH2.KD21',4,'2026-11-04','lesson'),
('TN2.GL15',1,'2026-10-14','lesson'),
('TN2.GL15',2,'2026-10-21','lesson'),
('TN2.GL15',3,'2026-10-28','lesson'),
('TN2.GL15',4,'2026-11-04','lesson'),
('SOLO01.TH02',1,'2026-10-30','lesson'),
('SOLO01.TH02',2,'2026-11-06','lesson'),
('SOLO01.TH02',3,'2026-11-13','lesson'),
('SOLO01.TH02',4,'2026-11-20','lesson'),
('SOLO01.TH02',5,'2026-11-27','lesson'),
('SOLO01.TH02',6,'2026-12-04','lesson'),
('SOLO01.TH02',7,'2026-12-11','lesson'),
('SOLO01.TH02',8,'2026-12-18','lesson'),
('SOLO01.TH02',9,'2027-01-08','lesson'),
('SOLO01.TH02',10,'2027-01-15','lesson'),
('SOLO01.TH02',11,'2027-01-22','lesson'),
('SOLO01.TH02',12,'2027-01-29','lesson'),
('SOLO01.TH02',13,'2027-02-19','lesson'),
('SOLO01.TH02',14,'2027-02-26','lesson'),
('SOLO01.TH02',15,'2027-03-05','lesson'),
('SOLO01.TH02',16,'2027-03-12','lesson'),
('SOLO01.TH02',17,'2027-04-02','lesson'),
('SOLO01.TH02',18,'2027-04-09','lesson'),
('SOLO01.TH02',19,'2027-04-23','lesson'),
('SOLO01.TH02',20,'2027-05-07','lesson'),
('SOLO01.TH02',21,'2027-05-14','lesson'),
('SOLO01.TH02',22,'2027-05-21','lesson'),
('SOLO01.TH02',23,'2027-05-28','lesson'),
('SOLO01.TH02',24,'2027-06-04','lesson'),
('SOLO01.TH02',null,'2026-12-25','break'),
('SOLO01.TH02',null,'2027-01-01','break'),
('SOLO01.TH02',null,'2027-03-19','break'),
('SOLO01.TH02',null,'2027-03-26','break'),
('DHNC01.TH01',1,'2026-12-18','lesson'),
('DHNC01.TH01',2,'2026-12-25','lesson'),
('DHNC01.TH01',3,'2027-01-08','lesson'),
('DHNC01.TH01',4,'2027-01-15','lesson'),
('DHNC01.TH01',5,'2027-01-22','lesson'),
('DHNC01.TH01',6,'2027-01-29','lesson'),
('DHNC01.TH01',7,'2027-02-19','lesson'),
('DHNC01.TH01',8,'2027-02-26','lesson'),
('DHNC01.TH01',9,'2027-03-19','lesson'),
('DHNC01.TH01',10,'2027-03-26','lesson'),
('DHNC01.TH01',11,'2027-04-02','lesson'),
('DHNC01.TH01',12,'2027-04-09','lesson'),
('DHNC01.TH01',13,'2027-04-23','lesson'),
('DHNC01.TH01',14,'2027-05-07','lesson'),
('DHNC01.TH01',15,'2027-05-14','lesson'),
('DHNC01.TH01',16,'2027-05-21','lesson'),
('DHNC01.TH01',17,'2027-06-11','lesson'),
('DHNC01.TH01',18,'2027-06-18','lesson'),
('DHNC01.TH01',19,'2027-06-25','lesson'),
('DHNC01.TH01',20,'2027-07-02','lesson'),
('DHNC01.TH01',21,'2027-07-09','lesson'),
('DHNC01.TH01',22,'2027-07-16','lesson'),
('DHNC01.TH01',23,'2027-07-23','lesson'),
('DHNC01.TH01',24,'2027-07-30','lesson'),
('DHNC01.TH01',null,'2027-03-05','break'),
('DHNC01.TH01',null,'2027-03-12','break'),
('DHNC01.TH01',null,'2027-05-28','break'),
('DHNC01.TH01',null,'2027-06-04','break');

do $$ declare n int; begin
  select count(*) into n from _new_sess x
   join (values ('DH2.KD21','19:00'),('TN2.GL15','20:30'),('SOLO01.TH02','19:00'),('DHNC01.TH01','20:30')) t(code,hm) on t.code=x.code
   join class_sessions s on (s.start_at at time zone 'Asia/Ho_Chi_Minh')::date = x.d
     and to_char(s.start_at at time zone 'Asia/Ho_Chi_Minh','HH24:MI') = t.hm and s.status not in ('cancelled','holiday')
   join class_schedule c on c.id=s.class_id and c.code is distinct from x.code;
  if n>0 then raise exception 'Xung đột: % buổi khác trùng slot/ngày', n; end if;
end $$;
insert into edu_groups (code, name, group_type, is_active)
select v.code, v.code, 'zalo', true from (values ('DH2.KD21'),('TN2.GL15'),('SOLO01.TH02'),('DHNC01.TH01')) v(code)
where not exists (select 1 from edu_groups g where upper(g.code)=v.code);
insert into class_schedule (code,name,section,schedule,start_text,duration,price,course_ids,main_course_id,group_id,sort_order,is_active,
  start_date,weekday,start_time,duration_minutes,total_sessions,end_date,status,timezone,program_code,breaks_after,show_on_practice_schedule,metadata,public_product,public_enroll)
select v.code, v.name, 'upcoming', v.sched, to_char(v.sd,'DD/MM/YYYY'), v.tot||' buổi · mỗi buổi 90 phút', null, '{}',
  (select id from edu_courses where code=v.course), (select id from edu_groups where upper(code)=v.code limit 1), 0, true,
  v.sd, v.wd, v.t::time, 90, v.tot, (select max(d) from _new_sess where code=v.code and ev='lesson'), 'upcoming', 'Asia/Ho_Chi_Minh',
  v.prog, v.brk, false, '{}'::jsonb, v.product, false
from (values
  ('DH2.KD21','Đệm hát trung cấp','DH2',3,'19:00',date '2026-10-14',4,null::int[],null,null,'Thứ 4 · 19h00'),
  ('TN2.GL15','Guitar trung cấp','TN2',3,'20:30',date '2026-10-14',4,null::int[],null,null,'Thứ 4 · 20h30'),
  ('SOLO01.TH02','Solo Guitar','SOLO',5,'19:00',date '2026-10-30',24,array[8,16]::int[],'solo_guitar','SOLO01','Thứ 6 · 19h00'),
  ('DHNC01.TH01','Đệm hát nâng cao','DHNC',5,'20:30',date '2026-12-18',24,array[8,16]::int[],'dem_hat_nang_cao','DHNC01','Thứ 6 · 20h30')
) v(code,name,course,wd,t,sd,tot,brk,product,prog,sched)
where not exists (select 1 from class_schedule c where c.code=v.code);
insert into class_sessions (class_id, session_number, start_at, end_at, event_type, status)
select c.id, x.n, (x.d + c.start_time) at time zone 'Asia/Ho_Chi_Minh', ((x.d + c.start_time) at time zone 'Asia/Ho_Chi_Minh') + interval '90 minutes',
       x.ev, case x.ev when 'break' then 'holiday' else 'scheduled' end
from _new_sess x join class_schedule c on c.code=x.code
where not exists (select 1 from class_sessions s where s.class_id=c.id);
commit;
