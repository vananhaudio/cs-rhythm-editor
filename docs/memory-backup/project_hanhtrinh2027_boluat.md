---
name: project_hanhtrinh2027_boluat
description: Bộ luật Hành trình 2027 — bản đồ học + luật mở khoá theo tiên quyết + học vượt cấp + cảnh báo nền tảng
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Thầy soạn **BỘ LUẬT HÀNH TRÌNH 2027** — bản CHÍNH THỨC có HỆ MÃ (2026-07-01). Lưu đầy đủ tại **docs/HANHTRINH-2027-BO-LUAT.md** (đã push GitHub).

**CỐT LÕI: QUẢN LÝ THEO MÃ, không theo tên.** Mã năng lực (ổn định): NM · DH1/2/3 · DHNC · TN1/2/3 · NL1/2/3 · SOLO. Mã lớp = `[mã năng lực].[dạng lớp][số 2 chữ số]` vd DH1.KD16 (dạng lớp: DH1/DH2=KD, DH3=BP, TN=GL). Tên thương mại = nhãn hiển thị (map ở mục 7 của doc → khớp edu_courses; TN2/NL2 tên hơi khác cần rà). Hiển thị: App học sinh = logo mã + tên năng lực + tên thương mại (KHÔNG số khóa/mã lớp); Web tuyển sinh = "Tên TM — Khóa N | Mã lớp" 2 tầng (mục 10 — GIỮ NGUYÊN, đang tốt); Admin/AI = mã. → NÊN thêm cột `code` (mã năng lực) vào edu_courses làm khoá gốc; class_schedule.code = mã lớp.

Tóm tắt luật:

- **Cửa vào:** Nhập môn Guitar (free, bắt buộc) → mới mở bản đồ.
- **3 nhánh ngang hàng:** Đệm hát (1→2→3), Tỉa nốt (1→2→3), Nhạc lý (1→2). Rồi Đệm hát Nâng cao → Solo Guitar.
- **Tiên quyết mở khoá:** Đệm2 = Đệm1+Nhạclý1; Tỉa2 = Tỉa1+Nhạclý1; Đệm3 = Đệm2+Nhạclý2; Tỉa3 = Tỉa2+Nhạclý2. Nâng cao = đủ Đệm1-3 + Tỉa1-3 + Nhạclý1-2. Solo = Nâng cao.
- **Học vượt cấp:** thầy kiểm tra + phê duyệt → mở khoá giữa chừng; khoá nền chưa xong VẪN hiện (mờ + chỉ mục lục + cảnh báo đỏ "thiếu nền tảng" → kích thích học bổ sung).
- **6 trạng thái khoá:** chưa mở / được mở / đang học / đã hoàn thành / học vượt cấp / thiếu nền tảng.

**ĐÃ BUILD (2026-07-01) — nền mã + đồng bộ:** (1) cột `edu_courses.code` (mã năng lực) + ô "Mã" trong CourseEditor; gán qua db/course_code_assign.sql (NM/DH1-3/DHNC/TN1-3/NL1/NL3/SOLO; NL2 trống). (2) `src/hanhtrinh.ts` = config bộ luật (DANG_LOP, PREREQ, BRANCH, buildClassCode='DH2.KD16', soFromClassCode). (3) ScheduleManager: chọn khoá chính → mã năng lực → tự sinh **mã lớp** (số khoá thầy gõ); **nhóm Zalo ≡ mã lớp** tự upsert edu_groups(code=mã lớp) — chỉ dán link Zalo (cột edu_groups.code, db/group_code_setup.sql). (4) admin-ai `propose_schedule` đổi input → chỉ {nangLuc, so, schedule, start}; AI hỏi gọn 4 câu; createSchedule ghép mã lớp + gắn khoá chính (byCode) + tạo nhóm Zalo theo mã. ⚠️ Cần chạy course_code_assign.sql + group_code_setup.sql + RE-DEPLOY admin-ai.

**ĐĂNG KÝ 1-CHẠM ĐÃ BUILD (2026-07-01):** trigger `grant_class_courses_on_join()` trên edu_group_members — học sinh vào NHÓM ZALO của lớp (nhóm.code = mã lớp = class_schedule.code) → tự enroll + edu_course_access các course_ids của lớp (db/class_course_grant_trigger.sql). Học sinh CŨ đã ở nhóm: hàm `backfill_class(mã)` cấp bù (db/backfill_class_gl11.sql). ⚠️ Nhóm Zalo CŨ (tạo trước hệ mã) có mã trong TÊN nhưng cột code=NULL → phải gắn code tay 1 lần (đã làm GL11, KD17). admin-ai addToGroups khớp/tạo nhóm theo mã lớp. AI được nạp FULL ngữ cảnh (bộ luật + khoá[mã] + nhóm[mã] + lớp+course_ids). GL11=NM+NL1+TN3; KD17=NM+NL1+DH1 (pattern: NM cửa vào + NL1 nền + khoá chính). Chạy: class_course_grant_trigger.sql (bắt buộc), redeploy admin-ai.

**CẢNH BÁO THIẾU NỀN TẢNG (§6 học vượt cấp) ĐÃ BUILD (2026-07-03):** helper `missingPrereqs(code, ownedSet)` trong hanhtrinh.ts (dùng PREREQ, bỏ NM vì free). "Đã sở hữu mã C" = có enrollment active với course.code=C. **Mobile (MobileStudentPortal — mặt chính):** (a) khi vào khoá tiên quyết mà thiếu nền → banner ĐỎ "Thiếu nền tảng" ở đầu danh sách bài; (b) mục "Nền tảng còn thiếu" ở Home = thẻ MỜ các khoá tiên quyết CHƯA sở hữu (fetch edu_courses theo mã thiếu), bấm vào chỉ lộ MỤC LỤC (bài khoá lại, ẩn tiến độ/bản đồ, thông báo mời mở khoá); openCourse chặn auto-nhảy bài cho khoá chưa sở hữu. **Desktop /course (LessonViewerPage):** chỉ banner cảnh báo (load ownedCodes từ enrollments). Commits e0cc26b (mobile), edf2e09 (desktop). **THẦY CHỐT (2026-07-04): CHỈ cảnh báo bằng chữ, KHÔNG làm nút mua/mở khoá — học viên tự biết cách liên hệ. ĐỪNG thêm nút.** CHƯA làm: 6-trạng-thái đầy đủ + tự mở theo PREREQ.

**HỌC VIÊN HÀNH TRÌNH (HT2026/27) — FULL KHOÁ + HỌC TUẦN TỰ ĐÃ BUILD (2026-07-04):** Cohort HT cũ đã gỡ; nay nhận diện bằng **cờ `edu_students.ht_member`** (thầy tick ở StudentProfile tab Khoá → nút bật cờ gọi RPC `grant_all_courses(student)` cấp TOÀN BỘ khoá status='on' = enroll+access). db/ht_member_setup.sql. Khác cảnh báo "thiếu nền tảng" (mềm, cho đặc cách): HT bị **CHẶN CỨNG** — khoá cấp trên chỉ mở khi **hoàn thành hết bài cấp dưới** (PREREQ + edu_lesson_progress: mã năng lực "đã hoàn thành" = mọi lesson của khoá đó completed). MobileStudentPortal: `completedCodes`/`isSeqLocked`/`seqLockMissing` (dùng courseLessonIds gom từ master-journey); thẻ khoá khoá hiện 🔒 + "Hoàn thành X để mở"; openCourse guard. Commit a90e8d3. **DESKTOP cũng chặn (commit 8e3dacc):** LessonViewerPage /course — effect tính seqLockNames (fetch khoá theo mã tiên quyết → modules → lessons → edu_lesson_progress; khoá CHƯA dựng thì bỏ qua) → early-return MÀN KHOÁ "Chưa mở khoá này · Hoàn thành X trước" nếu còn mã tiên quyết chưa xong. Cần chạy db/ht_member_setup.sql.

CÒN LÀM (chưa build): bản đồ trạng thái phía học sinh (6 trạng thái) + tự mở theo PREREQ. Spec đầy đủ: Khi làm cần: (1) map tên trừu tượng (Đệm1/2/3, Tỉa1/2/3, Nhạclý1/2, Nâng cao, Solo, Nhập môn) → edu_courses THẬT (thầy phải chốt, nhất là Nhạc lý 1 vs 2); (2) mô hình tiên quyết (prereq) per course; (3) hoàn thành khoá = dựa edu_lesson_progress; (4) render trạng thái + cảnh báo ở [[project_lms_roadmap]] MobileStudentPortal (bản đồ hành trình); (5) học vượt cấp tái dùng edu_course_access ([[project_cohort_hanhtrinh]] vòng đăng ký→duyệt). Liên quan [[project_lesson_philosophy]].
