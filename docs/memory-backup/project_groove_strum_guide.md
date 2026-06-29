---
name: project_groove_strum_guide
description: "Kế hoạch port tính năng \"Strum Score\" (gảy theo bản thu) vào Groove Lab — đã chốt khung tích hợp, CHƯA code (thầy sẽ bảo làm sau)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 617ea51e-3947-431b-9f18-619d6b837510
---

Tính năng SẮP LÀM cho [[project_groove_lab]]: **Strum Score** (TÊN CHÍNH THỨC; trước gọi "Strum Guide") — một dạng "bản nhạc cho người QUẠT": công cụ tạo & hiển thị hướng dẫn quạt (strumming) chạy theo nhạc NGƯỜI DÙNG TỰ CHÈN (file audio/YouTube) → tránh bản quyền. Điểm bán: dải nốt ↓↑ sáng theo từng phách trên chính bài của họ, trình bày "như bản nhạc giấy" (2 ô/hàng, hợp âm trên nốt đầu ô, 1 màu accent cho ô đang chơi). Định vị: *bảng hợp âm cho biết chơi gì — Strum Guide cho biết quạt thế nào*.

**Tài liệu đặc tả:** `~/Desktop/cs-rhythm-editor/docs/groove-lab-strum-guide.md` (12 mục, đầy đủ data model + cách vẽ nốt + đồng bộ).
**Bản web đang chạy thật (nguồn port):** `src/elearn/ChordStrumPlayer.tsx` (241 dòng) + `src/elearn/strumSongs.ts` trong repo cs-rhythm-editor; route `/hbd` (chùm 2) và `/hbd-td1` (nốt đen), bài mẫu Happy Birthday 3/4 75bpm.

**Mô hình dữ liệu:** `StrumSong { title, videoId?|audioUrl?, bpm, timeSignature(3|4), gridOffset, eighths?, bars: SongBar[] }`; `SongBar { chord?, pickup?, rest? }`. Đồng hồ: mỗi frame đọc thời gian nhạc → `barIdx=floor(elapsed/barDur)`, `beatInBar`; ô sáng ⟺ playing && barIdx===i.

**Khi port sang Groove Lab (RN/Expo) — khác biệt phải nhớ:**
- TÁI DÙNG được: vẽ nốt SVG + beam + ↓↑ và dấu lặng đã có sẵn trong `components/RhythmStaff.tsx` (react-native-svg) → khỏi cần font Bravura.
- Audio file: dùng **expo-audio** (đã là dep), KHÔNG dùng expo-av (deprecated SDK 54). Đọc positionMillis.
- Xanh hóa: Groove Lab OFFLINE, không Supabase → thay `record_skill_session` RPC bằng lưu **cục bộ (AsyncStorage)**.
- Routing: expo-router file route (vd `app/strum/[id].tsx`).
- RỦI RO: phát YouTube ẩn-hình-chỉ-lấy-tiếng dễ vi phạm ToS YouTube + bị Apple soi (~5.2.3) → v1 NÊN chỉ dùng file audio; YouTube để sau.

**KHUNG TÍCH HỢP vào cấu trúc bài học Groove Lab (đã đề xuất, chờ thầy chốt):**
- Danh sách bài trang chủ thành union 2 loại: `kind:'exercise'` (30 bài metronome cũ) | `kind:'strum'` (StrumSong mới). Row bấm vào → router rẽ: exercise→`app/lesson/[id]` (LessonScreen+metronome cũ); strum→`app/strum/[id]` (StrumScorePlayer MỚI, không dùng 3 tab Nhịp Điệu/Sắc Thái/Câu Chuyện).
- Strum Score KHÁC bản chất bài cũ: nhiều ô (không lặp), đồng hồ theo audio người dùng (KHÔNG dùng clock.ts), không 3-tab. → cần player+route riêng nhưng VẪN trong cùng 1 danh sách.
- Khớp triết lý HỌC–TẬP–SỐNG: 30 bài metronome = TẬP kỹ năng; Strum Score = SỐNG (áp kỹ năng lên bài hát thật). Đặt section mới cuối trang chủ: "Gảy theo bài hát" (bài thầy soạn sẵn) + sau này "Bài của tôi" (user tự tạo, lưu cục bộ).
- Tái dùng: tách glyph nốt từ RhythmStaff thành primitive dùng chung (`StrumNote`); làm mới: `StrumScoreSheet` (2 ô/hàng, sáng theo barIdx) + `StrumScorePlayer` + hook đồng hồ-theo-audio + lưu phiên AsyncStorage.
- TENSION cần chốt: "không cuộn" vs bài dài — HBD 10 ô (5 hàng) vừa 1 màn; bài ≥24 ô không vừa → phải chọn: giới hạn độ dài / tự co nốt / hiện cửa sổ quanh ô đang chơi.
- 3 QUYẾT ĐỊNH TREO (thầy chưa chốt, đã hỏi nhưng dismiss): (1) vị trí: section trong cùng list vs tab riêng; (2) nguồn nhạc v1: chỉ file audio (an toàn) vs có YouTube ngay; (3) nội dung đầu: chỉ bài thầy soạn vs làm luôn công cụ tự chèn.

**Lộ trình đề xuất:** GĐ1 player lõi + bài Happy Birthday mẫu (audio file) → GĐ2 xanh hóa cục bộ + màn "Gảy xong một lượt" → GĐ3 công cụ tự chèn nhạc (chọn file → nhập bpm/nhịp → tap đánh dấu hợp âm → dựng StrumSong; giống Beat My Songs) → GĐ4 (tuỳ chọn) nguồn YouTube.
Triết lý giữ xuyên suốt: [[feedback_simple_effective_design]] (nốt là trọng tâm, hạn chế màu mè), count-in [[project_countin_pattern]], lời động viên (không "đỏ/sai").
