---
name: project_groove_lab
description: "Groove Lab — app Expo dạy tiết tấu guitar, ĐÃ DUYỆT & lên App Store (v1.0 iOS, 2026-06-14, build 7 iPhone-only); link apps.apple.com/app/groove-lab/id6778263562"
metadata: 
  node_type: memory
  type: project
  originSessionId: 617ea51e-3947-431b-9f18-619d6b837510
---

**Groove Lab** (trước tên "Rhythm Lab") là app **Expo React Native** dạy tiết tấu/tay phải guitar của Thầy Văn Anh — DỰ ÁN RIÊNG, KHÁC repo cs-rhythm-editor.

- Vị trí: `~/App/project/` (ngoài repo cs-rhythm-editor). Slogan + 3 chế độ trong bài: **Nhịp Điệu • Sắc Thái • Câu Chuyện**.
- Stack: Expo SDK 54, expo-router (typed routes), react-native-audio-api (metronome lookahead scheduler `audio/clock.ts`). 30 bài trong `data/rhythmLessons.json`, offline hoàn toàn, không backend/login/quyền.
- VERSION: 1.0.0 đã duyệt công khai App Store (build 7). Đợt thêm tab Tập = **1.1.0** (đang TestFlight). LƯU Ý: version 1.0.0 đã bị Apple "khoá train" sau khi duyệt → mỗi đợt tính năng mới PHẢI bump `version` trong app.json (1.1.0→1.2.0…), không chỉ buildNumber (EAS tự tăng). Quên bump version → lỗi 90186/90062 khi submit.
- Android/CH Play: đã build `.aab` qua EAS (keystore EAS tự tạo, đã dọn quyền thừa RECORD_AUDIO/foreground-service trong app.json), đang đưa lên Play Console (upload TAY). Tài khoản Play của thầy đã có sẵn + đã publish 2 app (TVA Guitar, Beat My Songs) nên KHÔNG vướng quy định 12-tester/14-ngày. Ảnh Play: ~/Downloads/groovelab-appstore/play/ (icon 512 + feature 1024x500). ("blocker billing" cũ là của LMS web, không liên quan app free này.)
- iOS: **iPhone-only** (`supportsTablet:false` từ build 7 — app chưa tối ưu iPad nên tắt để khỏi vướng duyệt; App Store không đòi ảnh iPad). bundle `com.vananhaudio.rhythmlab`, EAS projectId `3e047754-e3ff-479e-809e-8e9999f52496`, **App Store Connect app id `6778263562`**, Team `S6ASX8GP62`. `eas.json` submit.production.ios.ascAppId đã set → build+submit chạy non-interactive, không hỏi credentials.
- Lệnh phát hành: `npx eas-cli build --platform ios --profile production` rồi `npx eas-cli submit --platform ios --latest`. buildNumber tự tăng (đang ở build 7, iPhone-only, 2026-06-14).
- Privacy Policy riêng: **https://timming.vananhaudio.com/groovelab-privacy/** (file tĩnh `public/groovelab-privacy/index.html` trong repo cs-rhythm-editor; deploy bằng push main → Netlify). Link này đã nhúng trong `app/settings.tsx`.
- Còn lại trước khi nộp App Store công khai (chỉ thủ tục App Store Connect): dán Privacy Policy URL ở App Information; điền screenshots, danh mục Education/Music, age rating, support URL, App Privacy = Not Collected; rồi Submit build 6 for Review.

Liên quan: [[project_bms_standalone_app]] (một app standalone riêng khác).
