-- Nhật ký Gỡ rối & Đào sâu — thu dữ liệu học viên kẹt ở đâu, hỏi gì (mỏ vàng cho thầy)
create table if not exists learning_support_log (
  id serial primary key,
  student_id           uuid,
  lesson_id            uuid,
  need_type            text,     -- 'stuck' | 'deepen'
  stuck_type           text,     -- trạng thái kẹt (khi need_type='stuck')
  coaching_shown       text,     -- câu coaching đã hiện
  resolved             boolean,  -- tự gỡ được hay không
  tried                text,     -- học viên đã thử cách nào
  question_for_teacher text,     -- câu hỏi ghi cho thầy
  created_at           timestamptz default now()
);

alter table learning_support_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'learning_support_log' and policyname = 'lsl auth all') then
    create policy "lsl auth all" on learning_support_log for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
