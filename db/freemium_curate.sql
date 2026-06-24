-- =====================================================================
-- CURATE FREEMIUM — đặt khoá miễn phí + khoá bài của khoá trả phí
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent (chạy lại cho kết quả như nhau).
--
-- Quy ước (thầy đã chốt):
--   • MIỄN PHÍ: khoá Nhập Môn + Nhạc lý CƠ BẢN  → ai cũng học toàn bộ.
--   • TRẢ PHÍ: tất cả khoá còn lại → khoá bài, CHỪA 2 bài đầu mỗi khoá làm "học thử".
--
-- ⚠️ SAU KHI CHẠY: học viên đã đóng phí cần được "Mở khoá" từng khoá ở
--    /admin → Hồ sơ học viên (nếu không họ chỉ xem được 2 bài thử).
-- =====================================================================

-- 1) Cờ miễn phí: Nhập Môn + Nhạc lý cơ bản = free; còn lại = trả phí
update public.edu_courses
  set is_free = (name ~* 'nhập môn' or name ~* 'nhạc lý cơ bản');

-- 2) Khoá bài: khoá free → mở hết; khoá phí → 2 bài đầu 'free' (học thử), còn lại 'basic'
with ranked as (
  select l.id as lid, c.is_free as course_free,
         row_number() over (partition by c.id order by m.order_index, l.order_index) as rn
  from public.edu_course_lessons l
  join public.edu_modules m on m.id = l.module_id
  join public.edu_courses c on c.id = m.course_id
)
update public.edu_course_lessons l
  set tier = case
    when r.course_free then 'free'   -- khoá miễn phí: mọi bài mở
    when r.rn <= 2     then 'free'   -- khoá trả phí: 2 bài đầu = học thử
    else 'basic'                     -- còn lại: cần đăng ký
  end
from ranked r
where r.lid = l.id;

notify pgrst, 'reload schema';

-- Kiểm tra nhanh sau khi chạy:
-- select c.name, c.is_free, count(*) filter (where l.tier='free') as free_bai,
--        count(*) filter (where l.tier<>'free') as khoa_bai
-- from edu_courses c join edu_modules m on m.course_id=c.id
-- join edu_course_lessons l on l.module_id=m.id group by c.name,c.is_free order by c.name;
