# Quiz Checkpoint V1 — Bài trả trắc nghiệm tự chấm (03/10/2026)

Owner duyệt kiến trúc audit 03/10. Mục tiêu: chuẩn Bài trả mới cho SOLO01 — kiểm kiến thức bằng trắc nghiệm tự chấm,
thực hành tổng hợp tối đa 1 video / buổi (Thầy chấm). Không phải hệ Quiz tổng quát.

## Phạm vi V1
- `single` (radio) và `multiple` (checkbox, đúng cả tập) · 1 câu / checkpoint · không điểm / % / giờ.
- Server chấm · làm lại không giới hạn · đúng → ✓ Đạt ngay · sai → "Chưa đúng — thử lại." + gợi ý (nếu có).
- KHÔNG Learning Thread → không Feed, không Không gian lớp, không Hàng đợi Thầy.
- Mục lục / "Bài trả của tôi": trắc nghiệm chỉ **Đạt / Chưa trả** (không "Chờ Thầy").

## Dữ liệu
| Nơi | Nội dung | Ai đọc / ghi |
|---|---|---|
| `class_lesson_content.blocks` | khối `{kind:'checkpoint', accepts:['quiz'], quiz:{mode, question, options[{id,text}], hint?}}` | học viên ĐỌC (RLS) — vì vậy KHÔNG có đáp án |
| `class_checkpoint_keys` | `(session_id, checkpoint_id) → mode, correct[]` | chỉ server (RLS bật, không policy, không grant) |
| `learning_checkpoint_passes` | một dòng / người / checkpoint: `attempts`, `last_attempt_at`, `passed_at` | chỉ qua RPC (không grant) |

Khoá nội dung giống bài trả cũ: `C:<PROGRAM>:<buổi>:<id>`. V1 chỉ đếm số lần thử, không lưu từng lần trả lời.

## Luồng
`lt_answer_checkpoint(p_class, p_session_no, p_checkpoint_id, p_choices text[])` (SECURITY DEFINER, chỉ `authenticated`):
1. Đăng nhập · không phải Thầy · có quyền giáo trình lớp (`can_read_class_curriculum`).
2. Checkpoint THẬT trong blocks đã xuất bản, `accepts` có `quiz`, có câu hỏi hợp lệ.
3. Lựa chọn: có, không trùng, đều là id thật; `single` = đúng 1 (sai → `LT_BAD_ANSWER`).
4. Buổi đã mở với người học (`lsp_sync` → `LT_SESSION_LOCKED`).
5. Có đáp án hợp lệ (đúng mode, ⊂ lựa chọn) — thiếu/lệch → `LT_QUIZ_NOT_READY` (không chấm bừa).
6. Đã ĐẠT → giữ nguyên, không chấm lại. Chưa → chấm theo tập; ghi attempts; đúng → `passed_at` + `lsp_try_complete`.
7. Trả `{correct, passed_at, attempts}` — không bao giờ trả đáp án.

Hoàn thành buổi (`lsp_try_complete`): bài trả bắt buộc ĐẠT = thread Thầy chấm passed **HOẶC** trắc nghiệm ĐẠT.
`class_learning_state` thêm `quiz_passed_at` mỗi checkpoint (của chính người học). Bài chữ/video cũ: hành vi không đổi.

## Frontend
- `LessonDocument`: câu hỏi luôn hiện; lựa chọn TĨNH khi không có phần tương tác (trang công khai `/solo01/buoi-NN`, in, Admin).
- Trang Buổi (`/me`): `CheckpointSlot` → `QuizCheckpoint` (học viên) · lựa chọn tĩnh + ghi chú (Thầy).
- `checkpointProblems` / `quizProblems`: câu hỏi · ≥ 2 lựa chọn · id hợp lệ, không trùng · mode · **không chứa đáp án**.
- `curriculumStandard`: tối đa 1 bài trả `video_link` / buổi SOLO01.

## Triển khai (prod-db.py)
- Hạ tầng: `db/quiz_checkpoint_v1_{preflight,setup,postflight,rollback}.sql` — cổng md5 2 hàm bị thay = production 03/10.
- Nội dung có đáp án: repo PRIVATE `cs-rhythm-editor-wip` → `prod-migrations/solo01-buoi02-quiz/` (`keys.json` + `gen.mts` sinh
  `publish.sql` / `rollback.sql` / `local-e2e.sql`). Publish = blocks + đáp án một giao dịch, chặn md5 cũ + chưa có bài nộp, tự kiểm sau ghi.
- Rollback: (1) nội dung buổi (`rollback.sql` private) → (2) frontend → (3) `db/quiz_checkpoint_v1_rollback.sql` (giữ dữ liệu nếu đã có kết quả).

## Kiểm
- DB: `scripts/test-learning-threads-db.sh` (mục QUIZ V1 + `db/tests/quiz_checkpoint_v1_test.sql`, dữ liệu giả).
- Unit: `tests/class-social/quiz-checkpoint.test.tsx`.
- E2E: `scripts/e2e-quiz-checkpoint.sh` (Buổi 02 thật; đáp án đọc từ thư mục private `E2E_QUIZ_PRIVATE`) + hồi quy `scripts/e2e-class-canonical.sh`.
