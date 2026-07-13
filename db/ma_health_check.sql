-- ═══ KIỂM TRA SỨC KHOẺ HỆ MÃ (chạy định kỳ để bắt lệch mã sớm) ═══
-- Bất biến: edu_groups.code (nhóm Zalo của lớp) === class_schedule.code === mã lớp.
-- Chạy trong Supabase SQL Editor. CHỈ ĐỌC, không sửa gì.

-- 1) Đối soát nhóm Zalo ↔ lớp trong lịch. Mọi LỚP THẬT phải '✅ KHỚP'.
--    "CHỈ CÓ NHÓM" hợp lệ với: HT2026/HT2027 (cấp qua cờ ht_member), lớp ngoài hệ (Z2).
select
  coalesce(upper(trim(g.code)), upper(trim(cs.code))) as ma,
  case
    when g.id is not null and cs.id is not null then '✅ KHỚP'
    when g.id is not null                       then '⚠ CHỈ CÓ NHÓM (thiếu lớp trong lịch)'
    else                                             '⚠ CHỈ CÓ LỚP (thiếu nhóm Zalo)'
  end as trang_thai,
  g.name as ten_nhom
from public.edu_groups g
full outer join public.class_schedule cs
  on upper(trim(g.code)) = upper(trim(cs.code)) and g.code is not null and cs.code is not null
where (g.code is not null and g.group_type = 'zalo') or cs.code is not null
order by trang_thai, ma;

-- 2) Nhóm Zalo dạng lớp mà THIẾU code (mã chỉ nằm trong tên) → tự cấp khoá sẽ hỏng.
select id, name, group_type from public.edu_groups
where group_type = 'zalo' and (code is null or trim(code) = '')
  and name !~* 'hành trình|cộng đồng';   -- bỏ qua nhóm HT/cộng đồng (không cần code)

-- 3) Lớp trong lịch CHƯA gắn khoá (course_ids rỗng) → vào nhóm cũng không có gì để cấp.
select code, id from public.class_schedule
where course_ids is null or array_length(course_ids, 1) is null;

-- 4) Code trùng nhau giữa các nhóm (phải DUY NHẤT).
select upper(trim(code)) as ma, count(*) as so_nhom
from public.edu_groups where code is not null
group by upper(trim(code)) having count(*) > 1;
