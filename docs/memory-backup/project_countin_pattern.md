---
name: project_countin_pattern
description: Cách count-in chuẩn cho mọi bài gảy-theo — ô lấy đà hiện số đếm 1-2-3 sáng theo phách
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Cách count-in thầy rất ưng (dùng cho mọi bài play-along về sau): **ô nhịp LẤY ĐÀ (pickup) không có hợp âm — thay vào đó hiện số đếm phách 1-2-(3/4) to, dàn đều, và SÁNG DẦN theo từng phách** khi phát. Số đếm này thay cho count-in: học sinh đếm theo rồi vào đúng ô hợp âm đầu, không bị bất ngờ.

**Why:** Đếm vào trực quan ngay trên khuông nhạc (không cần màn đếm riêng) — học sinh thấy nhịp chạy tới đâu, vào đúng lúc, tự tin hơn. Nằm gọn trong bố cục "như sách", đúng triết lý [[feedback_simple_effective_design]].

**How to apply:**
- Mô hình dữ liệu: ô lấy đà = `{ pickup: true }` (trong `SongBar`, file `src/elearn/ChordStrumPlayer.tsx`).
- Render: thay vùng nốt bằng lưới `repeat(N,1fr)` chứa số `1..N`; số đang ở phách hiện tại → to hơn + màu accent (tím) + scale nhẹ; số khác mờ.
- Sáng theo `isCur && beatInBar === j` (cùng đồng hồ `videoClock`/audio.currentTime của bài). Mỗi thời điểm chỉ một ô sáng.
- Nhãn ô để "Lấy đà"; không vẽ nốt, không đàn ở ô này.
- Bài mẫu đầu tiên: Happy Birthday (`HBD_CHUM2` trong `src/elearn/strumSongs.ts`, route `/hbd`), nhịp 3/4 → đếm 1-2-3.

Liên quan: [[project_lesson_philosophy]] (HỌC-TẬP-SỐNG), màn quạt hợp âm gảy-theo-bản-thu (ChordStrumPlayer + bảng `strum_songs`).
