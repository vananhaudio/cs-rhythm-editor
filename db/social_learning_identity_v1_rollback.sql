-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK LEARNING IDENTITY V1 (db/social_learning_identity_v1_setup.sql). Idempotent. KHÔNG mất dữ liệu (chỉ hàm đọc).
-- Frontend cũ/mới đều chạy được khi thiếu hàm (không hiện nhãn), nhưng nên rollback frontend TRƯỚC.
-- ═══════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '5s';
drop function if exists public.social_learning_identities(uuid[]);
notify pgrst, 'reload schema';
commit;
