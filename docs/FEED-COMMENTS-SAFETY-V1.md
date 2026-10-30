# Feed Comments Safety V1

Đưa bình luận Thread/TeamLab (`feed_comments`) vào cơ chế kiểm duyệt UGC có sẵn (Class UGC Safety V1, Apple 1.2).

| Hạng mục | Cách làm |
|---|---|
| Ẩn người chặn | `feed_comment_list` / `feed_comment_counts` dùng `class_ugc_pair_blocked(auth.uid(), tác giả)` (hai chiều); trả lời dưới bình luận bị ẩn vì chặn cũng ẩn. FE ẩn thêm bằng `useIsBlocked` (chặn tức thì trong phiên). |
| Báo cáo | RPC `feed_comment_report(p_comment, p_reason, p_note)` ghi `class_reports` với `kind='comment'`, `target_id` = id `feed_comments` → cùng hàng đợi `class_reports_list` của Thầy. Cùng luật với `class_report_submit`: phải thấy được bình luận, không tự báo cáo, chống trùng, ≤20 báo cáo/giờ. |
| Thầy xử lý | Trigger `feed_comment_report_apply` (AFTER UPDATE OF status trên `class_reports`): `hide` / `hide_and_block` → ẩn `feed_comments` tương ứng. `class_report_resolve` KHÔNG bị sửa (md5 không đổi; với id không thuộc `class_post_comments` nó bỏ qua êm theo P0002). |
| Menu FE | Bình luận của người khác dùng `SafetyMenu` (Báo cáo, Chặn người dùng) với `via="feed_comment"`; của mình giữ Sửa/Xoá. |

Không đổi: `class_post_comments`, `class_report_submit`, `class_report_resolve`, CHECK của `class_reports`.

- Migration: `db/feed_comments_safety_v1_setup.sql` (idempotent, additive, có GATE).
- Rollback: `db/feed_comments_safety_v1_rollback.sql` (gỡ trigger + RPC, trả hai hàm về bản V2; KHÔNG xoá báo cáo đã gửi).
- Test: `bash scripts/test-feed-comments-db.sh` (DB) · `bash scripts/e2e-feed-comments.sh` (Chrome 390px, cần `PUPPETEER_DIR`).
