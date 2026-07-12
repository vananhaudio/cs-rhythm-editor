---
name: project-admin-ai-assistant
description: "Tab \"Trợ lý AI\" trong /admin tạo tài khoản học sinh qua Edge Function admin-ai (Supabase)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

Tính năng "admin copilot" (chốt + dựng 2026-06-20): tab **🤖 Trợ lý AI** trong `/admin` — thầy chat → AI ĐỀ XUẤT tài khoản học sinh → thầy DUYỆT → mới tạo (triết lý "AI gợi ý, thầy chốt"). UI: `src/AiAssistant.tsx`, gắn vào `src/TeacherAdminPage.tsx` (thêm section `'assistant'` — 1 bảng /admin DUY NHẤT, không trang mới).

**Động cơ ẩn = Supabase Edge Function `admin-ai`** (`supabase/functions/admin-ai/index.ts`), deploy THỦ CÔNG qua Dashboard → Edge Functions → "Via Editor" (dán code). ⚠️ KHÔNG auto-sync từ git — sửa code phải re-paste + Deploy lại. Cấu hình bắt buộc: (1) **TẮT** "Verify JWT with legacy secret" ở Settings (hàm tự kiểm quyền; bật sẽ chặn CORS preflight → lỗi "Failed to send a request"); (2) CORS `Access-Control-Allow-Headers` phải có `apikey, x-client-info`; (3) secret `ANTHROPIC_API_KEY` set ở Edge Functions → Secrets — **dùng CHUNG khoá `sk-ant` với app [[reference_kho_tri_thuc]]** ⇒ phải NẠP CREDIT Anthropic (đã gặp lỗi "credit balance too low"). Env tự có: SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY (deprecated nhưng vẫn chạy). Model: `claude-haiku-4-5`.

Hàm verify teacher: lấy uid từ JWT (`anon.auth.getUser(jwt)`) → query role bằng service_role `app_users.role in (teacher,admin)`. Tạo TK = `auth.admin.createUser({email,password,email_confirm:true})` → INSERT `edu_students(user_id,full_name,email,is_active,level:'beginner',enrolled_at)`. **KHÔNG ghi `app_users`** (học sinh nhận diện qua edu_students; app_users chỉ teacher/admin). **KHÔNG auto-enroll khoá nữa** (chốt A 2026-06-20 — học sinh mới bắt đầu TRỐNG, thầy tự gán khoá ở /admin → Học viên → tab Khoá học). Bug liên quan đã sửa ở `StudentProfile.handleEnroll`: "thêm khoá" phải BẬT LẠI dòng `edu_enrollments` cũ (is_active=true) thay vì insert trùng (huỷ khoá = is_active=false, KHÔNG xoá dòng).

**Gán nhóm Zalo (thêm 2026-06-20):** Trợ lý AI còn gán học sinh vào nhóm — tool `propose_group_add({assignments:[{studentEmail,groupName}]})` + action `add_group` → resolve email→`edu_students.user_id`, groupName→`edu_groups.id` (ilike), upsert `edu_group_members(user_id,group_id,source:'admin',status:'active')` onConflict user_id,group_id (bảng CÓ unique). AI biết danh sách nhóm qua system prompt (chat action fetch `edu_groups`). Hiển thị phía học sinh ĐÃ CÓ SẴN: `MobileStudentPortal` gọi RPC `my_groups()` → mục "Cộng đồng của bạn". ⇒ bỏ luồng claim-link `/join-group/<token>` (mong manh trong webview Zalo: localStorage/phiên hay mất). AiAssistant UI xử lý 2 loại proposal (type 'students'|'group').

**XẾP LỊCH LỚP (thêm 2026-06-29):** AI tạo/xếp lịch lớp — tool `propose_schedule({classes:[{code,name,section,schedule,start,duration,price,courseNames[],groupName}]})` + action `create_schedule` → resolve tên khoá/nhóm→id (fuzzy), insert `class_schedule` (bảng Lịch lớp, db/class_schedule_setup.sql). chat action nạp thêm danh sách edu_courses vào system prompt để AI gắn khoá. 1 lớp = nhiều khoá (course_ids[]) + 1 nhóm (group_id). UI AiAssistant loại proposal thứ 4 ('schedule'). Tab admin quản lý lịch: ScheduleManager. Nền cho ĐĂNG KÝ 1-CHẠM (Bước 2 chưa làm: học sinh đăng ký lớp → thầy duyệt → tự tạo TK+nhóm+mở khoá).

**RESET MẬT KHẨU (thêm 2026-06-29):** Trợ lý AI đặt lại mật khẩu học sinh — tool `propose_reset_password({resets:[{studentEmail,password?}]})` + action `reset_password` → resolve email→edu_students.user_id → `auth.admin.updateUserById(uid,{password})`, trả mật khẩu mới. AiAssistant UI xử lý loại proposal thứ 3 ('reset'). Cùng khuôn AI-đề-xuất→thầy-duyệt, chỉ teacher gọi. ⚠️ Phải RE-DEPLOY admin-ai (Dashboard) mới có tác dụng.

**Mật khẩu mặc định `12345678`** (AiAssistant fill ở frontend nếu thầy không nói mật khẩu khác). Học sinh tự đổi: `MobileStudentPortal` modal "Hồ sơ của tôi" → **Đổi mật khẩu** (`auth.updateUser`, KHÔNG cần email). Đưa mật khẩu cho học sinh qua Zalo (không gửi email tự động).

**BUG quan trọng đã fix:** `edu_students` KHÔNG có unique constraint trên `user_id` ⇒ phải dùng `.insert(...)` (KHÔNG `.upsert({onConflict:'user_id'})` — sẽ lỗi "no unique or exclusion constraint matching the ON CONFLICT"). Lưu ý `StudentOnboarding.tsx:210` vẫn còn dùng upsert onConflict user_id = bug tiềm ẩn (đường IAP hiếm chạy). Hàm có rollback: lỗi sau createUser thì `auth.admin.deleteUser` để tránh mồ côi.

**Trạng thái: ĐÃ CHẠY end-to-end 2026-06-20** (nạp credit Anthropic xong → tạo TK thành công, hiện ✓ + mk 12345678). CÒN LÀM: (1) chưa thêm Đổi-mật-khẩu vào `StudentPortalV2` (desktop); (2) chưa có "xoá học sinh" trong admin — đề xuất thêm cho Trợ lý AI sau (có em nghỉ học sẽ cần); (3) cài Supabase CLI để deploy hàm bằng `supabase functions deploy admin-ai` thay vì dán tay Dashboard mỗi lần. Tránh đụng file GuitarBoard (chat khác đang sửa `ScoreTabViewerAlpha.tsx`).
