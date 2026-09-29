# Learning Thread P1 — Trả bài / Hỏi bài theo bài học

App học ("TÔI HỌC", riêng tư) ↔ Social `/me` ("CHÚNG TA SỐNG CÙNG ÂM NHẠC") dùng **chung một nguồn dữ liệu đào tạo**.
Bài học = đơn vị nội dung · **Thread = đơn vị tương tác đào tạo** · App dẫn từng người học · Feed (sau) chiếu câu chuyện ·
Hành trình (sau) xâu các thread thành lịch sử trưởng thành.

**STATUS = PRODUCTION PASS (29/09/2026).** `main` `56c9960` · Netlify `index-CN0ugz2B.js` · DB migrated · 3 bài DH2 bật.

### Bằng chứng production (Owner kiểm bằng tài khoản thật, 29/09/2026)

Học sinh thật HS03 (tự học) và Thầy thật cùng làm trên bài thật DH2 · Bài 4.3 — Bolero móc kiểu 1:

1. HS03 Hỏi bài → mở thread, trạng thái "Chờ Thầy phản hồi".
2. Thầy mở thread → "Cần làm lại", có đính kèm bài giảng nên xem.
3. HS03 thấy phản hồi → Trả lại, trong CÙNG thread.
4. Thầy → ĐẠT.

Danh tính lịch sử hiển thị đúng: "Tự học · DH2 → Chương 4 → Bài 4.3". "Cộng đồng học tập" hoạt động, App và `/me` cùng một dữ liệu. Thread thật này được giữ nguyên làm bằng chứng: không xoá, không ẩn.

### Sự cố khi release và cách chặn tái diễn

- **Sự cố:** lần chạy `db/learning_threads_p1_post_migration.sql` đầu tiên được báo "ok", nhưng production có **0** dòng `learning_lesson_settings`. RPC trả off/off nên panel ẩn đúng thiết kế, và Owner thấy UI cũ trên Bài 4.3.
- **Khắc phục:** chạy lại script (GATE PASS, smoke 23/23). `db/learning_threads_p1_diag.sql` xác nhận 3 dòng đã lưu và RPC dưới danh tính học sinh trả allowed/allowed.
- **Quy tắc từ nay:** bảng kết quả của script cấu hình KHÔNG phải bằng chứng, vì nó đọc trong cùng transaction. Chỉ chấp nhận `db/learning_threads_p1_diag.sql` chạy **riêng** với dòng cuối `CONFIG_GATE = PASS`. `CONFIG_GATE` đọc lại DB và gọi RPC dưới danh tính học sinh; khi có 0 dòng thì báo `STOP - CONFIG MISSING`. `scripts/test-learning-threads-db.sh` kiểm cả hai chiều.

### P1 KHÔNG làm (có chủ đích)

Feed projection · Journey timeline · tự ghi tiến độ · mở khoá bài · HT2027/Solo · build App Store (app native chỉ có P1 khi build lại + nộp store).

## Quyết định Owner (29/09/2026)

1. Mặc định chia sẻ **Cộng đồng học tập** (`community`); học sinh được chọn **Chỉ Thầy** (`private`).
   Ai được xem (visibility) **độc lập** với danh tính học tập: `community` = mọi thành viên Class, KHÔNG cần thuộc lớp.
2. Giữ Trả bài ở `/me` qua thread đã có ngữ cảnh (`/me/t/<id>`); App là nơi ưu tiên **khởi tạo**. 9 bài assignment cũ giữ nguyên.
3. P1 chứng minh end-to-end trên **DH2** (Đệm Hát Trình Độ 2, `c7ab2fcb-aff1-4485-a381-4edc83e4a62b`).
   HT2027/Solo ngoài phạm vi, nhưng schema tổng quát (`content_kind` / `content_key`).
4. ĐẠT chỉ ghi vào thread (`passed_at`, `passed_by`). **Chưa** ghi tiến độ, **chưa** mở khoá bài (P2).
5. Không hard-code Thầy: mọi phản hồi ghi `author_user_id`; tên/avatar lấy thật qua `class_public_identity`; nhiều giáo viên dùng chung hàng đợi.
6. **Không mặc định bài nào cũng được Trả bài.** Cấu hình ở tầng bài, tách "cho phép" và "yêu cầu", không suy từ `lesson_type`.

## Schema (`db/learning_threads_p1_setup.sql`)

### `learning_lesson_settings` — bài nào được Trả/Hỏi bài
| cột | ý nghĩa |
|---|---|
| `content_key` PK | `L:<edu_course_lessons.id>` (P1) · sau này `S:<PROGRAM>:<buổi>` |
| `lesson_id` | FK bài, CASCADE (xoá bài → cấu hình đi theo) |
| `submission_mode` | `off` · `allowed` (được Trả bài) · `required` (bài **yêu cầu** Trả bài — P1 chỉ hiển thị, P2 mới dùng cho mở khoá) |
| `question_mode` | `off` · `allowed` |
| `prompt` | lời dặn của Thầy cho bài (≤1000 ký tự) |

Chưa có dòng = cả hai `off`. Chỉ Thầy/admin ghi (RPC `lt_set_lesson_settings`).

### `learning_threads` — một người × một bài
- Khoá người = `auth.users.id` (không dùng `edu_students.id`: preflight thấy 3676/7378 dòng tiến độ có `student_id` trùng auth uid).
- **Unique:** `(learner_user_id, content_key) WHERE archived_at IS NULL`: mỗi bài một thread đang mở. Học lại = Thầy lưu trữ thread cũ → thread mới.
- `lesson_id` FK **SET NULL**: xoá bài KHÔNG xoá lịch sử (khác `edu_lesson_progress` bị CASCADE). `content_key` + snapshot giữ nguyên.
- Danh tính học tập: cột lọc `course_id`, `module_id`, `class_schedule_id`, `class_stage_id`, `student_id` + `identity jsonb`
  `{lesson, module, course{code,name,track,subject,level}, class{code,name,program_code,stage,public_product,stage_no,stage_title} | null, learner{student_id,ht_member,level}, captured_at}`.
  Chụp **ở server** lúc mở thread; không bao giờ cập nhật.
  Lớp: lớp active của người học (qua `edu_group_members` → nhóm cohort/mã lớp → `class_schedule`) có dạy khoá của bài;
  ưu tiên lớp đang học, chặng chứa hôm nay; không có → `null` = Tự học.
- `visibility`: `community` | `private`. `hidden_at`: Thầy ẩn (kiểm duyệt).
- `status`: `waiting_teacher` · `teacher_responded` · `needs_retry` · `passed` · `archived`.

### `learning_thread_events`
`kind` submission | question (học sinh) · teacher_feedback | teacher_answer (Thầy) · `verdict` retry | pass (chỉ teacher_feedback) ·
`author_role` đóng dấu lúc ghi · media link ngoài (cùng luật `class_posts`) · `tag_ids` (`class_tags`) · `resources` (video Kho, snapshot).

### Trạng thái
| sự kiện | → |
|---|---|
| học sinh gửi submission / question | `waiting_teacher` |
| Thầy phản hồi, verdict retry | `needs_retry` |
| Thầy phản hồi/trả lời không verdict | `teacher_responded` |
| Thầy verdict pass | `passed` (ghi `passed_at/by` lần đầu) |
| học sinh hỏi tiếp sau khi đạt | `waiting_teacher`, **giữ** `passed_at` |
| Thầy lưu trữ | `archived` |

## Quyền

Ba bảng **REVOKE hết** với anon/authenticated, RLS bật, không policy; nằm trong `self_managed` của `rls_setup.sql`.
Mọi truy cập qua RPC SECURITY DEFINER (chỉ `authenticated`):

| RPC | ai | việc |
|---|---|---|
| `lt_lessons_state(uuid[])` | mọi người đăng nhập | cấu hình bài + thread đang mở CỦA MÌNH (App: nút + chip) |
| `lt_submit(lesson, kind, body, media…, visibility)` | học sinh là thành viên Class | kiểm cấu hình bài + quyền mở bài qua `my_learning_state()`; tự mở thread + đóng dấu danh tính |
| `lt_respond(thread, kind, body, verdict, tags, resources, media…)` | Thầy/admin | phản hồi / chấm |
| `lt_detail(thread)` | chính chủ · Thầy · thành viên Class nếu community & không ẩn | toàn bộ thread (event ẩn chỉ Thầy thấy) |
| `lt_my_threads(…)` | chính chủ | thread của mình (/me) |
| `lt_teacher_queue(status, …)` | Thầy/admin | hàng đợi, cũ nhất trước |
| `lt_set_visibility(thread, v)` | chính chủ | Cộng đồng ↔ Chỉ Thầy |
| `lt_archive(thread)` · `lt_moderate(kind, id, hidden)` · `lt_set_lesson_settings(…)` | Thầy/admin | lưu trữ · kiểm duyệt · cấu hình bài |

Mã lỗi `LT_*` (NOT_AUTHENTICATED, NOT_MEMBER, TEACHER_ONLY, TEACHER_CANNOT_SUBMIT, SUBMISSION_NOT_ENABLED, QUESTION_NOT_ENABLED,
NO_ACCESS, NOT_FOUND, THREAD_HIDDEN, THREAD_ARCHIVED, BAD_*) để frontend dịch sang tiếng Việt.

## Frontend (`src/learning-thread/`)

Một bộ component dùng chung cho App (private view) và Social (social view). Không có hệ Trả bài thứ hai.

- **App học** (`MobileStudentPortal`):
  - `LessonThreadPanel` nằm trong màn bài học, ngay trên khối "Ghi nhận thực hành". Nút cũ "Tôi đã gửi bài cho thầy" (+50 XP) giữ nguyên.
  - Bản gọn của panel nằm ở Sổ tay hành trình (mọi loại bài, kể cả flow/native/strum).
  - Chỉ hiện khi Thầy bật cho bài. Ẩn khi Thầy xem thử hoặc khách chưa đăng nhập.
  - `LearningThreadSheet` là màn toàn màn hình: timeline + ô Trả bài / Hỏi bài + đổi Cộng đồng học tập ↔ Chỉ Thầy.
- **Social**:
  - `/me/t/<id>` (`ThreadPage`): người xem do server quyết.
  - `/me/queue` (`TeacherQueue`): Chờ Thầy / Cần làm lại / Đã phản hồi / Đã đạt.
  - Khối "Trả bài / Hỏi bài của tôi" trên `/me` (Thầy thấy lối vào hàng đợi).
  - Link `/me/t/<id>` giữ nguyên qua bước đăng nhập.
- **Renderer chung:** `ThreadView` (đầu thread + timeline). Media, avatar, tag và bài giảng Kho dùng lại component của Social.
- **Test:**
  - `tests/class-social/learning-thread.test.tsx`
  - E2E: `PUPPETEER_DIR=<thư mục có puppeteer-core> bash scripts/e2e-learning-thread.sh` (PostgreSQL tạm + PostgREST + auth giả lập + Vite + Chrome).

## Thứ tự chạy production

1. `db/learning_threads_p1_preflight.sql` (read-only) → GATE = PASS.
2. `db/learning_threads_p1_setup.sql` (tự mở/đóng một giao dịch; cổng phụ thuộc lặp lại preflight).
3. `db/learning_threads_p1_post_migration.sql`: MỘT lần dán, sinh bởi `scripts/build-lt-post-migration.py`.
   - Kiểm cổng hậu migration, rồi chạy smoke tự huỷ.
   - Chỉ khi cả hai PASS mới bật allowed/allowed cho 3 bài DH2 thật:
     - Bài 4.3 — Bolero móc kiểu 1 (`5f7acacd-9214-48f3-9349-93cc382649fb`)
     - Bài 4.4 — Bolero móc kiểu 2 (`a85592d5-b519-470d-84d0-4d9182d224b3`)
     - Bài 6.3 — Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp (`d2c00805-0000-4000-8000-000000000000`)
   - Lời dặn chung: "Bạn có thể gửi phần thực hành của bài này hoặc đặt câu hỏi cho Thầy."
4. **Chạy riêng `db/learning_threads_p1_diag.sql` → `CONFIG_GATE = PASS`.** Đây là bằng chứng bắt buộc trước khi báo đã cấu hình.
5. Merge `main` → Netlify deploy web. App native chỉ nhận khi build lại và nộp store (bundled).

Rollback: `db/learning_threads_p1_rollback.sql`. Script này **xoá** mọi thread và cấu hình. Muốn giữ dữ liệu thì chỉ gỡ frontend.

## Test

`bash scripts/test-learning-threads-db.sh`: cluster PostgreSQL 17 tạm, 90 kiểm tra. Nội dung:
- md5 hàm phụ thuộc (bản repo) khớp production.
- Preflight: chạy bình thường và khi bị dồn thành một dòng.
- Migration chạy 2 lần; chạy lại `rls_setup.sql`.
- Quyền theo từng loại người dùng; cấu hình theo bài; đóng dấu danh tính và snapshot không đổi.
- Workflow chấm; xoá bài; xoá tài khoản; rollback.
- Lỗi giữa migration rollback sạch; cổng drift.

## Chưa làm (có chủ đích)

- Feed/tường/trang Hành trình → P2; "Cộng đồng đang học bài này".
- Tự ghi tiến độ và mở khoá khi `required` + ĐẠT (P2).
- Upload video native (hiện chỉ nhận link ngoài).
- Thread cho buổi HT2027/Solo: nội dung buổi hiện ở `class_lesson_content` (Step 2C). Sẽ thêm `content_kind` phù hợp khi làm.

## Vấn đề bảo mật có sẵn (ngoài P1, xem preflight 29/09)

- `flows` (nội dung bài): `authenticated ALL true`, nghĩa là học sinh sửa/xoá được bài flow.
- `edu_lesson_progress`, `flow_progress`, `edu_skill_progress`, `student_xp_log`: `ALL true`.
- `edu_enrollments`, `edu_course_access`: mọi tài khoản đọc được toàn bộ.
- anon có quyền bảng rộng (kể cả TRUNCATE) trên nhiều bảng.
