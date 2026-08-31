-- START-HERE RESOLVER — vòng 10: Email 2 trả lời "Hôm nay tôi nên làm gì?"
-- Deterministic, không AI: ưu tiên structured (entitlement + course → first published lesson).
-- Canonical: edu_courses → edu_modules(order_index) → edu_course_lessons(order_index, is_published).
-- Route xem bài thật: /course?id={courseId}&lesson={lessonId}

-- mail_log: lưu resolved action để audit tại sao learner nhận CTA này
alter table public.mail_log add column if not exists resolved_start_kind  text;
alter table public.mail_log add column if not exists resolved_start_title text;
alter table public.mail_log add column if not exists resolved_start_url   text;

-- Course theo code (DH1/TN1/SOLO...) — entitlement thật bắt buộc
create or replace function public.course_by_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.edu_courses where code = p_code limit 1;
$$;

-- Bài đầu tiên published của course (module đầu → lesson đầu)
create or replace function public.first_lesson(p_course uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'lesson_id', l.id,
    'title', l.title
  )
  from public.edu_course_lessons l
  join public.edu_modules m on m.id = l.module_id
  where m.course_id = p_course and l.is_published = true
  order by m.order_index, l.order_index
  limit 1;
$$;

-- Learner có access thật với course không
create or replace function public.has_course_access(p_student uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.edu_course_access a
    where a.student_id = p_student and a.course_id = p_course and a.active = true
  );
$$;

-- RESOLVE START ACTION — output: jsonb array actions [{kind,title,url,source}]
-- mode: class / practice / both (từ note [reg-mode]); practice path: [practice-path]
create or replace function public.resolve_student_start_action(p_lead bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_note text;
  v_mode text;
  v_path text;
  v_class_name text;
  v_actions jsonb := '[]'::jsonb;
  v_course uuid;
  v_lesson jsonb;
  v_site text;
  v_kind text;
  v_title text;
  v_url text;
begin
  select student_id, note, class_name into v_student, v_note, v_class_name
    from public.leads where id = p_lead;
  if v_student is null then
    return '[]'::jsonb;
  end if;
  v_mode := coalesce((regexp_match(coalesce(v_note, ''), '\[reg-mode:([a-z]+)\]'))[1], 'class');
  v_path := coalesce((regexp_match(coalesce(v_note, ''), '\[practice-path:([a-z_]+)\]'))[1], '');
  select value into v_site from public.app_config where key = 'class_site_url';
  v_site := coalesce(v_site, 'https://class.vananhaudio.com');

  -- CLASS action (mode class/both)
  if v_mode in ('class', 'both') then
    -- course thật từ lớp đăng ký (class_schedule.main_course_id)
    select cs.main_course_id into v_course
      from public.class_schedule cs
      where cs.code = (regexp_match(coalesce(v_class_name, ''), '·\s*([A-Z0-9.]+)\s*$'))[1]
      limit 1;
    if v_course is not null and public.has_course_access(v_student, v_course) then
      v_lesson := public.first_lesson(v_course);
      if v_lesson is not null then
        v_actions := v_actions || jsonb_build_object(
          'kind', 'class_prep',
          'title', 'Xem bài nên học trước',
          'url', v_site || '/course?id=' || v_course || '&lesson=' || (v_lesson->>'lesson_id'),
          'source', 'class_first_lesson');
      else
        -- Chưa có lesson published canonical → course home THẬT (route /course?id= ổn định, có entitlement)
        v_actions := v_actions || jsonb_build_object(
          'kind', 'class_prep',
          'title', 'Mở hệ thống học tập',
          'url', v_site || '/course?id=' || v_course,
          'source', 'class_course_home');
      end if;
    else
      v_actions := v_actions || jsonb_build_object(
        'kind', 'class_prep',
        'title', 'Mở hệ thống học tập',
        'url', v_site || '/me',
        'source', 'class_no_access_or_course');
    end if;
  end if;

  -- PRACTICE action (mode practice/both) — dùng preferred path thật + entitlement
  if v_mode in ('practice', 'both') then
    v_course := null;
    if v_path = 'dem_hat' then v_course := public.course_by_code('DH1'); v_title := 'Bắt đầu học Đệm hát';
    elsif v_path = 'tia_not' then v_course := public.course_by_code('TN1'); v_title := 'Bắt đầu học Tỉa nốt';
    elsif v_path = 'solo' then v_course := public.course_by_code('SOLO'); v_title := 'Bắt đầu học Solo';
    end if;
    if v_course is not null and public.has_course_access(v_student, v_course) then
      v_lesson := public.first_lesson(v_course);
      if v_lesson is not null then
        v_actions := v_actions || jsonb_build_object(
          'kind', 'practice_path',
          'title', v_title,
          'url', v_site || '/course?id=' || v_course || '&lesson=' || (v_lesson->>'lesson_id'),
          'source', 'preferred_path_first_lesson');
      else
        -- Course có entitlement, chưa có lesson published canonical → course home THẬT
        v_actions := v_actions || jsonb_build_object(
          'kind', 'practice_path',
          'title', v_title,
          'url', v_site || '/course?id=' || v_course,
          'source', 'preferred_path_course_home');
      end if;
    else
      -- Solo chưa có entitlement / unsure → fallback learning home (không link locked)
      v_actions := v_actions || jsonb_build_object(
        'kind', 'learning_home',
        'title', 'Mở hệ thống học tập',
        'url', v_site || '/me',
        'source', 'preferred_path_no_access_or_unsure');
    end if;
  end if;

  -- Mode practice thuần (không class) mà không có action → fallback home
  if v_mode = 'practice' and jsonb_array_length(v_actions) = 0 then
    v_actions := v_actions || jsonb_build_object(
      'kind', 'learning_home',
      'title', 'Mở hệ thống học tập',
      'url', v_site || '/me',
      'source', 'practice_fallback');
  end if;
  -- Mode class thuần không có action → fallback home
  if v_mode = 'class' and jsonb_array_length(v_actions) = 0 then
    v_actions := v_actions || jsonb_build_object(
      'kind', 'learning_home',
      'title', 'Mở hệ thống học tập',
      'url', v_site || '/me',
      'source', 'class_fallback');
  end if;

  return v_actions;
end;
$$;

grant execute on function public.resolve_student_start_action(bigint) to service_role;
