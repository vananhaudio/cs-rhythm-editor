-- Rollback share_note_session_open_v1: chỉ gỡ đúng một hàm chỉ-đọc. Không dữ liệu, không bảng. Idempotent. Không begin/commit.
-- FE cũ (không gọi hàm này) chạy bình thường; FE mới gặp hàm vắng sẽ KHÔNG vẽ nhạc (an toàn: lỗi = không hiện).
drop function if exists public.share_note_session_open(uuid);
notify pgrst, 'reload schema';
