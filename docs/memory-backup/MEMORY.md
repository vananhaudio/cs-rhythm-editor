# Memory Index

- [Tỉa nốt 1 — triết lý](project_tia_not_1_philosophy.md) — dạy theo cụm→câu→vùng→bài thật, KHÔNG lấy dây làm trục; 6 bài; đồ nghề note_show/note_practice đủ; vùng Si-Đô-Rê-Mi-Fa-Sol = staff 4-9

- [Đơn giản, hiệu quả](feedback_simple_effective_design.md) — trình bày sạch, hạn chế màu mè; nốt nhạc là trọng tâm (to/đều/đẹp); hợp âm trên nốt đầu ô nhịp
- [Count-in lấy đà](project_countin_pattern.md) — ô lấy đà hiện số 1-2-3 sáng theo phách thay count-in; dùng cho mọi bài gảy-theo (ChordStrumPlayer)
- [Strum Score](project_strum_score.md) — TÊN CHÍNH THỨC màn gảy-theo-bản-thu = "bản nhạc cho người quạt"; ChordStrumPlayer, route /hbd
- [Ghi âm Strum Score](project_strum_recording.md) — thu tiếng đàn TRỘN SỐ với nền (cùng AudioContext), lưu local không upload; mic permission đã có sẵn (Tuner), route /jinglebell

- [Kỷ luật luyện tập](project_practice_discipline.md) — phiên + màu kỹ năng đỏ/vàng/xanh (3 phiên→xanh), tách trục Học vs Kỹ năng; edu_skill_progress; GĐ A+B đã làm, cần chạy db/skill_progress_setup.sql

- [Trang tuyển sinh class](project_class_tuyensinh.md) — cổng tuyển sinh class.vananhaudio.com; chốt làm route trong app, CHƯA code; mục bảo mật bàn giao đã lỗi thời (RLS xong)

- [Mở khoá = đăng ký→Duyệt](project_cohort_hanhtrinh.md) — học sinh tick "Hành trình miễn phí" khi đăng ký → leads (Chờ duyệt) → thầy "Duyệt & mở khoá" ở LeadsManager. Cohort HT2026/27 ĐÃ GỠ HẲN. db/course_request_setup.sql
- [Freemium per-course](project_freemium_percourse.md) — TK do thầy cấp (bỏ self-serve); mở chính xác từng khoá qua edu_course_access (is_free + cấp quyền ở Hồ sơ học viên); bài tier='free'=học thử
- [Tune Lab](project_tune_lab.md) — app tuner standalone (gốc `~/Desktop/pitch-lab/`), duyệt App Store id 6780132453 (2026-06-14)
- [Song Builder V1](project_song_builder.md) — đã dựng GĐ1-5; bước Xuất KHÓA chờ chốt schema v2.1 (3 quyết định treo)
- [App BMS riêng](project_bms_standalone_app.md) — Beat my Songs publish thành app iOS riêng (`~/Desktop/beat-my-songs/`), tải /song-builder?standalone=1
- [Backup bàn giao trong repo](reference_handoff_backup.md) — bàn giao + bản sao bộ nhớ lưu docs/HANDOFF.md + docs/memory-backup/ (đẩy GitHub, không mất); refresh khi xong đợt việc
- [Vị trí file bàn giao](reference_handoff_docs.md) — handoff/prototype từ Bolt nằm ở `~/App/song builer/` (ngoài repo)
- [Kho Tri Thức Văn Anh](reference_kho_tri_thuc.md) — app RIÊNG (Next.js, `~/App/Kho tri thức baì giảng/`) có Anthropic API key; LMS này KHÔNG có LLM key — đừng lẫn
- [Groove Lab](project_groove_lab.md) — app Expo dạy tiết tấu guitar ở `~/App/project/`, ĐÃ LÊN APP STORE v1.0 (id 6778263562, build 7 iPhone-only, duyệt 2026-06-14), privacy /groovelab-privacy/
- [Groove Lab trong LMS](project_groove_in_lms.md) — đã PORT toàn bộ Groove Lab vào LMS (src/groove/), mục "Tiết tấu" trong "Hôm nay luyện gì": tab Học (30 bài 3 tầng + metronome) + Tập (nền tập quạt); 2 codebase tách biệt
- [Strum Score (Groove Lab)](project_groove_strum_guide.md) — tính năng SẮP LÀM (tên chính thức Strum Score): hướng dẫn quạt chạy theo nhạc user tự chèn; đã chốt khung tích hợp (union kind exercise/strum, route app/strum riêng); CHƯA code, chờ thầy bảo làm
- [Nền tập quạt (Groove Lab)](project_groove_backing_track.md) — tính năng SẮP LÀM: engine tự sinh loop trống+bass 5 điệu để quạt theo; đặc tả Downloads/BAN-GIAO-groove-lab.md viết theo Tone.js (web) PHẢI port sang react-native-audio-api; trí tuệ nhạc copy thẳng; CHƯA code
- [Note Trainer](project_note_trainer.md) — game đọc nốt "ScoreLab Trainer" (React/Vite/Tailwind, 1 file App.tsx) ở `~/App/Game nhớ nốt nhạc/app`, ĐÃ LÊN APP STORE v1.0 (id 6780222404, iPhone-only, duyệt 2026-06-15), privacy /scorelab-privacy/
- [GuitarBoard AlphaTab](project_guitarboard_alphatab.md) — editor /guitarboard chuyển từ canvas tự vẽ sang AlphaTab render (ScoreTabViewerAlpha); giữ logic gõ phím cũ
- [Nhịp độ chỉnh GuitarBoard](feedback_guitarboard_pace.md) — làm chậm từng chi tiết một, không tự push, chờ duyệt
- [Xóa tài khoản (Apple 5.1.1v)](project_account_deletion.md) — hàm delete_my_account; phải xóa edu_students/student_taps/student_progress trước auth.users; app phải check error rpc
- [Cẩn thận khi nộp app](feedback_app_submission_care.md) — rà data model trước khi viết code xóa; không nuốt lỗi rpc; test end-to-end dữ liệu thật trước khi nộp Apple
- [Lộ trình LMS HỌC-TẬP-SỐNG](project_lms_roadmap.md) — đợt HỌC-TẬP (XP thật/journey/quiz mobile) đã ship+verify 2026-06-17; còn: trình soạn quiz, streak, tab SỐNG, Android/CH Play (blocker billing)
- [Tự chủ việc dễ](feedback_autonomy_easy_tasks.md) — thầy muốn Claude tự làm việc an toàn (edit/git/build/push main), ít hỏi; chỉ hỏi ở quyết định thật/khó đảo/rủi ro Apple
- [Triết lý thiết kế giáo trình](project_lesson_philosophy.md) — HỌC-TẬP-SỐNG Spiral, app-như-công-cụ, bộ đồ nghề xuyên suốt, trục người thầy (chốt 2026-06-18)
- [Hướng nhận diện hình ảnh](project_visual_identity.md) — bỏ dần emoji-làm-UI → bộ icon line thống nhất (thầy tự thiết kế); đã dọn mặt học viên, bản đồ ở docs/emoji-cleanup.md
- [Elearn engine](project_elearn_engine.md) — khoá "Khởi Đầu Đam Mê" = 11 link-lesson DB → render NATIVE `src/elearn/`; nội dung soạn trong admin tab "Bài Elearn" → bảng `elearn_lessons` (fallback data.ts); bỏ iframe; ĐỪNG sửa ô "Nội dung chi tiết" CourseEditor (chỉ là marker)
- [Mira trợ lý (class-ai)](project_mira_assistant.md) — đã cho truy cập dữ liệu mức 1 (danh mục khoá) + mức 2 (hồ sơ riêng người đăng nhập, xác thực token); hướng tới trợ lý chăm sóc học sinh đặc biệt
- [Trợ lý AI admin](project_admin_ai_assistant.md) — tab AI trong /admin tạo TK học sinh qua Edge Function `admin-ai` (deploy tay Dashboard, verify_jwt TẮT, dùng chung khoá Anthropic — chờ nạp credit); mk mặc định 12345678 + Đổi mật khẩu ở Hồ sơ học viên
- [Xưng hô "bạn" không "em"](feedback_address_learners_neutral.md) — nội dung bài học gọi học viên là "bạn" (có thể người lớn tuổi), tránh "em"
