-- Mở khoá cho TOÀN BỘ học viên — bằng CỜ CẤU HÌNH trên từng khoá, không hardcode mã khoá
--
-- Bối cảnh: thầy quyết định mở trọn giáo trình Đệm hát + Tỉa nốt hiện có cho mọi học viên,
-- vĩnh viễn, và áp cho cả học viên đăng ký MỚI về sau. Vì phải áp cho người chưa tồn tại,
-- không thể cấp bằng dữ liệu (edu_course_access từng hàng) — phải sửa LUẬT quyền.
--
-- Thiết kế: thêm cờ `open_to_all_students` trên edu_courses và cho has_course_access()
-- đọc cờ đó. Thầy bật/tắt từng khoá bằng một câu UPDATE (hoặc Admin sau này), KHÔNG cần
-- sửa hàm nữa — đúng quy ước "đổi luật quyền thì sửa server, đừng hardcode UUID".
--
-- Phạm vi mở: chỉ học viên ĐÃ ĐĂNG NHẬP và có hồ sơ edu_students (p_student not null).
-- Khách vãng lai / chưa đăng nhập KHÔNG được mở — nội dung không lọt ra ngoài.
-- Idempotent: chạy lại nhiều lần an toàn.

begin;

-- 1) Cờ cấu hình
alter table public.edu_courses
  add column if not exists open_to_all_students boolean not null default false;

comment on column public.edu_courses.open_to_all_students is
  'true = mọi học viên đã đăng nhập đều được học khoá này (không cần enrollment/gói). Tắt = trả về luật bán hàng bình thường.';

-- 2) Luật quyền: thêm nhánh cờ, GIỮ NGUYÊN 3 nhánh cũ (gói / cấp tay / enrollment)
create or replace function public.has_course_access(p_student uuid, p_course uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
 -- Khoá mở cho mọi học viên (cờ cấu hình) — chỉ áp khi có hồ sơ học viên thật
 select (p_student is not null and exists(
   select 1 from public.edu_courses c
   where c.id = p_course and coalesce(c.open_to_all_students, false)))
 or exists(select 1 from public.student_packages sp join public.edu_courses c on c.id=p_course
   where sp.student_id=p_student and c.code=any(sp.granted_course_codes)
   and public.package_term_valid(sp.status,sp.starts_at,sp.renews_at))
 or exists(select 1 from public.edu_course_access a where a.student_id=p_student and a.course_id=p_course and a.active
   and coalesce(a.note,'') not like 'PKG %')
 or exists(select 1 from public.edu_enrollments e where e.student_id=p_student and e.course_id=p_course and e.is_active and e.access_granted
   and not exists(select 1 from public.edu_course_access a where a.student_id=p_student and a.course_id=p_course and a.note like 'PKG %'));
$function$;

-- 3) Bật cờ cho giáo trình Đệm hát + Tỉa nốt đang có nội dung (status='on')
--    DH3/DHNC/TN2 đang coming_soon và TN4 chưa xuất bản → KHÔNG bật, tránh học viên
--    mở ra thấy khoá rỗng.
update public.edu_courses
   set open_to_all_students = true
 where code in ('DH1', 'DH2', 'TN1', 'TN3');

commit;

notify pgrst, 'reload schema';

-- THU HỒI (nếu cần đóng lại):
--   update public.edu_courses set open_to_all_students = false where code in ('DH1','DH2','TN1','TN3');
-- Không mất dữ liệu enrollment/gói nào — 3 nhánh quyền cũ vẫn nguyên.
