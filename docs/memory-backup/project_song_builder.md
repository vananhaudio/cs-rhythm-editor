---
name: song-builder-v1
description: "Trạng thái Song Builder V1 — đã dựng GĐ1-5, cố ý HOÃN bước Xuất (export) chờ chốt schema v2.1"
metadata: 
  node_type: memory
  type: project
  originSessionId: 26274173-3421-4b94-ad92-aab2ae5297a9
---

Song Builder V1 (`src/SongBuilderPage.tsx`, route `/song-builder`) đã dựng xong **Giai đoạn 1→5**: Tap Tempo (`src/logic/tempoFit.ts` — fitTempo, lưới beat đều, video-time taps), chọn phách mạnh (downbeatPosition), Anchor Mapping UI (GẮN MỐC + word chips), nội suy tuyến tính (`src/logic/songBuilder.ts` — computeMapping), preview. Bước **Xuất (GĐ6) KHÓA có chủ đích**.

**Why:** Văn Anh yêu cầu đợt này chỉ dựng UI + state + preview nội suy, KHÔNG làm export. Còn 3 quyết định treo trước khi làm export v2.1 tick-based:
1. Schema v2.1 thật — file nào định nghĩa, tên field tick/phân số?
2. "Phân số" biểu diễn vị trí hay trường độ nốt?
3. Player v2.1 render theo TỪ hay theo DÒNG? (mô hình hiện tại word-level; PlayerView cũ line-level, time-based giây).

**How to apply:** Khi Văn Anh quay lại làm export, hỏi/chốt 3 điểm trên trước. Mô hình dữ liệu: nguồn sự thật = words[] + anchors[] (source:"anchor"); từ nội suy là DERIVED (không lưu). beatIndex canonical, tick = beatIndex×480. Triết lý: một lưới beat đều duy nhất là trục chuẩn.
