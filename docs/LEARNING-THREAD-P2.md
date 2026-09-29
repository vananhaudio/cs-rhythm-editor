# Learning Thread P2 — Feed · Tường · Hành trình

P2 biến Learning Thread thành **đời sống xã hội** (`/me`) và **Hành trình**. Mọi thứ là CÁCH NHÌN của cùng dữ liệu P1:
- không copy sang `class_posts`;
- không bảng journey;
- không post nhân bản.

## Quyết định thiết kế (sau audit)

| Vấn đề | Chọn | Vì sao |
|---|---|---|
| Feed trộn | RPC mới `social_feed` trả `kind = post \| learning_thread` | Giữ nguyên `class_feed` (không đổi kiểu trả về, không đụng cổng drift Bạn bè + Tường). |
| Một thread = một mục | Server union 1 dòng/thread, `sort_at = last_event_at` | Có event mới thì câu chuyện nổi lên, không nhân bản. |
| Phân trang | Keyset `(sort_at, sort_key)`, `sort_key = 'p:<id>' \| 't:<id>'` | Xác định, không trùng. Test 1 mục/trang khớp trang lớn. |
| Quyền Feed | Chỉ `community` + không ẩn + không lưu trữ. Private không lên Feed, kể cả với Thầy (đã có hàng đợi). | Backend quyết, không lọc ở client. |
| Tường | RPC `user_wall`: bài (đúng luật `get_user_wall`) + thread của người đó | Cùng `can_view_wall`. Bạn bè thấy community; chính chủ và Thầy thấy tất cả (kể cả private, lưu trữ). |
| Hành trình | RPC `learning_journey(user)` + gom nhóm ở client (`groupJourney`) | Nguồn duy nhất = thread + snapshot + event. Chính chủ và Thầy thấy tất cả; thành viên khác chỉ community không ẩn. |
| Chặng | Theo **danh tính lịch sử**: (lớp hoặc Tự học) × khoá | Không cần lớp. HS03 "Tự học · DH2" là một chặng hợp lệ. Hồ sơ hiện tại không đổi quá khứ. |
| Màu | Xác định theo môn (`TRACK_THEMES`), **cùng bộ màu App học** (`courseFallbackStyle`) | Không màu ngẫu nhiên. Test khoá màu khớp App. Sau này có thể đưa vào cấu hình. |

## Backend — `db/learning_threads_p2_setup.sql` (chỉ RPC đọc + 1 index)

- `lt_thread_card(id)` — nội bộ. Thẻ tóm tắt gồm:
  - người học, danh tính, trạng thái;
  - `first_kind` (Hỏi bài / Trả bài);
  - `last_event`: loại, kết luận, tác giả (tên thật), `has_resources`, `is_resubmission`.
- `social_feed(p_before, p_before_key, p_limit)`
- `user_wall(p_user, p_before, p_before_key, p_limit)`
- `learning_journey(p_user)`
- Index `learning_threads_feed_idx`: thread community đang hoạt động.

Preflight: `db/learning_threads_p2_preflight.sql`. Rollback: `db/learning_threads_p2_rollback.sql`. Rollback không mất dữ liệu, nhưng phải rollback frontend trước.

## Frontend

- **Feed `/me`:** `useCommunityFeed` → `social_feed`. `CommunityFeed` → `FeedEntryCard`: bài Social vẫn là `PostCard`, thread là `LearningThreadCard`.
- **Thẻ thread:**
  - AI · danh tính lịch sử · ❓ Hỏi bài / 🎸 Trả bài · bài.
  - "Chuyện vừa xảy ra" theo event mới nhất, tên Thầy lấy từ dữ liệu.
  - "📘 Thầy đã gửi bài giảng nên xem" khi có bài giảng.
  - Trạng thái + [Xem cuộc trao đổi] → `/me/t/<id>`.
- **Tường:** `ProfilePage` → `user_wall` (vẫn chỉ mount khi `can_view_wall`).
- **Tab Hành trình** trên trang cá nhân: `JourneyView` → `JourneyTimeline`.
  - Năm → chặng (đường màu theo môn) → mốc. Mỗi mốc là tóm tắt bước: ❓ Hỏi bài · 🔄 Cần làm lại · 📘 Bài giảng · 🎸 Trả lại · ✅ Đạt.
  - Bấm mốc → `/me/t/<id>`.
- **App học không đổi** ("TÔI HỌC"), không đưa Feed vào App.

## Test

- **DB** (`scripts/test-learning-threads-db.sh`, phần P2):
  - preflight, gate khi thiếu P1, migration ×2;
  - 36 kiểm tra quyền và nội dung: private / ẩn / lưu trữ không lên Feed; một thread một mục; phân trang không trùng; khoá tường như cũ; bạn bè / chính chủ / Thầy; Hành trình tự học; không tạo `class_posts`;
  - rollback giữ dữ liệu.
- **Frontend:** `tests/class-social/learning-thread-p2.test.tsx` — câu mô tả Phần U, thẻ, Feed trộn, gom chặng, màu khớp App, timeline.
- **E2E Chrome:** `scripts/e2e-learning-thread.sh`, thêm 8 cảnh P2 — thẻ Feed, private không lộ, mở thread từ Feed và từ Hành trình, Hành trình tự học, 390px không tràn.

## Thứ tự production

1. Chạy `db/learning_threads_p2_preflight.sql` → `GATE = PASS`.
2. Chạy `db/learning_threads_p2_setup.sql`.
3. Merge `main` → deploy.
   - **DB PHẢI chạy trước:** frontend P2 gọi `social_feed`; thiếu hàm thì Feed báo lỗi tải.
4. Kiểm Feed `/me` (thẻ thread HS03) và tab Hành trình trên trang cá nhân HS03.

## Chưa làm (hướng tiếp theo, không cản kiến trúc)

- Bình luận / tương tác trên thẻ thread.
- "Cộng đồng đang học bài này" trong App.
- Chặng cho HT2027/Solo (khi thread có `content_kind = program_session`).
- Màu chặng lưu trong cấu hình.
- Tự ghi tiến độ / mở khoá khi ĐẠT.
- Cột mốc biểu diễn.
