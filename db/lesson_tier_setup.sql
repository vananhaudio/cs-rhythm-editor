-- =====================================================================
-- PHÂN TẦNG BÀI HỌC (freemium) — thêm cột tier cho edu_course_lessons
-- Chạy trong Supabase SQL Editor. Idempotent.
--
-- tier: free | basic | standard | pro  (khớp với gói mở theo level học viên)
--   beginner     → free
--   elementary   → free, basic
--   intermediate → free, basic, standard
--   advanced     → free, basic, standard, pro
--
-- PHẦN 1 (AN TOÀN): chỉ thêm cột, mặc định 'free' → KHÔNG khoá gì cả,
--   mọi bài vẫn mở như cũ. Thầy curate dần trong Course Editor.
-- =====================================================================

alter table public.edu_course_lessons
  add column if not exists tier text not null default 'free';

notify pgrst, 'reload schema';


-- =====================================================================
-- PHẦN 2 (TUỲ CHỌN — CHỈ CHẠY KHI ĐÃ SẴN SÀNG KHOÁ NỘI DUNG)
-- ⚠️ Khi chạy phần này, các bài "nâng cao" sẽ BỊ KHOÁ với tài khoản free.
--    → TRƯỚC KHI CHẠY: nâng level cho học viên đã đóng phí (Hồ sơ học viên),
--      nếu không họ sẽ mất quyền xem bài đã học.
--
-- Quy ước curate mặc định:
--   • Khoá "Nhập môn" & "Nhạc lý" → free toàn bộ.
--   • Các khoá còn lại (trả phí) → 'basic', TRỪ 2 bài đầu mỗi khoá giữ 'free' (học thử).
-- Bỏ dấu comment (--) ở khối dưới để áp dụng.
-- =====================================================================

-- with ranked as (
--   select l.id as lesson_id, c.name as course_name,
--          row_number() over (partition by c.id order by m.order_index, l.order_index) as rn
--   from public.edu_course_lessons l
--   join public.edu_modules  m on m.id = l.module_id
--   join public.edu_courses  c on c.id = m.course_id
-- )
-- update public.edu_course_lessons l
--   set tier = case
--     when r.course_name ~* 'nhập môn|nhạc lý' then 'free'   -- khoá miễn phí
--     when r.rn <= 2 then 'free'                              -- 2 bài đầu = học thử
--     else 'basic'                                            -- còn lại = cần đăng ký
--   end
-- from ranked r
-- where r.lesson_id = l.id;
-- notify pgrst, 'reload schema';
