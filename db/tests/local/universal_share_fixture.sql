-- Fixture TEST-ONLY cho Universal Share: bảng class_sessions tối thiểu (production có bảng đầy đủ) + 3 buổi cho lớp DH2.KD18 của fixture.
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class_schedule(id) on delete cascade,
  session_number int not null, title text, start_at timestamptz, end_at timestamptz, status text, note text,
  created_at timestamptz not null default now(), event_type text not null default 'lesson', stage_id bigint
);
insert into public.class_sessions (id, class_id, session_number, title, event_type) values
  ('51000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000c1', 1, 'Buổi 1 — Làm quen', 'lesson'),
  ('51000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-0000000000c1', 2, 'Nghỉ lễ', 'break')
on conflict do nothing;
