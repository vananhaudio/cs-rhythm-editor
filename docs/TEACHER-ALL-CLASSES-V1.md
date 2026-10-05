# Teacher All Classes V1 — Thầy/admin thấy mọi lớp (05/10/2026)

## Vấn đề
`/me/classes` lấy danh sách từ `social_my_classes()` = lớp mình là THÀNH VIÊN (canonical `tva_private.class_memberships`).
Tài khoản Thầy (role `admin`, không hồ sơ học sinh) không là thành viên lớp nào → "Lớp của tôi" rỗng; "Khám phá" chỉ có lớp
đang tuyển/chạy (lớp đã kết thúc không hiện ở đâu).

## Kiến trúc hiện có (không đổi)
- Danh tính Thầy CANONICAL = `public.is_teacher()` (`app_users.role in ('teacher','admin')`). Frontend: `me.isTeacher` cùng luật.
- Quyền đọc lớp/buổi cho Thầy ĐÃ có ở server: `social_class_detail` (mọi thành viên Class), `class_learning_entry`
  (`v_teacher`), `class_learning_state` (vai trò `teacher`, không tiến độ cá nhân), `social_class_members` (`is_teacher()`),
  RLS `class_lesson_content_teacher_all`, `class_sessions` đọc cho authenticated. Trang lớp/buổi đã có chế độ Thầy
  (bài trả "Xem trước"/ghi chú, không khung nộp).
- Chỗ thiếu DUY NHẤT: danh sách.

## Thay đổi
- DB (additive): RPC `social_all_classes()` — SECURITY DEFINER, `search_path=''`, raise `42501 SC_TEACHER_ONLY` nếu
  `not is_teacher()`; mọi lớp bỏ `cancelled/merged/draft` (cùng bộ lọc `social_my_classes`/`social_class_detail` → lớp nào
  cũng mở được); đọc thẳng `class_schedule` nên lớp mới tự xuất hiện. REVOKE public/anon, GRANT authenticated.
  Không đổi hàm cũ nào (test chốt md5), không ghi dữ liệu.
- Frontend: `useSocialClasses(me.isTeacher)` — Thầy: thêm `all` (gọi `social_all_classes`), bỏ "Khám phá". `mine` giữ
  nghĩa membership (sidebar lớp, Home, tab "Lớp"). `/me/classes` của Thầy = "Tất cả lớp học" (đang chạy/sắp mở → Lớp đã
  kết thúc, ô tìm, không "Nhập mã lớp"); sidebar mục "Tất cả lớp học". Học sinh: y nguyên.
- Không email, không enrollment/membership/tiến độ/giáo trình nào bị tạo hay sửa.

## File / test
- `db/teacher_all_classes_v1_{preflight,setup,postflight,rollback}.sql`; md5 `social_all_classes` = `57ca133b…`.
- DB: `bash scripts/test-teacher-all-classes-db.sh` · E2E: `PUPPETEER_DIR=… bash scripts/e2e-teacher-all-classes.sh`
  (`E2E_FULL=1` chạy cả kịch bản cũ) · Unit: `tests/class-social/teacher-all-classes.test.tsx`.
- Smoke production (tự huỷ): `prod-db.py dryrun db/tests/teacher_all_classes_v1_prod_smoke.sql`.
- Ghi chú harness: `scripts/e2e-learning-thread.sh` chưa có Class Membership Canonical V1 / Join Code V1 →
  `class_learning_entry` 404 ở stack local (được kiểm bằng smoke production).

## Deploy / rollback
DB TRƯỚC frontend: preflight → dryrun setup + rollback → migrate → postflight (dòng "dữ liệu lớp" + md5 hàm cũ giống preflight)
→ smoke → FF main. Rollback: frontend về bản trước TRƯỚC, rồi `migrate db/teacher_all_classes_v1_rollback.sql`.
