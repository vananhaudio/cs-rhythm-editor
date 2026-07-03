-- KD17: có 2 nhóm trùng ý nghĩa — DH1.KD17 (đúng, khớp lớp) và KD17 (sai mã, không khớp lớp nào).
-- Mã lớp thật trong class_schedule = 'DH1.KD17'. Gộp về 1 nhóm chuẩn rồi cấp khoá.
-- Chạy trong Supabase SQL Editor.

-- A) Ai đã ở CẢ HAI nhóm → bỏ bản ghi ở nhóm KD17 cũ (tránh trùng unique)
delete from public.edu_group_members m_old
using public.edu_group_members m_new
where m_old.group_id = '203e64fa-9d1b-4fe2-aaf4-fa535d0ae6bc'
  and m_new.group_id = 'f87868c8-23b5-4fa3-9001-3da69110665c'
  and m_old.user_id  = m_new.user_id;

-- B) Dời thành viên còn lại sang nhóm chuẩn DH1.KD17
update public.edu_group_members
set group_id = 'f87868c8-23b5-4fa3-9001-3da69110665c'
where group_id = '203e64fa-9d1b-4fe2-aaf4-fa535d0ae6bc';

-- C) Xoá nhóm KD17 cũ (sai mã)
delete from public.edu_groups where id = '203e64fa-9d1b-4fe2-aaf4-fa535d0ae6bc';

-- D) Cấp khoá cho cả lớp (kỳ vọng > 0)
select public.backfill_class('DH1.KD17') as so_quyen;
