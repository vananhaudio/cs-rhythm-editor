---
name: project_account_deletion
description: Cách xóa tài khoản đúng (Apple 5.1.1(v)) — hàm delete_my_account và bẫy khóa ngoại
metadata: 
  node_type: memory
  type: project
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

Apple reject TVA Guitar nhiều lần vì "xóa tài khoản xong vẫn đăng nhập lại được". Nguyên nhân kép, đã fix 6/2026:

1. **Khóa ngoại chặn `DELETE FROM auth.users`.** 3 bảng có FK NO ACTION trỏ tới `auth.users`, phải xóa TRƯỚC: `edu_students` (user_id), `student_taps` (user_id), `student_progress` (user_id). Xóa `edu_students` tự CASCADE 13 bảng con (edu_lessons/skills/assignments/messages/learning_events/teacher_notes/enrollments/lesson_progress/daily_tasks/achievements/student_tools + student_songs + student_xp_log, tất cả qua cột `student_id` → edu_students.id). `app_users` (cột khóa là **`id`**, KHÔNG phải user_id) CASCADE sẵn nên không cần đụng.
   **2 bảng tiến độ KHÔNG có FK (không tự cascade) → phải xóa tay:** `flow_progress` (tiến độ Flow Player) và `edu_quiz_results`, đều theo cột `student_id`. Hàm xóa chúng bằng `WHERE student_id IN (v_student_id, v_uid)`. `student_practice_log` ghi trong CLAUDE.md nhưng KHÔNG tồn tại trong DB. Các bảng SET NULL (classes/projects/teams/tracks/takes/timming_songs.created_by/timming_submissions.graded_by) là nội dung, chỉ ẩn danh — chấp nhận được.

2. **App nuốt lỗi.** `supabase.rpc()` KHÔNG throw khi Postgres lỗi — trả về `{ error }`. Code cũ bỏ qua `error` nên vẫn signOut/logout dù xóa thất bại → trông như đã xóa. Đã sửa: kiểm tra `error`, chỉ logout khi xóa thật thành công. Cũng đã thay `window.confirm` (không chạy trong WKWebView) bằng modal tự làm.

Hàm `public.delete_my_account()` hiện tại: SECURITY DEFINER, SET search_path='', guard auth.uid() NULL, GET DIAGNOSTICS row_count để báo lỗi nếu xóa 0 dòng, GRANT EXECUTE chỉ cho authenticated. Tài khoản demo cho Apple: `reviewer@vananhaudio.com`.

Câu chẩn đoán hữu ích — liệt kê FK chặn xóa: `SELECT conrelid::regclass, conname, confdeltype FROM pg_constraint WHERE confrelid='auth.users'::regclass AND confdeltype<>'c';` (confdeltype: c=cascade an toàn, a/r=chặn). Liên quan [[project_tune_lab]].
