-- Báo cáo học tập: gom XP/bài/khoá Ở PHÍA DB (tránh giới hạn 1000 dòng của API khi tải thô về client).
-- Trả 1 dòng/học sinh. Chỉ teacher/admin gọi được. Chạy trong Supabase SQL Editor. Idempotent.

create or replace function public.report_stats()
returns table(student_id uuid, total_xp bigint, last_at timestamptz, done bigint, opened bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.app_users where id = auth.uid() and role in ('teacher','admin')) then
    raise exception 'forbidden';
  end if;
  return query
  select s.id,
         coalesce(x.total_xp, 0),
         x.last_at,
         coalesce(p.done, 0),
         coalesce(a.opened, 0)
  from public.edu_students s
  left join (select l.student_id, sum(l.xp)::bigint as total_xp, max(l.created_at) as last_at
             from public.student_xp_log l group by l.student_id) x on x.student_id = s.id
  left join (select pr.student_id, count(*)::bigint as done
             from public.edu_lesson_progress pr group by pr.student_id) p on p.student_id = s.id
  left join (select ac.student_id, count(*)::bigint as opened
             from public.edu_course_access ac where ac.active group by ac.student_id) a on a.student_id = s.id;
end; $$;

notify pgrst, 'reload schema';
