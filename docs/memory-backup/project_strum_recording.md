---
name: project_strum_recording
description: "Ghi âm thành quả trong Strum Score — thu tiếng đàn trộn số với nền, lưu local không upload"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Tính năng GHI ÂM trong [[project_strum_score]] (ChordStrumPlayer, chế độ nền `backing`): học sinh bấm "🔴 Ghi âm — gảy theo nền", thu tiếng đàn qua micro **TRỘN SỐ (digital)** với đầu ra nền (trống+bass+giai điệu) trong **cùng AudioContext** → nghe lại sạch dù dùng loa hay tai nghe (không phụ thuộc bleed loa). Engine `backingEngine.ts`: `startMixRecording(micStream)` nối `master` + `createMediaStreamSource(mic)` vào `MediaStreamAudioDestinationNode`, trả `MediaRecorder`; `stopMixRecording()` ngắt. Blob dùng `mr.mimeType` (Safari = mp4, không hardcode webm).

**Chế độ mp3 (HBD)** cũng ghi được: AudioContext riêng, `createMediaElementSource(<audio crossOrigin="anonymous">)` + micro → recDest (Supabase storage trả `access-control-allow-origin: *` nên không bị tainted). `canRecord = isBacking || (!isYT && audioUrl)` — YouTube KHÔNG ghi được. Jingle Bells gắn 2 khoá qua registry native (`song-jingle-den` Cơ bản/Chương 4, `song-jingle-chum2` TĐ2/Tuần 1); STRUM_JINGLE_DEN = STRUM_JINGLE + patternId 'den'. SQL: db/lesson_jingle.sql.

**Quyền riêng tư:** bản ghi lưu tạm tại máy (blob URL), **KHÔNG upload** → không phải khai "data collection" ở App Privacy, không đổi `PrivacyInfo.xcprivacy`.

**Apple/TestFlight:** `NSMicrophoneUsageDescription` ĐÃ CÓ SẴN trong Info.plist (vốn cho Tuner) → recording tái dùng đúng đường getUserMedia của Tuner; nếu Tuner chạy được trong app thì recording cũng chạy. Đã mở rộng câu mô tả mic cho cả ghi âm luyện tập. Vì mic permission đã có trong build đang chạy, deploy web là tính năng hiện luôn cả trên web lẫn app hiện tại — rebuild Xcode chỉ cần để câu mô tả mic khớp khi review. Liên quan [[feedback_app_submission_care]], [[project_account_deletion]].
