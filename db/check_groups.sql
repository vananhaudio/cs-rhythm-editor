-- Xem tất cả nhóm + mã + số thành viên đang active → tìm nhóm nào là lớp GL11.
select g.id,
       g.code                as ma,
       g.name                as ten_nhom,
       g.group_type          as loai,
       count(m.*) filter (where m.status = 'active') as so_thanh_vien
from public.edu_groups g
left join public.edu_group_members m on m.group_id = g.id
group by g.id
order by so_thanh_vien desc, g.name;
