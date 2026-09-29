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

## V1.1 (30/09/2026) — tên thân thiện · hoạt động lớp thật · polish

- **Tên lớp thân thiện, chỉ đổi trình bày** (`classShortName`):
  - Menu hiện phần đầu của tên thật (cắt tại —, – hoặc " - "), ví dụ "Hành trình 2027 — 40 buổi thực hành" → **Hành trình 2027**, "Khởi đầu đam mê khóa 17 - KD17" → **Khởi đầu đam mê khóa 17**.
  - Không bao giờ hiện mã nội bộ (HT2027.TH01 / DH1.KD17) khi lớp có tên. Tooltip = tên đầy đủ · mã.
  - Trang lớp giữ tên đầy đủ. Không sửa tên trong DB.
- **Menu:** đúng MỘT mục sáng. Đó là lớp đang mở, dù nằm ở "Của tôi" hay "Khám phá"; hoặc "Tất cả lớp" khi ở `/me/classes`.
- **Header lớp** ("căn phòng của lớp"):
  - Thứ tự: TÊN LỚP · trạng thái → Thầy · số học viên (ẩn khi 0) · lịch · khoá → "Bạn là thành viên lớp này" hoặc "Bạn đang xem lớp này — bạn chưa tham gia."
  - Mã lớp / mã khoá là dòng nhỏ cuối.
- **`/me/classes`:** thẻ "Lớp của tôi" nổi (nền tím nhạt, "Bạn đang tham gia"); Khám phá nhẹ hơn; không nhấn "0 học viên".
- **Thẻ câu chuyện học tập:**
  - Tên bài là dòng chính, chương là metadata nhỏ.
  - Trong trang lớp bỏ nhãn lớp (đã rõ ngữ cảnh).
  - Empty state: "Chưa có hoạt động mới — Những bài Trả bài, Hỏi bài của lớp sẽ xuất hiện tại đây."
- **Quy tắc thuộc lớp của thread** (đã kiểm bằng test DB):
  - Theo **snapshot** `class_schedule_id` lúc mở thread, không theo membership hiện tại. Rời lớp thì lịch sử vẫn ở lớp cũ.
  - Chỉ thread `community`, không ẩn, không lưu trữ. Không lọt sang lớp khác. Tự học (`class = null`) không thuộc lớp nào.
- **Nhiều lớp cùng lúc:** `lt_identity_snapshot` chỉ xét các lớp active của học sinh có **dạy khoá của bài** (qua `class_stages` / `main_course_id` / `course_ids`). Ưu tiên theo thứ tự:
  1. lớp đang học;
  2. chặng chứa hôm nay;
  3. `start_date` mới nhất;
  4. id.

  Không lớp nào khớp thì là "Tự học". Quy tắc xác định, test kiểm trường hợp 2 lớp cùng dạy DH2.
- **Audit production chỉ đọc:** `db/social_classes_v11_audit.sql`. Liệt kê lớp, membership (số lượng), mọi thread kèm lớp đã đóng dấu, lớp có hoạt động thật, và lớp có thể sinh thread thật tự nhiên (lớp dạy khoá của bài đã bật). Không có PII.
- **Không migration.** Không tạo dữ liệu giả trên production.
