---
name: project_freemium_percourse
description: "Mô hình freemium \"mở chính xác từng khoá\" — tài khoản do thầy cấp, khoá trả phí mở theo edu_course_access; chốt 2026-06-24"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Thầy chốt (2026-06-24): KHÔNG self-serve signup trên app — **tài khoản do thầy cấp** (admin/Mira). Đã gỡ nút "Tạo tài khoản miễn phí" khỏi StudentOnboarding (commit d56e2b4).

Mở khoá nội dung phải **CHÍNH XÁC TỪNG KHOÁ** (không phải gói/level toàn cục):
- `edu_courses.is_free` (bool, default true) — khoá miễn phí vs trả phí. Toggle trong Course Editor (🆓 Miễn phí / 💰 Trả phí). Khoá mới tạo qua editor = is_free:false.
- `edu_course_access` (student_id, course_id, active, granted_by) — thầy CẤP QUYỀN từng khoá khi học viên đóng phí. RLS: authenticated ĐỌC, chỉ `is_teacher()` GHI (đã thêm vào self_managed của rls_setup.sql). SQL: `db/course_access_setup.sql`.
- Bài `edu_course_lessons.tier` (default 'free'): tier='free' = **HỌC THỬ** (luôn mở, kể cả khoá trả phí — dùng cho 1-2 bài đầu); 'basic' = trong khoá (cần quyền). SQL cột: `db/lesson_tier_setup.sql`. Ô chọn trong Course Editor: "Học thử / Trong khoá".
- Gating portal mobile (MobileStudentPortal): `isLessonCourseUnlocked = l.tier==='free' || freeCourses.has(activeCourseId) || accessCourses.has(activeCourseId)`. **Tools vẫn dùng tier/level riêng (isTierUnlocked) — KHÔNG đụng.**
- Cấp/thu quyền: /admin → Hồ sơ học viên → tab Khoá học → nút "🔓 Mở khoá / Thu quyền" (chỉ hiện ở khoá is_free=false).
- CTA bài khoá: web → "🔒 Đăng ký học để mở khoá →" dẫn /class; iOS để mềm "Mở khi đăng ký học" (không dẫn thanh toán — an toàn Apple).

CẦN THẦY CHẠY: `db/course_access_setup.sql` + `db/lesson_tier_setup.sql` (Phần 1) trong Supabase SQL Editor.

CẬP NHẬT 2026-06-24 (curate + signup):
- Khoá FREE = Nhập Môn + Nhạc lý CƠ BẢN (match name ~* 'nhập môn' / 'nhạc lý cơ bản'); còn lại trả phí. SQL `db/freemium_curate.sql` (set is_free + khoá bài: khoá phí → 'basic' trừ 2 bài đầu 'free' học thử). LƯU Ý gốc rễ "tưởng free hết": lesson tier mặc định 'free' nên mọi bài mở — phải chạy curate mới khoá thật. Sau curate phải Mở khoá cho HV đã đóng phí (Hồ sơ học viên).
- **Tài khoản miễn phí self-serve TRÊN /class (web, không phải app iOS)**: Edge Function `signup-free` (anon, verify_jwt TẮT, service_role) tạo auth user + edu_students level beginner + ghi danh CHỈ khoá is_free. Form/modal trên ClassLandingPage (nút "🎁 Tạo tài khoản miễn phí" ở hero) → thành công → mở app /start đăng nhập. TK free CHỈ thấy khoá miễn phí (chỉ enroll khoá free).
- Mira dẫn khách tới nút (không tự nhập hộ): thẻ kiến thức `db/mira_freeaccount_knowledge.sql`.
- CẦN THẦY: deploy `signup-free` (Dashboard, verify_jwt OFF) + chạy `freemium_curate.sql` + `mira_freeaccount_knowledge.sql`.

Gap đã biết: desktop StudentPortalV2 chưa gate bài theo khoá (chỉ gate tools); gating hiện UI-only (chưa RLS theo-hàng — stage 3). Học viên dùng mobile/app là chính nên tạm ổn. Liên quan [[project_lms_roadmap]].
