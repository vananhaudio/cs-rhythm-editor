-- Thêm trạng thái cho bài Strum Score học sinh soạn: 'draft' (đang soạn) | 'done'
-- (đã vạch nhịp xong — hiện ở "Bài hát của tôi", sẵn sàng tập / làm nguyên liệu
-- cho bước gán kiểu quạt kế tiếp). Idempotent — chạy lại vô hại.
alter table public.student_strum_drafts
  add column if not exists status text not null default 'draft';

alter table public.student_strum_drafts
  drop constraint if exists student_strum_drafts_status_check;
alter table public.student_strum_drafts
  add constraint student_strum_drafts_status_check check (status in ('draft', 'done'));

notify pgrst, 'reload schema';
