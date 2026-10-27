# Student 360° — P1 nền tảng hồ sơ học viên

Trạng thái: nhánh `feat/student-360-p1`, **chưa migrate production, chưa deploy, chưa đụng UI**.
Test: `bash scripts/test-student-360-db.sh` (PostgreSQL tạm, dữ liệu giả lập).

## Phạm vi P1
Chỉ tầng DB + RPC. Không sửa Class Mobile/Web UI, không Mira, không đọc CRM/Zalo.

## Mô hình
- `student_360_facts`: một mục chắt lọc (≤500 ký tự) gắn `auth.users.id`.
  - `category`: goal · music_taste · difficulty · support_need · key_topic · commitment
  - `origin`: self_reported (học viên tự nêu) · class_confirmed (dữ liệu Class xác nhận) · inferred (suy luận)
  - `verification`: unverified · student_confirmed · teacher_verified
  - `source_kind`: student · teacher · class · crm_zalo · mira; `source_ref`: con trỏ mờ, KHÔNG phải nội dung tin
  - `visibility`: teacher · student_and_teacher; `status`: active · revoked (+ ai/khi nào/vì sao)
- `student_360_fact_log`: nhật ký bất biến (trigger chặn UPDATE/DELETE), lưu bản trước/sau mỗi thay đổi.
- Hồ sơ cơ bản và dữ liệu học tập KHÔNG sao chép: `student_360_get` đọc `edu_students` trực tiếp, và trả danh sách
  nguồn Class (`my_learning_state()`, `lt_*`, `student_xp_log`, `edu_lesson_progress`) để nơi gọi đọc đúng nguồn.

## RPC (authenticated; anon không có quyền; bảng REVOKE hết, nằm trong `self_managed` của rls_setup)
| RPC | Ai | Ghi chú |
|---|---|---|
| `student_360_get(user?, include_revoked?)` | mình / Thầy | học viên chỉ thấy mục `student_and_teacher` còn hiệu lực, không thấy `source_ref` |
| `student_360_add_fact(...)` | mình / Thầy | học viên bị ép `self_reported/student`, trần 50 mục; suy luận của Thầy mặc định chỉ Thầy thấy |
| `student_360_edit_fact` | mình (mục tự nêu) / Thầy | sửa luôn đưa về `unverified` |
| `student_360_set_verification` | Thầy → teacher_verified; học viên → student_confirmed (mục của mình) | không đường nào tự nâng suy luận lên đã xác minh |
| `student_360_revoke_fact` | mình (mục mình thấy) / Thầy | idempotent, nhật ký giữ nội dung cũ |
| `student_360_revoke_by_source(kind, ref)` | Thầy | P2: sửa liên kết Zalo sai → thu hồi mọi mục từ nguồn đó |
| `student_360_fact_history` | Thầy | |

Mira (P4) sẽ đọc bằng JWT học viên → `student_360_get()` chỉ trả hồ sơ CỦA học viên đó, đúng phạm vi hiển thị.

## Production (khi Owner duyệt)
`prod-db.py`: preflight → dryrun → migrate `db/student_360_p1_setup.sql` → postflight. Rollback: `db/student_360_p1_rollback.sql`
(xoá dữ liệu hồ sơ 360, không đụng bảng Class khác). Migration chỉ thêm 2 bảng + hàm mới; không đổi bảng hiện có.

## Việc còn lại
P2 liên kết Zalo (đối soát 403 `rule_matched`, gọi `revoke_by_source`) · P3 chắt lọc (ghi mục `inferred`, nguồn `crm_zalo`)
· P4 Mira trong Class Chat · UI giáo viên trong `StudentProfile.tsx` (cần phối hợp phiên Class Mobile).
Quyết định mở: học viên có thấy mục `inferred` đã được Thầy duyệt hiển thị không (hiện: chỉ khi Thầy đặt `student_and_teacher`).
