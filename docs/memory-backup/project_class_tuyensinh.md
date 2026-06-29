---
name: project-class-tuyensinh
description: "Trang tuyển sinh class.vananhaudio.com — bàn giao đã nghiên cứu, chốt làm route trong app; chưa code"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Trang tuyển sinh **class.vananhaudio.com** — cổng "có đạo diễn" (showcase → tư vấn → tự đăng ký → thanh toán), thay dây chuyền làm tay. Khách đã "ấm" từ MXH/Zalo. Triết lý: đạo diễn theo TÂM LÝ (`trạng thái tâm lý → đạo cụ → 1 hành động nhỏ`), "vừa show vừa ẩn" (người mới thấy 3 cửa; bản đồ 10 khóa ẩn trong modal), chat là 1 khối tư vấn không phải cả trang.

**Gói bàn giao:** `~/Downloads/ban giao trang tuyen sinh.zip` — 3 file PROTOTYPE (không phải production): `class-vananhaudio.html` (landing, lead chỉ console.log), `class-vananhaudio-admin.html` (admin, lưu localStorage), `tva-step1-tables-rls.sql`. + `BAN-GIAO-class-vananhaudio.md` (đặc tả đầy đủ: 15 mục).

**Quyết định đã chốt (2026-06-22):**
- Trang dựng làm **ROUTE trong app cs-rhythm-editor** (vd `/class`), dùng chung Supabase + Netlify, sau trỏ domain class.vananhaudio.com về. KHÔNG site riêng.
- Trạng thái: **CHỈ NGHIÊN CỨU, CHƯA CODE** — thầy chuẩn bị "đạn" + bàn thêm trước.

**2 phát hiện kỹ thuật quan trọng (đừng quên):**
1. **Mục 12 (bảo mật) ĐÃ LỖI THỜI.** Tài liệu lo "RLS tắt, anon đọc 577 học sinh" — nhưng [[rls_setup.sql]] đã chạy từ 2026-06: RLS bật mọi bảng, anon chỉ SELECT 6 bảng nội dung (edu_courses/modules/course_lessons/tools/flows/timming_songs), không đọc PII. ⇒ **KHÔNG chạy Phần 4 SQL bàn giao**. showcase_* trên edu_courses tự được anon đọc.
2. **Bẫy tích hợp RLS:** `db/rls_setup.sql` quét mọi bảng → xóa sạch policy → tạo lại. Nếu thêm `articles`/`leads` với policy rời, chạy lại rls_setup sẽ XÓA mất (form gãy, landing hết đọc bài). ⇒ phải đăng ký articles/leads vào CHÍNH rls_setup (giống mảng `self_managed` của tính năng Cộng đồng): articles→anon SELECT where published; leads→anon INSERT.

**Khối lượng (4 mảng, làm dần):**
1. SQL: bảng `articles`, `leads`, cột `edu_courses.showcase_for_who/showcase_desc/showcase_learn(jsonb)` + tích hợp RLS đúng cách (an toàn, làm ngay được).
2. Admin: thêm 2 tab vào TeacherAdminPage — **Bài viết** (CRUD articles) + **Đăng ký** (leads, đổi status: Mới/Cần gọi/Đã tư vấn/Đã đóng phí/Chưa phù hợp).
3. Trang /class React: đọc articles + edu_courses.showcase_*, ghi leads. Bố cục: hero → 3 cửa vào → 6 thẻ showcase → chat → lớp sắp KG → quyền lợi (990k) → form → thanh toán (ẩn) → sau thanh toán → app → thầy/FAQ/CTA.
4. Sau: lớp đọc từ Google Sheet + bảng đo nhu cầu (chiều ngược: gom nhu cầu chưa có lớp); cổng thanh toán thật + kích hoạt tài khoản; AI chat 3 bên (HS↔AI↔Thầy).

**3 cửa vào (theo quan hệ với hát, không generic mới/cũ):** (1) vừa đàn vừa hát → Đệm hát căn bản TĐ1; (2) chơi giai điệu → Tỉa nốt căn bản TĐ1; (3) đã chơi nhưng bí cảm âm → Tỉa nốt âm giai & cảm âm TĐ2 (→ chat xếp trình độ).

**Học phí:** 990.000đ/khóa · 2 tháng · 8 buổi (~90'/tuần). Nhập môn & Nhạc lý căn bản FREE. Mã `TD2.` = trình độ 2; mã gốc (GL11, KD17) = trình độ 1. Zalo 0983 259 893. Chủ TK: VAN ANH AUDIO.

**Kiến trúc dữ liệu lead↔học sinh (chốt 2026-06-22):**
- 2 LỚP, 1 màn quản trị. KHÔNG dồn mọi người vào edu_students.
- **Lớp CRM `leads`** = mọi người quan tâm (học thử lớp, dùng thử app, đăng ký). status phễu: Mới→Cần gọi→Đã tư vấn→Học thử/Dùng thử app→Đã đóng phí→Chưa phù hợp; path lộ trình.
- **Lớp học sinh thật `edu_students`+auth** = chỉ tạo khi cần đăng nhập app. Nối ngược về lead qua email/`lead_id`.
- **Học thử LỚP (Zoom) ≠ dùng thử APP:** học thử lớp chỉ là `leads` (không cần TK). Dùng thử app CẦN tài khoản.
- **Phân nhóm chính = LOẠI TÀI KHOẢN** `student_type`: trial / paid / free → để phân quyền mở khóa trong app (khớp tier free/basic/standard/pro sẵn có).
- **Dùng thử app 7 ngày: TẠO TÀI KHOẢN NGAY khi đăng ký** (nhóm trial). ⇒ cần: trường `trial_expires_at`, cơ chế giới hạn/khóa khi hết hạn (check-on-login hoặc cron), dọn TK hết hạn.
- ⚠️ **Ràng buộc kỹ thuật:** trang dùng anon key — anon KHÔNG tạo được auth user / ghi edu_students (RLS chặn). ⇒ tạo TK trial phải qua **Edge Function service_role** (giống [[project_admin_ai_assistant]] — function `admin-ai` tạo TK học sinh, mk mặc định 12345678). Cần function tương tự gọi được từ trang công khai (rate-limit/chống lạm dụng).

**Trợ lý AI tuyển sinh (Pha 1, 2026-06-23):** đã code+push, CHỜ thầy deploy.
- Edge Function **`class-ai`** (`supabase/functions/class-ai/index.ts`) — ẩn danh gọi được (Verify JWT TẮT), giữ khoá Anthropic + service_role; model mặc định `claude-sonnet-4-6` (đổi được trong admin); ghép persona + bộ kiến thức + lịch sử → gọi Anthropic; ghi `class_chat_messages`. Dùng chung secrets với admin-ai.
- SQL `db/class_ai_setup.sql`: bảng `class_ai_config` (persona/model/greeting/enabled, 1 dòng), `class_ai_knowledge` (tài liệu thầy nạp, bật/tắt), `class_chat_sessions`, `class_chat_messages`. RLS authenticated-full, anon KHÔNG truy cập trực tiếp (mọi thứ qua function service_role).
- Chat thật trên /class (`ClassLandingPage` chatSendText → `supabase.functions.invoke('class-ai')`); chưa deploy thì rơi mềm sang "nhắn Zalo thầy".
- Tab admin **"💬 AI khách"** (`ClassAiAdmin.tsx`): xem hội thoại AI↔khách + Huấn luyện AI (sửa persona/model + CRUD bộ kiến thức — thầy dán tài liệu dày vào đây để tăng tự quyết cho AI).
- 2 việc thầy phải làm: chạy SQL + deploy function (Verify JWT TẮT).
- Quyết định: AI TỰ trả lời (không duyệt trước) ở pha 1; sức mạnh từ bộ kiến thức. Pha sau: duyệt-trước realtime 3 bên + AI xuyên suốt hỗ trợ học sinh.
- ⚠️ Anthropic credit: thầy xác nhận ĐÃ có (2026-06-23) — khác ghi chú cũ "chờ nạp" ở [[project_admin_ai_assistant]].

Liên quan: [[project_lms_roadmap]], [[project_admin_ai_assistant]].
