# Class System Chat V2 — thông báo hai chiều (17/10/2026)

Trạng thái: **code + migration + test PASS trên DB/stack tạm. CHƯA migration production, CHƯA merge, CHƯA deploy. Chờ Owner duyệt.**
Nền: [CLASS-SYSTEM-CHAT-V1.md](CLASS-SYSTEM-CHAT-V1.md) (đang chạy production). V2 chỉ tái dùng hạ tầng V1: `class_system_notices`, 3 RPC, màn Class 2.0, badge, polling.

## Sự kiện (đều là event Learning Thread sẵn có)
| Sự kiện | Event | Người nhận | kind | Nội dung | Nhãn nút |
|---|---|---|---|---|---|
| Học viên nộp bài | `submission` | Thầy phụ trách | `submission_received` | Học viên vừa nộp bài Buổi NN. | Xem bài |
| Học viên hỏi bài | `question` | Thầy phụ trách | `question_received` | Học viên vừa gửi câu hỏi mới. | Xem câu hỏi |
| Thầy chấm | `teacher_feedback` + verdict | Học viên | `checkpoint_graded` (V1 nguyên văn) | Bài trả … của bạn đã được chấm. | Xem kết quả |
| Thầy trả lời Hỏi bài | `teacher_answer` | Học viên | `question_answered` | Thầy đã trả lời câu hỏi của bạn. | Xem trả lời |

Liên kết luôn `/me/t/<thread>`; `?focus=ket-qua` (phản hồi Thầy mới nhất) cho chấm/trả lời, `?focus=bai-moi` (lượt học viên mới nhất) cho nộp/hỏi. Quyền mở do `lt_detail` quyết như cũ.

## Người nhận (server quyết, backend)
1. Học viên: `learning_threads.learner_user_id`.
2. Thầy: `learning_threads.last_teacher_user_id` nếu còn `app_users.role in (teacher, admin)` (đúng điều kiện `is_teacher()` mà `lt_respond` đòi) →
3. nếu chưa có: các tài khoản teacher/admin **thuộc lớp của thread** theo nguồn canonical `tva_private.class_memberships`.
4. Không xác định được (thread không lớp và chưa có Thầy phụ trách) → **không gửi cho ai**, `RAISE WARNING` (thread/event id + chỉ định danh), nộp bài vẫn thành công. Không suy "mọi Thầy xử lý mọi thread".
5. Không bao giờ gửi cho chính tác giả sự kiện. Học viên (kể cả cùng lớp) không bao giờ nhận thông báo hướng Thầy.

## Chống trùng (`unique(user_id, dedupe_key)`, theo vòng đời nghiệp vụ)
- nộp: `submit:<thread>:<seq phản hồi gần nhất của Thầy>` → một lượt chờ chấm = 1 thông báo/Thầy; Thầy phản hồi rồi học viên nộp lại = thông báo mới.
- hỏi: `ask:<thread>:<seq câu hỏi>` → mỗi câu hỏi mới 1 thông báo.
- trả lời: `answer:<thread>:<seq câu hỏi gần nhất>` → nhiều câu trả lời cho cùng câu hỏi = 1 thông báo.
- chấm: `grade:<thread>:<seq lượt nộp>` — V1 nguyên văn.

## An toàn transaction
Trigger vẫn chạy cùng transaction với event, nhưng toàn bộ nhánh thông báo nằm trong khối `BEGIN … EXCEPTION WHEN OTHERS` (savepoint con): lỗi → rollback riêng thông báo + `RAISE WARNING` (không nội dung), **event nghiệp vụ vẫn commit**. Lỗi của chính INSERT event (nằm ngoài khối) không bị nuốt. Có test chủ động gây lỗi (CHECK `false` NOT VALID trên bảng thông báo; đổi tên view lớp) qua `lt_submit`/`lt_respond` thật.

## Migration
- `db/class_system_chat_v2_setup.sql`: cổng (V1 + `tva_private.class_memberships` + trigger V1) → nới CHECK `kind` → thay thân `class_system_notice_on_event()`. Không bảng mới, không đổi `lt_*`/`dm_*`/RPC/RLS/grant. Idempotent. KHÔNG backfill.
- `db/class_system_chat_v2_rollback.sql`: xoá **chỉ** thông báo kind V2, trả CHECK + hàm trigger về đúng V1 (test: md5 hàm khớp V1; thông báo chấm V1 giữ nguyên). Rollback FE (revert PR) trước.
- Quy trình phát hành: preflight → dryrun → migrate (`prod-db.py`) → postflight. FE tương thích hai chiều (loại lạ → "Xem chi tiết", không đoán focus), nên FE/DB lên thứ tự nào cũng không hỏng.

## Kiểm thử
- DB: `bash scripts/test-class-system-chat-db.sh` (PG17 tạm) — V1 giữ nguyên + V2: cổng, idempotent, RLS/grant, ~55 kiểm tra qua RPC thật (đúng người, ưu tiên Thầy phụ trách, fallback lớp, mất quyền, thread không lớp, chống trùng, lỗi thông báo, rollback ×2).
- FE: `npm run test:class-social` (+ `tests/class-social/system-chat-v2.test.tsx`).
- E2E Chrome thật trên DB tạm: `scripts/e2e-class-system-chat.sh` chạy lại với V2 đã cài (hồi quy luồng chấm V1 + layout mobile).
