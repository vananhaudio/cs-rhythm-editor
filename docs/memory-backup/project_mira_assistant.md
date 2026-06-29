---
name: project_mira_assistant
description: "Mira (class-ai) — trợ lý; đã cho truy cập dữ liệu mức 1+2, hướng tới trợ lý chăm sóc học sinh"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Mira = trợ lý AI ở trang tuyển sinh `class.vananhaudio.com` (Edge Function `supabase/functions/class-ai/index.ts`, chạy service_role, Verify JWT TẮT, dùng ANTHROPIC_API_KEY; deploy TAY trên Dashboard → Edge Functions, KHÔNG phải SQL Editor, không qua Netlify).

**ĐÃ LÀM (2026-06-29, đã deploy):** cho Mira truy cập dữ liệu:
- Mức 1: đọc danh mục khoá thật (`fetchCatalogText`) — tư vấn lộ trình.
- Mức 2: hồ sơ RIÊNG người đang đăng nhập (`fetchStudentText`) — xác thực token từ header Authorization (`db.auth.getUser(token)`), chỉ đọc dữ liệu của chính họ: khoá đã mở/chưa mở, level, XP. Không lộ học sinh khác. Khách ẩn danh → chỉ mức 1.
- Kiến thức tĩnh: bảng `class_ai_knowledge`. Lịch: Google Sheet (`fetchScheduleText`).

**ĐỊNH HƯỚNG TƯƠNG LAI (thầy muốn, CHƯA làm):** nâng cấp Mira thành **trợ lý CHĂM SÓC HỌC SINH đặc biệt** — chủ động đồng hành, nhắc bài kế tiếp/streak/ngày học gần nhất, động viên, có thể cá nhân hoá sâu hơn. Khi tiếp tục: cân nhắc thêm dữ liệu (edu_lesson_progress, edu_skill_progress, lịch học), tinh chỉnh persona, có thể mức 3 (Mira hành động thay — rủi ro cao, cần kiểm soát). Liên quan [[project_admin_ai_assistant]] (admin-ai), [[project_cohort_hanhtrinh]] (mở khoá qua đăng ký→Duyệt).
