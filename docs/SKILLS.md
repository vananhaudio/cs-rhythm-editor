# DANH BẠ SKILL — TVA Guitar LMS

> Bảng điều khiển các **Skill** (quy trình cho Claude làm việc lặp lại theo chuẩn của thầy).
> Skill nằm ở `.claude/skills/<tên>/SKILL.md` — commit lên GitHub (versioned + backup).
> **Cách dùng:** mở bất kỳ ô chát nào, gõ *"dùng skill \<tên>"* hoặc mô tả việc — Claude tự nạp.
> **Cải tiến:** gõ *"cải tiến skill \<tên>: …"* → Claude sửa file + commit + cập nhật danh bạ này.

## Đang có

| Tên skill | Việc nó làm | Sửa gần nhất |
|---|---|---|
| `strum-score` | Tạo/nhúng bài Strum Score (gảy theo nền) đúng quy ước: lấy đà, ô kết hình thoi, ô Out, ghi âm, bộ hình tiết tấu cơ bản | 2026-07-04 |
| `khuong-nhac` | Chuẩn hoá bố cục & khắc nhạc màn "Đánh theo" (NotePractice): số chỉ nhịp, vạch nhịp, vạch kết, dàn đều dòng, không co giãn màn hình | 2026-07-04 |
| `mau-quat-video` | Tạo trang "Mẫu Quạt" (Artifact): ô nhịp mũi tên ↓↑ chạy theo BPM, chế độ quay + nền xanh chroma — nguyên liệu overlay video dạy đệm hát | 2026-07-06 |

## Dự kiến làm (ứng viên skill — chưa dựng)

| Tên (dự kiến) | Việc |
|---|---|
| `tia-not` | Soạn bài Tỉa nốt theo triết lý cụm→câu→vùng, note_show/note_practice, cảnh báo trường độ |
| `narrated-slideshow` | Tạo bài slideshow deck có audio đồng bộ (end_times), tránh vòng lặp seek |
| `lich-lop` | Tạo lịch + mã lớp + nhóm Zalo + cấp khoá (buildClassCode, backfill_class) |
| `bo-luat-hanh-trinh` | Áp bộ luật 2027: mã năng lực → PREREQ → cảnh báo thiếu nền |
| `deploy` | Quy trình build (tsc -b) + commit tiếng Việt + push main; Edge Function deploy tay |

## Nguyên tắc quản trị
- **Mỗi skill làm 1 việc, nhỏ gọn.**
- **Skill sống trong file (Git), không sống trong chát** — đóng chát skill vẫn còn.
- **Skill = quy trình (cách làm)** khác **Bộ nhớ = sự thật/trạng thái**; feedback lặp lại đủ ổn → nâng thành skill.
- Commit đặt tiền tố `skill(<tên>): …`.
