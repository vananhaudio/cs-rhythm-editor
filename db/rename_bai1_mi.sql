-- Đồng bộ tên Bài 1 môn Tỉa nốt 1 (Chương 1) theo format "Bài N:" như các bài sau.
--   Cũ:  "Nốt Mi — dây 1 buông"
--   Mới: "Bài 1: Nốt Mi đầu tiên"
-- Idempotent: lookup theo id cố định.

UPDATE edu_course_lessons
SET title = 'Bài 1: Nốt Mi đầu tiên'
WHERE id = '0d0604ff-bdb4-474a-a088-d9e699c698bb';

UPDATE flows
SET title = 'Bài 1: Nốt Mi đầu tiên'
WHERE lesson_id = '0d0604ff-bdb4-474a-a088-d9e699c698bb';
