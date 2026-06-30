---
name: project_groove_in_lms
description: "Groove Lab đã được PORT vào LMS (src/groove/) — mục 'Tiết tấu' trong 'Hôm nay luyện gì'; tab Học (30 bài 3 tầng) + Tập (nền tập quạt)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 369b553b-b6e0-41c4-92f5-13afac923dff
---

Toàn bộ tính năng [[project_groove_lab]] (app Expo riêng) đã được **port vào LMS web** (cs-rhythm-editor), gom ở **`src/groove/`** (inline styles, Web Audio thuần), ship 2026-06-30.

**Cấu trúc `src/groove/`:**
- `metronomeClock.ts` — port `audio/clock.ts`, đổi react-native-audio-api → `window.AudioContext`.
- `lessons.ts` + `rhythmLessons.json` — 30 bài tiết tấu + `analyzeBar`.
- `RhythmStaff.tsx` — vẽ nốt SVG web + **rAF nội bộ** (glow + con trượt) thay `Animated` của RN.
- `GrooveLesson.tsx` — 3 tầng Nhịp Điệu/Sắc Thái/Câu Chuyện + tempo + lời thầy.
- `GrooveBackingPad.tsx` — "Nền tập quạt"; **tái dùng `src/elearn/backing/backingEngine.ts`** (đừng viết lại engine trống+bass).
- `GrooveExercise.tsx` — overlay 2 tab Học | Tập.

**Gắn vào app:** mục `metronome` trong `EXERCISES` (MobileStudentPortal) đã đổi tên thành **"Tiết tấu"** (🥁, `#2E7D52`) → mở `GrooveExercise`; timer/XP như finger/scale. Route trực tiếp **`/groove`**.

**Quan trọng:** đây là 2 codebase TÁCH BIỆT — sửa tính năng Groove cho LMS thì sửa `src/groove/`; app Groove Lab gốc vẫn ở `~/App/project/` (Expo, lên App Store riêng). Nếu Groove Lab gốc thêm bài/điệu mới, phải port lại sang `src/groove/` (không tự đồng bộ).

**Chưa làm:** nút "Hỏi thầy" (có thể nối [[project_mira_assistant]]); phần "SỐNG"/Strum Score. Giữ triết lý [[feedback_simple_effective_design]] + [[project_lesson_philosophy]].
