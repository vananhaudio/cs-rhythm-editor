---
name: feedback_ui_color_depth
description: "Gu phối màu UI của thầy: tránh quá trắng/nhạt ('thư sinh'), thích tầng lớp có chiều sâu; dùng palette TVA (indigo/cam/nền xám)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 369b553b-b6e0-41c4-92f5-13afac923dff
---

Khi chuốt giao diện công cụ trong LMS, thầy **không thích quá trắng/phẳng** ("hơi trắng thư sinh quá") và không thích màu **chỏi/lệch tông** (vd đỏ tươi `#ef4444` cạnh indigo).

**How to apply — tạo chiều sâu bằng tầng lớp màu, dùng palette TVA:**
- Palette chuẩn (bảng `L` trong `MobileStudentPortal.tsx`): nền `#F0F2F5`, thẻ trắng `#FFFFFF`, primary indigo `#4338CA`, accent cam `#EA580C`, xanh `#16A34A`, chữ `#111827/#6B7280/#9CA3AF`.
- Công thức đẹp đã được thầy duyệt (tuner "Lên dây đàn"): **header dải gradient indigo (`#4338CA→#6366F1`, chữ trắng) → thẻ thân sáng → 1 khối "hero" nền tối navy** (mặt đồng hồ) để nội dung chính nổi bật. 3 tầng sáng/đậm tạo chiều sâu, hết "thư sinh".
- Bộ nhiều màu (vd 6 dây đàn) phải **cùng một họ độ đậm** (mức -600: rose/cam/hổ phách/lục/lam/tím) để không màu nào chỏi.
- Trạng thái: xanh `#16A34A` = đúng/chuẩn; cam `#EA580C` = cảnh báo/lệch (nền nhạt `#FFF7ED`).

**Why:** thầy có gu thẩm mỹ cao, art-direct kỹ; giao diện phải "đẹp & chuyên nghiệp", liền mạch với app học viên. Liên quan [[feedback_simple_effective_design]] (sạch, hạn chế màu mè) + [[project_visual_identity]] (bỏ emoji → icon line).
