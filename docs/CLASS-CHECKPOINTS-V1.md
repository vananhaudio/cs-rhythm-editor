# Lớp của tôi V1 — Học → Trả bài tại checkpoint → Chấm → Mở buổi tiếp theo

Nhánh `feat/class-checkpoints-v1`. Phân cấp: **HÀNH TRÌNH → LỚP → BUỔI/TUẦN → BÀI TRẢ**. Màn này là phần LỚP → BUỔI → BÀI TRẢ, không dùng chữ "Hành trình".

## Luồng

`/me` → Lớp học → chọn lớp → `/me/classes/<class_schedule.id>`

- Lớp có giáo trình với checkpoint thì vào thẳng **màn HỌC** (`ClassLearnView`):
  - Sơ đồ buổi dọc, buổi hiện tại tự mở, mỗi lúc chỉ một buổi mở.
  - Nội dung buổi = `LessonDocument` (khuôn SOLO01).
  - Bài trả có nút TRẢ BÀI và trạng thái ngay tại chỗ.
  - Bên dưới: **Các bạn vừa trả bài** (5 mục) + **[Xem thêm về lớp]**, dẫn sang trang cộng đồng lớp cũ (Hoạt động | Thành viên; nút "Vào học" để quay lại).
- Lớp có giáo trình nhưng chưa có checkpoint (SOLO01, HT2027 hiện nay): **chế độ giáo trình** (xem mục dưới). Lớp không có giáo trình: trang lớp cũ.
- RPC chưa có trên server (chưa migration): frontend tự lùi về trang lớp cũ. Nhờ vậy deploy frontend trước migration vẫn an toàn.

## Quyết định Owner (01/10/2026)

1. Checkpoint thuộc **chương trình + buổi**: khoá `C:<PROGRAM>:<buổi>:<id>`, ví dụ `C:SOLO01:4:4.1`. Thread đóng dấu `class_schedule_id`, `program_code`, `session_no`, `checkpoint_id` lúc nộp.
2. Quyền xem thread checkpoint: chính chủ · thành viên **cùng lớp** · Thầy/admin.
   - Thể hiện qua visibility mới `class` (mặc định), hoặc `private` (Chỉ Thầy).
   - Thread cũ (`course_lesson`) giữ `community | private` như trước; checkpoint không bao giờ thành `community`.
   - Feed chung / Tường / Hành trình của người khác chỉ lọc `community`, nên bài trả không lọt ra ngoài lớp.
3. DB (`class_lesson_content.blocks`) là nguồn runtime. TS là nguồn soạn + route `/solo01/buoi-NN`. Xem `docs/GIAO-TRINH-CHUAN.md`.
4. Pilot từ Buổi 1: không bulk.
   - Người học có quyền giáo trình (`class_curriculum_access`, Admin bật từng người) mở lớp lần đầu thì server mở Buổi 1.
   - Lớp chỉ bật khi giáo trình có ≥ 1 khối checkpoint.

## DB (`db/class_checkpoints_v1_setup.sql`)

**Bảng và ràng buộc**

- `learning_threads`:
  - Thêm loại `program_checkpoint` và cột `checkpoint_id`.
  - Visibility `class` chỉ dành cho checkpoint.
  - Mỗi checkpoint là một thread riêng (giới hạn "một thread / khoá" vẫn đúng, theo từng checkpoint).
- `learning_session_progress(learner_user_id, program_code, session_no, class_schedule_id, opened_at, completed_at, completed_class_schedule_id)`:
  - Unique theo (người, chương trình, buổi).
  - Trigger `lsp_guard_history`: `opened_at` bất biến, `completed_at` ghi một lần.
  - Ngoại lệ duy nhất: `set local tva.lsp_admin_override = 'on'` trong migration Admin tường minh.
  - RLS bật, không policy, REVOKE hết. Có trong `self_managed` của `rls_setup.sql`.

**RPC**

- `class_learning_state(p_class)` (volatile):
  - Bật khi: lớp có `program_code`, có giáo trình xuất bản chứa checkpoint, và người gọi là Thầy hoặc người học có quyền giáo trình.
  - Người học: `lsp_sync` mở Buổi 1, hoàn thành buổi đã đủ, mở buổi kế đã xuất bản. Trả về buổi + checkpoint + thread của chính mình.
  - Buổi khoá không lộ checkpoint.
- `lt_submit_checkpoint(p_class, p_session_no, p_checkpoint_id, body, media…, visibility)`. Server kiểm, không tin client:
  - Thầy không nộp.
  - Phải có quyền giáo trình lớp.
  - Checkpoint có thật trong blocks đã xuất bản của đúng buổi.
  - Đúng loại nộp (`accepts`).
  - Buổi đã mở với chính người nộp.

**Hoàn thành buổi**

- Trigger `learning_threads_checkpoint_passed` chạy khi `passed_at` chuyển null → có (`lt_respond` **không đổi**).
- Đủ mọi checkpoint required ĐẠT → `completed_at` → mở buổi lesson kế (bỏ qua dòng nghỉ).
  - Buổi kế chưa xuất bản thì chờ, mở lười khi đã xuất bản, để không chạy đồng hồ 7 ngày khi chưa có nội dung.
  - Buổi cuối: không có buổi kế, không lỗi.
- Idempotent: chấm lại không mở trùng, không đổi mốc, không bỏ hoàn thành.
- Buổi không có checkpoint required thì không tự hoàn thành.

**Thay 3 hàm** (cổng md5 = production 01/10, có dấu `CHECKPOINT_V1` để chạy lại an toàn)

- `lt_detail`: thêm nhánh cùng lớp + ngữ cảnh checkpoint.
- `lt_set_visibility`: theo loại thread.
- `social_class_activity`: thêm thread `class` cho thành viên lớp / Thầy.

## Giao diện

- Khối `checkpoint` trong `lessonTypes.ts`.
- `LessonDocument` render tĩnh. Phần tương tác cắm qua `CheckpointSlot` (`src/lesson/checkpointSlot.ts`), có `no-print`. Renderer không biết `/me`.
- Trạng thái tại checkpoint: TRẢ BÀI · Đã trả · Chờ chấm · Đã có phản hồi (+ Trả lại) · Cần làm lại (+ TRẢ LẠI) · Đạt · Xem cuộc trao đổi.
- **Nhịp tuần** (`sessionPace`, theo giờ server, chuẩn 7 ngày):
  - 🟢 xong trước hạn ≥ 2 ngày
  - 🟡 xong trong hạn
  - 🔴 xong sau hạn / đang quá hạn ("vẫn học tiếp bình thường")
  - Không khoá vì trễ. DB không lưu màu.
- Hàng đợi Thầy `/me/queue` giữ nguyên. Thẻ có "Bài trả 4.2 · …" + "SOLO01 · Buổi 04 · …" + lớp.
- `/me/t/<id>` có Trả lại + Mở giáo trình. Ghi chú Đạt đúng ngữ cảnh checkpoint.

## Test

- **DB:** `bash scripts/test-learning-threads-db.sh` — mục "LỚP CỦA TÔI V1":
  - Cổng md5, setup ×2, `rls_setup`, quyền.
  - Khoảng 70 ca SQL.
  - Rollback giữ dữ liệu / rollback sạch, drift.
- **FE:** `npm run test:class-social` (`class-checkpoints.test.tsx`, `curriculum-standard.test.ts`).
- **E2E:**
  - `PUPPETEER_DIR=… bash scripts/e2e-learning-thread.sh`: 73 kịch bản cũ, chưa có V1.
  - `E2E_CHECKPOINTS=1 …`: 73 kịch bản cũ trên DB đã migrate + 19 bước checkpoint.

## Triển khai production (chờ Owner GO)

1. `prod-db.py query db/class_checkpoints_v1_preflight.sql` → GATE PASS (đã PASS 01/10, 0 STOP).
2. `prod-db.py dryrun db/class_checkpoints_v1_setup.sql` → `migrate … --confirm wojmdilyflffvdtpovmq` → `query db/class_checkpoints_v1_postflight.sql` GATE PASS.
3. Merge main (FF) → Netlify deploy → smoke khách.
   - Frontend có thể đi trước DB.
   - Không có checkpoint trên production thì màn học chưa bật với lớp nào. An toàn.
4. **Pilot (dữ liệu, Owner quyết):**
   - Thêm khối `checkpoint` vào giáo trình SOLO01 qua Admin.
   - Cấp quyền giáo trình cho từng học viên pilot (Admin → Lớp học).
   - Bản nháp checkpoint đề xuất: chưa tạo. Nội dung bài trả do Owner chốt.
5. **Rollback:**
   - Frontend về main trước, rồi `db/class_checkpoints_v1_rollback.sql`.
   - Rollback luôn gỡ RPC/trigger và trả 3 hàm về bản cũ.
   - Bảng / cột / ràng buộc chỉ gỡ khi chưa có dữ liệu V1; có dữ liệu thì giữ.

## Kiến trúc V2 — TRANG LỚP (bản đồ) ⟂ TRANG BUỔI (phòng học) (02/10/2026)
- `/me/classes/<id>` = **bản đồ**: header lớp, 3 chặng, 24 buổi dọc, vạch nghỉ, trạng thái buổi, "Các bạn vừa trả bài", [Xem thêm về lớp].
  - KHÔNG render giáo án, KHÔNG tải blocks (`fetchClassOutline` chỉ đọc `session_id, status`).
  - Bấm buổi → Trang Buổi. Buổi khoá với người học: thấy nhưng nút bị vô hiệu.
- `/me/classes/<id>/sessions/<n>` = **phòng học**: "← tên lớp", `LessonDocument` của ĐÚNG buổi (tải một buổi), bài trả tại chỗ, ← Buổi trước / Buổi sau → (tôn trọng khoá).
  - Không bản đồ, không feed, không social.
  - Deep link + reload được; link được giữ qua bước đăng nhập (`keepsPathForGuest`).
- Quay lại: chuyển Buổi trước/sau THAY mục lịch sử (Trang Buổi luôn sâu một cấp dưới Trang Lớp).
  - "← Về lớp" = `history.back` nếu trang trước là `/me`, mở thẳng bằng link thì mở Trang Lớp.
  - Trang Lớp đưa dòng buổi vừa xem vào giữa màn hình (`sessionStorage`, một lần, 10 phút).
- Bảo mật: URL không vượt quyền.
  - Buổi khoá (người học, chế độ checkpoint) → không tải nội dung.
  - Không có quyền giáo trình → "chưa xem được giáo trình". `class_lesson_content` vẫn do RLS chặn ở server.
- Buổi hiện tại: `currentSessionNo()` (progress.ts) — chế độ checkpoint theo tiến độ server, chế độ giáo trình theo lịch.
  - Trình bày (`aria-current`, `is-current`) tách khỏi cách xác định → sau này đổi sang tiến độ cá nhân chỉ sửa hàm này.
- Code: `useClassLearning` (nạp chung), `ClassLearnView` (bản đồ), `ClassSessionPage` (phòng học), `resolveMeRoute` (`sessionPath` / `sessionFromPath`).
- alphaTab: `player.scrollMode = Off` trong `LessonScore` (mặc định Continuous tự kéo trang tới bản nhạc vừa khắc).

## Chế độ GIÁO TRÌNH (01/10/2026, main 79ff889) — không cần checkpoint
- `ClassPage`: `class_learning_state` enabled (có checkpoint) → chế độ checkpoint như trên. Nếu không: giáo trình đọc qua RLS SẴN CÓ
  (`fetchClassOutline`: học viên = thành viên + quyền giáo trình + đã xuất bản; Thầy/admin = tất cả) → `curriculumState()` → màn học.
  Không đọc được buổi nào → trang lớp cũ. Không migration, không nới quyền.
- Chế độ giáo trình: mọi buổi đã xuất bản mở; không nút trả bài, không tiến độ/màu; buổi hiện tại theo LỊCH (ngày giờ VN);
  buổi chưa có giáo án → "Nội dung buổi này đang được cập nhật."; dòng nghỉ = vạch ngăn (trước tiêu đề chặng kế).
- E2E thêm: `E2E_EXTRA_SQL` / `E2E_EXTRA_RUNNER` (dữ liệu thử chỉ nạp DB tạm, không commit).

## Production 01/10/2026 — LIVE (nằm im)
- Migration COMMIT sha256 1c3cb467… · postflight GATE PASS · dữ liệu cũ (thread/event/giáo trình/quyền/nhóm) giống hệt trước migration.
- main FF 6aa55c8 → 73ba625, Netlify bundle index-DrE2pUhc.js (trước: index-YnsdEQsE.js).
- Smoke bảo mật tự huỷ: `prod-db.py dryrun db/tests/class_checkpoints_v1_prod_smoke.sql` → SMOKE PASS 5/5 (lớp tạm trong giao dịch, ROLLBACK).
- Rollback: Netlify deploy trước / main 6aa55c8 TRƯỚC, rồi `prod-db.py migrate db/class_checkpoints_v1_rollback.sql`.

## Còn mở (ngoài V1)

- Loại nộp image / audio / quiz / interaction (cần hạ tầng upload / tương tác).
- Thông báo khi Thầy chấm.
- Tab "Lớp của tôi" của Feed (`social_feed_scoped`) chưa gồm bài trả `class`. Feed lớp lấy từ `social_class_activity`.
- Hợp nhất nguồn TS ↔ DB của giáo trình.
- Hệ xưng hô theo vai.
