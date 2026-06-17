-- =====================================================================
-- TVA Guitar — Chỉ số V1 / Tăng 2: bảng event "hành động thật"
-- student_action_logs — ghi lại các hành động học sinh TỰ xác nhận
-- (đã thực hành bài / đã gửi bài / đã ôn lại bài cũ...). Đây là tín hiệu
-- để nâng MÀU mốc từ đỏ → vàng. KHÔNG chấm đạt/chưa đạt ở V1.
--
-- Bảo mật: học viên CHỈ ghi & đọc event CỦA MÌNH (user_id = auth.uid());
-- teacher đọc/sửa tất cả (is_teacher). Bảng TỰ QUẢN RLS hẹp → rls_setup.sql
-- đã được sửa để BỎ QUA (self_managed). Append-only: học viên không sửa/xóa.
--
-- Idempotent: chạy lại vô hại. Cần is_teacher() đã tạo từ community_setup.sql.
-- =====================================================================

create table if not exists public.student_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,          -- 'practiced_lesson' | 'submitted_video_self_report' | 'reviewed_old_lesson' | 'completed_assignment_self_report'
  lesson_id uuid,                      -- gắn bài học (để tính màu mốc) — không FK cứng (event log)
  song_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- composite (user_id, lesson_id) phục vụ cả query lọc theo user_id lẫn user_id+lesson_id
create index if not exists idx_sal_user_lesson on public.student_action_logs(user_id, lesson_id);

alter table public.student_action_logs enable row level security;

-- Học viên: tự GHI event của mình
drop policy if exists sal_self_insert on public.student_action_logs;
create policy sal_self_insert on public.student_action_logs
  for insert to authenticated with check (user_id = auth.uid());

-- Học viên: chỉ ĐỌC event của mình
drop policy if exists sal_self_read on public.student_action_logs;
create policy sal_self_read on public.student_action_logs
  for select to authenticated using (user_id = auth.uid());

-- Teacher: toàn quyền (xem/sửa/xóa cho admin)
drop policy if exists sal_teacher_all on public.student_action_logs;
create policy sal_teacher_all on public.student_action_logs
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

notify pgrst, 'reload schema';
