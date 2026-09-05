# TVA Guitar iOS 1.4.1 (20)

- Source web: commit `2630dc4`.
- Context: khởi động âm giai hằng ngày, chọn mẫu tự do.
- Thêm La thứ hòa thanh và Rê thứ hòa thanh; sửa tên nốt và chủ âm.
- Sáu mẫu được lưu tại `edu_tools.config.scale_warmups`; schema và seed: `db/scale_warmups_setup.sql` (đã áp dụng).
- Bỏ khóa mẫu theo phút; cần đàn tự khớp cửa sổ phím.
- iOS dùng web assets **đóng gói**, không có `server.url`. Deploy Netlify không cập nhật code trong app iOS.
- Build web từ checkout sạch của commit trên; Archive thành công.
- Archive: `build/TVA-1.4.1-20.xcarchive`.
- Bundle web đã đối chiếu khớp build phát hành (`index-CpQ5cZi8.js`).
- Chưa kiểm thử trực tiếp trên iPhone trong lần phát hành này.
- Upload thành công ngày 05/09/2026 lúc 14:34 (giờ Việt Nam); Apple đang xử lý build.
- App Review: đã tạo phiên bản và lưu release notes; đang chờ gắn build để gửi duyệt.
