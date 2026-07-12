---
name: project_khuong_nhac_skill
description: "Skill khuong-nhac — chuẩn hoá bố cục & khắc nhạc màn Đánh theo (NotePractice), commit 2c6567b 2026-07-04"
metadata:
  node_type: memory
  type: project
  originSessionId: c2460e02-c449-40d6-b950-5736e49e25c2
---

Skill `khuong-nhac` (`.claude/skills/khuong-nhac/SKILL.md`) dựng 2026-07-04, chốt tên qua 3 lựa chọn (score-practice/practice-score/khuong-nhac) — thầy chọn **khuong-nhac** vì trùng khớp tên ứng viên đã dự kiến sẵn trong `docs/SKILLS.md` và đúng nghĩa nhất với phạm vi (chuẩn khuông nhạc, không phải soạn nội dung sư phạm — đó là phạm vi của `tia-not`, vẫn CHƯA dựng).

**Phạm vi:** component `NotePractice` + `NoteSheet` trong `src/elearn/guitarRenderers.tsx` (màn "Đánh theo: ..." — slide `type: 'note_practice'`). `NoteSheet` chỉ dùng trong `NotePractice`, không nơi nào khác.

**Các chuẩn đã chốt (xem chi tiết trong SKILL.md, đừng lặp lại ở đây khi code đổi — SKILL.md là nguồn thật):**
- Khuông tự co giãn lấp đầy chiều ngang (scale theo `ResizeObserver`, trần 1.6x)
- Count-in thay đúng chỗ chữ "TỐC ĐỘ" (đã xoá chữ này), KHÔNG đè/thay 3 nút Chậm/Vừa/Nhanh
- Nguyên tắc cứng: không co giãn khung khuông nhạc khi thao tác bất kỳ nút nào (chừa sẵn `minHeight` cho ô kết quả) — thầy nhấn mạnh lý do là tránh mất tập trung ánh nhìn học sinh
- Số chỉ nhịp = glyph Bravura SMuFL (`0xE080+digit`), không dùng chữ số thường
- Lề phải mỗi dòng sát vạch nhịp cuối (không kéo dư); vạch kết cả bài = 2 nét (thin+thick)
- Dàn đều (justify) mỗi dòng để vạch nhịp cuối mọi dòng thẳng hàng — dòng ngắn hơn giãn nốt ra, neo trái giữ nguyên

Cách quy trình phiên này chạy (đáng lặp lại): mỗi yêu cầu sửa nhỏ → sửa code → verify bằng preview thật (`/flow-lab?bai=<key>`, key lấy từ `tiaNot1Lessons.json`, vd `solthangtap` 2 dòng lệch nốt, `totNghiep` 4 dòng đều) → chụp ảnh/đo `getBoundingClientRect` để xác nhận không giật hình → mới sang việc tiếp theo. Thầy duyệt từng bước rồi mới build+commit gộp ở cuối. Liên quan [[project_skills_system]], [[project_tia_not_1_philosophy]].
