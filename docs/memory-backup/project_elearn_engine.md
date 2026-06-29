---
name: project_elearn_engine
description: "Khoá \"Khởi Đầu Đam Mê — Nhập Môn\" dùng elearn HTML làm engine render qua 11 link-lesson + ?num"
metadata: 
  node_type: memory
  type: project
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

Khoá **"Khởi Đầu Đam Mê — Nhập Môn"** (edu_courses id `fd23a7a2-bfce-44c6-8bde-6d76289a3625`) là CASE STUDY để thầy cải tiến khung bài học tương tác — không phải "khoá lồng khoá".

Kiến trúc NATIVE (chốt 2026-06-18, đã bỏ iframe):
- 11 bài THẬT trong DB (`edu_course_lessons`), chia 4 module (Phần 1–4). Mỗi bài: `lesson_type='link'`, `content_url='/lessons/khoi-dau-dam-me.html'`, `content` = JSON `{"elearn":true,"num":X}` (X=1..11). SQL seed: `db/elearn_khoi_dau_dam_me.sql`.
- Bài học giờ là COMPONENT REACT NATIVE trong `src/elearn/` (KHÔNG còn iframe/PostMessage):
  - `data.ts` — nội dung 11 bài (goal/steps/prompt/thao.type) + ACCENT/STR/FREQ/LESSONS/PLAY9 + getLesson(). **Đây là chỗ thầy sửa nội dung bài.**
  - `audio.ts` — playTone (WebAudio, tiếng dây buông).
  - `ElearnLessonView.tsx` — render 1 bài theo prop `num`; widget: CheckWidget/NeckPick/ToolLaunch/Listen8/NoteChart/Media. Props: `num, studentName, isDone, onComplete, onBack, onOpenTool`. Bài 9 có StyleChips (fingers/pick, lưu localStorage `guitarPlayStyle`). Media tự fetch từ `elearn_media`.
- Wrapper phát hiện elearn qua content `{"elearn":true,"num":X}` → render `<ElearnLessonView>` trong overlay `position:fixed inset:0`. `MobileStudentPortal.tsx` (<1024px): onComplete=markComplete+goBack, onOpenTool=openTool overlay. `LessonViewerPage.tsx` (desktop /course?id=): completeElearn ghi `edu_lesson_progress`+`student_xp_log`, onBack=setActive(null); vùng main ẩn khi bài elearn.
- File `public/lessons/khoi-dau-dam-me.html` (bản React-CDN cũ) GIỜ KHÔNG DÙNG NỮA. Có thể xoá sau.

NỘI DUNG SOẠN TRONG ADMIN (DB-driven, chốt 2026-06-18):
- Bảng `elearn_lessons` (SQL: `db/elearn_lessons.sql`): course_slug, lesson_num, goal, steps[], prompt, thao_type, items[], youtube_id, video_url. RLS anon-read + auth-all.
- Admin tab **"Bài Elearn"** (`ElearnLessonsManager.tsx`) — ĐÃ GỠ KHỎI NAV 2026-06-19 (thừa, mâu thuẫn với Flow). Flow là engine soạn bài DUY NHẤT giờ. Bảng `elearn_lessons` GIỮ NGUYÊN trong DB (có video bài 1/6/7: cU-ZtHf3-D4, sZbkm6wqfwY, oPB3_l6z6Y0) — `/flow-migrate` đọc trực tiếp để kéo video+nội dung vào Flow. File ElearnLessonsManager.tsx còn trên đĩa (không import) — xoá được sau khi migrate xong.
- `ElearnLessonView` fetch `elearn_lessons` (1 query, content+media) → merge ĐÈ lên mặc định code (`data.ts`) theo từng field; thiếu hàng/field → dùng code. Tiêu đề lấy từ prop `title` (= edu_course_lessons.title). Bảng/bucket chưa tạo → fallback code êm, không lỗi.
- `data.ts` giờ là MẶC ĐỊNH/fallback (không còn là nguồn duy nhất). Sửa nhanh vẫn có thể sửa data.ts; sửa "chính thức" thì qua admin.

CẢNH BÁO: marker `{"elearn":true,"num":X}` trong `edu_course_lessons.content` chỉ là CON TRỎ — đừng sửa ô "Nội dung chi tiết" trong CourseEditor (rich-text phá JSON). Nội dung thật giờ ở bảng `elearn_lessons` (sửa qua tab "Bài Elearn").

GỘP VÀO FLOW — ĐÃ CHỐT & BẮT ĐẦU GĐ1 (2026-06-19):
- Bản thiết kế đầy đủ: `docs/flow-design.md` (sinh từ workflow đa-agent + phản biện đọc code).
- 5 quyết định đã chốt (theo khuyến nghị): (1) DB lưu SỐ DÂY 1-6 (không index 0-5); (2) KHÔNG hệ sao/accuracy ở GĐ1; (3) ghi `practiced_lesson` DUY NHẤT ở FlowPlayer (gỡ ở Portal khi migrate, tránh cộng đôi); (4) slide LÀM = self-check TRUNG THỰC (app phát mẫu → học viên bắt chước trên đàn → tự xác nhận; app chưa nghe tay đàn tới GĐ3 mic); (5) ship 1 bài mẫu duyệt TRƯỚC khi migrate 11 bài.
- ĐÃ LÀM (GĐ1 bước 1): `src/elearn/guitarConst.ts` (STRINGS num 1-6, freq/màu/độ dày), `audio.ts` (+cắt nốt chống chồng tiếng, +transient, +playSequence), `src/elearn/guitarRenderers.tsx` (NeckPick/NoteChart/Checklist emit onPass/onWrong), FlowPlayer mở rộng (slide types callout/note_chart/guitar_neck/checklist/guitar_tool + cổng hard-mềm `passed`/`attempts`/lối thoát sau 2 lần sai + tự ghi practiced_lesson cuối bài có LÀM), FlowManager VALID_TYPE thêm type mới (chặn auto-fix→text). Bài 4 mẫu render ở route `/flow-lab` (mọi user đăng nhập, chỉ previewFlow, không ghi DB). ĐÃ VERIFY chạy thông suốt + sửa bug Checklist setState-in-render.
- ĐÃ LÀM (GĐ1 bước 2, 2026-06-19): port guitar_strum (gảy đủ dãy) + guitar_ear (luyện tai nghe) vào guitarRenderers + FlowPlayer; bài 8 mẫu ở /flow-lab?bai=8. THẦY ĐÃ DUYỆT CẢM GIẢC ("rất tốt rồi đó") → được phép làm tiếp. Palette mô phỏng GĐ1 ĐỦ: callout/note_chart/guitar_neck/guitar_strum/guitar_ear/guitar_tool/checklist + text/video/image/quiz/true_false/input của Flow cũ.
- ĐÃ LÀM (GĐ1 bước 3, 2026-06-19): TRÌNH SOẠN Flow trong `FlowInlineEditor.tsx` (gắn trong CourseEditorContent khi Loại bài = Flow; Admin→Khoá học→bài→Loại=Flow). Thêm slide type mới vào dropdown + form cấu hình: callout (kiểu hộp tip/warn/teacher), note_chart, guitar_neck (StringPicker bấm chọn dây), guitar_strum (bấm dãy + preset 1→6/6→1), guitar_ear (số câu), guitar_tool (chọn tuner/tempo/guitarboard + nhãn), checklist (mục + requireAll). Đáp án quiz đổi GÕ TAY → DROPDOWN chọn từ options (sửa bug). doImport giữ interactive/hintText. Preview (👁) + save không đụng do previewFlow guard.
- ĐÃ LÀM (GĐ1 bước 4, 2026-06-19): trang teacher `/flow-migrate` (`FlowMigratePage.tsx`) — đọc 11 bài elearn (theo content_url) + elearn_lessons + flows hiện có → buildSlides (goal→NHẬN text, steps→NHẬN text, bài4 thêm note_chart, thao→guitar_neck/guitar_tool/guitar_strum+guitar_ear/checklist, đóng bằng callout teacher) → HIỆN BẢNG DUYỆT → upsert flows theo lesson_id (select-then-update/insert, không trùng) + set lesson_type='flow'. Bài 9 dùng biến thể fingers (có cờ nhắc). Không cộng đôi practiced_lesson vì lesson_type='flow' chỉ chạy FlowPlayer (path elearn cũ chết). Đảo lại được (đổi lesson_type về 'link'; elearn_lessons + marker giữ nguyên). buildSlides đã test node OK. THẦY CHƯA CHẠY (chờ thầy vào /flow-migrate bấm). (C) Lỗi style shorthand/longhand có sẵn FlowPlayer gốc (padding/overflow màn Done/Loading) — cosmetic. (D) FlowManager (global) sanitize re-save có thể drop interactive nếu thầy dùng — chỉ FlowInlineEditor là an toàn. Chưa verify UI editor trực tiếp (preview là tài khoản học viên, không vào /admin được) — thầy tự test soạn.

(LỊCH SỬ) Thầy nhận ra ý "trình dựng khối" cho elearn CHÍNH LÀ Flow ([FlowPlayer.tsx]/[FlowInlineEditor.tsx], bảng `flows` gắn `lesson_id`, slide types: text/video/image/quiz/true_false/input/action/reward/next, có trục sư phạm NHẬN·NGHĨ·LÀM·NGẪM·THƯỞNG·DẪN, FlowPlayer lướt 1 màn/slide không cuộn, XP+action logging). Flow ĐANG THIẾU đúng các widget guitar tương tác của elearn (chọn dây, gảy/tai nghe + audio.ts, gọi tuner, bảng nốt) — chúng là slide "LÀM".
2 QUYẾT ĐỊNH TREO thầy đang cân nhắc:
1) Hợp nhất hẳn elearn vào Flow (widget guitar → slide type mới của Flow, một engine duy nhất) HAY giữ 2 cái song song?
2) Bài học = lướt từng màn (Flow thuần, không cuộn) HAY cho cuộn trong slide khi nội dung dài?
Claude nghiêng về: hợp nhất về Flow + lướt từng màn. CHỜ thầy gật trước khi code.

SLIDE "ĐÁNH THEO MẪU" (note_practice, 2026-06-19): widget play-along "nghe & bắt chước" — máy chạy chuỗi nốt theo nhịp (Chậm/Vừa/Nhanh 60/80/100bpm), phát tiếng (audio.ts), học viên đánh theo trên đàn thật → sau ~2 vòng (8 beat) tự mở cổng LÀM (self-check, chưa mic). Renderer `NotePractice` trong guitarRenderers.tsx HIỆN: (1) CẦN ĐÀN gỗ tối `MiniFretboard` (dây 1..6, phím 0=buông ○ ở nut, nốt chạy sáng theo string/fret) — phong cách như FingerExercise; (2) KHUÔNG NHẠC `NoteStaff` (5 dòng + treble clef 𝄞 + nốt ở vị trí `staff` (0=dòng dưới=Mi/E4), dạy thụ động). cfg `{notes:[{label,freq,string,fret,staff}], speeds?, showStaff?}`. Editor: chọn dây buông (Dây1-Mi có khuông; dây khác chỉ cần đàn vì chưa có ledger line) + số lần lặp. Bài mẫu /flow-lab?bai=mi.
QUY ƯỚC KHUÔNG NHẠC GUITAR (quan trọng, thầy nhắc 2026-06-19): guitar là nhạc cụ CHUYỂN VỊ — nốt VIẾT cao hơn thực tế 1 QUÃNG 8. Nên Mi dây-1-buông (E4 thực) VIẾT là E5 = KHE 4 (gần đỉnh), KHÔNG phải dòng kẻ dưới. Trong NoteStaff: `staff` = bậc nửa-dòng từ dòng dưới cùng (0). Mi dây1 = staff 7; dây2 Si(B4)=4; dây3 Sol(G4)=2. Đuôi nốt: staff≥4 (từ dòng giữa B4 lên) → quay XUỐNG. dây4-6 trầm cần dòng kẻ phụ → chưa hỗ trợ khuông (chỉ cần đàn).

BÀI 1 THẬT: `db/bai1_tia_not.sql` tạo "Nốt Mi — dây 1 buông" cho khoá "Tỉa nốt căn bản" (KHÁC "Tia Nốt Trình Độ 1/2"), Chương 1 — Flow 6 slide (callout → 2 text → note_practice Mi → checklist → callout). Idempotent, lookup course by name ILIKE. THẦY CHƯA CHẠY SQL.

HỆ GỠ RỐI & ĐÀO SÂU (GĐ1 xong 2026-06-19): slide type `support` OPT-IN (thầy tự gắn vào bài cần, KHÔNG ép mọi bài — thay câu "Nhắn thầy" tĩnh cũ). `SupportFlow.tsx` overlay: chọn nhu cầu (gặp khó/đào sâu) → chọn trạng thái → coaching mẫu chung (`src/elearn/supportContent.ts`, 5 stuck-type + 6 deepen) → [tự gỡ được] / [Tìm bài thầy giảng = Kho Tri Thức "sắp có"] / [ghi câu hỏi có ngữ cảnh → bảng `learning_support_log` + nút Nhắn thầy (teacherUrl)]. Mô hình ChatGPT 4 tầng; tầng 3 (Kho Tri Thức: video tag + search) = ĐỢT SAU (cần thầy build thư viện video tag trước). SQL: `db/learning_support_log.sql` (chạy 1 lần). Trình soạn: slide "🧭 Gỡ rối & Đào sâu" + ô link Nhắn thầy. ĐÃ VERIFY full flow ở /flow-lab?bai=4 (slide 7). Triết lý: tự gỡ→tự tra→hỏi thầy = NHÂN BẢN người thầy (thầy làm 1 mình), câu hỏi tới thầy đã có ngữ cảnh.

Liên quan: [[project_lesson_philosophy]] [[project_lms_roadmap]]
