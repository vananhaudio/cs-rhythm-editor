# Band Chat V1 — nhóm chat theo Band trong Trò chuyện (/me/chat)

Mỗi **Band** (`teamlab_bands`, không phải Team = `projects`) có đúng một nhóm chat. Hiện cùng danh sách hội thoại cá nhân, có nhãn "Band".

## Nguồn dữ liệu & quyền
- Thành viên = hàng hiện hành trong `teamlab_band_members (band_id, user_id)` — kiểm ở backend, MỘT chỗ: `bandchat_is_member()`.
  Rời/bị gỡ → mất quyền đọc/gửi ngay; vào mới → đọc được toàn bộ lịch sử (tin trước lúc vào không tính chưa đọc).
- Không có đường tắt cho Thầy/Admin: muốn đọc nhóm phải là thành viên Band (quyết định quyền đọc-toàn-bộ là việc riêng của Owner).
- Tên + ảnh lấy lúc đọc từ `teamlab_bands.name` / `cover_path` (dự phòng `projects.avatar_path`) — không có bản sao.
- Không thành viên và không tồn tại → cùng lỗi `P0002` (không lộ sự tồn tại).

## DB (additive, `db/band_chat_v1_*.sql`)
- Bảng `bandchat_rooms` (PK = band_id → mỗi Band đúng một phòng, tạo lười, idempotent), `bandchat_messages`, `bandchat_reads`. RLS bật, 0 grant, 0 policy.
- `band_id` KHÔNG có khoá ngoại: xoá Band/Team không xoá lịch sử chat (chưa có chính sách lưu trữ — chờ Owner).
- RPC (SECURITY DEFINER): `bandchat_rooms`, `bandchat_messages`, `bandchat_send`, `bandchat_mark_read`, `bandchat_unread_count`, `bandchat_members`.
- Không đụng `dm_*`, `teamlab_*`. Rollback: `db/band_chat_v1_rollback.sql` (xoá toàn bộ tin nhóm).
- Quy trình: preflight → dryrun → migrate → postflight (`scripts/prod-db.py`), DB TRƯỚC frontend. Frontend tự ẩn nhóm Band khi RPC chưa có.

## Frontend
- Id hội thoại nhóm = `band:<band id>`; route `/me/chat/b/<band id>`. `chatApi` định tuyến `band:` → `bandchat_*`, còn lại → `dm_*`.
- Dùng lại `useConversation` (polling 4 s), `MessageList`, `Composer`, badge; thêm tên + ảnh người gửi, dòng "Nhóm Band · n thành viên", danh sách thành viên.

## Kiểm thử
- `bash scripts/test-band-chat-v1-db.sh` — DB (quyền, cô lập, rời/vào Band, đồng thời, rollback, hồi quy `dm_v1_test`).
- `npm run test:class-social` — model/route/API/render.
- `PUPPETEER_DIR=… bash scripts/e2e-band-chat-v1.sh` — Chrome thật trên stack local (2 tài khoản + mobile 320…1440).
