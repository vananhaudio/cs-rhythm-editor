# JOURNEY OPERATING SYSTEM — /admin/schedule (spec)

> Tầm nhìn: `/admin/schedule` không chỉ là lịch — mà là **hệ điều hành hành trình học viên + tuyển sinh + mở lớp cả năm**. Mira quan sát dữ liệu → phát hiện cơ hội, cảnh báo rủi ro, ĐỀ XUẤT → **thầy DUYỆT** (Mira không tự quyết). Nguồn: gợi ý ChatGPT do thầy đưa (2026-07-02).

## 4 tầng
1. Lịch lớp thật · 2. Tiến trình từng lớp · 3. Bản đồ hành trình học viên · 4. Mira đề xuất (xếp/gộp/mở lớp, ưu đãi).

## 3 loại quyết định Mira hỗ trợ
- **Vận hành**: tối nay lớp nào · lớp KD17 buổi mấy · lớp nào sắp xong · ngày nào rảnh mở lớp.
- **Tuyển sinh**: tháng 8 mở lớp gì · đủ HV mở GL07 chưa · gộp lớp nào · nhóm nào đang chờ lịch.
- **Hành trình**: KD17 xong dẫn sang lớp gì · HV thiếu khoá nền nào · lớp nào cần nhắc ưu đãi.

## 5 khu màn hình
1. **Dashboard** (thẻ chỉ số): Hôm nay · Tuần này (số buổi) · Đang học · Sắp khai giảng · Sắp kết thúc · Cần xếp tiếp · Khung giờ trống.
2. **Calendar thật** (mặc định view Tuần; có Tháng). Block lớp: mã lớp · tên khoá · buổi hiện tại/tổng · trạng thái · giờ · cảnh báo.
3. **Class Timeline**: mỗi lớp 1 dòng ngang từ khai giảng → kết thúc.
4. **Journey Map**: bản đồ khoá (Nhập môn → Đệm 1/2/3, Tỉa 1/2/3, Nhạc lý…) + gắn lớp thật đang chạy vào từng mốc.
5. **Mira Planner** (`/admin/schedule/planner`): hỏi Mira · đề xuất mở lớp · gộp lớp · ưu đãi · hành động nhanh (tạo lớp nháp / khảo sát giờ / thông báo Zalo / tạo ưu đãi / gắn tag / danh sách chờ).

## Dữ liệu Mira cần (7 nhóm)
1. Khoá (mã, tên TM, số buổi, thời lượng, tiên quyết, khoá tiếp, khoá song song, đối tượng).
2. Lớp thật (mã lớp, khoá, lịch, khai giảng, số buổi, kết thúc dự kiến, trạng thái).
3. **Từng buổi học** (sinh buổi thật — không chỉ lịch lặp): số buổi · ngày · giờ · trạng thái → xử lý dời/nghỉ/bù/thêm buổi → ngày kết thúc luôn đúng.
4. Học viên (đã học gì, đang học lớp nào, combo, khung giờ, mức hoàn thành, khoá nên học tiếp, thuộc HT2026/27, ưu đãi).
5. **Nhu cầu chờ xếp lớp** (HV muốn học khoá X, khung giờ, ưu tiên, nguồn) → Mira gom.
6. Ưu đãi (tên, khoá, giá gốc/ưu đãi, hạn, quota, điều kiện, đối tượng, trạng thái).
7. Quy tắc gộp lớp (cùng trình độ · cùng mục tiêu · lịch tương thích · tiến trình lệch nhẹ · không giảm trải nghiệm).

## Bộ trạng thái
- **Lớp**: draft · recruiting · ready_to_open · scheduled · upcoming · active · ending_soon · completed · paused · cancelled · merged.
- **Buổi học**: scheduled · completed · cancelled · rescheduled · makeup · holiday.

## Bảng kỹ thuật đề xuất (LƯU Ý: EXTEND bảng sẵn có, đừng tạo trùng)
- `courses` ⇒ **đã có `edu_courses`** (thêm: totalSessions, durationMinutes, prerequisites, nextCourses, parallelCourses; đã có code/mã năng lực).
- `classes` ⇒ **đã có `class_schedule`** (thêm: startDate/endDate thật, weekday, startTime/endTime, status enum, maxStudents/minStudents, note).
- `class_sessions` (MỚI): classId, sessionNumber, title, startAt, endAt, status, note.
- `student_journeys` (MỚI hoặc suy từ dữ liệu): currentStage, completedCourses, activeClasses, recommendedNextCourses, missingPrerequisites, journeyPackage.
- `class_enrollments` ⇒ **đã có `edu_enrollments`** (thêm status/paymentStatus/source nếu cần).
- `class_demands` (MỚI): studentId, courseCode, preferredDays, preferredTimes, priority, source, status.
- `offer_campaigns` (MỚI): name, courseCode, packageCode, originalPrice, offerPrice, startAt, endAt, quota, usedQuota, targetRules, status.
- `mira_recommendations` (MỚI): type (open_class/merge_class/continue_journey/early_bird_offer/schedule_warning/capacity_warning), title, reason, priority, relatedClassIds, relatedStudentIds, suggestedAction, status, approvedAt.

## Mira suy luận bằng RULE (trước, chưa cần AI phức tạp)
- R1 lớp còn 1-2 buổi → đề xuất lớp tiếp nối (theo nextCourses + HV đủ điều kiện + khung giờ).
- R2 nhiều HV chờ 1 khoá vượt ngưỡng → gom theo khung giờ → đề xuất mở.
- R3 ngày quá nhiều lớp → cảnh báo quá tải, không đề xuất thêm.
- R4 HV đủ nền (DH2/TN2) → nhóm tư vấn HT2027 + ưu đãi đăng ký sớm.
- R5 lớp nháp đạt 70-80% sĩ số → nhắc đẩy truyền thông/giữ chỗ.

## Dẫn dắt lớp theo mốc buổi (kịch bản 8 buổi)
B1 giới thiệu vị trí trong hành trình · B3 kiểm tra bám lớp/nhắc luyện app · B5 gieo nhận thức khoá tiếp (không bán mạnh) · B7 chốt hướng + khảo sát giờ + mời đăng ký sớm · Sau B8 đánh dấu hoàn thành + gợi ý khoá tiếp + gắn tag + tạo nhu cầu.

## Lớp nháp (draft)
Lớp dự kiến, chưa chắc, đặt lên lịch (màu nhạt/nét đứt) để thấy kế hoạch; gom HV quan tâm + ghi nhận đăng ký sớm; đủ điều kiện → chuyển lớp chính thức.

## Màu theo TRẠNG THÁI VẬN HÀNH (không theo khoá)
Xanh đang học · Vàng sắp KG/KT · Đỏ xung đột/thiếu HV · Xám nháp · Tím HT2026/27. Icon: ● ▲ ★ ⚠ ◇.

## MVP 4 giai đoạn
1. **Lịch thật + tiến trình**: tạo lớp · tự sinh buổi · calendar tuần/tháng · buổi hiện tại/tổng · tính ngày kết thúc · đánh dấu buổi đã học. (NỀN MÓNG)
2. **Bản đồ hành trình**: khoá thuộc nhánh, trước/sau, lớp ở mốc nào, HV ở đâu.
3. **Nhu cầu mở lớp + lớp nháp**: HV chọn lớp muốn học, khung giờ, gom nhu cầu, lớp nháp, Mira đề xuất mở.
4. **Ưu đãi + Mira Planner**: chính sách đăng ký sớm, quota, danh sách phù hợp, đề xuất tư vấn/gộp, kế hoạch 12 tháng.

## Tư tưởng
Schedule chỉ là lớp vỏ — bên trong là **Journey Operating System**. Mỗi lớp = 1 chặng trong hành trình HV. Mỗi buổi = 1 mốc để Mira biết khi nào nhắc/dẫn dắt/tư vấn. **Mira đề xuất, thầy duyệt.**
