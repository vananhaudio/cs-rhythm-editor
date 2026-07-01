-- Sửa lớp GL11 (Tỉa nốt trên nền karaoke khoá 11): khoá chính = TN3, bỏ NM khỏi lớp.
-- Chạy 1 lần trong Supabase SQL Editor.

update public.class_schedule
set main_course_id = 'efeababa-fdad-4eab-a88a-a80dab1da2af',            -- TN3
    course_ids     = array['efeababa-fdad-4eab-a88a-a80dab1da2af']::uuid[]  -- chỉ TN3
where code = 'GL11';

notify pgrst, 'reload schema';
