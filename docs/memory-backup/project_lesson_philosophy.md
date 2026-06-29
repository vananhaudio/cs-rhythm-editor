---
name: project_lesson_philosophy
description: "Triết lý thiết kế giáo trình guitar hiện đại — HỌC-TẬP-SỐNG, app-như-công-cụ, vòng xoáy Spiral"
metadata: 
  node_type: memory
  type: project
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

**Kim chỉ nam:** Con người là tối thượng. Công nghệ phục vụ con người, không thay thế con người.
**Triết lý nền:** HỌC – TẬP – SỐNG CÙNG ÂM NHẠC.

**Why:** Chốt sau thảo luận dài với Claude Chat 2026-06-18. Làm nền cho thiết kế bài học chi tiết.
**How to apply:** Mọi quyết định thiết kế tính năng/bài học phải chiếu theo khung này trước khi code.

---

## App là công cụ, không phải cái lồng

Hai loại sản phẩm học tập:
- **App-như-giáo-trình:** người dùng tiêu thụ nội dung → giữ chân bằng gamification
- **App-như-công-cụ (CHỌN CÁI NÀY):** người dùng dùng để làm việc của mình → gắn bó tự nhiên vì hữu dụng

## Ba tư cách của app

| Vai | Tư cách | App làm gì |
|-----|---------|------------|
| **HỌC** | Người thầy | Dẫn dắt, trao kiến thức, giảm bối rối |
| **TẬP** | Huấn luyện viên | Đứng bên cạnh, đưa dụng cụ, đếm nhịp |
| **SỐNG** | Nhạc cụ / công cụ sống | Im lặng nhường chỗ — người học tự chơi, hòa âm, thu âm, sáng tác |

"SỐNG" không nằm ngoài app: người học dùng app như công cụ để sống ngoài đời (cuộn lời+hợp âm, thu âm, tạo beat, dạy lại con cái).

## Mô hình vòng xoáy (Spiral)

```
HỌC → TẬP → SỐNG → [VẤP] → quay về thầy/khóa mới → vòng cao hơn
```

Tỷ trọng dịch chuyển theo giai đoạn:
- GĐ1: Học nhiều · Tập vừa · Sống ít
- GĐ2: Học vừa · Tập nhiều · Sống vừa
- GĐ3: Học ít · Tập vừa · Sống nhiều
- Mốc ~2 năm: 20% Học · 30% Tập · 50% Sống

Thành công = sau 2 năm vẫn dùng app — chủ yếu để SỐNG, không để cày bài.

## Nguyên tắc "bộ đồ nghề"

Mỗi bài trao **một món đồ nghề bỏ túi**. Đồ nghề phải **XUYÊN SUỐT và THỐNG NHẤT** — không rời rạc. Người học biết *ráp* chúng thành bài sống, không chỉ *có* công cụ.

## Cơ chế quay về — con người là trục

Khi vấp → quay về hỏi thầy hoặc tìm khóa phù hợp. Trục của vòng quay là **người thầy, không phải thuật toán**.

## 2 điểm cần giữ khi triển khai

1. **Trung thực với "cao nguyên" học tập** — tạo động lực nhưng không dạy bỏ cuộc khi hết cảm giác "lên cấp mỗi ngày".
2. **Rút ngắn khe hở lúc VẤP** — app gợi đúng món đồ nghề/khóa còn thiếu ngay tại chỗ, không lấn vai người thầy.
