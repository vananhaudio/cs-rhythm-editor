-- =====================================================================
-- Bảng xếp hạng THEO LỚP: chỉ thành viên cùng nhóm (Zalo) với người đang đăng nhập,
-- gộp tất cả các lớp họ tham gia. Luôn gồm chính mình. SECURITY DEFINER (RLS chặn
-- học sinh đọc thành viên nhóm khác). Chạy trong Supabase SQL Editor. Idempotent.
-- =====================================================================

create or replace function public.my_class_leaderboard()
returns table(student_id uuid, name text, avatar_url text, xp bigint)
language sql security definer set search_path = '' stable as $$
  with my_groups as (
    select group_id from public.edu_group_members
    where user_id = auth.uid() and status = 'active'
  ),
  classmates as (
    select distinct gm.user_id
    from public.edu_group_members gm
    join my_groups mg on mg.group_id = gm.group_id
    where gm.status = 'active'
    union
    select auth.uid()                      -- luôn gồm chính mình (kể cả chưa vào lớp nào)
  ),
  cm_students as (
    select s.id,
           coalesce(nullif(trim(s.display_name), ''), s.full_name, 'Học viên') as name,
           s.avatar_url
    from public.edu_students s
    join classmates c on c.user_id = s.user_id
  )
  select cs.id, cs.name, cs.avatar_url,
         coalesce((select sum(x.xp) from public.student_xp_log x where x.student_id = cs.id), 0)::bigint as xp
  from cm_students cs
  order by xp desc;
$$;

revoke all on function public.my_class_leaderboard() from anon;
grant execute on function public.my_class_leaderboard() to authenticated;

notify pgrst, 'reload schema';
