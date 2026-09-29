-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK LEARNING THREAD P2 (db/learning_threads_p2_setup.sql). Idempotent. KHÔNG mất dữ liệu:
-- P2 chỉ thêm RPC đọc + một index; thread/event/cấu hình của P1 giữ nguyên.
-- Gỡ DB trước thì frontend P2 báo lỗi tải Feed/Tường → rollback frontend (Netlify) TRƯỚC, rồi mới chạy file này.
-- ═══════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '5s';
drop function if exists public.social_feed(timestamptz, text, int);
drop function if exists public.user_wall(uuid, timestamptz, text, int);
drop function if exists public.learning_journey(uuid);
drop function if exists public.lt_thread_card(uuid);
drop index if exists public.learning_threads_feed_idx;
notify pgrst, 'reload schema';
commit;
