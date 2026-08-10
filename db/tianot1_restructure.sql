-- ============================================================================
-- TỈA NỐT 1 — Companion cho tái cấu trúc 10 chương → 7 chặng (khớp sách V2)
-- Course: 4e80d7ec-3b99-426a-a090-990d37eb24c0
--
-- CHẠY SAU db/seed_tianot_chuong1.sql (bản mới, 7 chặng). Seed đã đổi tên/order
-- 7 module tái dùng + dời 62 bài. File này làm 2 việc seed KHÔNG làm được:
--   1. Gán bài "Nốt Mi" (chỉ có trên DB, không nằm trong tiaNot1Lessons.json)
--      vào Chặng 2 — Dây 1 & 2, order 0 (bài đầu tiên học nốt).
--   2. Xoá 3 module cũ nay đã rỗng (Ô nhịp / Ôn tập / Bài hát yêu thích).
-- Idempotent: chạy lại nhiều lần OK.
-- ============================================================================

-- 1) Bài "Nốt Mi đầu tiên" → Chặng 2 (module d2fa1b1f…), đứng trước cụm Mi-Fa-Sol
UPDATE edu_course_lessons
   SET module_id = 'd2fa1b1f-b3bc-4084-a130-71beb14c98f2', order_index = 0
 WHERE id = '0d0604ff-bdb4-474a-a088-d9e699c698bb';

-- 2) Xoá 3 module dư — CHỈ khi đã rỗng (không còn bài nào trỏ vào).
--    Nếu dòng nào không bị xoá (còn trả về ở SELECT kiểm tra dưới) tức là còn
--    lesson trỏ vào → DỪNG, rà lại ánh xạ trước khi ép xoá.
DELETE FROM edu_modules m
 WHERE m.id IN (
        'c6720000-0000-4000-8000-000000000001',  -- Chương 6 cũ: Ô nhịp
        'c7720000-0000-4000-8000-000000000001',  -- Chương 7 cũ: Ôn tập & Vận dụng
        'c9720000-0000-4000-8000-000000000001'   -- Chương 9 cũ: Bài hát yêu thích
       )
   AND NOT EXISTS (
        SELECT 1 FROM edu_course_lessons l WHERE l.module_id = m.id
       );

-- Kiểm tra: câu này PHẢI trả về 0 dòng sau khi chạy (không còn module mồ côi).
-- SELECT id, name FROM edu_modules
--  WHERE id IN ('c6720000-0000-4000-8000-000000000001',
--               'c7720000-0000-4000-8000-000000000001',
--               'c9720000-0000-4000-8000-000000000001');

NOTIFY pgrst, 'reload schema';
