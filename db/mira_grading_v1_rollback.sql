-- Rollback MIRA CẠNH MÀN CHẤM BÀI V1: gỡ 4 hàm + 2 bảng mới (không đụng bảng/hàm Class nào khác). Idempotent.
-- Hệ quả: vé đang sống mất hiệu lực; khung Mira ở Class báo "chưa sẵn sàng" và màn chấm bài vẫn dùng bình thường.
drop function if exists public.mira_grading_context(text, text);
drop function if exists public.mira_grading_end(uuid);
drop function if exists public.mira_grading_ticket(uuid);
drop table if exists public.mira_grading_tickets;
drop table if exists public.mira_grading_keys;
notify pgrst, 'reload schema';
