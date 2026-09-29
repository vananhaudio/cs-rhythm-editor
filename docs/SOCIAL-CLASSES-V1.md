# Social UX + Lớp học V1 (`/me`)

`/me` = mạng xã hội nội bộ về âm nhạc: **Trang chủ = CON NGƯỜI + HOẠT ĐỘNG**. Học sinh chưa được hướng dẫn phải tự hiểu trong 30–60 giây.

## Trang chủ

- Mở `/me` là thấy **ô chia sẻ** "Chia sẻ điều gì về âm nhạc…" (🎸 Đang tập · 🎵 Vừa đàn · 🙋 Nhờ góp ý · ✍️ Chia sẻ), rồi **Feed** ngay sau.
- Ô chia sẻ **dùng lại bài `status` của tường**: chỉ bạn bè và Thầy xem, không lập hệ bài đăng thứ hai.
- Bỏ khỏi Home:
  - ảnh bìa và hồ sơ lớn (nay ở Trang cá nhân, bấm avatar trong ô chia sẻ để tới);
  - nút "Trả bài" tím hero (còn là lối phụ nhỏ "Trả bài bằng link video"; Trả/Hỏi bài có cấu trúc bắt đầu từ đúng bài trong App học);
  - khối "Trả bài / Hỏi bài của tôi" (đã có ở tab Hành trình).
- Thầy: một dòng nhỏ "N bài đang chờ phản hồi ›", chỉ khi N > 0. Route `/me/queue` giữ nguyên.
- Feed "Dành cho bạn" (`social_feed`) có thêm bài tường của **chính mình + bạn bè**, đúng quyền sẵn có của bài `friends`, nên bài vừa chia sẻ hiện ngay. Người không phải bạn vẫn không thấy.

## Sidebar / menu

```
CỘNG ĐỒNG    Trang chủ (đầu tiên, /me) · Bạn bè · Trò chuyện
LỚP HỌC      ● lớp của tôi (hiện trực tiếp, bấm là vào) · KHÁM PHÁ ○ tối đa 3 lớp · Tất cả lớp
HỌC TẬP      App học · Kho bài giảng · Kho giáo trình · Thư viện bản nhạc
CÔNG CỤ      …
```

## Lớp học — không hệ thống thứ hai

- **Lớp** = `class_schedule`.
- **Thành viên** = `edu_group_members` active trong nhóm cohort (`cohort_group_id`) hoặc nhóm gắn lớp (`group_id` / cùng mã lớp). Cùng nguồn với "Lớp đang học" của App.
- **Giáo viên của lớp** = thành viên nhóm có vai trò teacher/admin. Không hard-code; không có thì không hiện.
- **RPC chỉ đọc** (`db/social_classes_v1_setup.sql`): `social_my_classes`, `social_discover_classes`, `social_class_detail`, `social_class_activity`, `social_class_members`. Hàm nội bộ: `social_class_members_of`, `social_class_is_member`, `social_class_card`.
- **Route:** `/me/classes` (Lớp của tôi + Khám phá lớp + tìm không dấu), `/me/classes/<id>` (tab Hoạt động | Thành viên). Link giữ nguyên qua đăng nhập.
- **Hoạt động lớp** = Learning Thread `community` có **snapshot thuộc lớp** (một thread = một thẻ). Thread tự học không thuộc lớp nào.

## Quyền (server enforce)

| | Người ngoài lớp | Thành viên lớp | Thầy/admin |
|---|---|---|---|
| Trang lớp công khai (tên, mã, trạng thái, lịch, khoá, số học viên, Thầy) | ✓ | ✓ | ✓ |
| Hoạt động: thread community của lớp | ✓ | ✓ | ✓ |
| Danh sách thành viên (tên/avatar/vai trò/quan hệ bạn bè) | ✕ (chỉ số lượng) | ✓ | ✓ |
| Đăng bài / Trả-Hỏi bài từ trang lớp | ✕ | ✕ (V1 chưa có) | ✕ |

- Không trả `zoom_url`, giá, `metadata`, email/SĐT, gói, tiến độ, thread private, hay bài tường của người không phải bạn.
- Khám phá = lớp `is_active` và đang học/tuyển sinh mà mình chưa tham gia. Sắp xếp xác định (đang học trước, mới nhất), không "gợi ý AI".

## Gap (để phase sau, KHÔNG tạo model trùng)

- Đăng bài **vào lớp** / bài công khai cho cộng đồng: cần cột ngữ cảnh lớp + đổi ràng buộc `status ⇔ friends` của `class_posts`, nên cần migration riêng.
- `class_schedule` không có cột giáo viên: đang suy ra từ thành viên nhóm có vai trò teacher.
- Bộ lọc Feed (Dành cho bạn / Lớp của tôi / Bạn bè); uy tín / đóng góp: chưa làm, kiến trúc không chặn.

## Test

- **DB:** 22 kiểm tra trong `scripts/test-learning-threads-db.sh` (phần SOCIAL UX + LỚP HỌC V1): preflight / gate md5 / idempotent / rollback về đúng `social_feed` P2.
- **Frontend:** `tests/class-social/classes.test.tsx`.
- **E2E Chrome** (`scripts/e2e-learning-thread.sh`):
  - sidebar, trang lớp khi là người ngoài / thành viên;
  - chia sẻ từ Home; menu mobile;
  - 390px không tràn.

## Production

1. `db/social_classes_v1_preflight.sql` → `GATE = PASS`. Không bắt buộc, vì migration tự có cổng.
2. `db/social_classes_v1_setup.sql`.
3. Merge `main` → deploy. **DB trước:** frontend gọi `social_my_classes`; thiếu hàm thì sidebar chỉ trống phần lớp (không vỡ trang).

Rollback: frontend trước, sau đó `db/social_classes_v1_rollback.sql` (không mất dữ liệu; `social_feed` về đúng bản P2).
