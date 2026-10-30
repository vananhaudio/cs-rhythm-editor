# Feed Likes V1 (Lát 1 của Tương tác Feed)

Thích cho ba nguồn Feed bằng MỘT mô hình `(target_kind, target_id)`: `post` (class_posts.id) · `learning_thread` (learning_threads.id) · `teamlab_publication` (publication_id).
Cùng một bảng/RPC cho `/me`, Class Mobile và TVA Guitar (cùng bundle React + Supabase) — không có nguồn Like thứ hai.

## DB (chưa chạy production)
- `db/feed_likes_v1_setup.sql` — bảng `feed_likes` (PK kind+id+user, không policy, không quyền bảng), `feed_target_visible`, `feed_like_set(kind,id,liked)` (đặt TRẠNG THÁI → idempotent), `feed_like_summary(kinds[],ids[])` (theo lô ≤100, chỉ trả mục thấy được). Không sửa social_feed*/lt_*/RLS hiện có.
- `db/feed_likes_v1_rollback.sql` — gỡ cả bảng (mất lượt thích). Revert frontend TRƯỚC.
- Quyền thấy = luật Feed hiện hành: bài theo `class_posts_member_read` (audience/ẩn/bạn bè), thread community chưa ẩn/lưu trữ, publication published. Người ngoài Class/anon: từ chối.
- Chạy bằng `prod-db.py` (preflight → dryrun → migrate → postflight) sau khi Owner duyệt.

## Frontend
`src/class-social/likes/` — `likeModel.ts` (thuần), `likesApi.ts` (RPC), `likeStore.ts` (nạp lô, lạc quan, 1 yêu cầu bay/mục, hoàn khi lỗi), `LikeBar.tsx`. `FeedEntryCard` gắn `LikeBar` qua ô `footer` của PostCard / LearningThreadCard / PublicationCard.
Chỉ hiện nút Thích (đã hoạt động); Bình luận/Chia sẻ thêm ở Lát 2–3.

## Kiểm thử
- `bash scripts/test-feed-likes-db.sh` (PG17 tạm: cổng, migration ×2, quyền, trùng, ẩn/riêng tư, lô, rollback).
- `npm run test:class-social` (390 test, gồm `feed-likes.test.tsx`).
- `PUPPETEER_DIR=… bash scripts/e2e-feed-likes.sh` (stack cục bộ, iPhone 390px, mất mạng, 2 người dùng).
