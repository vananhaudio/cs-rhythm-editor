# CHANGELOG — Thầy Văn Anh Guitar LMS

Ghi lại thay đổi đáng chú ý. Định dạng ngày: dd/mm/yyyy.

## 27/07/2026

- **Trang tuyển sinh (class.vananhaudio.com)**: thêm CTA "📖 1001 Câu chuyện" trên header — pill nằm giữa nhóm menu và nút "Hành trình của tôi", dẫn tới `/story`. Mobile rút gọn thành "📖 1001" (trang chưa có menu hamburger nên pill hiển thị trực tiếp).
- **Fix form đăng ký**: hai lớp trùng tên (TN3.GL12 / TN3.GL13) không phân biệt được trong ô "Lớp muốn đăng ký" — giá trị chọn + `leads.class_name` giờ kèm MÃ LỚP (vd "Tỉa Nốt 3 (Cảm âm 1) · TN3.GL13"), hết trùng key React và Duyệt nhanh khớp lớp chính xác hơn.
- **Trợ lý AI admin**: thêm khả năng GỠ học sinh khỏi nhóm Zalo qua chat (đề xuất → thầy duyệt → mới gỡ; không thu hồi khoá đã cấp).
- **Tab Đăng ký**: nút "⚡ Duyệt nhanh" — tạo tài khoản + tự đưa học viên vào đúng lớp đã đăng ký (theo mã lớp, tự cấp khoá qua backfill_class).
- **Lịch lớp**: chat với Mira ngay trong tab 🧭 Mira để xếp lịch bằng hội thoại; lớp tạo qua chat có lịch thật + tự sinh buổi học (múi giờ VN).
- **Đếm buổi học**: sửa progressInfo — buổi huỷ/nghỉ lễ không tính vào tổng & đã học; buổi dời tính vào "còn lại"; Dashboard + Mira Planner dùng chung công thức.
- **Mira tuyển sinh (class-ai)**: đọc lịch sống theo status + ngày thật mỗi lượt chat, kèm tiến độ "đã học X/Y buổi" và mốc ngày hôm nay.

## 26/07/2026

- **Trang tuyển sinh**: bỏ danh sách lớp dự phòng hardcode — hết lớp sắp khai giảng thì hiện thông điệp giữ chỗ thật thay vì lớp cũ; form đăng ký lấy danh sách lớp thật từ `class_schedule`.
- **RLS**: thêm `class_schedule`, `class_sessions` vào nhóm bảng tự-quản trong `db/rls_setup.sql` (chạy lại script không xoá nhầm policy công khai của lịch).
