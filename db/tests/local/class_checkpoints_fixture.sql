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
-- Dữ liệu (lớp, người, buổi, giáo trình): db/tests/local/class_checkpoints_fixture_data.sql
