-- KD17 (Khởi đầu đam mê khoá 17) = NM + NL1 + DH1. Gắn mã nhóm thật + cấp bù 5 học sinh.
-- Chạy trong Supabase SQL Editor.

-- 1) Xoá nhóm "KD17" RỖNG (auto-tạo) để không trùng mã với nhóm thật
delete from public.edu_groups where id = '563b52e6-832e-4b8c-8ef8-bb28d67efdf2';

-- 2) Gắn mã KD17 cho nhóm THẬT (đang có 5 thành viên)
update public.edu_groups set code = 'KD17'
where id = '203e64fa-9d1b-4fe2-aaf4-fa535d0ae6bc';   -- "Khởi đầu đam mê khoá 17 – KD17"

-- 3) Lớp KD17 gồm NM + NL1 + DH1 (khoá chính = DH1 để hiển thị)
update public.class_schedule
set course_ids = array[
      'fd23a7a2-bfce-44c6-8bde-6d76289a3625',   -- NM  (Nhập môn)
      '79706056-ddf5-4741-8811-1f33f4ee0d48',   -- NL1 (Nhạc lý cơ bản)
      '65bccb3e-4740-4103-b1fa-c2009fe67921'    -- DH1 (Đệm hát cơ bản)
    ]::uuid[],
    main_course_id = '65bccb3e-4740-4103-b1fa-c2009fe67921'   -- DH1
where code = 'KD17';

-- 4) Cấp bù cho 5 học sinh đang trong lớp
select public.backfill_class('KD17') as so_quyen_da_cap;   -- kỳ vọng 15 (5 × 3)

notify pgrst, 'reload schema';
