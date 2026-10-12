# Class System Chat V1 — "Class 2.0" trong Trò chuyện (12/10/2026)

Trạng thái: **mã client + SQL + test xong trên nhánh `feat/class-system-chat-v1`. CHƯA migration production, CHƯA merge, CHƯA deploy. Chờ Owner duyệt migration.**

## Nguyên tắc bất biến (Owner)
Chat là **cổng giao tiếp và điều hướng**, không phải hệ thống nghiệp vụ:
`SỰ KIỆN NGHIỆP VỤ → THÔNG BÁO NGẮN → LIÊN KẾT ĐẾN ĐÚNG VỊ TRÍ → HỆ THỐNG GỐC XỬ LÝ`.
Chat KHÔNG chứa nhận xét, nội dung bài trả, kết quả chi tiết; không chấm bài; không thay giao diện nghiệp vụ.

## Quyết định sản phẩm (Owner, 12/10)
1. Sự kiện V1 duy nhất: **Thầy hoàn tất chấm bài trả** (`teacher_feedback` có verdict Đạt/Cần làm lại). Universal Share giữ nguyên (đã vào Chat, không phát thông báo trùng).
2. Nội dung: ngắn + liên kết — "Bài trả Buổi 02 của bạn đã được chấm." + "Xem kết quả →". Không nêu kết quả, không sao chép nhận xét.

## Audit (tóm tắt)
- Chat V1a: hội thoại 1-1 giữa hai `auth.users` thật → **không thêm được hội thoại hệ thống mà không có cấu trúc dữ liệu mới** (và không được tạo user giả).
- Universal Share: `dm_share` đã ghi tin vào hội thoại người nhận → badge chưa đọc đã đúng. Không động tới.
- Điểm xác nhận "đã chấm": `lt_respond` ghi `learning_thread_events` (+ cập nhật trạng thái) trong MỘT transaction.

## Kiến trúc (Phương án B — tách dữ liệu thông báo khỏi tin nhắn cá nhân, gộp trên UI)
```
Thầy lưu chấm bài → lt_respond (KHÔNG sửa)
  └ INSERT learning_thread_events (teacher_feedback + verdict)
      └ TRIGGER class_system_notice_on_event (cùng transaction; lưu thất bại → rollback → không thông báo)
          └ INSERT class_system_notices(user = học viên của thread, dedupe_key = 'grade:<thread>:<lượt nộp>')
Học viên: Trò chuyện
  ├ dm_conversations()               → hội thoại cá nhân (như cũ)
  └ class_system_notice_summary()    → hàng "Class 2.0" (mới nhất + chưa đọc); RPC chưa có → ẩn hàng (FE deploy trước DB không hỏng)
Mở Class 2.0 → class_system_notices() + class_system_notice_mark_read(seq)  (chỉ khi MỞ màn này)
"Xem kết quả →" → /me/t/<thread>?focus=ket-qua (trang Learning Thread hiện có; quyền do lt_detail quyết; cuộn tới phản hồi mới nhất của Thầy)
Badge Trò chuyện = dm_unread_count() + summary.unread
```

## Hồ sơ migration (`db/class_system_chat_v1_setup.sql`, rollback `…_rollback.sql`)
| # | Mục | Nội dung |
|---|---|---|
| 1 | Bảng mới | `class_system_notices(seq, user_id, kind, body, ref_type='thread', ref_key, dedupe_key, created_at)`; `class_system_notice_reads(user_id, last_read_seq)` |
| 2 | Index | `(user_id, seq desc)`; unique `(user_id, dedupe_key)` |
| 3 | Cột bổ sung ở bảng cũ | **Không** |
| 4 | Sửa bảng/RPC Chat hiện có | **Không** (`dm_*` giữ nguyên) |
| 5 | Sửa chấm bài | **Không** sửa `lt_respond`; chỉ thêm 1 trigger AFTER INSERT trên `learning_thread_events` |
| 6 | RLS | Bật, thu hồi mọi grant, **không có policy**; thêm 2 bảng vào `self_managed` của `db/rls_setup.sql` |
| 7 | Chống giả mạo | Chỉ trigger SECURITY DEFINER ghi; client không có quyền bảng; hàm trigger revoke khỏi mọi role; recipient = `learning_threads.learner_user_id` do server tra |
| 8 | Chống trùng | unique `(user_id, dedupe_key)`; key theo (thread, lượt nộp gần nhất của học viên) → chấm lại/sửa trong cùng lần nộp = không thông báo thêm |
| 9 | Đã đọc | `last_read_seq` theo người dùng; `mark_read` chỉ tăng, bị chặn ở thông báo mới nhất; tách hẳn `dm_participants` |
| 10 | Dữ liệu cũ | Không backfill, không gửi lại bài đã chấm trước migration |
| 11 | Kiểm thử cô lập | `scripts/test-class-system-chat-db.sh` (PG17 tạm): migration ×2, rls_setup rerun, ~35 kiểm tra quyền/nội dung/chống trùng/đã đọc, rollback ×2 + cài lại |
| 12 | Rollback | FE revert → chạy rollback SQL (bỏ trigger → hàm → 2 bảng). **Mất dữ liệu thông báo + trạng thái đọc đã tạo** (nguồn gốc `learning_thread_events` còn nguyên; thông báo có thể suy lại bằng script nhưng sẽ hiện lại như chưa đọc). Không đụng `dm_*`, `lt_*`, dữ liệu thread |

## Thứ tự phát hành khi được duyệt
preflight → dryrun → migrate (`prod-db.py`) → postflight; FE có thể lên trước hoặc sau (FE tự ẩn mục khi RPC chưa có); Owner nghiệm thu bằng tài khoản thật (1 bài trả thật → Thầy chấm → học viên nhận) → merge + deploy.

## Hạn chế / hành vi bảo thủ cần Owner biết
- Chấm lại hoặc đổi Cần làm lại → Đạt **trong cùng lần nộp**: KHÔNG thông báo thêm (học viên mở link vẫn thấy kết quả mới nhất). Nếu Owner muốn thông báo cả khi đổi kết quả, đổi `dedupe_key` (1 dòng).
- Thông báo cho Hỏi bài / nhận xét không chấm / Share / sự kiện khác: **chưa có** (đúng quyết định V1).
- Làm mới theo polling (30 s ở badge) như Chat V1a, chưa realtime/push.
- Nút "Xem kết quả" luôn mở trang cuộc trao đổi của bài trả; buổi/lớp hiển thị tại đó (header Learning Thread có nút "Mở giáo trình Buổi …").
- **Rủi ro có sẵn, ngoài phạm vi:** `db/rls_setup.sql` không liệt kê `dm_*` trong `self_managed` → chạy lại file này trên production sẽ tạo policy rộng lên `dm_conversations/dm_participants/dm_messages` (đã tái hiện trên DB tạm: 0 → 3 policy). Không chạy lại `rls_setup.sql` trên production trước khi xử lý.

## Phạm vi mã client
`chat/chatModel.ts` · `chat/chatApi.ts` (3 RPC, chỉ đọc + mark_read) · `chat/chatLive.ts` · `chat/useChat.ts` (badge cộng + hook màn Class 2.0) · `chat/ConversationList.tsx` (hàng hệ thống) · `chat/SystemNoticeView.tsx` (mới, chỉ đọc) · `sections/Chat.tsx` · `resolveMeRoute.ts` (`/me/chat/system`) · `ClassSocialPage.tsx` · `classSocial.css` · `learning-thread/ThreadView.tsx` (+css: cuộn tới phản hồi khi `?focus=ket-qua`). Không đổi Composer/`useConversation` của chat cá nhân, không dependency mới.
