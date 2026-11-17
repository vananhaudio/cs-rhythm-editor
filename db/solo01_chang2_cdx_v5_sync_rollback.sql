-- HOÀN TÁC đồng bộ bản nhạc chuẩn Chặng 2 (v5-2026-11-17): khôi phục blocks từ tva_private.class_lesson_content_bak_20261117.
update public.class_lesson_content c set blocks = b.blocks
  from tva_private.class_lesson_content_bak_20261117 b
 where c.session_id = b.session_id and b.session_id in ('028adc12-051f-4d23-a514-d85a4aa064a2','0c1d496c-c9b3-49b1-bca7-d4537b0eee2d','14dd9919-5da6-46f1-9772-298833677d8b','eb652678-11b4-4d5e-bac3-be242b551166','cc361627-321f-46b7-9d9c-92ebf7b0ac89','8237b352-ea28-435d-ab7a-016ca23b7aa7','43b28a5e-cf31-4a94-82f3-2bab17b3d3aa');
