---
name: project_journey_os
description: Tầm nhìn Journey Operating System cho /admin/schedule — lịch thật + Mira điều hành đào tạo cả năm
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Thầy đưa spec lớn (gợi ý ChatGPT, 2026-07-02): biến `/admin/schedule` thành **hệ điều hành hành trình học viên + tuyển sinh + mở lớp 1 năm**, không chỉ là lịch. Spec đầy đủ: **docs/JOURNEY-OS-SPEC.md** (đã push GitHub). Mira ĐỀ XUẤT, thầy DUYỆT.

4 tầng: lịch thật · tiến trình lớp · bản đồ hành trình · Mira đề xuất (xếp/gộp/mở lớp, ưu đãi). 5 khu: Dashboard · Calendar thật · Class Timeline · Journey Map · Mira Planner.

**Điểm mấu chốt cho việc build:** ĐÃ CÓ nền (đừng tạo bảng trùng) — `edu_courses` (=courses, có mã năng lực + hanhtrinh.ts prereq), `class_schedule` (=classes, đang lưu lịch dạng TEXT), `edu_enrollments`, nhóm Zalo ≡ mã lớp + trigger cấp khoá, Mira full-context. CẦN MỚI: dates thật + tự sinh `class_sessions` (từng buổi), status enum lớp/buổi, `class_demands` (nhu cầu chờ), `offer_campaigns` (ưu đãi), `mira_recommendations`; UI Mira Planner + rules (R1-R5).

**MVP 4 GĐ:** (1) lịch thật + tự sinh buổi + tiến trình + tính ngày kết thúc [NỀN]; (2) bản đồ hành trình; (3) nhu cầu + lớp nháp; (4) ưu đãi + Mira Planner. Đây là build NHIỀU PHIÊN. Liên quan [[project_hanhtrinh2027_boluat]], [[project_mira_assistant]], [[project_admin_ai_assistant]], [[project_cohort_hanhtrinh]].

**GĐ1 ĐÃ BUILD & LIVE (2026-07-02):** SQL `db/journey_os_stage1.sql` (ĐÃ chạy) — nâng `class_schedule` (start_date/weekday 0=CN..6=T7/start_time/duration_minutes/total_sessions/end_date/status enum 11 trạng thái/max-min_students, GIỮ cột text cũ cho trang tuyển sinh) + bảng MỚI `class_sessions` (từng buổi: session_number/start_at/end_at/status 6 trạng thái; RLS thầy-only, anon KHÔNG đọc → nhớ thêm 'class_sessions' vào self_managed nếu chạy lại rls_setup.sql). Sinh buổi Ở CLIENT khi lưu lớp (`src/journey/sessions.ts`: generateSessions cách 7 ngày/1 buổi/tuần, giữ buổi đã completed khi sửa lịch). UI: `ScheduleManager` có 3 tab — Danh sách (badge buổi X/8 + chấm status) · **Lịch tuần** (`src/journey/CalendarWeek.tsx`, lưới T2-CN, click buổi→popup đánh dấu đã dạy/huỷ/dời/bù/nghỉ) · **Chỉ số** (`src/journey/ScheduleDashboard.tsx`). Giả định 1 buổi/tuần (weekday là int, chưa hỗ trợ nhiều buổi/tuần). CÒN LẠI: GĐ2 bản đồ hành trình, GĐ3 nhu cầu+lớp nháp, GĐ4 ưu đãi+Mira Planner.
