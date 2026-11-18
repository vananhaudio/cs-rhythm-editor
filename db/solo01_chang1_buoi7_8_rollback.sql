-- Hoàn tác SOLO01 Chặng 1 Buổi 7 + 8 (Buổi 7 về trạng thái chưa có nội dung; Buổi 8 về bản đề tốt nghiệp một bài đã sao lưu).
do $rb$
begin
  delete from public.class_checkpoint_keys where session_id = '97d1f3ec-d96d-4ce3-bc78-e7ad970fe50f' and checkpoint_id in ('7.1','7.2');
  delete from public.class_lesson_content where session_id = '97d1f3ec-d96d-4ce3-bc78-e7ad970fe50f' and blocks @> '[{"id":"7.3"}]'::jsonb;
  update public.class_lesson_content c set blocks = b.blocks, updated_at = now()
    from tva_private.class_lesson_content_bak_20261118_b78 b where c.session_id = b.session_id and c.session_id = '949f1d47-1a70-423d-8f7b-7fdf86c233fd';
end $rb$;
