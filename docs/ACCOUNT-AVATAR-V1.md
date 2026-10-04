# Account Avatar V1 — Thầy/admin tự đổi ảnh đại diện (04/10/2026)

## Vấn đề
Ảnh đại diện chuẩn của Class = `class_public_identity(user_id).avatar_url`, trước đây chỉ đọc
`edu_students.avatar_url`. Tài khoản admin/giáo viên KHÔNG có hàng `edu_students` → `/me` ẩn nút đổi ảnh
(`canEditAvatar = !!me.studentId`) và server không có chỗ lưu ảnh.

## Thiết kế (không thêm nguồn avatar thứ hai)
Ảnh đi theo cùng luật dự phòng mà TÊN đã dùng (`display_name → full_name → app_users.name`):

    avatar = edu_students.avatar_url (hàng mới nhất)  →  app_users.avatar_url

- Học sinh: KHÔNG đổi gì — vẫn ghi `edu_students.avatar_url` (App học + `/me`).
- Tài khoản không có hồ sơ học sinh: `/me` tải ảnh lên bucket `avatars` (`<userId>-<ms>.jpg`, cùng
  `prepareImage`) rồi gọi RPC `class_set_my_avatar(p_url)`.
- RPC (SECURITY DEFINER) chỉ ghi hàng `auth.uid()`; URL phải là ảnh bucket `avatars` mang đúng id của người gọi;
  tài khoản có hồ sơ học sinh bị từ chối (`use_student_profile`). `app_users` vẫn chỉ-đọc với client → không ai
  tự đổi role. Không tạo `edu_students` cho admin, không đổi role.
- Mọi nơi đọc qua `class_public_identity` (feed, bình luận, hồ sơ `/me/u/<id>`, thẻ thành viên TeamLab
  `teamlab_project_member_cards`) tự thấy ảnh mới. `/me` của tài khoản giáo viên đọc `app_users.avatar_url`
  (không còn đọc `user_metadata.avatar_url`).

## File
- `db/account_avatar_v1_{preflight,setup,postflight,rollback}.sql`
- Test DB: `bash scripts/test-account-avatar-db.sh` · E2E: `PUPPETEER_DIR=… bash scripts/e2e-account-avatar.sh`
  (`E2E_FULL=1` chạy cả kịch bản cũ).
- md5(prosrc) `class_public_identity`: trước `9bda0938…`, sau `c1129bf0…` — preflight của tính năng sau phải
  ghim hằng mới.

## Deploy / rollback
DB TRƯỚC frontend: `prod-db.py query preflight → dryrun setup → migrate setup → query postflight` → FF main.
(Frontend vẫn chạy được khi DB chưa migrate: thiếu cột → đọc lại chỉ `role`.)
Rollback: frontend về bản trước TRƯỚC, rồi `migrate db/account_avatar_v1_rollback.sql` (mất ảnh lưu ở
`app_users.avatar_url`; file trong bucket vẫn còn).
