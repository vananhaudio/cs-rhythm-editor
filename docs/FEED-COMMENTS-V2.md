# Feed Comments V2 (Lát 2 của Tương tác Feed)

Bình luận cho Learning Thread + bài TeamLab đã xuất bản; sửa/xoá của mình; trả lời MỘT cấp; số lượng; thông báo chủ thread (System Chat). Phụ thuộc Feed Likes V1 (`feed_target_visible`) — cài Likes TRƯỚC.

## Quyết định kiến trúc
- KHÔNG đổi `class_post_comments` (cấu trúc/policy/trigger/dữ liệu 41 dòng production, trigger `class_ugc_guard_*`) và không đổi `class_add_comment` / `class_comments_for_posts`.
- Thread/publication: bảng mới `feed_comments` (không policy, không quyền bảng; chỉ RPC definer) — cùng luật quyền thấy với Like, cùng bộ chặn nội dung (`class_ugc_text_blocked`, tài khoản tạm dừng) nếu production có.
- Bài Social: bình luận vẫn ở bảng cũ; `feed_comment_edit/delete('post', …)` ghi đúng bảng cũ (chỉ tác giả).
- Một API client (`targetCommentsApi`) và một model hai tầng (`targetCommentModel.buildThread`) cho các loại mới.

## DB (chưa chạy production) — `db/feed_comments_v2_setup.sql` / `_rollback.sql`
RPC: `feed_comment_add/list/counts/edit/delete/hide`; trigger `feed_comment_notify` (thread → học viên chủ thread, kind `feed_comment`, gộp theo người/ngày; lỗi thông báo không phá bình luận). Nới CHECK kind của `class_system_notices` thêm `feed_comment`.
Chưa thông báo cho bài Social / TeamLab: cần trang mở bài đơn lẻ (Lát 3).

## Frontend
`comments/targetComment*.ts`, `commentCountStore.ts`, `sections/comments/TargetComments.tsx`; `LikeBar` thêm nút Bình luận (chỉ khi có hành động thật); `FeedEntryCard` gắn: thread/publication mở khu bình luận dưới thanh (không che player), bài Social focus ô viết có sẵn; CommentItem/CommentsSection thêm Sửa.
Chưa có: trả lời bình luận của BÀI SOCIAL (khu cũ phẳng) — để Lát 2.1 nếu Owner muốn.

## Kiểm thử
`bash scripts/test-feed-comments-db.sh` · `npm run test:class-social` (396) · `PUPPETEER_DIR=… bash scripts/e2e-feed-comments.sh` (thread + publication + Social, 390px).
