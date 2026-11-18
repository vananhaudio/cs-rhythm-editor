-- HOÀN TÁC khối tải PDF Buổi 9: khôi phục blocks từ tva_private.class_lesson_content_bak_20261118_pdf.
update public.class_lesson_content c set blocks = b.blocks
  from tva_private.class_lesson_content_bak_20261118_pdf b where c.session_id = b.session_id;
