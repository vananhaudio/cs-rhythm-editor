-- Sửa lớp KD17: khoá chính = DH1 (Đệm hát cơ bản), bỏ khoá "Nhập Môn Guitar" gắn nhầm.
-- Nếu KD17 thực ra là Đệm hát TRÌNH ĐỘ 2 thì đổi DH1 → DH2 (c7ab2fcb-...).
-- Chạy 1 lần trong Supabase SQL Editor.

update public.class_schedule
set main_course_id = '65bccb3e-4740-4103-b1fa-c2009fe67921',            -- DH1
    course_ids     = array['65bccb3e-4740-4103-b1fa-c2009fe67921']::uuid[]
where code = 'KD17';

notify pgrst, 'reload schema';
