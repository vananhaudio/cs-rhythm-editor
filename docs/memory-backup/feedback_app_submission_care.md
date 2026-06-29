---
name: feedback_app_submission_care
description: "Làm app/tính năng nhạy cảm (Apple compliance, xóa dữ liệu) phải cẩn thận, rà data model trước"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

Việc fix lỗi "xóa tài khoản" của TVA Guitar (Apple reject 5.1.1v) mất rất nhiều vòng vì đoán mò. Thầy nhắc: lần sau làm app cần **thật cẩn thận**.

**Why:** Apple reject từng lỗi một (đụng là reject), mỗi vòng chờ review mất 24-48h. Một lỗi xử lý ẩu = mất cả tuần. Thầy làm một mình nhiều app song song nên thời gian là tài nguyên quý nhất.

**How to apply:**
- **Tính năng đụng database (nhất là XÓA): rà data model TRƯỚC khi viết code.** Chạy ngay: liệt kê bảng, liệt kê khóa ngoại + quy tắc ON DELETE, liệt kê cột liên kết user. KHÔNG đoán tên cột/quan hệ.
- **Không để code nuốt lỗi.** `supabase.rpc()` trả `{ error }` chứ không throw — luôn kiểm tra `error`, hiện ra cho người dùng, không "giả vờ thành công".
- **Test end-to-end bằng dữ liệu THẬT trước khi nộp Apple**: với xóa tài khoản = tạo TK thật → xóa → kiểm tra row trong DB đã mất → đăng nhập lại phải fail. KHÔNG nộp khi mới "thấy nút chạy".
- **Test trên đúng loại thiết bị Apple review** (lần này iPad Air gây đơ vì vào nhầm StudentPortalV2 desktop).
- Dùng lại [[project_account_deletion]] làm mẫu cho app sau có login.
