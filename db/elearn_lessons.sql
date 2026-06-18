-- Bảng nội dung + media cho bài elearn (soạn trong admin, app đọc từ đây)
-- Mỗi hàng = 1 bài của 1 khoá elearn. Thiếu hàng/thiếu cột → app dùng mặc định trong code (src/elearn/data.ts).
create table if not exists elearn_lessons (
  id serial primary key,
  course_slug text not null,
  lesson_num  int  not null,
  goal       text,
  steps      jsonb default '[]'::jsonb,   -- mảng chuỗi: các bước
  prompt     text,
  thao_type  text,                        -- 'check' | 'neck' | 'tool' | 'listen8'
  items      jsonb default '[]'::jsonb,   -- mảng chuỗi: mục tự đánh giá (khi thao_type='check')
  youtube_id text,
  video_url  text,
  updated_at timestamptz default now(),
  unique (course_slug, lesson_num)
);

alter table elearn_lessons enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'elearn_lessons' and policyname = 'elearn_lessons anon read') then
    create policy "elearn_lessons anon read" on elearn_lessons for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'elearn_lessons' and policyname = 'elearn_lessons auth all') then
    create policy "elearn_lessons auth all" on elearn_lessons for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
