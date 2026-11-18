-- Hoàn tác SOLO01 Chặng 1 Buổi 8 (trả về trạng thái chưa có nội dung). Chỉ xoá khi nội dung còn là bản đã xuất bản (8.1/8.2/8.3).
do $rb$
begin
  delete from public.class_checkpoint_keys where session_id = '949f1d47-1a70-423d-8f7b-7fdf86c233fd' and checkpoint_id in ('8.1','8.2');
  delete from public.class_lesson_content where session_id = '949f1d47-1a70-423d-8f7b-7fdf86c233fd' and blocks @> '[{"id":"8.3"}]'::jsonb;
end $rb$;
