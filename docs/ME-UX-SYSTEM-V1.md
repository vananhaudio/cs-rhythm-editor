# /me UX System V1 — Con đường mòn

Ngôn ngữ UX chung cho toàn bộ `/me` (class.vananhaudio.com/me). Là polish hệ thống, KHÔNG đổi business logic / DB.

## Nguyên tắc
1. **Cấu trúc đứng yên, dữ liệu thay đổi bên trong.** Lần đầu = lần thứ 20. Không "Tiếp tục học", "Việc tiếp theo",
   "Recommended", auto-scroll, auto-open, auto-redirect. Người dùng chủ động đi sâu.
2. **Tổng quan trước, chi tiết sau.** Lớp của tôi → Lớp (mục lục) → Buổi → Bài trả/cuộc trao đổi. Không nhảy cóc tầng.
3. **Không nói điều người dùng tự nhận ra.** Không nhãn "Đang học", "Hiện tại", "Bạn đang ở đây". Vị trí do bản đồ nói
   (vạch nhẹ, độ đậm, thứ tự).
4. **Tím = THƯƠNG HIỆU / TƯƠNG TÁC**: logo, focus, hover, mục menu đang chọn, nút hành động chính, chi tiết nhận diện nhỏ.
   Tím KHÔNG mang nghĩa nội dung (đang học, hiện tại, tiến độ, vai trò, nhãn, VIP).
5. **Màu nội dung = token ngữ nghĩa, tiết chế:** Đạt `--cs-ok` (xanh nhẹ) · Cần làm lại `--cs-warn` (ấm nhẹ) ·
   Chưa trả / Chờ Thầy / Thầy đã phản hồi = trung tính · Khoá = xám + chữ. Chữ luôn là nguồn nghĩa chính.
6. **Thứ bậc bằng chữ + khoảng trắng** (cỡ, độ đậm, thụt lề, đường kẻ) trước màu/card/bóng/badge.
7. **Ít card.** Card chỉ cho object độc lập (bài feed, thread, artifact). Danh sách = dòng + đường kẻ.
8. **Ít nút.** Tên object đã bấm được thì không thêm "Vào lớp / Xem lớp / Mở lớp". Nút cho HÀNH ĐỘNG thật
   (Đăng, Trả bài, Gửi, Tham gia lớp, Lưu, Chia sẻ).
9. **Mỗi thông tin một lần.** Trong trang lớp không lặp tên lớp trên feed; không card "Buổi hiện tại" khi mục lục đã có.
10. **Sidebar = bản đồ toàn hệ:** thứ tự cố định, không xếp lại theo hoạt động.

## Token (`src/class-social/classSocial.css`, trên `.cs-root`)
`--cs-accent` (= `--cs-p`, thương hiệu) · `--cs-text` / `--cs-muted` / `--cs-faint` (xám trung tính) · `--cs-border` ·
`--cs-neutral-soft` / `--cs-neutral-line` (nhãn/vai trò) · `--cs-ok` / `--cs-ok-soft` · `--cs-warn` / `--cs-warn-soft`.
Nền/viền/chữ phụ là xám trung tính (không ngả tím).

## Bản đồ route
| Route | Vai trò |
|---|---|
| `/me` | Trang chủ: ô chia sẻ → Feed. Tab **Dành cho bạn · Lớp · Bạn bè**. Tab "Lớp" (`?feed=classes`) = **Lớp của tôi** (tên lớp → Class Page, lịch nếu có, "+ Nhập mã lớp") → **Hoạt động từ các lớp** (feed) — xem Class Entry V2 bên dưới |
| `/me/classes` | **Lớp của tôi**: tên lớp (lối vào) → "+ Nhập mã lớp" → Lớp trước đây → Các lớp khác |
| `/me/classes/:id` | Trang học của lớp: Tên + lịch → Mục lục ↔ Bài trả của tôi (desktop master-detail) → cánh cửa Không gian lớp (docs/CLASS-UX-V3.md) |
| `/me/classes/:id/space` | Không gian lớp: hoạt động của một lớp + Thành viên |
| `/me/classes/:id/sessions/:n` | Trang Buổi (LessonDocument — chuẩn giáo trình, docs/GIAO-TRINH-CHUAN.md) |
| `/me/t/:id` | Cuộc trao đổi (Learning Thread) |
| `/me/u/:id` | Trang cá nhân (Tường · Hành trình) |
| `/me/friends` · `/me/queue` · `/me/tools` · `/me/bands` | Bạn bè · Hàng đợi Thầy · Công cụ · Ban nhạc |

Sidebar: Cộng đồng (Trang chủ · Bạn bè · Trò chuyện · Ban nhạc) → **Lớp học** (các lớp của tôi + "Lớp của tôi") →
Học tập → Công cụ. Thứ tự không đổi theo người dùng.

## Class Entry V2 — tab "Lớp" cho thấy lớp của mình (03/10/2026)
Bấm tab **Lớp** theo phản xạ = "lớp của tôi ở đây". Một tab trả lời hai câu theo thứ tự: *Tôi thuộc những lớp nào?* → *Các lớp của tôi đang có chuyện gì?*
- **Lớp của tôi** (`HomeClasses`): dòng tên lớp (link `/me/classes/<id>`), dòng phụ chỉ là lịch nếu có. Không trạng thái / buổi / bài trả / sĩ số / mã lớp / nút "Vào lớp".
  Sau danh sách là "+ Nhập mã lớp" (nút nhẹ, mở đúng `JoinClassByCode`). Tham gia xong thì ở lại tab, lớp hiện ngay; sidebar, `/me/classes` và danh tính học tập cũng nạp lại.
  Chưa có lớp: "Bạn chưa có lớp nào." Đang tải: một dòng giữ chỗ (không nháy "chưa có lớp"). Lỗi: "Chưa tải được danh sách lớp.", feed vẫn chạy.
- **Hoạt động từ các lớp**: feed sẵn có (`social_class_activity`), không đổi backend/thứ tự/phân trang.
- **Một nguồn**: `useSocialClasses()` (gọi MỘT lần ở `ClassSocialPage`) → `currentClasses()` (bỏ lớp completed/merged/cancelled, giữ thứ tự server).
  Sidebar = tab Lớp = phần chính `/me/classes` về tập và thứ tự. `/me/classes` vẫn là bản đồ đầy đủ (Lớp trước đây, Các lớp khác), không feed.
- Sidebar mở rộng: bỏ chấm trước tên lớp (không mang nghĩa); chỉ còn khi thu gọn (hình thay chữ).
- Dòng lớp ở mọi nơi là `<a href>` (mở tab mới được); bấm thường thì điều hướng trong app.

