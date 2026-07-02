---
name: project_strum_score
description: "Tên chính thức \"Strum Score\" — bản nhạc dành cho người quạt (màn gảy-theo-bản-thu)"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Tên CHÍNH THỨC của tính năng "gảy theo bản thu": **Strum Score** (thầy chốt). Bản chất: **một dạng BẢN NHẠC thật sự dành cho người QUẠT** (rhythm) — có khuông, nhịp, ô, trường độ (nốt móc đơn cách đều), hợp âm; chỉ khác là dành cho tay phải/quạt thay vì cho giai điệu. Có tính âm nhạc hẳn hoi, không phải "bảng/chart".

**Why:** Gọi đúng bản chất + đúng hướng phát triển lâu dài (một hệ ký âm cho strumming, không chỉ là công cụ tạm).

**How to apply (từ khoá khi trao đổi):**
- **"Strum Score"** = màn này (web: `src/elearn/ChordStrumPlayer.tsx`, route `/hbd`, `/hbd-td1`; data `strumSongs.ts`).
- "ô lấy đà" = ô đầu đếm 1-2-3 (count-in, xem [[project_countin_pattern]]).
- "dải quạt" = hàng nốt ↓↑ (chùm 2 / nốt đen).
- "ô đang sáng" = ô/phách đang chơi.
- "xanh hóa" = màn xong-lượt đỏ/vàng/xanh.

Đặc tả đầy đủ để port (Groove Lab/Expo): `docs/groove-lab-strum-guide.md`. Liên quan: [[project_groove_strum_guide]], [[feedback_simple_effective_design]] (nốt là trọng tâm, hạn chế màu mè).

## RÀ SOÁT 2026-07-02 (hiện trạng + khoảng trống)
**Kiến trúc:**
- `ChordStrumPlayer.tsx` (~419d): màn chơi. 3 nguồn tiếng — **nền synth** (`backing`) / **mp3** (`audioUrl`) / **YouTube ẩn** (`videoId`, iframe lấy tiếng). Sáng theo ô/phách, đếm vào, tự cuộn, **ghi âm trộn** mic+nhạc (lưu LOCAL, không upload), màn "xong lượt" xanh hóa (RPC `record_skill_session`, cần studentId+lessonId — LessonViewerPage truyền đủ). Font glyph nốt trắng/lặng = **Bravura** (đã nhúng index.html).
- `strumPatterns.ts`: 9 kiểu quạt (đen/chùm2/liên3/móc kép × 4/4,3/4,2/4). `resolvePattern(N, eighths, patternId)`.
- `strumSongs.ts`: 5 bài **HARDCODE** (HBD chùm2/đen có lấy đà; Jingle chùm2/đen có melody + ô kết oneStrum; Ballad). Route thử `/hbd /hbd-td1 /jinglebell /strum-backing /strum-test`.
- `StrumConfigEditor.tsx` (admin, `lesson_type='strum'`): `parseStrumConfig`/`configToSong`, lưu JSON ở `content`. Dùng lại ở MobileStudentPortal + LessonViewerPage.
- `SongBar { chord?, pickup?, rest?, oneStrum? }`; `StrumSong { …, patternId, backing?, melody?, loop? }`.

**KHOẢNG TRỐNG (ưu tiên):**
1. **Trình soạn của thầy chỉ làm bản RÚT GỌN**: `configToSong` chỉ hỗ trợ nền synth + vòng hợp âm ĐỀU một kiểu quạt. KHÔNG tạo được: ô lấy đà/nghỉ/kết (oneStrum), melody, nguồn mp3/YouTube, kiểu quạt khác nhau từng ô. → Bài "xịn" (HBD/Jingle) phải hardcode. **Đây là việc đáng làm nhất.**
2. Đường YouTube ẩn còn trong code (rủi ro Apple ~5.2.3) nhưng editor không mở ra → hiện an toàn, đừng bật trong app iOS.
3. 1 patternId/bài (không đổi tiết tấu giữa đoạn). Mic gain ghi âm cố định 1.6.

**Hướng đề xuất (chờ thầy chốt):** A. Nâng editor tạo bài đầy đủ (lấy đà/nghỉ/kết + melody + mp3 upload Supabase); B. Soạn per-bar (hợp âm + kiểu quạt riêng từng ô); C. Chỉ dọn/gia cố (guard YouTube, dọn route thử).
