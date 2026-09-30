# CHANGELOG — Thầy Văn Anh Guitar LMS

Ghi lại thay đổi đáng chú ý. Định dạng ngày: dd/mm/yyyy.

## 30/09/2026

- **Sửa Danh tính học tập V1: nguồn DUY NHẤT = lớp học Admin**
  - Bỏ hẳn fallback `edu_students.ht_member`: người chỉ có cờ mà không thuộc lớp Hành trình thì không có nhãn Hành trình. "◆ Hành trình yyyy" chỉ dành cho người thuộc lớp HTyyyy.
  - Hàm `social_learning_identities` bỏ cột `ht_member` (drop + create cùng transaction). Client, test, preflight, postflight và docs đã cập nhật.
  - Không sửa membership hay lớp của ai.

- **Class Social — Danh tính học tập V1** (Đang học · Sắp học · Đã tốt nghiệp)
  - Nhãn chương trình sinh từ lớp thật; học sinh không tự chọn. Ví dụ: "◆ Hành trình 2027", "Đệm hát 2", "Solo Guitar". Không mã lớp, không Level/VIP/XP.
  - Luật: thành viên theo đúng Lớp học V1. `active`/`ending_soon`/`paused` = Đang học; `recruiting`…`upcoming` = Sắp học; `completed` = Đã tốt nghiệp; lớp huỷ/gộp/nháp không hiện. Gộp theo chương trình (2 cohort DH2 = một nhãn). Thầy không có nhãn học sinh.
  - Hiện ở:
    - Feed, Tường, thẻ và trang cuộc trao đổi: tối đa 2 nhãn Đang học, thừa hiện +N.
    - Bình luận: 1 nhãn. Bạn bè: tối đa 2.
    - Thành viên lớp: bỏ nhãn trùng ngữ cảnh lớp.
    - Trang cá nhân: khối "Danh tính học tập" đầy đủ.
    - Không hiện trên top bar và App học. Danh tính LỊCH SỬ của thread giữ nguyên, tách riêng.
  - DB: 1 hàm đọc `social_learning_identities(uuid[])`, không bảng mới; preflight có thống kê gộp. Helper nhãn duy nhất ở client; nạp theo lô, không N+1.
  - Test: DB (thêm 17 kiểm Identity V1), class-social 157, E2E 61. Thiết kế: `docs/SOCIAL-LEARNING-IDENTITY-V1.md`.

- **Class Social — Chỉnh sửa trang cá nhân V1** (`/me/u/<chính mình>`)
  - Nút "Chỉnh sửa trang cá nhân" chỉ hiện trên trang của chính mình (tài khoản có hồ sơ học sinh). Hộp thoại chỉ có Ảnh đại diện (Đổi ảnh) và Tên hiển thị, với Huỷ / Lưu thay đổi.
  - **Không tạo hồ sơ Social riêng:** ghi vào `edu_students.display_name` / `avatar_url` của chính mình, đúng cột App học (Cài đặt → Hồ sơ của tôi) đang sửa. Ảnh đi qua pipeline sẵn có (bucket `avatars`, kiểm loại ảnh thật, thu nhỏ). Mọi màn đọc qua `class_public_identity`, không snapshot.
  - Tên: gọn khoảng trắng, chuẩn hoá NFC, giữ hoa/thường, tối đa 60 ký tự, không được rỗng. Lỗi hiện câu thân thiện; tệp hỏng không làm mất tên đang nhập.
  - Sau khi lưu: top bar, trang cá nhân và Feed cập nhật ngay, không cần đăng nhập lại. RLS sẵn có chỉ cho sửa hàng của chính mình.
  - Không DB/migration. Test: class-social 152, E2E 58 (thêm storage giả lập trong proxy local; kiểm DB sau khi lưu).

- **Sửa: Trang chủ / logo luôn về Home mặc định** (`/me`)
  - Root cause: đang ở Home với `?feed=classes|friends` mà bấm Trang chủ → router coi là "cùng màn" nên không đổi URL, và Home không mount lại nên giữ tab cũ. Back/Forward giữa `/me?feed=…` và `/me` cũng lệch tab.
  - Sửa tại router: điều hướng tới URL khác (kể cả cùng màn) thì `pushState`. Mỗi lượt điều hướng, gồm cả Back/Forward, làm Home mount lại, đọc `?feed=` từ URL và về đầu trang.
  - Deep link `/me?feed=classes|friends` vẫn giữ. E2E 56 (☰, sidebar, logo; từ các tab, lớp, cuộc trao đổi, trang cá nhân; Back/Forward; 390/1280).

- **Class Social — FEED V1: "Dành cho bạn · Lớp của tôi · Bạn bè"** (`/me`)
  - Một Feed, ba góc nhìn, tab gạch chân ngay trên Feed. Không AI, không xếp hạng: mới nhất lên trước.
    - **Dành cho bạn** = `social_feed` hiện có, không đổi.
    - **Lớp của tôi** = câu chuyện học tập community thuộc các lớp hiện tại của mình.
    - **Bạn bè** = hoạt động của bạn bè đã chấp nhận.
  - Bộ lọc không tạo quyền mới: server lọc trong tập vốn được xem. Thread "Chỉ Thầy" không bao giờ hiện; Tự học không vào "Lớp của tôi"; bài Social không vào "Lớp của tôi".
  - DB: `db/social_feed_v1_setup.sql` thêm 2 hàm đọc (`social_feed_scoped`, `social_post_card`). Không bảng mới; có preflight và rollback.
  - URL `?feed=classes|friends` (reload và "Quay lại" giữ góc nhìn). Trạng thái trống có lối đi tiếp.
  - Test: DB (thêm 24 kiểm Feed V1), class-social 149, E2E 54 (kết bạn / huỷ kết bạn thật trên stack local).
  - Thiết kế: `docs/SOCIAL-FEED-V1.md`.

- **Class Social — UX polish Phase 2 (`/me`) · chỉ trình bày, không DB/RPC/quyền**
  - **Ô chia sẻ trên điện thoại:** 4 gợi ý xếp 2 × 2, luôn thấy đủ ở 320–430px. Thay cách vuốt ngang cũ, vốn che mất gợi ý cuối.
  - **Quay lại giữ tab:** Hành trình → cuộc trao đổi → Quay lại vẫn ở tab Hành trình; lớp giữ tab Hoạt động/Thành viên. Tab được nhớ trong `history.state`, không đổi URL.
  - **Thầy phản hồi:** một nút chính "Gửi phản hồi". "Cần làm lại" (vàng ấm) và "Đạt" (xanh nhạt) thành nút phụ, đặt tách xa để tránh bấm nhầm. Logic giữ nguyên.
  - **Bớt chữ, bớt hộp:**
    - Bỏ tiêu đề lặp "Cộng Đồng Hành Trình Guitar" trên Home; vẫn giữ cho trình đọc màn hình.
    - Ghi chú "quyền Thầy" trên tường thành một dòng nhỏ.
    - Tường khoá, Hành trình rỗng ("Chưa có dấu mốc học tập.") và hàng đợi rỗng dùng bản nhẹ.
    - Nhãn "Thầy" trong bình luận dùng nền nhạt.
    - Ghi chú mục khoá trên menu ngắn lại.
  - **Tìm lớp:** không có kết quả → "Không tìm thấy lớp phù hợp." ở cả Lớp của tôi và Khám phá. Tab lọc hàng đợi xuống dòng thay vì bị cắt.
  - **Tiêu đề tab trình duyệt:** "Trang chủ · Thầy Văn Anh Guitar".
  - **E2E mới:** composer 320/360/390px; "Quay lại" (Home, Hành trình giữ tab, lớp, link thẳng); đúng một mục menu sáng; không lộ enum thô; menu ☰ đóng sau khi chọn lớp.
  - Nguyên tắc UX và OPEN ITEMS: `docs/SOCIAL-UX.md`.

- **Class Social — UX polish (`/me`) · chỉ trình bày, không migration, không đổi RPC/dữ liệu**
  - **Feed:** thẻ câu chuyện học tập đọc trong 2–4 giây: tên → thời gian · danh tính ngắn (chữ nhỏ, không còn nhãn tím) → "🎸 Trả bài / ❓ Hỏi bài" (chữ thường) → tên bài → chương dạng "Chương 4 · …" (không đổi dữ liệu). Chỉ kể "Thầy vừa nhận xét…" khi Thầy vừa phản hồi hoặc học sinh trả lại bài. Trạng thái dùng nhãn cho người xem: "Chờ Thầy phản hồi". Nút "Xem cuộc trao đổi" là nút nhạt, không phải một dãy nút tím đặc.
  - **Bài Social:** bỏ nhãn "BÀI VIẾT" ở bài thường; "Trả bài / Hỏi bài" là nhãn nhẹ; "🔒 Bạn bè" nằm cạnh thời gian.
  - **Tabs** Tường | Hành trình và Hoạt động | Thành viên: gạch chân như mạng xã hội, thay nút tím đặc.
  - **Hành trình:** bớt hộp. Mốc là dòng bấm được trên đường thời gian, các bước nối bằng "→". Màu chặng giữ nguyên.
  - **Cuộc trao đổi:** tên bài là tiêu đề, còn chương và lớp/khoá nhỏ dần. Avatar đứng ở đầu lượt, thời gian cùng hàng tên. "Cần làm lại" dùng vàng ấm nhạt, không mang cảm giác lỗi. Nhãn "ĐẠT" đổi thành "Đạt".
  - **Điều hướng:** "Quay lại" về đúng màn trước trong `/me` (mở thẳng bằng link thì về Trang chủ). Trang lớp có "← Lớp học".
  - **Bạn bè:** không dựng khung "Chưa có lời mời". Bỏ nút "Xem trang cá nhân" vì bấm tên là đủ. Danh sách đổi tên thành "Tất cả bạn bè".
  - **Trạng thái trống / đang tải:** dùng bản nhẹ (không khung, không icon lớn) ở Feed, trang lớp, `/me/classes` và Tường.
  - Test: class-social 143, E2E 42 (thêm kiểm "Quay lại"). Ảnh 390px/1280px không tràn ngang.

- **Class Social V1/V1.1 — PRODUCTION PASS END-TO-END (đóng)**
  - Học sinh thật (DH2.KD0826) Hỏi bài ở DH2 · Bài 4.4 từ `/learn` → Learning Thread tự đóng dấu DH2.KD0826 → hiện ngay trong Hoạt động của trang lớp; không thành Tự học.
  - Thread tự học cũ (HS03 · Bài 4.3) giữ nguyên danh tính lịch sử. Không migration, không dữ liệu giả.
  - Câu kiểm chỉ đọc: `db/social_classes_v11_kd0826_check.sql`. Chi tiết: `docs/SOCIAL-CLASSES-V1.md` (mục PRODUCTION PASS).

- **Class Social V1.1 — tên lớp thân thiện · hoạt động lớp thật · polish**
  - Menu hiện tên người đọc được ("Hành trình 2027" thay vì HT2027.TH01), chỉ đổi trình bày; một mục sáng duy nhất.
  - Header lớp theo thứ tự tên → Thầy/học viên/lịch → "bạn là thành viên / đang xem"; mã lớp nhỏ ở cuối.
  - `/me/classes` phân biệt "Của tôi" / "Khám phá"; thẻ câu chuyện học tập gọn hơn (tên bài chính, chương phụ, không lặp nhãn lớp trong trang lớp).
  - Test DB: thread thuộc đúng lớp theo snapshot, giữ lịch sử khi rời lớp, quy tắc xác định khi ở nhiều lớp.
  - Có câu audit production chỉ đọc. Không migration, không dữ liệu giả.
  - Chi tiết: `docs/SOCIAL-CLASSES-V1.md` (mục V1.1).

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
