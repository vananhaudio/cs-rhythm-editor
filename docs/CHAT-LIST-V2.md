# Chat List V2 — danh sách Trò chuyện (Giai đoạn 1A)

Trạng thái: **nhánh `feat/chat-list-v2` (từ origin/main 23d71df8), chưa migrate production, chưa deploy, chưa merge.** Chờ Owner nghiệm thu Preview.
Không gồm nhóm lớp học (Giai đoạn sau). Không sửa Band Chat, DM, TeamLab, Feed, Mira.

## Làm gì
- Tìm kiếm (phía server, bỏ dấu, tìm cả hội thoại chưa tải) · phân loại Tất cả / Cá nhân / Lớp học / Band · chip Chưa đọc.
- Ghim do người dùng chọn (tối đa 10, lưu ở DB theo tài khoản → web và app đồng bộ). Không tự ghim Band/lớp.
- Phân trang con trỏ (30/trang, cuộn tải thêm) — hết trần 50/100 cắt âm thầm; cuối danh sách có dòng "Đã hiển thị tất cả N".
- Nhãn loại (Band/Lớp học), avatar nhóm bo vuông + biểu tượng, trạng thái trống riêng cho từng bộ lọc.
- Thầy/Admin: hàng "Quản lý Band" → màn riêng (tìm kiếm + phân trang) cho các Band không thuộc, chỉ xem; danh sách chính không tràn.
- Nhắn tin, lịch sử, thông báo, quyền, route (`/me/chat`, `/me/chat/<id>`, `/me/chat/b/<band>`, `/me/chat/u/<user>`) giữ nguyên.

## DB (additive — `db/chat_list_v2_{setup,rollback,preflight,postflight}.sql`)
- Bảng `chat_pins` (RLS bật, 0 grant, 0 policy). Hàm: `chat_fold`, `chat_inbox_base` (nội bộ, MỘT nguồn ứng viên cùng luật quyền với `dm_conversations`/`bandchat_rooms`),
  `chat_inbox` (con trỏ + tìm + lọc + ghim), `chat_inbox_summary`, `chat_conversation_info`, `chat_pin_set`.
- KHÔNG sửa `dm_*`, `bandchat_*`, `teamlab_*`. Quy trình: preflight → dryrun → migrate (prod-db.py) → postflight; DB TRƯỚC frontend.
- **Rollback:** frontend tự rơi về chế độ cũ (100 gần nhất, lọc tại máy, không ghim) khi RPC chưa có/đã gỡ → revert frontend không cần DB;
  gỡ DB = `db/chat_list_v2_rollback.sql` (mất duy nhất danh sách ghim; xuất trước `select * from public.chat_pins`).
- Rò rỉ: tìm kiếm/lọc/ghim/đếm/thông tin một hội thoại đều chạy trên `chat_inbox_base` nên không thể trả hội thoại người gọi không có quyền thấy.

## Frontend
`chat/inboxModel.ts` (thuần) · `chat/inboxApi.ts` (RPC + chế độ legacy) · `chat/useInbox.ts` (hook) · `chat/InboxList.tsx` (giao diện) · `sections/Chat.tsx` (nối).
`ConversationList.tsx` cũ giữ lại (test cũ còn dùng), không còn được Chat dùng.
Ghim trên cảm ứng: nút "Ghim" ở đầu danh sách (chế độ sửa) hoặc nhấn giữ một hàng; desktop: nút ⋯ khi rê chuột / chuột phải.

## Kiểm thử
- `bash scripts/test-chat-list-v2-db.sh` — DB cục bộ (PostgreSQL 17 tạm): quyền, rò rỉ, lọc, con trỏ, ghim, Thầy/Admin, tương thích RPC cũ, 1800 hội thoại, rollback, hồi quy `dm_v1_test`.
- `npm run test:class-social` — model thuần + toàn bộ test Trò chuyện cũ.
- `node tests/chat-list-v2/e2e-preview.mjs` — Chrome thật trên Preview (0/1/50/120+, tìm, lọc, ghim, nhấn giữ, Thầy, legacy, lỗi, nhắn tin, desktop).

## Preview (chỉ dev, không có trong bản build)
`npx vite --port 5199` rồi mở `http://localhost:5199/chat-preview.html?view=mobile&dm=120&bands=24`.
Tham số: `view=mobile|desktop` · `dm=<n>` · `bands=<n>` · `teacher=1&support=<n>` · `pins=<n>` · `legacy=1` (server chưa nâng cấp) · `fail=1` · `lat=<ms>` · `sel=<id>`.
Giao diện + `chatApi`/`inboxApi` chạy nguyên bản; chỉ lớp `fetch` tới `/rest/v1/rpc/*` được thay bằng máy chủ giả (`src/chat-preview/mockServer.ts`).

## Chưa kiểm chứng / giới hạn
- Chưa chạy trên production, iPhone/Android thật, WebKit thật (Preview dùng Chrome giả lập 390px).
- Hiệu năng đo trên 1800 hội thoại ở DB tạm; chưa đo với dữ liệu production.
- Tìm kiếm theo TÊN hội thoại (không tìm trong nội dung tin).
- Ghim chỉ cho hội thoại ở danh sách chính (không ghim Band ở chế độ hỗ trợ).
- App iOS/Android đóng gói web → thay đổi giao diện tới app khi có bản build mới; DB tới ngay.
