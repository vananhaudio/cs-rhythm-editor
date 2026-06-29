---
name: project_note_trainer
description: "Game \"Đọc nốt nhạc cùng thầy Văn Anh\" (Guitar Note Trainer) — code ở ~/App/Game nhớ nốt nhạc/app"
metadata: 
  node_type: memory
  type: project
  originSessionId: d16fa247-b3d1-4ecd-99d1-5ce6d579ae86
---

Game nhớ/đọc nốt nhạc trên khuông (tông Đô trưởng) của thầy Văn Anh — thầy hay gọi tắt "note lab"/"game nhớ nốt nhạc".

- **Thư mục code: `~/App/Game nhớ nốt nhạc/app`** (giải nén từ `Bài tập nhớ nốt nhạc tông Đô trưởng.zip`, gốc từ Bolt).
- Stack: React 18 + TS + Vite 5 + Tailwind 3 + lucide-react; có `@supabase/supabase-js` nhưng **chưa dùng** (tiến độ lưu `localStorage` key `noteProgress`).
- **Toàn bộ app trong 1 file `src/App.tsx` (~879 dòng)** — Tailwind classes (KHÁC quy ước inline-styles của LMS chính).
- Nội dung: 5 level (3 nốt → toàn khuông C4–A5), mở khoá theo %đúng (70–80%), 2 mode Thường/Tốc độ (timer+streak+speed-level), khuông+khoá Sol vẽ SVG, audio guitar synth Web Audio, confetti, popup level-up.
- **Deploy: `lab.vananhaudio.com`** (đã xác nhận: bundle live chứa marker "Đọc nốt nhạc"/"Chọn cấp độ"/"speedLevel"). Title tĩnh trang là "Bài tập lớp guitar..." chỉ là HTML cũ sót lại, KHÔNG phải app chords.
- **Trong app tổng = tool `note-sheet` name "Note Sheet"**, category "Nhạc lý", enabled, tier free, `edu_tools.route = https://lab.vananhaudio.com/` → mở qua iframe overlay (all-database, không hardcode route trong AppRouter).
- ⚠️ Thư mục local `~/App/Game nhớ nốt nhạc/app` CHƯA có git/remote/netlify config → cần xác nhận cách deploy (Netlify drag-drop dist? CLI? repo riêng?) trước khi ship bản cải tiến.

**Vai trò:** đây cũng là tool "music note" / đọc nốt trong app tổng TVA (LMS cs-rhythm-editor). Mô hình tool ngoài = deploy Netlify riêng → nhúng iframe qua 1 route (giống `/chords` ở `AppRouter.tsx:147` trỏ `chords-vananhaudio.netlify.app`), khai báo trong `TOOLS_MAP` (`MobileStudentPortal.tsx:143`) + bảng `edu_tools` (Supabase). TÍNH ĐẾN 2026-06-14: repo app tổng CHƯA có route/`TOOLS_MAP` cho game này → chưa nối thật, cần wire nếu muốn.

**✅ ĐÃ DUYỆT APP STORE (2026-06-15):** ScoreLab Trainer 1.0 được Apple chấp nhận, eligible for distribution. App Store id **6780222404**, link `https://apps.apple.com/app/scorelab-trainer/id6780222404`. Rủi ro 4.2 KHÔNG xảy ra. Privacy live tại `https://timming.vananhaudio.com/scorelab-privacy/`. (Kế hoạch ghép vào Tune Lab giờ không cần nữa — ScoreLab đứng riêng đã được duyệt.)

**CHỐT 2026-06-14:** đi hướng APP RIÊNG. Đã tạo app trên App Store Connect tên **"ScoreLab Trainer"**. Đang wrap Capacitor iOS (khuôn copy từ Tune Lab `~/Desktop/pitch-lab`: Capacitor core/ios ^8.4.0, cli ^7.6.6, iOS 15, bundle offline `webDir:dist`). App KHÔNG cần mic (chỉ Web Audio output) → không thêm NSMicrophoneUsageDescription. Bundle id: **`com.vananhaudio.scorelab`**.

**iOS project ĐÃ DỰNG XONG** (2026-06-14) tại `~/App/Game nhớ nốt nhạc/app/ios/App/App.xcworkspace`. Đã cấu hình: deployment target 15.0 (4 chỗ trong pbxproj), Podfile `platform :ios, '15.0'`, `ITSAppUsesNonExemptEncryption=NO`, khoá portrait-only + **`UIRequiresFullScreen=true`** (BẮT BUỘC: nếu portrait-only mà vẫn hỗ trợ iPad, Apple báo lỗi 90474 đòi đủ 4 hướng cho multitasking; UIRequiresFullScreen=true để opt-out multitasking, giữ portrait), CFBundleDisplayName "ScoreLab Trainer", icon 1024 đặc tràn viền (logo SLT chữ kem + chấm cam trên nền xanh #06503E, tạo bằng PIL từ `~/App/Game nhớ nốt nhạc/SLT logo.png`). MARKETING_VERSION 1.0. Build 1 đã lên TestFlight. Build 2 (CURRENT_PROJECT_VERSION=2) sửa: safe-area (2 container `fixed inset-0` thêm `paddingTop/Bottom: env(safe-area-inset-*)` vì position:fixed bỏ qua padding body — đây là cách fix màn bị status bar che), header đổi logo C#→logo SLT (`public/logo.png` = icon SLT 256px) + tên "ScoreLab Trainer" (cả 2 màn). Build 3 (CURRENT_PROJECT_VERSION=3): chuyển **TARGETED_DEVICE_FAMILY="1" (chỉ iPhone)** để bỏ yêu cầu screenshot iPad 13". Ảnh App Store sạch (đã xoá status bar) ở `~/Desktop/ScoreLab-AppStore/` — bản 1290×2796 (6.7/6.9") và `6.5inch_1284x2778/`.
- ⚠️ **BẪY: `pod install`/`npx cap` PHẢI chạy với `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`** vì đường dẫn có dấu tiếng Việt ("Game nhớ nốt nhạc") làm CocoaPods (Ruby 3.4) chết ở `unicode_normalize` (ASCII-8BIT). Cân nhắc đổi sang thư mục ASCII nếu phiền.
- CÒN LẠI (thủ công trong Xcode): mở workspace → set Team `S6ASX8GP62` (VAN ANH AUDIO) cho signing → Archive → Upload lên App Store Connect (app "ScoreLab Trainer" đã tạo sẵn).

**Định hướng cũ (đã thay bằng dòng trên):** Note Sheet thuộc nhánh "cao độ" cùng Tune Lab. KHÔNG ghép vội. Trình tự: (1) chuốt/polish Note Sheet trước, giữ đứng độc lập; (2) chờ Apple duyệt Tune Lab (đang chờ review) → NẾU duyệt thì ghép Note Sheet thành tab thứ 2 trong Tune Lab (giữ tên "Tune Lab", bundleId `com.vananhaudio.pitchlab` đã sẵn — "Tune"=giai điệu/nốt nên đủ rộng; tab bar: Lên dây / Đọc nốt); NẾU bị từ chối thì tách Note Sheet thành app iOS riêng (Capacitor, bundle offline, khuôn copy từ `~/Desktop/pitch-lab`). Tên "Pitch Lab" KHÔNG dùng được (trùng trên App Store).

Khác với [[project_groove_lab]] (Expo, tiết tấu) và Tune Lab (`~/Desktop/pitch-lab`, tuner Capacitor, cùng nhánh cao độ — ứng viên ghép).
