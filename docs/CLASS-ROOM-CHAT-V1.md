# Class Room Chat V1 — phòng chat theo lớp trong Trò chuyện (/me/chat)

Mỗi **lớp** (`class_schedule`) có đúng một phòng chat, dùng CHUNG khung Chat với Band Chat (không có hệ chat thứ hai). Mô hình = Band Chat V1; "thành viên Band" được thay bằng **thành viên lớp canonical** `tva_private.class_memberships` (docs/CLASS-MEMBERSHIP-CANONICAL.md). Không heuristic nào khác.

## Nghiệp vụ (Owner chốt)
1. Học viên cùng lớp thấy nhau và trò chuyện chung.
2. Thầy phụ trách lớp (Thầy/Admin có trong nhóm lớp) gửi + nhận như thành viên. **Thầy đồng hành** (`bandchat_is_companion()`, Band V1.3) gửi được ở mọi lớp còn tồn tại, chưa draft/huỷ/gộp. Thầy/Admin khác ngoài lớp: chỉ đọc ("Hỗ trợ").
3. Học viên mới vào lớp đọc được lịch sử; tin trước `joined_at` không tính chưa đọc.
4. Lớp `draft`/`cancelled`/`merged` → thành viên hiện hành chỉ đọc, giữ lịch sử. Lớp mới sau khi gộp có `class_id` khác ⇒ phòng riêng; KHÔNG chuyển/nhân đôi tin.
5. Rời lớp / bị gỡ khỏi nhóm lớp → mất đọc + gửi; tin đã gửi giữ nguyên.

## Đã có sẵn (tái dùng nguyên)
`ConversationView` · `MessageList` · `Composer` · `useConversation` (polling) · badge/âm thanh · Hộp thư V2 (lọc "Lớp học", tìm, ghim, đếm — chỗ `kind='class'` đã dành sẵn) · mẫu RPC `SECURITY DEFINER` + seq + đã đọc · lớp an toàn UGC (`*_safe`).

## DB (additive; `db/class_room_chat_v1_*.sql`)
| File | Nội dung |
|---|---|
| `setup` | 3 bảng `classchat_rooms/messages/reads` (RLS bật, 0 grant, 0 policy) + `classchat_access` (MỘT chỗ quyết quyền) + RPC `classchat_rooms/messages/send/mark_read/unread_count/members` |
| `safety_setup` | trigger `classchat_guard_write` (đình chỉ UGC03, từ cấm UGC01) + `classchat_messages_safe` (lọc người chặn hai chiều) |
| `inbox_setup` | thay `chat_inbox_base` + `chat_inbox_summary` thêm khối `class` (cổng md5 + bản sao lưu `tva_private.classchat_v1_backup`) |
| `rollback` | gỡ tất cả; khôi phục NGUYÊN VĂN 2 hàm Hộp thư từ bản sao lưu |

Thứ tự: setup → safety → inbox (DB TRƯỚC frontend, qua `scripts/prod-db.py`). KHÔNG sửa `bandchat_*`, `dm_*`, `class_schedule`, `class_report_submit`, `class_ugc_guard_write`.

Id hội thoại `class:<class id>`, route `/me/chat/c/<class id>`. `class_id` không có FK: xoá lớp không xoá lịch sử.

## Quy tắc quyền (`classchat_access`)
thành viên lớp hiện hành → `send` (lớp draft/cancelled/merged → `read`) · Thầy/Admin ngoài lớp → `read` (Thầy đồng hành → `send` nếu lớp sống) · còn lại / lớp không tồn tại → cùng lỗi `P0002` (không lộ sự tồn tại). Chỉ đọc mà gửi → `42501`.

## Giới hạn đã biết của V1
- **Báo cáo riêng từng tin** trong phòng lớp CHƯA có: `class_reports.kind`/`class_report_submit` là hạ tầng dùng chung, mở rộng cần Owner duyệt. V1: báo cáo/chặn **người gửi** (`profile` + `class_block_user`). Chặn người vẫn ẩn tin của họ ở người chặn (hai chiều).
- Lớp huỷ/gộp mà nhóm lớp bị gỡ hết thành viên → học viên mất quyền đọc (Thầy/Admin vẫn đọc). V1 không chụp ảnh thành viên như `bandchat_frozen`.
- ~~Thầy/Admin chỉ thấy ở "Hỗ trợ" các lớp đã có tin~~ — **sửa ở V1.1** (`db/class_room_chat_v1_1_support_list_setup.sql`, rollback kèm theo): Thầy/Admin thấy mọi lớp chưa draft/huỷ (kể cả chưa có tin), như Band V1.2. Lớp nháp/huỷ chỉ hiện khi đã có tin. Quyền (`classchat_access`) không đổi. Lỗi V1: Owner (admin, không thuộc lớp nào) thấy tab "Lớp học" trống.
- Thông báo = badge + âm thanh qua polling như DM/Band (không push thật).

## Kiểm thử
- `bash scripts/test-class-room-chat-db.sh` — DB: quyền, cách ly lớp, người mới/rời lớp, huỷ/gộp, Thầy phụ trách/đồng hành/ngoài lớp, an toàn UGC, Hộp thư V2, đồng thời, khoá, rollback ×2 + cài lại, cổng drift, hồi quy `dm_v1_test`.
- `npm run test:class-social` — model/route/API/render (gồm `class-room-chat-v1.test.tsx`).
- `PUPPETEER_DIR=… bash scripts/e2e-class-room-chat.sh` — Chrome thật, 5 tài khoản, mobile 320…1440.
- Hồi quy Band/Chat List: `scripts/test-band-chat-v1-db.sh`, `scripts/test-chat-list-v2-db.sh`, `scripts/e2e-band-chat-v1.sh`.

## Rollback
(a) mềm: revert frontend → phòng lớp biến khỏi UI, bảng + tin giữ nguyên; (b) cứng: `db/class_room_chat_v1_rollback.sql` XOÁ 3 bảng + tin lớp (xuất trước bằng `prod-db.py query`). Band Chat/DM không bị ảnh hưởng ở cả hai.
