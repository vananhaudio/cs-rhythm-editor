-- PROGRESS_READ_GATE_V1 (phần policy). Cần progress_read_gate_v1_setup.sql. Chạy RIÊNG, ngắn (thao tác policy khoá auth.*).
set local lock_timeout = '3s';
alter policy class_lesson_content_student_read on public.class_lesson_content using (
  status = 'published' and exists (select 1 from public.class_sessions s
    where s.id = class_lesson_content.session_id and s.event_type = 'lesson'
      and tva_private.can_read_class_curriculum(s.class_id) and tva_private.lesson_session_readable(s.id)));
