# Class Phase 1 — Lịch tuyển sinh public (09/2026)

## Khái niệm
- **Lịch vận hành** = toàn bộ `class_schedule` (HT2026, HT2027, Solo, KD, GL…). Không đổi.
- **Lịch tuyển sinh public** = các dòng có `public_enroll = true` và `public_product` khác null.
  Chỉ những dòng này hiện trên class.vananhaudio.com.

## 4 sản phẩm public
`dem_hat_can_ban` · `guitar_can_ban` (4 buổi, lớp phễu) → `dem_hat_nang_cao` · `solo_guitar` (6 tháng).
Tên/mô tả nằm ở `src/class-content.ts` (`PRODUCTS`, `TRACKS`); key phải khớp CHECK của
`class_schedule.public_product` (`db/class_public_enroll.sql`).

## Vòng 4 buổi
Hết một vòng: tạo cohort mới trong Admin → Lịch lớp, chọn **Sản phẩm public** + tick **Đang tuyển**.
Trang Class lấy cohort khai giảng gần nhất chưa kết thúc của mỗi sản phẩm; cohort cũ tự rơi khỏi trang
khi qua `end_date`. Không cần cơ chế reset riêng, không hardcode mã lớp.
Chưa có cohort nào → trang hiện "Lịch khai giảng đang cập nhật" + Hỏi Mira / Nhắn Thầy.

## Giới hạn còn lại (để Phase 2)
- Chưa có UI chọn **Theo tháng 499k / Đồng hành 6 tháng 396k×6**: khối thanh toán hiện mức theo tháng
  và mời học viên nhắn Zalo nếu muốn gói 6 tháng.
- Đăng ký vẫn ghi `leads` + chuyển khoản thủ công (chưa gắn `billing_*`).
- `note` của lead mang khoá sản phẩm: `[public-product:<key>]`.
- KHÔNG dùng mã tier App `can_ban_396` / `nang_cao_499` để đại diện gói lớp mới.

## Không đụng tới
Trigger cấp quyền lớp, `ht_member`, `packages`/`student_packages`, `student_entitlements`,
`my_learning_state()`, App native, các trang `/hanhtrinh2027`, `/solo01`, `/azz`.
