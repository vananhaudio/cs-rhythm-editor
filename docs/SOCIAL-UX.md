# Class Social `/me` — nguyên tắc UX

APP `/learn` = "TÔI HỌC". SOCIAL `/me` = "CHÚNG TA SỐNG CÙNG ÂM NHẠC".
Mental model gần Facebook, nhưng mọi nội dung xoay quanh âm nhạc, học tập, lớp, bạn bè, Thầy và Hành trình.

## Mỗi màn trả lời một câu hỏi

| Màn | Câu hỏi |
|---|---|
| Trang chủ = dòng chảy | Có chuyện gì mới trong cộng đồng âm nhạc của tôi? Tôi muốn chia sẻ gì? |
| Trang cá nhân = một con người | Đây là ai và hành trình âm nhạc của họ thế nào? |
| Lớp = một cộng đồng nhỏ | Lớp đang học gì, đang diễn ra chuyện gì? |
| Hành trình = câu chuyện trưởng thành | Người này đã lớn lên trong âm nhạc như thế nào? |
| Cuộc trao đổi | Trong bài này, học sinh và Thầy đã trao đổi với nhau thế nào? |
| Bạn bè = con người | Tôi có quan hệ với những ai trong cộng đồng? |

Acceptance: học sinh mới, không ai hướng dẫn, trong 30–60 giây tự biết đi đâu, xem gì, bấm gì.
Không giải quyết UX kém bằng tooltip dài, popup hướng dẫn hay FAQ.

## Quyết định đã chốt — giữ nguyên

- Ô chia sẻ luôn là "Chia sẻ điều gì về âm nhạc…". KHÔNG dùng "Bạn đang nghĩ gì?".
- Bốn gợi ý: Đang tập · Vừa đàn · Nhờ góp ý · Chia sẻ. Trên điện thoại xếp 2 × 2, luôn thấy đủ.
- Trang chủ: ô chia sẻ, sau đó là Feed.
  - Không có ảnh bìa, không dashboard, không nút Trả bài hero.
  - Hàng đợi của Thầy chỉ hiện một dòng khi có bài chờ.
  - "Trả bài bằng link video" (hệ cũ) chỉ là lối phụ.
- Ảnh bìa lớn chỉ có ở Trang cá nhân.
- Trả bài có cấu trúc bắt đầu từ đúng bài trong App học. `/me` chỉ là cách nhìn (projection) của Learning Thread.
- Mã lớp và mã khoá chỉ là metadata phụ (chữ nhỏ, tooltip). Menu hiện tên lớp thân thiện, còn trang lớp hiện tên đầy đủ.
- Trạng thái trống và đang tải: một hai dòng chữ nhẹ, không khung, không icon lớn.
- Mỗi vùng chỉ có một nút chính. Thầy phản hồi: "Gửi phản hồi" là nút chính; "Cần làm lại" (vàng ấm) và "Đạt" (xanh nhạt) là nút phụ, đặt tách xa.
- Không hard-code tên Thầy (lấy từ dữ liệu). Không để lộ enum, mã kỹ thuật hay thông báo lỗi thô.
- "Quay lại" về đúng màn trước trong `/me`, kể cả tab đang xem. Mở thẳng bằng link thì về Trang chủ.

## OPEN ITEMS — cần quyết định sản phẩm/backend, KHÔNG làm trong polish

- Bộ lọc Feed (Dành cho bạn / Lớp của tôi / Bạn bè): cần backend. Không lọc giả ở frontend.
- Bài Social công khai cho cộng đồng (hiện bài status chỉ bạn bè + Thầy xem được): quyết định quyền riêng tư và schema.
- Thành viên đăng bài trực tiếp vào lớp: `class_posts` chưa hỗ trợ đích là lớp.
- Thông báo (Learning Thread, bình luận).
- Trò chuyện: mới có khung giao diện, chưa có backend tin nhắn.
- Uy tín / đóng góp, mentor, trợ giảng.
- "Cộng đồng đang học bài này" trong App học.
- Giữ vị trí cuộn Feed khi "Quay lại": Feed tải lại từ đầu; nếu cần thì làm cache Feed.
- Sửa tên: chỉ ở App học → Cài đặt → Hồ sơ của tôi. `/me` đổi được ảnh đại diện/bìa, nhưng chưa có lối sang chỗ sửa tên.
- Phát hành app native sau khi web ổn định (app bundled, phải build lại và nộp store).

## Định hướng dài hạn (chỉ ghi, chưa làm)

- **Quyền:** cơ bản theo thành viên (membership); mở rộng theo uy tín/đóng góp; chuyên môn theo vai trò được xác nhận. Chưa tạo điểm, huy hiệu hay schema.
- **Lớp:** một cộng đồng nhỏ có biên giới bên trong cộng đồng lớn. Thành viên sống trong lớp; người ngoài nhìn vào phần công khai; Thầy dẫn dắt.
- **Hành trình:** lâu dài có thể gồm bài, lượt trả, câu hỏi, nhận xét, làm lại, đạt, chuyển chặng, mốc biểu diễn. Nguồn gốc vẫn là dữ liệu đào tạo thật, không có bảng Journey riêng.
- **Tự động hoá:** cấu trúc Learning Thread là nền cho hàng đợi Thầy, AI hỗ trợ, nhắc tiếp, tiến độ, mở khoá.
