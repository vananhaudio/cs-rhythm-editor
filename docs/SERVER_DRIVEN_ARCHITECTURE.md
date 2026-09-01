# SERVER-DRIVEN ARCHITECTURE — TVA Guitar

> **Nguyên tắc gốc: APP CHỈ LÀ ENGINE + RENDERER. SERVER/ADMIN QUYẾT ĐỊNH nội dung,
> quyền học, hành trình, trạng thái, cấu hình.** Mục tiêu: không dùng Apple/Google
> release như công cụ thay đổi nghiệp vụ.

## Câu hỏi bắt buộc trước khi code BẤT KỲ yêu cầu nào

**A. Đây là DATA/CONFIG/POLICY hay SOFTWARE CAPABILITY?**
- data / content / quyền / trạng thái / cấu hình / thứ tự / policy → **SERVER/ADMIN**.
- app chưa có khả năng thực hiện loại hành vi đó → **CODE**.

**B. Đây có phải thứ thầy có thể muốn thay đổi ngày mai không?** Nếu CÓ → server/admin.

## Canonical resolver — nguồn sự thật duy nhất về quyền học

- **RPC `public.my_learning_state()`** (`db/learning_state_setup.sql`, SECURITY DEFINER,
  không tham số — chỉ trả trạng thái của chính `auth.uid()`, anon = khách).
- Tổng hợp: user→student (user_id/email), role (is_teacher), entitlement
  (`get_effective_student_entitlement` + level legacy), enrollment, free/public,
  manual grant (`edu_course_access`), content policy (visibility/availability/
  required_tier, lesson override), prerequisite (`course_prereqs` × progress),
  hành trình (`journey_curriculum`/`journey_tracks`), completed lessons, feature
  flags (`edu_tools.enabled`).
- Trả JSON: `courses[] { visible, access: open|upgrade|coming_soon|hidden|prereq,
  missing_prereqs, modules[], lessons[] { access, completed } }`.
- Client: `src/learningState.ts` (fetch + cache TTL 5 phút) → `MobileStudentPortal`
  chỉ **map vào view-model và render**. Refresh: mở app, đổi user, quay lại
  foreground khi cache quá TTL, sau khi hoàn thành bài.

### RULE: **Client MUST NOT derive authorization from enrollment (or any table) alone.**
Mọi quyết định mở/khoá đọc từ `my_learning_state()`. Muốn đổi luật → sửa RPC + test
(`db/tests/learning_state_test.sql`), KHÔNG thêm suy luận ở client. Resolver client
(`src/contentAccess.ts`, `src/hanhtrinh.ts`) chỉ còn là **fallback legacy** khi
`app_config.learning_state_mode = 'client'` hoặc RPC lỗi — không mở rộng thêm.

### Công tắc & rollback (không cần build)
- `app_config.learning_state_mode`: `'server'` (mặc định) / `'client'` (fallback legacy).
- Bug ở resolver → đổi key này là toàn bộ app quay về logic cũ ngay.

## Bảng phân loại: sửa Ở ĐÂU

### ADMIN/SERVER — KHÔNG BUILD
| Việc | Chỗ sửa |
|---|---|
| Mở/khóa bài, khoá học, visibility, coming-soon | Admin → Khoá học (content policy) / `edu_courses`/`edu_course_lessons` |
| Cấp/thu hồi quyền 1 học sinh | Admin → Học viên (grant) / `edu_course_access`, `grant/revoke_student_entitlement` |
| Enrollment, package, expiry | `edu_enrollments`, `packages`/`student_packages` (Admin Học viên) |
| Prerequisite | **Admin → Hành trình** (`course_prereqs`) |
| Cấu trúc/thứ tự hành trình, khoá thuộc môn nào, level | **Admin → Hành trình** (`journey_curriculum`, `journey_tracks`) |
| Thứ tự bài/khoá | Admin → Khoá học (`order_index`, `sort_order`) |
| Nội dung bài (video/YouTube/PDF/audio/text/link/tool) | Admin → Khoá học (`content_url`, `lesson_type`, `tools`) |
| Bản tin / thông báo / banner / CTA / sự kiện | **Admin → Bản tin** (`home_feed_items`, đủ 8 loại + open_mode) |
| Lịch học | Admin → Lịch lớp (`class_schedule`) |
| Feature flag công cụ (tuner, metronome, Tap, BMS, Piano Journey…) | **Admin → Công cụ** (`edu_tools.enabled`) |
| Bật/tắt server-driven learning state | `app_config.learning_state_mode` |

### CODE/BUILD — chỉ khi đổi engine/capability thật
Native plugin, audio/mic engine, camera/Bluetooth/MIDI, auth engine, vỏ Capacitor,
**renderer hoàn toàn mới app chưa biết**, crash/client bug, yêu cầu SDK/iOS, UX engine lớn.

## Cache
- Learning state: localStorage `tva_learning_state_v1`, TTL 5 phút; cache chỉ chống
  trắng màn hình — quyền luôn do lần fetch mới quyết. Admin đổi quyền → học viên
  thấy trong ≤5 phút hoặc ngay khi mở lại app.
- Bản tin: `tva_home_feed_cache_v2`, cùng nguyên tắc.

## Bảo mật
- RPC không nhận student_id — không leo quyền qua tham số.
- `journey_tracks`/`journey_curriculum`/`course_prereqs`: mọi người ĐỌC, chỉ teacher GHI
  (RLS riêng, nằm trong `self_managed` của `rls_setup.sql`).
- Client gửi gì cũng không đổi được quyền — server tự tính từ DB.

## Test
`db/tests/learning_state_test.sql` — chạy `supabase db query --linked -f ...`:
khách (course ẩn không lộ, có bài open), học viên không-enrollment (KHÔNG journey rỗng
— bug build 17), học viên có enrollment (course open + progress khớp), prereq seed,
chống privilege escalation (student không ghi được bảng cấu hình), teacher thấy đủ.
Đổi luật resolver → PHẢI chạy lại file này.
