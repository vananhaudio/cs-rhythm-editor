# CLAUDE.md — Thầy Văn Anh Guitar LMS (cs-rhythm-editor)

> Hướng dẫn cho Claude Code. **Luôn trả lời bằng tiếng Việt.**

## Dự án
LMS dạy guitar online của Trần Văn Anh ("Thầy Văn Anh Guitar"). Triết lý: HỌC – TẬP – SỐNG CÙNG ÂM NHẠC. Một mình làm cả nội dung lẫn full-stack.

## Stack & hạ tầng
- React + TypeScript + Vite + Tailwind.
- Supabase: project `wojmdilyflffvdtpovmq.supabase.co` (client ở `src/supabase.ts`).
- Deploy: GitHub `vananhaudio/cs-rhythm-editor` → Netlify tự deploy **nhánh `main`** ra `timming.vananhaudio.com`. (Nhánh dev không dùng nữa.)
- Lệnh deploy: `git add . && git commit -m "..." && git push origin main`. Commit tiếng Việt OK.

## Quy ước BẮT BUỘC tuân thủ
- **All-database, KHÔNG hardcode nội dung.** Mọi khoá/bài/công cụ nằm trong Supabase.
- **SERVER-DRIVEN CONTENT (từ 08/2026):** nội dung thay đổi thường xuyên (bản tin, thông báo, banner, video giới thiệu, bài viết, ảnh, PDF, link, sự kiện, CTA, giới thiệu khóa học) BẮT BUỘC lấy từ backend/Admin — app native chỉ chứa capability/renderer chung. Store update CHỈ khi thêm capability mới, KHÔNG BAO GIỜ vì đổi content. Khuôn mẫu: "Bản tin hôm nay" — bảng `home_feed_items` (type: article/video/image/document/link/announcement/course/event + `open_mode`: in_app/native/external), renderer chung `src/HomeFeed.tsx` (overlay in-app có nút Đóng, KHÔNG đá ra Safari trừ khi `open_mode=external`), CMS ở Admin → "Bản tin" (`src/admin/NewsFeedAdmin.tsx`), migration `db/home_feed_v2.sql`. KHÔNG viết renderer riêng cho một bài cụ thể; KHÔNG fallback về mock giả trong production (lỗi mạng → cache gần nhất hoặc "Chưa tải được bản tin"). RLS: anon/học viên chỉ ĐỌC item published còn hiệu lực; ghi = teacher (`is_teacher()`); bảng nằm trong `self_managed` của `rls_setup.sql`. Asset (thumbnail/ảnh/PDF) lưu Supabase Storage bucket `lessons` (thư mục `feed/`), DB chỉ giữ URL.
- **Mobile là giao diện học viên chính.** `<1024px` → `MobileStudentPortal` (breakpoint 1024 để iPad cũng vào giao diện cảm ứng — fix Apple 2.1; desktop ≥1024 → `StudentPortalV2`).
- **Toàn bộ dùng INLINE STYLES, KHÔNG dùng Tailwind** — TRỪ `ChordsPage` và `ChordAmGuide` (2 file này dùng Tailwind).
- UI phức tạp thường prototype ở Bolt; tích hợp/fix/deploy ở đây.
- **Nguyên tắc vàng UX — Scroll có chủ đích:**

| Màn hình | Scroll | Lý do |
|---|---|---|
| **Flow Player** | ❌ KHÔNG | Mỗi slide = 1 màn hình trọn vẹn, nút luôn hiển thị |
| Tool (tap, tuner...) | ✅ Được | Công cụ tương tác |
| Nhật ký / Ghi chú | ✅ Được | Bản chất là văn bản dài |
| Admin | ✅ Được | Công cụ soạn thảo |

**FlowPlayer bắt buộc:** `height: 100dvh`, `display: flex; flex-direction: column`, vùng nội dung `flex:1; overflow:hidden`, nút bấm luôn cố định ở cuối. Nội dung slide dài → cắt/ẩn, KHÔNG để tràn.

## Routing — `src/AppRouter.tsx`
KHÔNG dùng react-router. Tự kiểm tra `window.location.pathname` bằng chuỗi `if`. Auth qua `supabase.auth`; vai trò lấy từ bảng `app_users`; `isTeacher = role === 'teacher' || role === 'admin'`.
- `/` → `StudentOnboarding` (trang chủ — app mở vào đây)
- `/start` → `StudentOnboarding` (tự nhận mobile → `MobileStudentPortal`; desktop → `StudentPortalV2`)
- `/admin` → `TeacherAdminPage` (chỉ teacher; chứa `CourseEditorContent`, `ToolsManager`, `StudentList`...)
- `/course?id=` → `LessonViewerPage`
- `/chords` → iframe nhúng `chords-vananhaudio.netlify.app`
- `/tap` → `TapWithSong` (chưa login → `TapLandingPage`)
- `/tempo` → `TapTempoTool` · `/tuner` → `GuitarTuner` · `/guitarboard` → `GuitarBoard`
- `/editor` → `App` (rhythm editor, chỉ teacher) · `/youtube-sync` → `YouTubeSyncPage` (teacher) · `/import` → `ImportPage` (teacher)
- fall-through → `PlayerView` (trang chủ cũ của teacher; vào bằng `/player`)

## Database (Supabase) — RLS đang BẬT trên mọi bảng `public`
Sau khi đổi schema phải chạy `NOTIFY pgrst, 'reload schema';`.
- **RLS (từ 2026-06):** mọi bảng `public` có policy `authenticated` TOÀN QUYỀN (`FOR ALL USING(true)`) — thầy + học viên đã đăng nhập dùng như cũ. `anon` CHỈ được SELECT 6 bảng nội dung không-PII: `edu_courses`, `edu_modules`, `edu_course_lessons`, `edu_tools`, `flows`, `timming_songs`. `anon` KHÔNG ghi/xóa bất cứ đâu, KHÔNG đọc bảng PII. Script: `db/rls_setup.sql` (idempotent). KHÔNG đọc `edu_students`/`student_taps`/`flow_progress` khi chưa đăng nhập (app đã sửa). `delete_my_account` là SECURITY DEFINER nên RLS không chặn.
- **Ngoại lệ app_users:** authenticated CHỈ ĐƯỢC ĐỌC (policy `rls_authenticated_read`), KHÔNG ghi — chặn học viên tự `UPDATE role='admin'` để leo quyền (app chỉ đọc app_users, đổi role làm qua SQL). ĐỪNG cấp lại FOR ALL cho app_users.
- **Tính năng "Cộng đồng" (`db/community_setup.sql`):** 3 bảng `edu_groups`/`edu_group_members`/`edu_group_claim_tokens` TỰ QUẢN RLS hẹp (teacher-only + self-read) + RPC `is_teacher()`/`claim_group(token)`/`my_groups()` (SECURITY DEFINER). `rls_setup.sql` đã được sửa để **BỎ QUA** 3 bảng này (mảng `self_managed`) — đừng để vòng lặp áp policy rộng lên chúng.
- Stage 3 chưa làm: siết policy theo-hàng (mỗi học viên chỉ sửa dữ liệu của mình) — hiện authenticated vẫn có quyền rộng lên dữ liệu của nhau.
- `edu_course_lessons` ← **DÙNG BẢNG NÀY** (KHÔNG dùng `edu_lessons` cũ). Cột: `title`, `lesson_type`, `content_url`, `description`, `content`, `tools` (jsonb).
- `edu_courses`, `edu_modules`, `edu_students`, `edu_enrollments`.
- `edu_tools`: `id` text PK, `enabled` (bool — false = ẩn công cụ), `route`.
- `app_users` (role), `edu_lesson_progress`, `student_songs` (journey jsonb), `student_xp_log`, `student_practice_log`.
- `lesson_type`: video, text, slide, quiz, game, tap, metronome, backing_track, submit_video, discussion, link.
- Mở khoá theo tier: free/basic/standard/pro → beginner/elementary/intermediate/advanced.

## Design tokens
- Desktop portal: accent `#4F46E5`, bg `#F4F4F5`, surface `#FFFFFF`.
- Mobile (light): primary `#4338CA`, accent `#EA580C`, bg `#F0F2F5`.
- Admin sidebar: nền tối `#18181B`.

## File chính
`AppRouter.tsx` (routing), `main.tsx` (entry), `StudentOnboarding.tsx`, `StudentPortalV2.tsx`, `MobileStudentPortal.tsx`, `TeacherAdminPage.tsx`, `CourseEditorContent.tsx`, `LessonViewerPage.tsx`, `ToolsManager.tsx`, `StudentList.tsx`, `StudentProfile.tsx`, `App.tsx` (rhythm editor), `GuitarTuner.tsx`, `TapWithSong.tsx`, `YouTubeSyncPage.tsx`, `ImportPage.tsx`, `GuitarBoard.tsx` (+ `GuitarFretboard`, `ScoreTabViewer`, `TeachingBoard`, `audioEngine`, `guitarNotes`, `scoreData`), `supabase.ts`, `types.ts`, `utils.ts`.

## Piano Journey — "TRÒ CHUYỆN" là WebRTC Realtime, KHÔNG phải speech-to-text
Màn đầu của Piano Journey là **hội thoại 2 chiều với Cô Piano** qua **OpenAI Realtime API + WebRTC** (`src/piano/TalkWithTeacher.tsx` ↔ edge function `realtime-token`). Trẻ nói, AI trả lời **bằng giọng nói**. Đây là tính năng chính, và nó CHẠY THẬT trong WKWebView vì WebRTC + `getUserMedia` được hỗ trợ đầy đủ.
- **ĐỪNG thay bằng `SpeechRecognition`.** Ngày 28/07 commit `0406b72` đã làm đúng việc đó — thay cả PianoJourney bằng Web Speech API — và **xoá mất hội thoại**, tốn trọn một ngày đi tìm "lỗi mic" không tồn tại. Nếu thấy PianoJourney không còn `RTCPeerConnection`, tức là hội thoại lại bị xoá.
- Giao thức: client tạo SDP offer → **gửi dạng JSON** `{sdp}` tới `realtime-token` (gửi raw text gây lỗi ByteString header, xem `bcfb8dd`) → function proxy sang `/v1/realtime/calls` → trả `{sdp}` answer.
- ⚠️ **TUYỆT ĐỐI KHÔNG `supabase functions deploy realtime-token`.** File trong repo để `OPENAI_API_KEY = '***'`, còn **bản đã deploy mới có key thật** (hardcode, không dùng secret). Deploy đè = phá hỏng hội thoại. Muốn đổi cấu hình session thì làm từ client bằng `session.update`, đừng sửa function.
- **Nói chuyện để TẠO BÀI TẬP**: client gửi `session.update` khi data channel mở, khai báo công cụ `tao_bai_tap`. Bé nói "con muốn bài về khủng long" → cô gọi công cụ → `generateMission` chạy ngay trong lúc cô còn nói → sang LearningFlow. Bắt **cả hai** dạng sự kiện `response.function_call_arguments.done` và `response.output_item.done` (API bắn khác nhau tuỳ phiên bản), chống gọi trùng bằng `Set` call_id.
- Kết nối **bằng cú chạm của trẻ**, đừng auto-connect: iOS cần user gesture để mở micro và phát tiếng AI.
- Cần đăng nhập (Realtime tốn tiền). Chưa đăng nhập → báo rõ, không im lặng.

## Mic trong app (phần tạo bài tập) — CÁI BẪY ĐÃ LÀM MẤT 1 NGÀY
**Trong WKWebView (app iOS), `webkitSpeechRecognition` CÓ MẶT nhưng CHẾT.** Đây là điểm khiến chẩn đoán sai: kiểm `if (!SpeechRecognition)` sẽ THẤY CÓ và tưởng ổn, nhưng `start()` chạy xong rồi **không bao giờ bắn `onstart`/`onresult`/`onerror`/`onend`** ⇒ treo ở "Đang nghe..." vĩnh viễn, không một lỗi nào. App Capacitor luôn chạy trong WKWebView (dù bundled hay live), còn **test trên Chrome desktop thì luôn thấy chạy tốt**. Đừng chẩn đoán bằng desktop, và đừng tin phép kiểm "API có tồn tại".
- Cách phát hiện duy nhất đáng tin: **watchdog dựa trên `onstart`/`onaudiostart`** (browser thật bắn gần như tức thì) — không thấy dấu hiệu sống trong ~3s thì coi là chết và tụt tầng. ĐỪNG dùng watchdog trên `onresult`, vì trẻ nói chậm là tụt tầng oan.
- Dùng `src/piano/useVoiceInput.ts` (3 tầng tự tụt: Web Speech → `MediaRecorder` + Whisper qua edge function `piano-stt` → gõ text). Cần mic ở đâu thì tái sử dụng hook này, đừng gọi `SpeechRecognition` trực tiếp.
- **`SpeechRecognition.start()` phải gọi ĐỒNG BỘ trong user gesture.** `await getUserMedia()` trước `start()` làm mất user-activation → iOS chặn (đây là lý do commit `05adc37` hỏng rồi bị revert).
- **Đừng restart trong `onerror`** — spec chạy `onerror` TRƯỚC `onend`, `start()` lúc đó throw `InvalidStateError`. Restart trong `onend`.
- Tool cần mic thì **render thẳng, KHÔNG iframe** (`getUserMedia` trong iframe của WKWebView hay bị chặn) — xem khuôn BMS/Piano Journey trong `openTool`.
- Edge function `piano-stt` cần secret `OPENAI_API_KEY` (Whisper). Thiếu secret thì Tầng 2 trả 502 và app tự lùi về ô gõ.

## App iOS (Capacitor) — ĐÃ PHÁT HÀNH TRÊN APP STORE
- Vỏ Capacitor. `appId` `com.vananhaudio.guitar`, app name "TVA Guitar". Dự án iOS: `ios/App/App.xcworkspace`.
- **KIẾN TRÚC (từ 1.2): BUNDLED WEB ASSETS.** `capacitor.config.json` **KHÔNG bật `server.url`** (chỉ `appId`/`appName`/`webDir: dist`). App production iOS **và** Android chạy bản web **đóng gói trong native**, KHÔNG tải web live. ⇒ **Deploy web KHÔNG tự cập nhật app đã cài.** Mọi thay đổi UI muốn tới người dùng store phải: `npm run build` → `npx cap copy ios/android` (bake `dist` vào native) → tăng version/build → build lại native → nộp lại store. ĐỪNG bật lại `server.url`.
- Podfile `platform :ios, '15.0'`. App target **Minimum Deployment iOS 15.0** (Capacitor 8 cần ≥15; trước để 14.0 gây lỗi compile).
- Team: VAN ANH AUDIO COMPANY LIMITED (Team ID `S6ASX8GP62`). App Store Connect app id `6776205968`. Nhóm internal TestFlight: "Thầy Văn Anh v1".
- **Cập nhật vỏ native** (đổi Info.plist/quyền/icon/plugin): tăng số **Build** (và Version nếu phát hành) trong Xcode → Archive → Upload → App Store Connect → gửi duyệt bản mới → học viên Update từ App Store. TestFlight chỉ là bước thử TRƯỚC khi gửi duyệt, không bắt buộc.
- ⚠️ Vì app BUNDLED (không `server.url`), thay đổi web KHÔNG tự tới app đã cài — phải bake + build lại native + nộp store (xem dòng KIẾN TRÚC ở trên). Web deploy chỉ cập nhật bản chạy trên trình duyệt `timming.vananhaudio.com`.
- (Cũ, đã qua: từng chỉ ở TestFlight và vướng Guideline 4.2 — nay đã phát hành công khai. Nhóm internal TestFlight "Thầy Văn Anh v1" vẫn dùng để thử bản mới.)

## Đang làm dở / cần làm
- Theo dõi tiến độ thật (đánh dấu hoàn thành bài) — đã có `edu_lesson_progress` + nút "✓ Xong"/XP trong `MobileStudentPortal`.
- `LessonViewerPage` khớp wireframe mobile (video + nội dung + ghi chú + bài kế).
- Nhập nốt ~20% giáo trình Edubit qua `/admin` → nút "📥 Nhập hàng loạt".
- Hoàn thiện Tuner (đang làm ở Bolt).
- Thêm chord finger guide Em/C/G theo mẫu `ChordAmGuide`/Am.
- Fix `guitarNotes.ts` dòng 51 (octave): `2 + octaveOffset + (semitone >= 8 ? 1 : 0)`.

## Billing Foundation (BƯỚC 8A) — KHÔNG đụng khi chưa hiểu
- **Billing ≠ Entitlement.** Billing Core (`db/billing_setup.sql`) KHÔNG gọi `activate_student_package`/`apply_package_permissions`, KHÔNG tạo `edu_students`/`edu_enrollments`/`edu_course_access`. Entitlement vẫn do `packages`/`student_packages` lo.
- **Mọi write billing qua SECURITY DEFINER functions** (`billing_ingest_event`, `billing_record_manual_payment`...). Frontend/PostgREST KHÔNG được tự UPDATE `billing_subscriptions.status`/`billing_payments.status`. RLS: anon không policy nào; authenticated chỉ teacher SELECT.
- **Idempotency**: `UNIQUE(provider, external_event_id)` trong `billing_events` — KHÔNG apply transition 2 lần, KHÔNG overwrite event cũ.
- **Payment lịch sử**: mỗi attempt mới = `billing_payments` record MỚI. KHÔNG đổi `failed → succeeded` trên cùng record.
- **Trial source of truth**: `billing_subscriptions.trial_started_at/ends_at`. `leads.trial_started_at` là legacy (sync 1 chiều, không DROP). KHÔNG dùng `edu_students.trial_expires_at` cho Class 2.0.
- **Provider boundary**: `supabase/functions/_shared/billing/provider.ts` — `getProviderAdapter()` trả null khi chưa chốt provider; `billing-webhook` từ chối an toàn (503). KHÔNG giả Stripe/provider.
- **Giá**: chỉ trong `billing_products` (4 mã chuẩn). KHÔNG hardcode giá rải rác.
- Chi tiết: `docs/BILLING.md`.
