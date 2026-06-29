---
name: project_visual_identity
description: "Hướng thiết kế hình ảnh — bỏ dần emoji-làm-UI, tiến tới bộ icon line thống nhất (thầy tự thiết kế)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

Thầy thấy emoji dùng làm icon giao diện rải rác khắp app → rối, thiếu chuyên nghiệp. Chốt hướng (2026-06-19): **bỏ dần emoji-làm-UI, tiến tới MỘT ngôn ngữ hình ảnh thống nhất** (màu + 1 bộ icon line gọn). **Thầy cầm trịch phần nhận diện** (gu riêng), Claude làm phần kỹ thuật.

ĐÃ LÀM:
- Badge giai đoạn Flow (NHẬN/NGHĨ/LÀM…): bỏ chữ + emoji → **chấm màu nhỏ** theo màu giai đoạn (tooltip giữ tên cho thầy). Chữ NHẬN/NGHĨ là thuật ngữ NỘI BỘ — không cho học viên thấy.
- Đợt "dọn ngay": gỡ emoji trang trí + nhãn-section ở 10 file mặt học viên (giữ chữ). Build pass, không vỡ layout.

CÒN LẠI (chờ ngày thầy làm bộ icon — swap một lượt cho đồng bộ): nav bar, thẻ công cụ/icon loại bài (lấy từ DB `edu_tools.icon`/`edu_courses.icon`), badge cấp độ/danh hiệu, nút chỉ-icon, callout/tool-card trong Flow, mặt admin. **Bản đồ chi tiết: `docs/emoji-cleanup.md`** (đã dọn / để lại / giữ nguyên).

GIỮ NGUYÊN luôn (glyph chức năng, không phải "emoji clutter"): mũi tên ←→‹›, ✓✗✕, ●★•, ⚠️ modal, 🔒, 🔊, ⬆️⬇️ vặn khóa Tuner.

Liên quan: [[project_elearn_engine]] [[feedback_autonomy_easy_tasks]]
