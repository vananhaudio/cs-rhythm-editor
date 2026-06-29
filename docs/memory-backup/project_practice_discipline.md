---
name: project_practice_discipline
description: "Cơ chế \"kỷ luật luyện tập\" — phiên + màu kỹ năng đỏ/vàng/xanh, tách trục Học vs Kỹ năng; chốt 2026-06-24"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Tầng "kỷ luật luyện tập" trên bài tương tác (ChordLesson) — chốt với thầy 2026-06-24, lấy ý từ trao đổi ChatGPT.

NGUYÊN TẮC:
- Tách **2 trục tiến độ**: HỌC (đã mở/xong bài — `edu_lesson_progress`) vs KỸ NĂNG (đỏ/vàng/xanh — `edu_skill_progress`). Độc lập với free/paid.
- **1 phiên = tập đủ số vòng (KHÔNG gate mic)** — mic chỉ phản hồi đúng/sai. Màu theo BÀI (vì bản đồ hiện theo bài), không theo từng drill.
- **3 phiên → 🟢 xanh** (1=🔴, 2=🟡). "Xanh ≠ hoàn hảo, = đã luyện đủ vòng cơ bản".
- Khóa MỀM: không chặn học tiếp; chỉ nhắc quay lại xanh hóa. "Đi xa = mở bài mới · Đi chắc = xanh hóa bài cũ".

ĐÃ LÀM:
- GĐ A: ChordSeqTrainer đếm MỌI vòng đã tập (`loops` prop, bỏ gate mic); ChordLesson màn hoàn thành = "Xong 1 phiên" + thẻ màu 3 chấm + nhắc nghỉ 1-2' + "Tập thêm 1 phiên/Dừng". Ghi nhận qua RPC `record_skill_session(p_student,p_lesson)` → trả tổng phiên. Bảng `edu_skill_progress(student_id,lesson_id,sessions)`. SQL: `db/skill_progress_setup.sql`. Native lesson nhận thêm `studentId/lessonId` (portal truyền).
- GĐ B: MobileStudentPortal nạp skillMap; dòng bài hiện 🔴/🟡/🟢 + "X/3 phiên"; card "🎯 Việc nên làm hôm nay" liệt kê bài đỏ/vàng (1-2 phiên) trong khoá → mở để luyện thêm.

CẦN THẦY: chạy `db/skill_progress_setup.sql`. Loop/drill = 4 vòng (ChordLesson), 3 phiên→xanh — con số tạm, chỉnh được.

CHƯA LÀM (gợi ý sau): nhắc mềm khi học quá nhanh nhiều bài đỏ; giới hạn "1-2 bài/ngày"; "việc hôm nay" xuyên khoá (hiện chỉ trong khoá đang mở). Liên quan [[project_elearn_engine]] [[project_freemium_percourse]].
