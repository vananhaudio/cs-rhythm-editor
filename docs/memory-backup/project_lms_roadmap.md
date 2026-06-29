---
name: project_lms_roadmap
description: "Lộ trình cải tiến LMS TVA Guitar theo HỌC-TẬP-SỐNG; đợt HỌC-TẬP đã ship+verify, các trục còn lại"
metadata: 
  node_type: memory
  type: project
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

Ngày 2026-06-17 chạy workflow audit 5 mặt → lộ trình cải tiến theo triết lý HỌC–TẬP–SỐNG. Chẩn đoán cốt lõi: nhiều cơ chế đã viết code nhưng CHƯA nối dây ("lời hứa vỡ") → giá trị lớn nhất là kích hoạt code có sẵn, không phải viết mới.

**ĐÃ SHIP & VERIFY LIVE (2026-06-17) — đợt HỌC-TẬP:**
- XP thật khi xong bài (markComplete +50, lần đầu) & flow (FlowPlayer reward_xp) — trước chỉ khoe không cộng.
- 5 chấm tiến trình journey trên thẻ bài hát (tab Tập).
- Sửa bug TRÙNG BÀI: handleAddSong giờ mở Tempo kèm `songId` → TapTempoTool cập nhật đúng bài thay vì tạo dòng student_songs thứ 2. Nối markStepDone bước 'tempo' (+100 XP + 👑) khi đóng Tempo (closeTool re-fetch, xác nhận bằng data).
- Quiz hiện trên mobile (MobileStudentPortal nối QuizViewer) + guard JSON thô desktop.

**CÒN LẠI (chưa làm), theo ưu tiên:**
- Trình soạn quiz trực quan (trục CONTENT) — DB chưa có bài quiz thật vì phải gõ JSON tay. QuizViewer schema: multiple_choice dùng `data.options`+`answer.correct`(string); true_false `answer.correct`(boolean); QuizViewer named export, tự guard quizData rỗng.
- markStepDone cho timing/nhip/hat/dan: BMS (SongBuilderPage) chưa ghi gì khi xong; nhip/hat/dan route=null (chưa có tool). Bước cuối "Đàn/Hát" → nộp video thầy duyệt (trục SỐNG).
- Streak + mục tiêu phút/ngày: XP_SOURCE.streak=200 khai báo nhưng CHƯA có logic (tính từ student_practice_log.practiced_at).
- Tab SỐNG gần như rỗng → bảng xếp hạng lớp (classRank đã tính sẵn), khoe huy hiệu.
- parseOutline nhập được mô tả (47% bài đang rỗng); nút copy-prompt sinh JSON flow/quiz.
- Android/CH Play (đang làm 2026-06-17): ĐÃ thêm @capacitor/android@8 + nâng cli@8 + resources/icon.png (1024 từ icon iOS), commit 85ae4ef. Blocker billing ĐÃ GỠ: Android = vỏ tải web live, đăng-nhập-là-dùng, panel IAP khóa iOS-only nên Android KHÔNG có mua bán → app MIỄN PHÍ hợp lệ Play (học viên dùng tài khoản thầy tạo qua Zalo; chưa có tự-đăng-ký Android). cap add android + build .aab chạy TRÊN MÁY THẦY (Node≥22 + Android SDK; ở đây Node v20 không chạy cap v8 được). applicationId com.vananhaudio.guitar. Privacy: timming.vananhaudio.com/tvaprivacy. Data safety: khai có thu thập email. server.url → deploy web là app Android tự cập nhật. BMS đã lên CH Play (tiền lệ).
- Dữ liệu cũ: ĐÃ dọn 2026-06-17 — toàn DB chỉ có 1 bài trùng (do thêm 2 lần, cả 2 đều có journey; KHÔNG phải kiểu bug Tempo journey_len=0), đã xóa dòng bỏ dở giữ dòng đầy đủ. Không còn trùng.
- Nợ git: khối GuitarBoard AlphaTab + scoreImporter.ts + CAPPlugins.m còn uncommitted/untracked (làm chậm theo [[feedback_guitarboard_pace]]).

**Tính năng "Cộng đồng của bạn" (đang làm, 2026-06-17):** Facebook chung (mọi học viên) + nhóm Zalo riêng gán theo lớp. KHÔNG xây chat trong app (né Apple 1.2 UGC); chỉ link ra Zalo/FB (link cộng đồng OK với Apple, chỉ cấm link THANH TOÁN). Mô hình nhiều-nhiều. Học sinh CŨ tự xác nhận nhóm bằng claim-link (token gửi trong nhóm Zalo) → khỏi dò email; học sinh MỚI phân luồng lúc đăng ký.
- **Phần 1 (SQL nền) ĐÃ chạy + verify live 2026-06-17:** `db/community_setup.sql` = `edu_groups`/`edu_group_members`/`edu_group_claim_tokens` + RPC `is_teacher`/`claim_group(token)`/`my_groups()` (SECURITY DEFINER, search_path=''). RLS hẹp: teacher-only + self-read; anon bị chặn cả bảng lẫn RPC (401). claim_group lấy group từ token (không nhận group_id từ client).
- **🔴 Vá kèm — lỗ leo quyền app_users:** trước authenticated FOR ALL nên học viên tự `UPDATE role='admin'` thành teacher (chiếm app). ĐÃ đổi app_users sang CHỈ-ĐỌC trong `db/rls_setup.sql` (app chỉ đọc app_users; đổi role qua SQL). `rls_setup.sql` cũng BỎ QUA 3 bảng nhóm (self_managed) để chạy lại không mở toang.
- **Phần 2 (admin) ĐÃ ship 2026-06-17:** `src/GroupManager.tsx` + mục "Cộng đồng" trong TeacherAdminPage — tạo/sửa nhóm FB/Zalo, bật/tắt, dán hàng loạt `Tên|link`, tạo/đổi token, copy link `/join-group/<token>` + copy tin nhắn Zalo, xem/gỡ thành viên.
- **Phần 3 (app) ĐÃ ship 2026-06-17:** `src/JoinGroupPage.tsx` (route `/join-group/<token>` trong AppRouter, tự xử lý auth; chưa login → lưu pendingClaimToken, StudentOnboarding claim sau khi đăng nhập) + mục "Cộng đồng của bạn" tab Sống MobileStudentPortal (Facebook luôn hiện + Zalo của mình qua RPC my_groups, mở link _system).
- **Còn (tùy chọn):** StudentPortalV2 (desktop ≥1024) CHƯA có mục "Cộng đồng" (mobile là chính); claim route vẫn chạy cho desktop. Phân luồng học sinh MỚI lúc đăng ký chưa nối (hiện dùng claim-link cho mọi người).

**Bộ chỉ số học viên V1 (thiết kế chốt 2026-06-17):** triết lý "bản đồ hành trình" — tách VỊ TRÍ (lesson progress, quyết unlock) khỏi MÀU (đỏ=đã học / vàng=có hành động thật / xanh=quiz/tool đạt); mỗi chỉ số phải đẻ 1 hành động kế; mọi điểm truy ngược ra event thật (không điểm ảo). Quyết: màu TỰ SUY từ event + nút thầy override tùy chọn; "trả bài" ghi nhận thủ công/Zalo (KHÔNG upload video → né Apple 1.2); dùng XP sẵn làm "Điểm hành trình" (không tạo hệ điểm 2).
- **Tăng 1 ĐÃ ship live 2026-06-17:** Streak + nhịp tuần (thẻ tab Học: 🔥streak, X/7 ngày, phút tuần, dải 7 ô) — tính từ student_practice_log.
- **Tăng 2 ĐÃ ship live 2026-06-17:** `db/student_actions_setup.sql` (bảng `student_action_logs`, RLS self-insert/self-read + teacher-all, append-only, đã thêm vào self_managed của rls_setup) + nút "✋ Ghi nhận thực hành" trong bài (practiced_lesson +10 / submitted_video_self_report +50, ghi event + XP, 1 lần/bài/loại).
- **Tăng 3 ĐÃ ship live 2026-06-17:** Bản đồ hành trình trong màn khóa học (MobileStudentPortal screen 'courses') — dải mốc cửa sổ-9 trên path gradient đỏ→cam→xanh; màu mỗi mốc = điểm ẩn (completed 40 + practiced_lesson 30 + submitted 30) nội suy qua scoreColor(); "Mốc X/N" + "Việc tiếp theo" (học bài kế + gợi ý củng cố mốc đỏ). Helper `lessonScore`/`scoreColor`, state `lessonActionMap` nạp ở openCourse + cập nhật ở logAction.
- **Cấu trúc hành trình (chốt + ship 2026-06-17):** "Hành trình" = TỔNG xuyên suốt CẢ giáo trình (chặng=khóa, mốc=bài), KHÔNG phải 1-khóa-1-hành-trình. ĐÃ BỎ thẻ "Cấp độ nghệ sĩ" — Hành trình thay chỗ đó (đừng dùng lại từ "cấp độ nghệ sĩ"). Vẽ dạng CON ĐƯỜNG SVG sóng-sin (KHÔNG dùng chấm — thầy thấy chấm xấu): nền xám + vạch lane, phần đã đi gradient đỏ→cam→xanh theo %, cờ chặng tô màu theo độ-chắc-TB của khóa, marker 🎸. Gộp Điểm hành trình (XP, đổi từ "cấp độ") + Hạng lớp. Master journey ở **trang chủ tab Học** ("🗺️ Hành trình của bạn"): đường mốc xuyên mọi khóa (sort_order khóa→chương→bài), vạch ngăn chặng, cửa sổ 11 mốc, "Mốc X/N·%" toàn giáo trình, chặng hiện tại, việc tiếp theo→openCourse. State `masterPath` nạp ở mount (modules+lessons mọi khóa). Bản đồ TRONG khóa đổi tên "🧭 Tiến độ khóa này" (giữ tiến độ riêng từng khóa, không gọi "hành trình"). Cấp độ nghệ sĩ = trục NỖ LỰC riêng (không phải hành trình). Màu mốc = scoreById (đã học 40+thực hành 30+gửi bài 30) gradient đỏ→xanh.
- **Còn (tùy chọn):** màu XANH chưa nối quiz-pass/tool (cần xác minh schema edu_quiz_results); "chăm chỉ" gắn per-mốc cần log lesson_id khi luyện; reframe nhãn XP→"Điểm hành trình"; hành trình chưa có trên desktop StudentPortalV2; admin "tầng sự thật".

Apple: cập nhật web (server.url) KHÔNG cần duyệt lại; chỉ tránh thanh toán ngoài IAP + nội dung cấm. App = live web nên muốn test trên máy thật BẮT BUỘC deploy. Liên quan: [[feedback_app_submission_care]]
