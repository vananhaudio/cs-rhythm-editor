# Class System Chat V1 — "Class 2.0" trong Trò chuyện (BẢN THIẾT KẾ, 12/10/2026)

Trạng thái: **audit + thiết kế + SQL nháp đã test trên DB tạm. CHƯA có mã client. CHƯA migration production. Chờ Owner duyệt.**

## 1. Kết luận audit
| Câu hỏi | Kết quả |
|---|---|
| Chat V1a lưu gì? | `dm_conversations(user_lo,user_hi)` ↔ 2 `auth.users` thật, `dm_participants.last_read_seq`, `dm_messages(seq,sender_kind,sender_id,body,ref_type,ref_key)`. Chỉ 1-1, tên/ảnh đối phương lấy từ `class_public_identity(peer)`. |
| Thêm "hội thoại hệ thống" mà không migration được không? | **Không.** Hội thoại bắt buộc có người thứ hai là user thật; không được tạo user giả. Danh sách (`dm_conversations()`) chỉ trả hội thoại có `peer`. |
| Universal Share đã vào Chat chưa? | **Rồi.** `dm_share` → `dm_open` + `dm_append(ref_type, ref_key)` ghi tin vào hội thoại của người nhận, `last_seq` tăng → badge chưa đọc của người nhận đã đúng. **Không tạo thông báo hệ thống thứ hai** cho Share (tránh trùng). |
| Badge chưa đọc | `dm_unread_count()` = số hội thoại có `last_seq > last_read_seq`; client poll (`chatLive.watchUnread`). Tin nhắn cá nhân và hệ thống phải tách trạng thái. |
| Chấm bài đi qua đâu? | `lt_respond` (Thầy): ghi **một dòng `learning_thread_events`** (`teacher_feedback` + verdict `pass`/`retry`, hoặc `teacher_answer`) rồi cập nhật `learning_threads.status`. Cùng transaction → đây là điểm xác nhận "đã lưu". Trắc nghiệm (`lt_answer_checkpoint`) tự chấm, không có Thầy → không thông báo. |
| Đã có notification/event cho chấm bài? | Chưa. `learning_thread_events` là nhật ký bền vững nhưng học viên không có trạng thái "đã xem". |

## 2. Phương án
- **A (dùng nguyên Chat hiện có): loại** — cần user hệ thống hoặc đổi schema.
- **B (lớp dữ liệu nhỏ, hiển thị trong Chat): CHỌN.** Không đổi `dm_*`, `lt_*`.
- C (hệ thống notification riêng): không cần.

**Vì sao cần migration production:** bảng thông báo + trạng thái đọc + trigger không thể thay bằng mã client. Đọc từ `lt_my_threads` ở client thì không có "đã đọc" đáng tin (chỉ localStorage — bị loại theo yêu cầu).

## 3. Luồng dữ liệu
```
Thầy bấm lưu chấm bài → lt_respond (KHÔNG sửa)
   └─ INSERT learning_thread_events (teacher_feedback/teacher_answer)
        └─ TRIGGER class_system_notice_on_event (cùng transaction)
             └─ INSERT class_system_notices(user=học viên của thread, dedupe_key='event:<id>')  ← unique, chống trùng
Học viên mở Trò chuyện
   ├─ dm_conversations()            → cuộc trò chuyện cá nhân (như cũ)
   └─ class_system_notice_summary() → hàng "Class 2.0" (thông báo mới nhất + chưa đọc), ẩn nếu chưa có
Bấm "Class 2.0" → class_system_notices() danh sách; mark_read(seq) → badge giảm
Bấm một thông báo → /me/t/<thread_id> (route Learning Thread hiện có; quyền do lt_detail quyết)
Badge tổng = dm_unread_count() + summary.unread
```
- Ghi: chỉ trigger (SECURITY DEFINER). Client không có quyền bảng, không giả mạo được "hệ thống".
- Đọc: RPC theo `auth.uid()`; người A không thấy của B.
- Lưu thất bại → rollback → không thông báo. Mở bài/viết dở → không có sự kiện → không thông báo.
- Không backfill dữ liệu cũ.

## 4. Gói SQL (đã viết, đã test trên cluster tạm; production CHƯA đụng)
- `db/class_system_chat_v1_setup.sql` (idempotent, additive, 1 transaction), `db/class_system_chat_v1_rollback.sql`.
- `db/rls_setup.sql`: thêm 2 bảng vào `self_managed` (nếu không, chạy lại `rls_setup.sql` sẽ áp policy rộng — đã tái hiện lỗi này khi test).
- Test: `bash scripts/test-class-system-chat-db.sh` → **ALL DB PASS** (migration ×2, rls rerun không mở policy, đúng loại/thứ tự/nội dung, không thông báo cho nộp bài/ẩn/rollback, unique chống trùng, A/B/anon cách ly, mark_read chỉ tăng + bị chặn ở max, client không ghi/đọc thẳng bảng, rollback ×2 không đụng `lt_*`/`dm_*`/dữ liệu thread, cài lại).

## 5. Phạm vi client dự kiến (chưa làm) — ~8 file, 0 dependency mới
`chatApi.ts` (3 RPC) · `chatModel.ts` (SystemNotice, hàng ảo "Class 2.0") · `chatLive.ts` (watch summary, cộng vào badge) · `ConversationList.tsx` (hàng hệ thống, không avatar cá nhân) · `SystemNoticeView.tsx` (mới, bong bóng chỉ đọc + dòng "Đây là thông báo chính thức từ Class 2.0.", thay Composer) · `sections/Chat.tsx` + `ChatSelection` thêm `{kind:'system'}` · `classSocial.css` · test.
Không đổi Composer/`useChat` của hội thoại cá nhân.

## 6. Thứ tự triển khai khi được duyệt
1. Preflight → dryrun → migrate (`prod-db.py`) → postflight; 2. FE preview (cần DB đã migrate vì RPC mới); 3. Owner nghiệm thu trên tài khoản thật; 4. merge + deploy.
Rollback: FE revert, rồi `class_system_chat_v1_rollback.sql`. DB trước FE khi lên, FE trước DB khi gỡ.

## 7. Điểm cần Owner quyết
1. **Duyệt migration production** (2 bảng + 3 RPC + 1 trigger trên `learning_thread_events`, additive).
2. **Sự kiện V1:** đề xuất Thầy chấm Đạt / Cần làm lại / nhận xét / trả lời Hỏi bài (4 loại). Rút gọn còn Đạt + Cần làm lại nếu muốn ít nhiễu.
3. Nội dung thông báo dùng "Thầy …" cố định (không lấy tên giáo viên) — đồng ý?

## 8. Hạn chế đã biết
- Thầy bấm lưu hai lần = hai sự kiện thật = hai thông báo (hành vi `lt_respond` hiện có; trigger không dedupe theo nội dung).
- Thầy chấm lại bài đã Đạt vẫn thông báo mỗi lần chấm.
- Polling (không realtime) như Chat V1a; thông báo tới trong ≤ nhịp poll.
- **Rủi ro có sẵn (ngoài phạm vi):** `db/rls_setup.sql` KHÔNG liệt kê `dm_conversations/dm_participants/dm_messages` trong `self_managed` → chạy lại file này trên production sẽ tạo policy `rls_authenticated_all` (đã tái hiện trên DB tạm: 0 → 3 policy). Nên thêm vào danh sách ở lát riêng; không chạy lại `rls_setup.sql` trên production trước đó.
