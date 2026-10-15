# Band Chat V1 — nhóm chat theo Band trong Trò chuyện (/me/chat)

Mỗi **Band** (`teamlab_bands`, không phải Team = `projects`) có đúng một nhóm chat. Hiện cùng danh sách hội thoại cá nhân, có nhãn "Band".

## Nghiệp vụ đã chốt (Owner, 15/10) và cách thực hiện
1. **Thành viên hiện hành** đọc toàn bộ lịch sử + gửi tin. Rời Band → mất quyền đọc/gửi, tin đã gửi giữ nguyên. Người mới vào: đọc lịch sử, tin trước lúc vào không tính chưa đọc.
2. **Lưu trữ Band** → nhóm chỉ đọc cho những người là thành viên LÚC lưu trữ (ảnh chụp `bandchat_frozen`); người vào/rời sau đó không đổi quyền. **Khôi phục** → quyền theo thành viên hiện hành, ảnh chụp bị xoá.
   - Production CHƯA có chức năng lưu trữ Band (`teamlab_bands` không có cột trạng thái; chỉ bài hát có `archived_at`). Trạng thái lưu trữ nằm ở phía chat: RPC `bandchat_set_archived(band, bool)` (chỉ Thầy/Admin) là móc nối để TeamLab gọi khi thêm tính năng lưu trữ Band.
3. **Không xoá vĩnh viễn chat:** `band_id` không có khoá ngoại → xoá Band/Team (kể cả cascade `projects → teamlab_bands`) KHÔNG xoá tin. Thành viên cũ không đọc được; Thầy/Admin vẫn đọc (tên Band lưu ở `name_snapshot`).
4. **Thầy/Admin xem nhóm Band để hỗ trợ/quản lý:** nguồn quyền chuẩn `public.is_teacher()` (`app_users.role` ∈ teacher|admin), kiểm ở backend. Chỉ ĐỌC: không gửi thay, không giả danh, xem không tạo/đổi trạng thái đọc của ai. Hiển thị ở mục "Hỗ trợ" trong danh sách + ghi chú trong thông tin nhóm (danh sách thành viên) để thành viên biết.

## Nguồn dữ liệu & quyền
- Quyền = MỘT hàm nội bộ `bandchat_access(band)` → `send | read | null`, tính ở thời điểm gọi, từ `teamlab_band_members` (+ `bandchat_frozen` khi lưu trữ, + `is_teacher()`).
- Tên + ảnh lấy lúc đọc từ `teamlab_bands.name` / `cover_path` (dự phòng `projects.avatar_path`) — không có bản sao.
- Không có quyền và không tồn tại → cùng lỗi `P0002`; có quyền đọc nhưng gửi → `42501` "chỉ đọc".

## DB (additive, `db/band_chat_v1_*.sql`)
- 4 bảng mới: `bandchat_rooms` (PK = band_id → mỗi Band đúng một phòng; `archived_at`, `name_snapshot`), `bandchat_messages`, `bandchat_reads`, `bandchat_frozen`. RLS bật, 0 grant, 0 policy.
- 7 RPC client + 2 hàm nội bộ (`bandchat_access`, `bandchat_append`): `bandchat_rooms/messages/send/mark_read/unread_count/members/set_archived`.
- KHÔNG sửa/xoá bảng, hàm, policy hay dữ liệu hiện có; không đụng `dm_*`, `teamlab_*`.
- Quy trình: preflight → dryrun → migrate → postflight (`scripts/prod-db.py`), DB TRƯỚC frontend. Frontend tự ẩn nhóm Band khi RPC chưa có.
- **Rollback:** (a) mềm — revert frontend: nhóm biến mất khỏi UI, bảng + tin giữ nguyên, không mất dữ liệu; (b) cứng — `db/band_chat_v1_rollback.sql` XOÁ 4 bảng + tin phát sinh sau migration. Trước (b) phải xuất 4 bảng (`prod-db.py query --sql "select * from public.bandchat_messages"` …). Chat 1-1 không bị ảnh hưởng ở cả hai.

## Frontend
- Id hội thoại nhóm = `band:<band id>`; route `/me/chat/b/<band id>`. `chatApi` định tuyến `band:` → `bandchat_*`, còn lại → `dm_*`.
- Dùng lại `useConversation` (polling 4 s), `MessageList`, `Composer`, badge; thêm tên + ảnh người gửi, dòng "Nhóm Band · n thành viên", danh sách thành viên.

## Kiểm thử
- `bash scripts/test-band-chat-v1-db.sh` — DB (quyền, cô lập, rời/vào Band, đồng thời, rollback, hồi quy `dm_v1_test`).
- `npm run test:class-social` — model/route/API/render.
- `PUPPETEER_DIR=… bash scripts/e2e-band-chat-v1.sh` — Chrome thật trên stack local (2 tài khoản + mobile 320…1440).
