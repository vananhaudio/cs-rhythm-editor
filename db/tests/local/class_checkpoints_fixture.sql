-- Fixture LỚP CỦA TÔI V1 (checkpoint + tiến độ buổi) cho cluster PostgreSQL TẠM. KHÔNG chạy production.
-- Nạp SAU social_fixture + Social + learning_threads_fixture + P1/P2/Lớp học V1/Feed V1.
-- Giả lập đúng DDL production (đọc 01/10): class_sessions, class_lesson_content, class_curriculum_access và
-- tva_private.can_read_class_curriculum (thân hàm y như production).
-- Người: A, B (lớp SOLO01.TH01, có quyền giáo trình) · C (lớp SOLO01.TH02, có quyền) · T (thầy) · N (ngoài Class)

alter table public.class_stages add column if not exists from_session int, add column if not exists to_session int,
  add column if not exists summary text;

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class_schedule(id) on delete cascade,
  session_number int, title text, start_at timestamptz not null default now(), end_at timestamptz,
  status text not null default 'scheduled', note text, created_at timestamptz default now(),
  event_type text not null default 'lesson' check (event_type in ('lesson', 'break', 'special')),
  stage_id bigint references public.class_stages(id),
  unique (class_id, session_number), unique (id, event_type)
);
create table if not exists public.class_lesson_content (
  session_id uuid primary key, event_type text not null default 'lesson' check (event_type = 'lesson'),
  status text not null check (status in ('draft', 'published')), blocks jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array'),
  updated_at timestamptz default now(), updated_by uuid references auth.users(id) on delete set null,
  foreign key (session_id, event_type) references public.class_sessions(id, event_type),
  check (status <> 'published' or jsonb_array_length(blocks) > 0)
);
create table if not exists public.class_curriculum_access (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class_schedule(id), user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'revoked')), granted_at timestamptz default now(), granted_by uuid,
  revoked_at timestamptz, revoked_by uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (class_id, user_id)
);
alter table public.class_lesson_content enable row level security;
alter table public.class_curriculum_access enable row level security;

create schema if not exists tva_private;
CREATE OR REPLACE FUNCTION tva_private.can_read_class_curriculum(p_class_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.class_schedule c
  JOIN public.edu_groups g ON g.id=c.cohort_group_id
  JOIN public.edu_group_members m ON m.group_id=g.id
  JOIN public.class_curriculum_access a ON a.class_id=c.id AND a.user_id=m.user_id
  WHERE c.id=p_class_id AND g.group_type='class' AND g.code='CLASS.' || c.code
    AND m.user_id=auth.uid()
    AND m.status='active' AND a.status='active'
 );
$function$;
create policy class_lesson_content_student_read on public.class_lesson_content for select to authenticated
  using (status = 'published' and exists (select 1 from public.class_sessions s where s.id = class_lesson_content.session_id
         and s.event_type = 'lesson' and tva_private.can_read_class_curriculum(s.class_id)));
create policy class_lesson_content_teacher_all on public.class_lesson_content for all to authenticated using (public.is_teacher());

-- Lớp + nhóm cohort (mã nhóm 'CLASS.<mã lớp>' như production)
insert into public.edu_groups (id, name, group_type, code) values
  ('f1000000-0000-4000-8000-000000000001', 'CLASS.SOLO01.TH01', 'class', 'CLASS.SOLO01.TH01'),
  ('f1000000-0000-4000-8000-000000000002', 'CLASS.SOLO01.TH02', 'class', 'CLASS.SOLO01.TH02');
insert into public.class_schedule (id, code, name, program_code, stage, status, start_date, cohort_group_id) values
  ('b1000000-0000-4000-8000-000000000001', 'SOLO01.TH01', 'Solo Guitar Căn Bản', 'SOLO01', 'phat_trien', 'scheduled', current_date - 14, 'f1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'SOLO01.TH02', 'Solo Guitar', 'SOLO01', null, 'scheduled', current_date - 7, 'f1000000-0000-4000-8000-000000000002');
insert into public.class_stages (id, class_id, stage_no, public_title, from_session, to_session) values
  (9101, 'b1000000-0000-4000-8000-000000000001', 1, 'TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR', 1, 8);
insert into public.edu_group_members (user_id, group_id, source, status) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'f1000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('cccccccc-0000-4000-8000-00000000000c', 'f1000000-0000-4000-8000-000000000002', 'admin', 'active');
insert into public.class_curriculum_access (class_id, user_id, status) values
  ('b1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'active'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-00000000000b', 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-00000000000c', 'active');

-- Buổi TH01: 1, 2, (nghỉ), 3, 4 (nháp) · TH02: 1, 2
insert into public.class_sessions (id, class_id, session_number, title, start_at, event_type, status, stage_id) values
  ('51000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 1, 'Buổi 1 · Bản đồ nốt C–Am', now() - interval '14 days', 'lesson', 'scheduled', 9101),
  ('51000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 2, 'Buổi 2 · Ép ngón & Bass', now() - interval '7 days', 'lesson', 'scheduled', 9101),
  ('51000000-0000-4000-8000-0000000000b1', 'b1000000-0000-4000-8000-000000000001', null, 'Nghỉ giữa chặng', now(), 'break', 'holiday', null),
  ('51000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 3, 'Buổi 3 · Slide', now() + interval '7 days', 'lesson', 'scheduled', 9101),
  ('51000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 4, 'Buổi 4 · Xếp ngón', now() + interval '14 days', 'lesson', 'scheduled', 9101),
  ('52000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 1, 'Buổi 1 · Bản đồ nốt C–Am', now(), 'lesson', 'scheduled', null),
  ('52000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 2, 'Buổi 2 · Ép ngón & Bass', now() + interval '7 days', 'lesson', 'scheduled', null);
insert into public.class_lesson_content (session_id, status, blocks) values
  ('51000000-0000-4000-8000-000000000001', 'published', '[{"kind":"objectives","items":["x"]},
     {"kind":"checkpoint","id":"1.1","title":"Âm giai C–Am","prompt":"Gửi video chơi âm giai","required":true,"accepts":["text","video_link"]},
     {"kind":"note","text":"giữa"},
     {"kind":"checkpoint","id":"1.2","title":"Tự chọn","required":false},
     {"kind":"checkpoint","id":"bad id!","title":"id sai bị bỏ qua"}]'),
  ('51000000-0000-4000-8000-000000000002', 'published', '[{"kind":"checkpoint","id":"2.1","title":"Ép ngón"},
     {"kind":"checkpoint","id":"2.2","title":"Bass","required":"yes"}]'),
  ('51000000-0000-4000-8000-000000000003', 'published', '[{"kind":"checkpoint","id":"3.1","title":"Slide","accepts":["video_link"]},
     {"kind":"checkpoint","id":"3.2","title":"Quiz sau này","required":false,"accepts":["quiz"]}]'),
  ('51000000-0000-4000-8000-000000000004', 'draft', '[{"kind":"note","text":"đang soạn"}]'),
  ('52000000-0000-4000-8000-000000000001', 'published', '[{"kind":"checkpoint","id":"1.1","title":"Âm giai C–Am"}]'),
  ('52000000-0000-4000-8000-000000000002', 'published', '[{"kind":"note","text":"buổi không có checkpoint"}]');
