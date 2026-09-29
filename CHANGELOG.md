# CHANGELOG — Thầy Văn Anh Guitar LMS

Ghi lại thay đổi đáng chú ý. Định dạng ngày: dd/mm/yyyy.

## 29/09/2026

- **Social UX + Lớp học V1 (`/me`)**
  - **Trang chủ:** ô chia sẻ "Chia sẻ điều gì về âm nhạc…" (bài status có sẵn) → Feed ngay. Bỏ ảnh bìa lớn, nút Trả bài hero và khối "của tôi". Thầy thấy một dòng nhỏ khi có bài chờ.
  - **Menu:** Trang chủ đầu tiên; nhóm **LỚP HỌC** hiện trực tiếp lớp của tôi, 3 lớp khám phá và "Tất cả lớp".
  - **Trang lớp** `/me/classes/<id>`: tab Hoạt động (Learning Thread community của lớp) và Thành viên (chỉ thành viên lớp + Thầy). Người ngoài xem được phần công khai với nhãn "đang xem lớp… chưa tham gia".
  - Lớp = `class_schedule` + membership sẵn có, qua 5 RPC chỉ đọc; không bảng mới, không lộ zoom/giá/PII.
  - Feed thêm bài tường của mình + bạn bè (đúng quyền).
  - Chi tiết: `docs/SOCIAL-CLASSES-V1.md`.

- **Learning Thread P2 — Feed · Tường · Hành trình (PRODUCTION)**
  - Thread `community` hiện trên Feed `/me` dạng "câu chuyện học tập": một thread = một thẻ, nổi lên khi có hoạt động mới. Thread private / ẩn / lưu trữ không lên Feed.
  - Tường gồm bài Social + thread của người đó theo quyền.
  - Tab **Hành trình** trên trang cá nhân: timeline gom theo danh tính lịch sử ((lớp hoặc Tự học) × khoá), màu theo môn giống App học. Bấm mốc → `/me/t/<id>`.
  - Chỉ thêm RPC đọc `social_feed`, `user_wall`, `learning_journey` (+ `lt_thread_card` nội bộ). Không bảng mới, không copy sang `class_posts`; `class_feed` / `get_user_wall` giữ nguyên.
  - Chi tiết: `docs/LEARNING-THREAD-P2.md`.

- **Learning Thread P1 — Trả bài / Hỏi bài theo bài học (PRODUCTION PASS)**
  - **Mô hình:** một bài học = một thread đang mở cho mỗi học sinh. Trả bài, câu hỏi, Thầy phản hồi, "Cần làm lại", Trả lại và ĐẠT đều là event trong cùng thread. App học (riêng tư) và `/me` (Social) dùng chung dữ liệu, không có hệ Trả bài thứ hai.
  - **Bảng:** `learning_lesson_settings` (Thầy bật theo từng bài: off / allowed / required; Hỏi bài off / allowed; không suy từ `lesson_type`), `learning_threads`, `learning_thread_events`. Chỉ truy cập qua RPC `lt_*` SECURITY DEFINER; bảng REVOKE hết và nằm trong `self_managed`.
  - **Danh tính học tập** (lớp / chặng / khoá / chương / bài) được server đóng dấu lúc mở thread, không đổi theo hồ sơ về sau. Người xem ("Cộng đồng học tập" / "Chỉ Thầy") độc lập với lớp.
  - **Không đổi:** ĐẠT không ghi tiến độ, không mở khoá bài. Nút "Tôi đã gửi bài cho thầy" và XP giữ nguyên. 9 bài Trả bài Social cũ giữ nguyên.
  - **Giao diện:** khu vực trong bài học + Sổ tay hành trình (App), `/me/t/<id>`, hàng đợi Thầy `/me/queue`, khối "Trả bài / Hỏi bài của tôi".
  - **Bật cho 3 bài DH2:** 4.3, 4.4 (Bolero móc kiểu 1/2), 6.3 (Dự án cuối khoá).
  - **Bằng chứng production:** học sinh thật hỏi bài → Thầy "Cần làm lại" + bài giảng → học sinh Trả lại → Thầy ĐẠT, tất cả trong một thread.
  - **Test:** DB 101, class-social 124, E2E Chrome 23 (stack local).
  - **Sự cố khi release:** lần chạy script cấu hình đầu tiên để lại 0 dòng trên production, nên CTA ẩn. Từ nay chỉ chấp nhận `db/learning_threads_p1_diag.sql` với `CONFIG_GATE = PASS` làm bằng chứng.
  - Chi tiết: `docs/LEARNING-THREAD-P1.md`.

## 23/08/2026

- **Billing Foundation Class 2.0 (BƯỚC 8A — PHA B, code xong chưa chạy production)**: 6 bảng billing provider-neutral (`billing_customers`, `billing_provider_customers`, `billing_products`, `billing_subscriptions`, `billing_payments`, `billing_events`) + Billing Core (SECURITY DEFINER: `billing_ingest_event`, `billing_apply_event_internal`, `billing_record_manual_payment`, `billing_sanitize_payload`). Idempotency qua `UNIQUE(provider, external_event_id)`; manual fallback đi qua CÙNG business transition với webhook tương lai. RLS: anon không policy nào, authenticated chỉ teacher SELECT, mọi write qua trusted function. KHÔNG lưu card/CVV/PCI. Provider boundary chỉ là interface (`_shared/billing/provider.ts`, `getProviderAdapter()` = null); `billing-webhook` từ chối an toàn 503. CHƯA chạy migration production, CHƯA commit/deploy. Chi tiết: `docs/BILLING.md`.

## 29/07/2026

- **Thiết kế lại tab "Sống"** phục vụ chiến dịch 1001 Câu chuyện: bỏ dashboard (thống kê, bảng xếp hạng, quote, thẻ sự kiện) → còn **Band của tôi** (hero, trạng thái "chưa tham gia Band" + nút tìm hiểu) và 4 entry điều hướng: Cộng đồng Hành trình · 1001 Câu chuyện cùng Guitar (→ `/story`) · Đại hội Guitar · Nhóm lớp của tôi. Trang đích ở `src/live/LivePages.tsx` — nội dung tĩnh, không feed. Giữ hàng tài khoản (đổi hồ sơ / đăng xuất) vì đây là lối vào duy nhất trên điện thoại. Kiến trúc: Lớp = đơn vị đào tạo, Band = đơn vị cộng đồng lập sau các khoá nâng cao.

- **Hết cắt cụt tên khoá/tên bài trên điện thoại**: tên tiếng Việt dài hơn bề ngang máy bị cắt thành "Đệm Hát Trình …", học viên không đọc được mình đang học khoá nào. Sửa 13 chỗ trong `MobileStudentPortal` (danh sách "Tất cả khoá học", "Nền tảng còn thiếu", danh sách bài, header bài học, thẻ "Học ngay", "Học tiếp theo hành trình", "Việc tiếp theo", "Củng cố cho chắc", "Việc nên làm hôm nay", danh sách bài hát, popup chúc mừng) + header `ElearnLessonView`, `ChordStrumPlayer`, `NarratedSlides`, `ForcedVideo`: đổi từ cắt 1 dòng sang xuống **tối đa 2 dòng**. `FlowPlayer` giữ nguyên 1 dòng có chủ ý — quy tắc "mỗi slide 1 màn trọn vẹn, nút luôn hiển thị".

## 28/07/2026

- **Nói chuyện để tạo bài tập**: bé nói "con muốn bài về khủng long" là ra bài luôn. Công cụ `tao_bai_tap` được khai báo cho Realtime qua `session.update` **từ client** (không sửa `realtime-token` — file repo để key `'***'`, deploy đè là phá hỏng hội thoại). Cô nói câu chờ trong lúc bài đang soạn nên không có khoảng lặng. Màn "Tập bài tập" giờ chỉ để gõ, bỏ hẳn mic Web Speech vì nó chết trong WKWebView.
- **PHỤC HỒI trò chuyện với Cô Piano** (`src/piano/TalkWithTeacher.tsx`): hội thoại 2 chiều qua OpenAI Realtime + WebRTC được thêm ở `e01aad1` (27/07 22:20) và chạy mượt, nhưng `0406b72` (28/07 00:12) thay toàn bộ PianoJourney bằng SpeechRecognition nên **xoá mất hội thoại**. Đó mới là lý do "mic không trò chuyện được" — không phải lỗi mic. Nay màn đầu Piano Journey là trò chuyện trở lại; nút "🎼 Tập bài tập" dẫn sang LearningFlow. Kết nối bằng cú chạm thay vì auto-connect (iOS cần user gesture cho micro + phát tiếng AI). Backend `realtime-token` chưa bao giờ hỏng.
- **Piano Journey — mic chạy được trong app** (phần tạo bài tập): nguyên nhân gốc là trong **WKWebView, `webkitSpeechRecognition` CÓ MẶT nhưng CHẾT** — `start()` chạy xong rồi không bao giờ bắn event nào, treo ở "Đang nghe..." vĩnh viễn không báo lỗi. Phép kiểm "API có tồn tại" luôn PASS nên chẩn đoán bị lệch; test trên Chrome desktop cũng luôn thấy chạy tốt. Thêm `src/piano/useVoiceInput.ts` với 3 tầng tự tụt: Web Speech (có watchdog `onstart`/`onaudiostart` 3s) → thu âm (`MediaRecorder`) + Whisper qua edge function `piano-stt` → gõ text. Giữ nguyên `server.url` nên **không phải build lại Xcode**.
- **Fix 4 bug logic mic**: (1) `onend` đọc `transcript` từ closure cũ → mất trắng câu nói khi recognizer kết thúc mà chưa có final result; (2) `no-speech` gọi `rec.start()` trong `onerror` → luôn throw `InvalidStateError` rồi tuột về idle, chuyển sang restart trong `onend`; (3) `setState` trong thân render; (4) animation `setState` 60fps → chuyển sang CSS.
- **Chặn treo**: `generateMission` và xin quyền micro đều có timeout (8s / 15s) rồi lùi về bài mẫu — mạng yếu không còn để trẻ kẹt ở "Đang sáng tác".
- **Piano Journey render thẳng, không iframe** (`MobileStudentPortal`): `getUserMedia` trong iframe của WKWebView hay bị chặn. Cùng khuôn với BMS.
- **`NSMicrophoneUsageDescription`**: sửa mô tả — bản cũ cam kết bản ghi "không gửi đi", sai kể từ khi có Tầng 2 (rủi ro bị App Review từ chối).

## 27/07/2026

- **Trang tuyển sinh (class.vananhaudio.com)**: thêm CTA "📖 1001 Câu chuyện" trên header — pill nằm giữa nhóm menu và nút "Hành trình của tôi", dẫn tới `/story`. Mobile rút gọn thành "📖 1001" (trang chưa có menu hamburger nên pill hiển thị trực tiếp).
- **Fix form đăng ký**: hai lớp trùng tên (TN3.GL12 / TN3.GL13) không phân biệt được trong ô "Lớp muốn đăng ký" — giá trị chọn + `leads.class_name` giờ kèm MÃ LỚP (vd "Tỉa Nốt 3 (Cảm âm 1) · TN3.GL13"), hết trùng key React và Duyệt nhanh khớp lớp chính xác hơn.
- **Trợ lý AI admin**: thêm khả năng GỠ học sinh khỏi nhóm Zalo qua chat (đề xuất → thầy duyệt → mới gỡ; không thu hồi khoá đã cấp).
- **Tab Đăng ký**: nút "⚡ Duyệt nhanh" — tạo tài khoản + tự đưa học viên vào đúng lớp đã đăng ký (theo mã lớp, tự cấp khoá qua backfill_class).
- **Lịch lớp**: chat với Mira ngay trong tab 🧭 Mira để xếp lịch bằng hội thoại; lớp tạo qua chat có lịch thật + tự sinh buổi học (múi giờ VN).
- **Đếm buổi học**: sửa progressInfo — buổi huỷ/nghỉ lễ không tính vào tổng & đã học; buổi dời tính vào "còn lại"; Dashboard + Mira Planner dùng chung công thức.
- **Mira tuyển sinh (class-ai)**: đọc lịch sống theo status + ngày thật mỗi lượt chat, kèm tiến độ "đã học X/Y buổi" và mốc ngày hôm nay.

## 26/07/2026

- **Trang tuyển sinh**: bỏ danh sách lớp dự phòng hardcode — hết lớp sắp khai giảng thì hiện thông điệp giữ chỗ thật thay vì lớp cũ; form đăng ký lấy danh sách lớp thật từ `class_schedule`.
- **RLS**: thêm `class_schedule`, `class_sessions` vào nhóm bảng tự-quản trong `db/rls_setup.sql` (chạy lại script không xoá nhầm policy công khai của lịch).
