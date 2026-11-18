update public.class_lesson_content c set blocks = b.blocks, updated_at = now()
  from tva_private.class_lesson_content_bak_20261118_b7k b where c.session_id = b.session_id and c.session_id = '97d1f3ec-d96d-4ce3-bc78-e7ad970fe50f';
