---
name: project_tune_lab
description: "Tune Lab — app tuner standalone (gốc pitch-lab), đã duyệt App Store id 6780132453"
metadata: 
  node_type: memory
  type: project
  originSessionId: a5e7e4b6-ea5c-4641-bca1-148725b37823
---

**Tune Lab** = app tuner (lên dây đàn) độc lập, tách từ tuner của LMS.

- Source: `~/Desktop/pitch-lab/` (project gốc tên `pitch-lab`; đổi tên hiển thị → "Tune Lab" ở commit f6041a0). Vite + React + TS, file chính `src/GuitarTuner.tsx`.
- Vỏ Capacitor riêng: `appId: com.vananhaudio.pitchlab`, appName "Tune Lab", min iOS 15, project `ios/App/App.xcworkspace`.
- App Store: id `6780132453`, https://apps.apple.com/app/tune-lab/id6780132453 — DUYỆT 2026-06-14 (public trong 24h). Submit dưới tên Văn Anh Trần.
- Để qua review Apple đã: bỏ Pro/FREE badge + tab bar + login screen; thêm NSMicrophoneUsageDescription, ITSAppUsesNonExemptEncryption=NO; auto-start mic, kim mượt.
- Privacy page host trong repo cs-rhythm-editor: `public/tunelab-privacy/` (deploy theo timming.vananhaudio.com).

- **2026-07-02:** đồng bộ giao diện với tuner LMS — viết lại `src/GuitarTuner.tsx` (nốt to giữa + vành cung, tự bật mic, mặc định dây 6, nhắc TĂNG/GIẢM, kim mượt, icon line, bỏ nút thừa/bảng tần số, chế độ Tự động) nhưng **tông TỐI SANG** (charcoal + xanh lá + nhấn cam logo) giữ nhận diện riêng. Build pass, CHƯA commit + CHƯA phát hành. Bàn giao đầy đủ ở `~/Desktop/pitch-lab/HANDOFF.md` + `TUNER-UPDATE.md`. Bản gốc đối chiếu: LMS `src/GuitarTuner.tsx` (tông indigo/sáng) — sửa logic thì đồng bộ cả 2.

Liên quan: tuner trong LMS [[project_lms_roadmap]] (file `src/GuitarTuner.tsx` cũng tồn tại trong cs-rhythm-editor).
