# BÀN GIAO — TVA Guitar LMS (cs-rhythm-editor)

> Bản bàn giao đẩy lên GitHub để **không mất dữ liệu** (backup ngoài máy + lịch sử phiên bản).
> Cập nhật gần nhất: **2026-07-02** (Journey OS GĐ1).
>
> - **Bộ nhớ chi tiết** (Claude tự đọc mỗi phiên): `~/.claude/projects/-Users-vananhaudio-Desktop-cs-rhythm-editor/memory/`
> - **Bản sao bộ nhớ trong repo** (an toàn, versioned): [`docs/memory-backup/`](./memory-backup/) — xem [`MEMORY.md`](./memory-backup/MEMORY.md) làm mục lục.

## Dự án
LMS dạy guitar online "Thầy Văn Anh Guitar". React + TS + Vite + Tailwind (chủ yếu **inline styles**). Supabase (`wojmdilyflffvdtpovmq`). Deploy: push `main` → Netlify → `timming.vananhaudio.com` (app) & `class.vananhaudio.com` (tuyển sinh). Vỏ iOS Capacitor (TestFlight) tải web live. **Build BẮT BUỘC `npm run build` (tsc -b + vite) trước khi push.** Xem `CLAUDE.md` cho quy ước đầy đủ.

## Việc làm trong đợt gần nhất (2026-07)

### Journey OS — GĐ1: Lịch thật + tiến trình lớp (2026-07-02, LIVE)
Biến `/admin` tab **Lịch lớp** thành nền của "hệ điều hành hành trình". Spec đầy đủ: `docs/JOURNEY-OS-SPEC.md`. Nguyên tắc: **Mira đề xuất, thầy duyệt** (GĐ sau).
- **SQL `db/journey_os_stage1.sql` (ĐÃ chạy, idempotent):** nâng `class_schedule` thêm cột ngày/giờ thật (`start_date`, `weekday` 0=CN..6=T7, `start_time`, `duration_minutes`, `total_sessions`, `end_date`, `status` enum 11 trạng thái lớp, `max/min_students`) — **giữ nguyên** cột text cũ (`schedule`/`start_text`/`duration`) cho trang tuyển sinh. Bảng MỚI **`class_sessions`** (từng buổi: `session_number`/`start_at`/`end_at`/`status` 6 trạng thái buổi). RLS: `class_sessions` **thầy-only**, anon KHÔNG đọc → nếu chạy lại `rls_setup.sql` phải thêm `'class_sessions'` vào mảng `self_managed`.
- **Sinh buổi Ở CLIENT** (không dùng trigger) — `src/journey/sessions.ts`: `generateSessions` sinh N buổi cách 7 ngày (1 buổi/tuần), tự dời buổi 1 về đúng thứ; `realStart/EndDate`, `progressInfo` (buổi X/tổng), `scheduleText`; export `STATUS`/`statusInfo` dùng chung. Khi lưu lớp: đồng bộ `class_sessions`, **giữ buổi đã `completed`**, tự tính `end_date` + gợi ý text lịch cũ.
- **UI `ScheduleManager` — 3 tab:** 📋 Danh sách (badge buổi X/8 + chấm màu trạng thái + ngày KT) · 📅 **Lịch tuần** (`src/journey/CalendarWeek.tsx`: lưới T2–CN, khối buổi màu theo status lớp, ◀ Tuần này ▶, click buổi → popup đánh dấu đã dạy/huỷ/dời/bù/nghỉ) · 📊 **Chỉ số** (`src/journey/ScheduleDashboard.tsx`: buổi hôm nay/tuần này, đang học, sắp KG, sắp KT/xếp tiếp, nháp).
- **Giả định:** 1 buổi/tuần (`weekday` kiểu int). Muốn nhiều buổi/tuần phải đổi sang mảng.
- **Còn lại:** GĐ3 Nhu cầu + lớp nháp · GĐ4 Ưu đãi + Mira Planner. Commits `84cb734`, `c72a151`.

### Journey OS — GĐ3: Nhu cầu mở lớp + lớp nháp (2026-07-02, LIVE)
- **SQL `db/journey_os_stage3.sql` (ĐÃ chạy):** bảng **`class_demands`** (thầy nhập tay: HV muốn học mã năng lực nào, khung ngày/giờ, ưu tiên, status waiting/planned/enrolled/cancelled). RLS thầy-only → thêm `'class_demands'` vào `self_managed` nếu chạy lại `rls_setup.sql`.
- **Nguồn nhu cầu = thầy nhập tay ở /admin** (đã chốt; nút phía học viên để GĐ sau).
- Tab **📥 Nhu cầu** (`src/journey/DemandsBoard.tsx`): form ghi + gom theo mã năng lực. **Rule R2** ngưỡng 4 người/khoá → badge "Đủ mở lớp" + nút "Tạo lớp nháp" (mở form lớp prefill khoá chính + status draft). Lớp nháp: nét đứt/nền nhạt trên Calendar. Commit `2d3ff94`.
- **Còn lại:** GĐ4 Ưu đãi + Mira Planner.

### Journey OS — GĐ2: Bản đồ hành trình (2026-07-02, LIVE)
- Tab **🗺 Bản đồ** trong Lịch lớp — `src/journey/JourneyMap.tsx`. **Thuần frontend, không SQL** (suy từ dữ liệu sẵn có, không tạo bảng `student_journeys`).
- Vẽ 5 nhánh từ `hanhtrinh.ts`: Nhập môn · Đệm hát (DH1→DH2→DH3→DHNC) · Tỉa nốt (TN1→TN2→TN3) · Nhạc lý (NL1→NL2→NL3) · Solo, nối bằng →.
- Mỗi mốc = 1 mã năng lực: node **đậm** nếu `edu_courses` có code đó, **mờ** nếu chưa dựng. **Gắn lớp thật** vào mốc qua `main_course_id`→code: mã lớp + buổi X/8 + chấm màu status. Commit `7129d10`.

## Việc làm trong đợt trước (2026-06)

### Đưa Groove Lab vào LMS — module "Tiết tấu" (2026-06-30)
- **Port toàn bộ Groove Lab** (app Expo riêng `~/App/project/`) sang web, gom ở **`src/groove/`** (inline styles, Web Audio thuần):
  - `metronomeClock.ts` ← port `audio/clock.ts` (bỏ react-native-audio-api → `window.AudioContext`).
  - `lessons.ts` + `rhythmLessons.json` ← 30 bài tiết tấu + `analyzeBar` (chia ô nhịp).
  - `RhythmStaff.tsx` ← vẽ khuông nốt SVG + beam + ↓↑; **rAF nội bộ** cho glow nốt + con trượt sáng theo phách (thay `Animated` của RN).
  - `GrooveLesson.tsx` ← màn bài: 3 tầng **Nhịp Điệu → Sắc Thái → Câu Chuyện** + tempo + "lời thầy".
  - `GrooveBackingPad.tsx` ← "Nền tập quạt" (tab Tập mới của Groove Lab); **tái dùng `src/elearn/backing/backingEngine.ts` có sẵn** (không viết lại engine trống+bass).
  - `GrooveExercise.tsx` ← overlay fullscreen 2 tab **Học | Tập**.
- **Gắn vào "Hôm nay luyện gì?"** (`MobileStudentPortal`, tab Tập): nâng cấp mục `metronome` → tên **"Tiết tấu"** (🥁, xanh `#2E7D52`) mở `GrooveExercise`; cộng timer/XP như finger/scale. Cùng nhánh `#exercise:metronome` trong bài học.
- `backingStyles.ts`: thêm `PRESETS` (6 vòng hợp âm mẫu, additive — không đụng `ChordStrumPlayer`).
- Route trực tiếp **`/groove`** để xem module. Verify preview: danh sách 30 bài, metronome sáng nốt đồng bộ, dấu nhấn Sắc Thái, nền tập quạt highlight ô. Build sạch, push main.
- **CHƯA làm (đợt sau):** nút "Hỏi thầy về bài này" (Groove offline; LMS có thể nối Mira); phần "SỐNG"/Strum Score.



### Strum Score (gảy theo nền) — `src/elearn/ChordStrumPlayer.tsx`
- Hiển thị bản nhạc hợp âm "như sách", chạy theo nền synth (trống+bass) hoặc mp3/YouTube.
- **Engine nền** `src/elearn/backing/` (backingEngine.ts + backingStyles.ts): trống+bass 5 điệu, **giai điệu** (tiếng chuông), **count-in**, ô **"Out"/kết** (chốt 1 cú: kick+crash+bass rồi im), **tự cuộn** khuông tới ô đang chơi, cờ `loop=false` (chơi 1 lượt rồi dừng).
- **Ghi âm thành quả**: thu tiếng đàn TRỘN SỐ với nền (cùng AudioContext) — chạy cả chế độ nền synth lẫn mp3 (HBD, qua MediaElementSource + crossOrigin; Supabase CORS `*`). Tắt EC/NS/AGC cho tiếng đàn trong. Lưu LOCAL, KHÔNG upload → quyền riêng tư sạch. Mic permission đã có sẵn (Tuner). Xem `docs/memory-backup/project_strum_recording.md`.
- Bài Jingle Bells: `src/elearn/strumSongs.ts` (STRUM_JINGLE chùm 2 + STRUM_JINGLE_DEN nốt đen), gắn 2 khoá qua registry native (`song-jingle-chum2`/`song-jingle-den`) — SQL `db/lesson_jingle.sql`.

### Mở khoá học = vòng ĐĂNG KÝ → THẦY DUYỆT
- Học sinh đăng nhập bấm "Đăng ký lớp này" (trang Lịch) → form **tự điền sẵn** tên/email/SĐT + ô tick **"học sinh lớp Hành trình — miễn phí"** → ghi `leads` (is_hanhtrinh, status 'Chờ duyệt').
- Admin tab **Đăng ký** (`LeadsManager`): nút **"Duyệt & mở khoá"** → enroll + edu_course_access. SQL `db/course_request_setup.sql` (ĐÃ chạy).
- Ý tưởng cohort HT2026/HT2027 **đã GỠ HẲN** (đừng khôi phục). Nhóm Zalo là hệ độc lập.

### Mira (trợ lý class-ai) — `supabase/functions/class-ai/index.ts`
- Cho truy cập dữ liệu **mức 1** (danh mục khoá thật) + **mức 2** (hồ sơ RIÊNG người đang đăng nhập — xác thực token, chỉ dữ liệu của chính họ). ĐÃ deploy tay trên Dashboard.
- **Edge Function deploy TAY** (Dashboard → Edge Functions, KHÔNG phải SQL Editor, không qua Netlify).
- Định hướng tiếp: nâng Mira thành **trợ lý chăm sóc học sinh đặc biệt**. Xem `docs/memory-backup/project_mira_assistant.md`.

### Mira đọc dữ liệu (mức 1+2) — đã deploy
- `class-ai/index.ts`: đọc danh mục khoá thật (mức 1) + hồ sơ RIÊNG người đăng nhập qua xác thực token (mức 2). Hướng tới trợ lý chăm sóc học sinh.

### Phát hành app (2026-06-29)
- **iOS:** version **1.0.1**, build **12**, icon C# nền xanh → đã upload TestFlight/App Store Connect. Build lại: tăng Build trong Xcode (file đã set sẵn) → Archive → Upload. Train 1.0 đã đóng → mỗi lần nộp phải tăng cả **MARKETING_VERSION**.
- **Android (Capacitor):** đã thêm quyền **RECORD_AUDIO** (trước thiếu → micro KHÔNG chạy trên app Android: Tuner, chấm hợp âm, ghi âm). `uses-feature microphone required=false`. Ký release đọc từ `android/keystore.properties` (gitignored, mật khẩu KHÔNG commit). Build: `cd android && ANDROID_HOME=~/Library/Android/sdk ./gradlew bundleRelease` → AAB ở `app/build/outputs/bundle/release/`. Upload key: `~/App/TVA Androi/tvauploadkey.jks`. versionCode hiện 5.

### Quản trị & cộng đồng (2026-06-29)
- **Xếp hạng theo lớp:** `MobileStudentPortal` dùng RPC `my_class_leaderboard` (db/class_leaderboard.sql) — chỉ bạn cùng nhóm Zalo, gộp nhiều lớp, top 5 + "Xem thêm".
- **Báo cáo admin:** `StudentList` có nút "📊 Báo cáo" — bảng XP/bài xong/khoá đã mở/hoạt động; lọc Toàn bộ / Theo lớp / Theo khoá (chỉ frontend, không cần SQL).

## SQL cần để ý
- ĐÃ chạy: `db/course_request_setup.sql`, `db/class_leaderboard.sql` (RPC xếp hạng theo lớp), `db/lesson_jingle.sql` (gắn 2 bài Jingle vào khoá) — tất cả xác nhận chạy 2026-06-30.
- ĐÃ XOÁ (đừng chạy): các file cohort cũ.

## Quy trình làm việc với Claude (khuyến nghị)
- Tách thành **nhiều chat nhỏ theo chủ đề**; mọi chat trong project này **dùng chung bộ nhớ** (tự nạp `MEMORY.md`).
- Xong một mảng → Claude chốt vào memory → mở chat mới cho việc kế. Lâu lâu chạy lại file này để cập nhật bàn giao.
