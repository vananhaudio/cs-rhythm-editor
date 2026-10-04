-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK V1.2 — gỡ 3 hàm vạch nhịp thủ công, trả về đúng V1.1. Phiên bản đã tạo khi V1.2 chạy (có anchors)
-- vẫn hợp lệ với V1.1 (cột anchors có sẵn từ V1). CHẠY trong MỘT transaction. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
drop function if exists public.chord_sheet_accept_anchors(uuid, jsonb, jsonb);
drop function if exists public.chord_anchors_problem(jsonb, integer[]);
drop function if exists public.chord_lyric_token_counts(text);
notify pgrst, 'reload schema';
