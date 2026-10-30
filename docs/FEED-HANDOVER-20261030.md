# Bàn giao phiên Feed (Thích + Bình luận) — 30/10/2026

Dành cho phiên hợp nhất TVA Guitar (App Store / Google Play). Không chứa bí mật.

## 1. Đã vào main
| Mục | Giá trị |
|---|---|
| PR | #43 → `7388068e` (rollback FE `014f2445`); #44 (kiểm duyệt) → `a1adc3f7` (rollback FE `7388068e`) |
| Nhánh nguồn | `integrate/feed-like-comments-20261030` (chứa `feat/feed-like-v1` Lát 1 + `feat/feed-comments-v2` Lát 2, đã gộp `origin/main` lúc đó, giữ cả lớp chặn/báo cáo của main) |
| Bundle production | `index-DwBJcYwk.js` (chunk `SystemNoticeView-DNYrFlPk.js` chứa `feed_like_set`, `feed_comment_add`) |

## 2. Migration production đã chạy (30/10, qua `prod-db.py`)
| File | sha256 | Kết quả |
|---|---|---|
| `db/feed_likes_v1_setup.sql` | `f190cd1b223c463aa37c4365d7e306de04b4a1e4252ff004e9c1def067461a81` | COMMIT · postflight 10/10 |
| `db/feed_comments_v2_setup.sql` | `fbda802be3f4e32cc0cf3883544800ae0c1e2a1913d31fa5daab6e247ab1dc0f` | COMMIT · postflight: RLS bật, 0 policy, grants đúng, 8 hàm, `class_post_comments` 41 dòng + 3 trigger |

Lưu ý: CHECK `class_system_notices_kind_check` phải giữ kind `teacher_commented` (production có, repo không có).

## 3. Chức năng đã lên production
Thích (post / learning_thread / teamlab_publication) · Bình luận thread + bài TeamLab (trả lời một cấp, sửa/xoá của mình, Thầy ẩn) · sửa bình luận bài Social · số bình luận trên thanh · thông báo System Chat cho chủ thread (gộp theo người/ngày).

## 4. Migration kiểm duyệt (đã chạy) và còn thiếu
- `db/feed_comments_safety_v1_setup.sql` sha256 `2a5112d9b5452a99fd79ec45bacdf34f9d949fdf85811474661a7afee5ba58c9`: **COMMIT 30/10**. Postflight PASS: trigger `feed_comment_report_apply` (trigger duy nhất trên `class_reports`), `anon` không gọi được `feed_comment_report`, `authenticated` gọi được, `feed_comment_report_apply` không gọi trực tiếp được, `feed_comments` RLS bật + 0 policy, md5 `class_report_resolve` không đổi, `class_post_comments` 41 dòng; `feed_comments`/`class_reports`/`feed_likes` còn 0 dòng.
- Frontend kiểm duyệt: PR `feat/feed-comments-safety-v1` → main PR #44 đã merge và deploy: `origin/main` = `a1adc3f7` (bundle `index-DGq9r7mD.js` chứa `feed_comment_report`); rollback FE = `7388068e`.
- Chưa nghiệm thu bằng thao tác thật trên production (chưa được phép tạo dữ liệu); chưa kiểm WebKit/iPhone/TVA Guitar thật (Chrome 390px không phải nghiệm thu thiết bị).
- Hoãn: trả lời bình luận Social (2.1), Chia sẻ vào Trò chuyện + trang mở bài gốc + thông báo bài Social/TeamLab (Lát 3). Không có trong main.

## 5. Tương thích Class Mobile / TVA Guitar
Cùng một codebase và cùng RPC `feed_*` (không có hệ thống riêng cho mobile). Nút Thích/Bình luận là nút thật, ≥44px, Light Mode, không có nút giả (không có Chia sẻ). Bản native/Capacitor cần build từ main ≥ `7388068e` (và ≥ commit của PR safety khi được duyệt).

## 6. Bắt buộc trước khi lên Apple / Google Play
1. (XONG 30/10) migration safety + FE kiểm duyệt đã lên production — kiểm lại bundle trước khi build native.
2. Apple 1.2: Báo cáo + Chặn + lọc từ cấm + đồng ý quy tắc phải phủ MỌI nơi hiển thị UGC — sau bước 1 thì bình luận Thread/TeamLab đã phủ; kiểm lại khi thêm Lát 3.
3. Kiểm thật trên iPhone/WebKit và Android: Thích, Bình luận, Báo cáo, Chặn (Chrome 390px chưa đủ).
4. Nghiệm thu production bằng tài khoản thử + bài thử có kiểm soát, rồi dọn dữ liệu thử (xem mục 8).
5. Bản native không dùng bundle cũ hơn `7388068e`.

## 7. Hợp nhất an toàn
- Dùng `git merge origin/main` vào nhánh tích hợp; không rebase/force-push; không sửa nhánh phiên khác, không đụng `wip/macbook/*`.
- Xung đột đã gặp: `classSocial.css` (hai khối thêm cuối — giữ cả hai), `PostCard.tsx` (import `ReactNode` + `useState`), `CommentItem.tsx` (import `Composer` + `SafetyMenu`/`useIsBlocked`). `FeedEntryCard.tsx`, `LikeBar.tsx`, `TargetComments.tsx`, `src/class-social/likes|comments/` là file mới/của Feed: giữ phiên bản Feed.
- TeamLab / Class Mobile: Feed chỉ thêm `footer` slot cho 3 thẻ và RPC `feed_*`; không sửa TeamLab, Player, chấm bài, nộp bài.
- Gate trước khi merge: `npm run test:class-social`, `tsc -p tsconfig.app.json`, `npm run test:og`, `npm run build`, `bash scripts/e2e-feed-likes.sh`, `bash scripts/e2e-feed-comments.sh` (E2E fixture cần stub `db/tests/local/social_feed_safe_stub.sql` vì FE gọi `social_feed_safe`).
- DB: không sửa `class_post_comments`, `class_report_submit`, `class_report_resolve`.

## 8. Kế hoạch nghiệm thu production có kiểm soát (chưa chạy)
Tài khoản thử + một thread/bài thử do Owner chỉ định → Thích/Bỏ thích → Bình luận → Trả lời → Sửa → Xoá → Báo cáo → Thầy xử lý. Sau đó xoá bằng RPC `feed_comment_delete` và `feed_like_set(..., false)`; kiểm `feed_likes`/`feed_comments`/`class_reports` về số cũ. Rollback DB (chỉ khi Owner ra lệnh, xoá dữ liệu Feed mới): `db/feed_comments_v2_rollback.sql`, `db/feed_likes_v1_rollback.sql`, `db/feed_comments_safety_v1_rollback.sql`.

## 9. Ghi nhận khác
`class_posts` thấy 49 → 46 sau migration (46 dòng, 1 ẩn). Các migration Feed chỉ thêm đối tượng mới, không xoá; chưa xác minh nguyên nhân (nghi người dùng xoá bài).
