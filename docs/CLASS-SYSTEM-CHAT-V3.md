# Class System Chat V3 — thông báo học tập: nhận xét · ĐẠT · NỘP LẠI

Trạng thái: **bản nháp, chưa chạy production** (cần Owner duyệt riêng). Nền: V2 đang LIVE (hàm trigger md5 prosrc `01809de4`, khớp `db/class_system_chat_v2_setup.sql`).

## Sự kiện → thông báo

| Sự kiện (Learning Thread) | Người nhận | kind | Nội dung | Khoá chống trùng |
|---|---|---|---|---|
| Học viên nộp bài | Thầy phụ trách, chưa có → Thầy/Admin thuộc lớp | `submission_received` | Học viên vừa nộp bài[ Buổi NN]. | `submit:<thread>:<seq phản hồi gần nhất của Thầy>` (V2) |
| Học viên nộp **lại** sau NỘP LẠI | như trên | `submission_received` | Học viên vừa nộp **lại** bài… | như trên (lượt mới sau phản hồi của Thầy) |
| Học viên hỏi bài | như trên | `question_received` | Học viên vừa gửi câu hỏi mới. | `ask:<thread>:<seq câu hỏi>` (V2) |
| Thầy chỉ nhận xét | Học viên | `teacher_commented` (mới) | Thầy vừa nhận xét bài trả…của bạn. | `comment:<thread>:<seq>` + bỏ qua nếu còn thông báo cùng loại **chưa đọc** |
| Thầy chấm ĐẠT (có/không nhận xét) | Học viên | `checkpoint_graded` | Bài trả…của bạn đã ĐẠT. | `grade:<thread>:<lượt nộp>:pass` |
| Thầy yêu cầu NỘP LẠI (có/không nhận xét) | Học viên | `checkpoint_graded` | Thầy yêu cầu bạn nộp lại bài trả… | `grade:<thread>:<lượt nộp>:retry` |
| Thầy trả lời Hỏi bài | Học viên | `question_answered` | Thầy đã trả lời câu hỏi của bạn. | `answer:<thread>:<seq>` + bỏ qua nếu còn thông báo cùng loại chưa đọc |

Một lần lưu của Thầy = một sự kiện = tối đa một thông báo. Không bao giờ gửi cho tác giả sự kiện; không đưa tên học viên/nội dung bài vào thông báo.

## Tương thích

- Chỉ thêm MỘT kind (`teacher_commented`); ĐẠT/NỘP LẠI giữ `checkpoint_graded` nên app đã phát hành vẫn hiển thị và mở đúng ("Xem kết quả"). Kind mới trên app cũ: nút "Xem chi tiết", vẫn mở đúng thread.
- Không bảng/policy/grant mới; không sửa `lt_*`, `dm_*`, RLS. Hàng thông báo cũ giữ nguyên.
- Rollback: `db/class_system_chat_v3_rollback.sql` — khôi phục thân hàm trigger về đúng V2 (md5 khớp), **BẢO TOÀN DỮ LIỆU**: không `DELETE`, không `NOT VALID`.
  - CHECK `kind` giữ bản mở rộng của V3 (tập cha của V2, đã validated); hàm V2 không bao giờ tạo `teacher_commented` nên không có tác dụng phụ.
  - Các thông báo `teacher_commented` đã tạo vẫn đọc được qua RPC (RPC không lọc theo kind), `summary` vẫn đếm chưa đọc, `mark_read` hoạt động; app cũ hiện nút "Xem chi tiết" và mở đúng thread.
  - Sau rollback hành vi là V2: chỉ nhận xét không tạo thông báo mới; chấm tạo thông báo "đã được chấm".
  - Idempotent; không đổi quyền, RLS, GRANT, policy, trigger. Cài lại V3 sau rollback không đổi dữ liệu.
  - Thứ tự: rollback FE (revert nhánh V3) trước, rồi chạy file này.
- Kiểm thử DB: `bash scripts/test-class-system-chat-db.sh` (PostgreSQL tạm, qua RPC thật).

## Giới hạn đã biết

- `lt_respond` không idempotent: gửi lại request vẫn tạo thêm sự kiện nhận xét (hành vi sẵn có, ngoài phạm vi); thông báo thì không nhân đôi.
- Học viên đã mất quyền vẫn nhận thông báo (nhận theo `learning_threads.learner_user_id`, như V2); không đọc được nội dung thread nếu không còn quyền.
- Tối đa một thông báo thừa khi triển khai V3 đúng lúc một thread đang chấm (khoá cũ `grade:<thread>:<lượt>` khác khoá mới).
