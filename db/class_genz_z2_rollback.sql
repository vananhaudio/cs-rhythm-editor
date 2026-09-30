-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK lớp "Gen Z — Z2" (db/class_genz_z2_setup.sql). Idempotent. KHÔNG đụng thành viên nhóm Z2.
-- Gỡ lớp code Z2 (chỉ đúng bản ghi do setup tạo: tên + nhóm) và trả mã nhóm Z2 về NULL như trước.
-- CHẠY bằng scripts/prod-db.py (không begin/commit trong file).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
delete from public.class_sessions s using public.class_schedule c
 where s.class_id = c.id and c.code = 'Z2' and c.name = 'Gen Z — Z2' and c.group_id = '8874c845-78eb-430d-9159-926cda00203b';
delete from public.class_schedule
 where code = 'Z2' and name = 'Gen Z — Z2' and group_id = '8874c845-78eb-430d-9159-926cda00203b';
update public.edu_groups set code = null
 where id = '8874c845-78eb-430d-9159-926cda00203b' and code = 'Z2'
   and not exists (select 1 from public.class_schedule c where upper(coalesce(c.code, '')) = 'Z2');
notify pgrst, 'reload schema';
