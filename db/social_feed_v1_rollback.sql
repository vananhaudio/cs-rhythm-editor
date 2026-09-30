-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK CLASS SOCIAL — FEED V1 (db/social_feed_v1_setup.sql). Idempotent. KHÔNG mất dữ liệu (chỉ hàm đọc).
-- Gỡ social_feed_scoped + social_post_card. social_feed (tab "Dành cho bạn") KHÔNG bị đụng.
-- Rollback frontend TRƯỚC (Netlify / main cũ), rồi mới chạy file này.
-- ═══════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '5s';
drop function if exists public.social_feed_scoped(text, timestamptz, text, int);
drop function if exists public.social_post_card(uuid);
notify pgrst, 'reload schema';
commit;
