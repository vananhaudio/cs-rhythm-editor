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

## App iOS (Capacitor) — đã lên TestFlight
- Vỏ Capacitor. `appId` `com.vananhaudio.guitar`, app name "TVA Guitar". Dự án iOS: `ios/App/App.xcworkspace`.
- `capacitor.config.json`: `server.url = https://timming.vananhaudio.com` → app chỉ tải web live ⇒ **deploy web là app tự cập nhật**, KHÔNG cần build lại Xcode. Chỉ khi đổi vỏ native (icon/plugin) hay bỏ `server.url` mới phải build lại.
- Podfile `platform :ios, '15.0'`. App target **Minimum Deployment iOS 15.0** (Capacitor 8 cần ≥15; trước để 14.0 gây lỗi compile).
- Team: VAN ANH AUDIO COMPANY LIMITED (Team ID `S6ASX8GP62`). App Store Connect app id `6776205968`. Nhóm internal TestFlight: "Thầy Văn Anh v1".
- Build TestFlight hết hạn ~90 ngày → tăng số **Build** trong Xcode (tab General), Archive, Upload lại. Học viên chỉ bấm Update trong app TestFlight (không cài lại).
- Lên App Store công khai cần qua Guideline 4.2: thêm lớp native (push notification, offline cho công cụ lõi, điều hướng native, icon/splash). Icon hiện vẫn mặc định trắng.

## Đang làm dở / cần làm
- Theo dõi tiến độ thật (đánh dấu hoàn thành bài) — đã có `edu_lesson_progress` + nút "✓ Xong"/XP trong `MobileStudentPortal`.
- `LessonViewerPage` khớp wireframe mobile (video + nội dung + ghi chú + bài kế).
- Nhập nốt ~20% giáo trình Edubit qua `/admin` → nút "📥 Nhập hàng loạt".
- Hoàn thiện Tuner (đang làm ở Bolt).
- Thêm chord finger guide Em/C/G theo mẫu `ChordAmGuide`/Am.
- Fix `guitarNotes.ts` dòng 51 (octave): `2 + octaveOffset + (semitone >= 8 ? 1 : 0)`.
