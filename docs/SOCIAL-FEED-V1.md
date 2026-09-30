# Class Social — Feed V1: "Dành cho bạn · Lớp của tôi · Bạn bè"

Một Feed, ba góc nhìn, ngay trên Home (`/me`), theo thứ tự: ô chia sẻ → tab → Feed.
V1 hoàn toàn xác định từ dữ liệu và quan hệ thật: không AI, không chấm điểm, không xếp hạng. Mới nhất lên trước.

## Nguyên tắc

**Bộ lọc không tạo quyền mới.** Mỗi góc nhìn là tập con của những gì người xem vốn đã được xem. Server tự lọc (`SECURITY DEFINER` + `auth.uid()`); client chỉ gửi tên góc nhìn.

| Góc nhìn | Nguồn | Gồm |
|---|---|---|
| **Dành cho bạn** (mặc định) | `social_feed()` — giữ nguyên, không sửa | Như Feed hiện tại: bài Trả bài cũ (`audience='class'`), bài chỉ-bạn-bè của mình và bạn bè, Learning Thread community |
| **Lớp của tôi** | `social_feed_scoped('my_classes')` | Learning Thread community (chưa ẩn, chưa lưu trữ) có snapshot `class_schedule_id` thuộc một trong các **lớp hiện tại** của người xem |
| **Bạn bè** | `social_feed_scoped('friends')` | Hoạt động có tác giả là bạn bè **đã chấp nhận**, cùng luật xem như "Dành cho bạn" |

### Lớp của tôi

- "Lớp hiện tại" dùng đúng luật `social_my_classes` (`social_class_is_member`; bỏ lớp `cancelled`, `merged`, `draft`).
- Gộp mọi lớp thành một dòng, không nhóm theo lớp. Rời lớp thì hoạt động lớp đó biến khỏi tab, nhưng snapshot của thread không đổi.
- Thread **Tự học** không bao giờ vào tab này.
- Bài Social không vào tab này, vì `class_posts` không có ngữ cảnh lớp và hệ thống không suy diễn lớp.
- Người ngoài lớp (xem theo diện khám phá) không phải thành viên, nên lớp đó không vào "Lớp của tôi".
- Thầy chỉ thấy các lớp mà nhóm lớp có Thầy là thành viên. Không có luật "Thầy thấy mọi lớp".

### Bạn bè

- Chỉ tính quan hệ `accepted`. Lời mời đang chờ, đã từ chối hay đã huỷ kết bạn đều không tính. Không tính chính mình.
- Là bạn không nâng quyền:
  - Thread "Chỉ Thầy" không bao giờ hiện.
  - Bài đã ẩn chỉ Thầy thấy, đúng như luật hiện có.

### Chung

- Mỗi thread là **một** mục, thời gian theo `last_event_at`; có lượt mới thì mục đó nổi lên, không nhân đôi.
- Không trùng lặp: mỗi hàng có khoá `p:<id>` hoặc `t:<id>`.
- Phân trang keyset như `social_feed`: `(sort_at, sort_key)` giảm dần, mỗi trang 20. Đổi góc nhìn thì cursor về đầu.

## Audit `social_feed` trước Feed V1 (30/09)

- **Chữ ký:** `social_feed(p_before timestamptz, p_before_key text, p_limit int)` trả về `(kind, sort_at, sort_key, post jsonb, thread jsonb)`. Hàm SECURITY DEFINER, chỉ cấp cho `authenticated`, có cổng `is_class_member()`.
- **Mục:** `class_posts` (`audience='class'`: bài ẩn chỉ Thầy thấy; `audience='friends'`: mình và bạn bè) cộng với `learning_threads` community.
- **Sắp xếp / cursor:** bài theo `created_at`, thread theo `last_event_at`; keyset `(sort_at, sort_key)`; giới hạn tối đa 50.
- **Bạn bè:** `is_friend_of()`, tức `friendships` có status `accepted`.
- **Lớp:** không có trong `social_feed`. Hoạt động lớp nằm ở `social_class_activity`.
- **Index:** `friendships` đã có index theo cặp và theo từng người. Chưa thêm index `learning_threads.class_schedule_id` vì dữ liệu còn nhỏ; khi cần thì thêm bằng một migration riêng.

## Frontend

- URL: `/me` (mặc định), `/me?feed=classes`, `/me?feed=friends`. Đổi tab thì thay URL tại chỗ (reload và "Quay lại" giữ đúng góc nhìn). Không dùng `?tab=`, vì tham số này đã dành cho chuyển hướng sang App học.
- Mỗi góc nhìn có một hàm tải cố định. `usePostsFeed` coi đổi tab là đổi nguồn: tải lại và bỏ kết quả cũ về muộn.
- Ô chia sẻ không theo tab: bài đăng vẫn là bài chỉ-bạn-bè, kể cả khi đang ở tab "Lớp của tôi".
- Trạng thái trống ngắn gọn, có lối đi tiếp ("Xem các lớp của tôi", "Bạn bè"). Tab không hiện số đếm.

## Phát hành

1. Chạy `db/social_feed_v1_preflight.sql` (chỉ đọc) và kiểm `GATE = PASS`.
2. Chạy `db/social_feed_v1_setup.sql`. File chỉ thêm 2 hàm đọc, tự mở và đóng giao dịch, có cổng md5 drift.
3. Kiểm hàm đã tồn tại bằng anon API: phải nhận `permission denied`.
4. Merge `main` và deploy frontend.

"Dành cho bạn" vẫn gọi `social_feed`, nên frontend mới vẫn chạy nếu DB chưa có hàm mới; khi đó hai tab kia báo "Chưa tải được…". Dù vậy, vẫn phải chạy DB **trước**.

**Rollback:** đưa frontend về `main` cũ trước, sau đó chạy `db/social_feed_v1_rollback.sql` (không mất dữ liệu; `social_feed` không bị đụng).

## Test

- DB: `bash scripts/test-learning-threads-db.sh`, mục FEED V1.
  - Nhiều lớp, lớp huỷ, lớp của người khác, Tự học, private, ẩn, lưu trữ.
  - Bạn bè đã chấp nhận và đang chờ; Thầy; người ngoài Class; khách.
  - Phân trang 7 mục/trang có mốc trùng thời điểm; có lượt mới; huỷ kết bạn; rời lớp; preflight, idempotent, rollback.
- Unit: `tests/class-social/feed-v1.test.tsx`.
- E2E Chrome: `scripts/e2e-learning-thread.sh`, mục Feed V1: 3 tab, `?feed=` qua reload và "Quay lại", 320px, kết bạn và huỷ kết bạn thật trên stack local.
