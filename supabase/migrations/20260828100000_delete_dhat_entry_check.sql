-- Xoá 2 bài "Kiểm tra đầu vào" (self-report) của Đệm hát 1 + module rỗng còn lại.
-- Lessons: 5ed2409d… "Tôi đã hoàn thành khoá Nhập môn guitar"
--          96055827… "Tôi đã hoàn thành khoá học Chìa khoá nhạc lý cơ bản"
-- Module:  d28f5327… "Kiểm tra đầu vào" (course Đệm hát cơ bản)
-- Dọn các bảng phụ tham chiếu lesson_id trước để tránh lỗi FK / bỏ rác.

delete from public.edu_lesson_progress where lesson_id in ('5ed2409d-e7b0-4279-8451-c03b7f6983cb','96055827-23e9-4dba-baa4-79d088a0c883');
delete from public.edu_skill_progress  where lesson_id in ('5ed2409d-e7b0-4279-8451-c03b7f6983cb','96055827-23e9-4dba-baa4-79d088a0c883');
delete from public.student_action_logs where lesson_id in ('5ed2409d-e7b0-4279-8451-c03b7f6983cb','96055827-23e9-4dba-baa4-79d088a0c883');

delete from public.edu_course_lessons where id in ('5ed2409d-e7b0-4279-8451-c03b7f6983cb','96055827-23e9-4dba-baa4-79d088a0c883');
delete from public.edu_modules where id = 'd28f5327-d7d6-41fe-aa35-d5dd1ca1747d';

notify pgrst, 'reload schema';
