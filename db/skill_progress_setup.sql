-- =====================================================================
-- KỶ LUẬT LUYỆN TẬP — tiến độ KỸ NĂNG (đỏ/vàng/xanh) theo từng bài.
-- Tách khỏi "tiến độ học" (edu_lesson_progress). 1 bài = nhiều PHIÊN luyện.
--   sessions: số phiên đã hoàn thành. 1=đỏ, 2=vàng, 3+=xanh.
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent.
-- =====================================================================

create table if not exists public.edu_skill_progress (
  id          bigint generated always as identity primary key,
  student_id  uuid not null,
  lesson_id   uuid not null,
  sessions    int  not null default 0,
  last_at     timestamptz not null default now(),
  unique (student_id, lesson_id)
);
create index if not exists esp_student_idx on public.edu_skill_progress (student_id);

alter table public.edu_skill_progress enable row level security;
drop policy if exists esp_all on public.edu_skill_progress;
create policy esp_all on public.edu_skill_progress for all to authenticated using (true) with check (true);

-- Tăng 1 phiên cho (student, lesson); trả về tổng số phiên sau khi tăng.
create or replace function public.record_skill_session(p_student uuid, p_lesson uuid)
returns int language plpgsql security definer as $$
declare n int;
begin
  insert into public.edu_skill_progress (student_id, lesson_id, sessions, last_at)
    values (p_student, p_lesson, 1, now())
  on conflict (student_id, lesson_id)
    do update set sessions = public.edu_skill_progress.sessions + 1, last_at = now()
  returning sessions into n;
  return n;
end $$;
revoke all on function public.record_skill_session(uuid, uuid) from public, anon;
grant execute on function public.record_skill_session(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
