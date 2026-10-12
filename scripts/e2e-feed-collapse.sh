#!/usr/bin/env bash
# E2E Facebook-style Expand/Collapse (/me): bài + bình luận dài thu gọn, "Xem thêm bình luận" theo đợt. DB tạm cục bộ, không production.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-feed-collapse.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvafc.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
T=dddddddd-0000-4000-8000-00000000000d; A=aaaaaaaa-0000-4000-8000-00000000000a; B=bbbbbbbb-0000-4000-8000-00000000000b
cat > "$TMPX/extra.sql" <<SQL
delete from public.class_post_comments; delete from public.class_posts;
-- p1..p5 (mới → cũ): 0 / 1 / 2 / 10 / 35 bình luận; p1 ngắn, p2 DÀI nhiều đoạn, p3 ngắn, p4 ngắn, p5 một "từ" rất dài không dấu cách
insert into public.class_posts (id, author_user_id, type, body, created_at) values
 ('00000000-fc00-4000-8000-000000000001', '$T', 'practice', 'FCSHORT bài ngắn không bình luận', now() - interval '1 minute'),
 ('00000000-fc00-4000-8000-000000000002', '$T', 'practice', (select string_agg('FCLONG đoạn ' || g || ': nội dung rất dài để kiểm tra thu gọn bài đăng trên điện thoại và máy tính, lặp lại nhiều lần cho đủ dòng.', E'\n\n') from generate_series(1, 12) g), now() - interval '2 minute'),
 ('00000000-fc00-4000-8000-000000000003', '$T', 'practice', 'FCTWO bài ngắn hai bình luận', now() - interval '3 minute'),
 ('00000000-fc00-4000-8000-000000000004', '$T', 'practice', 'FCTEN bài ngắn mười bình luận', now() - interval '4 minute'),
 ('00000000-fc00-4000-8000-000000000005', '$T', 'practice', 'FCMANY bài ngắn ' || repeat('x', 400), now() - interval '5 minute');
insert into public.class_post_comments (post_id, author_user_id, body, created_at)
 select '00000000-fc00-4000-8000-000000000002', '$A', 'FCC1 bình luận ngắn', now() - interval '90 second';
insert into public.class_post_comments (post_id, author_user_id, body, created_at) values
 ('00000000-fc00-4000-8000-000000000003', '$A', 'FCC1 ngắn', now() - interval '170 second'),
 ('00000000-fc00-4000-8000-000000000003', '$B', (select 'FCLONGC ' || string_agg('câu dài kiểm tra thu gọn bình luận', ' ') from generate_series(1, 40)), now() - interval '160 second');
insert into public.class_post_comments (post_id, author_user_id, body, created_at)
 select '00000000-fc00-4000-8000-000000000004', case when g % 2 = 0 then '$A'::uuid else '$B'::uuid end, 'FCT' || lpad(g::text, 2, '0'), now() - interval '4 minute' + g * interval '1 second' from generate_series(1, 10) g;
insert into public.class_post_comments (post_id, author_user_id, body, created_at)
 select '00000000-fc00-4000-8000-000000000005', case when g % 2 = 0 then '$A'::uuid else '$B'::uuid end, 'FCM' || lpad(g::text, 2, '0'), now() - interval '5 minute' + g * interval '1 second' from generate_series(1, 35) g;
SQL
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-feed-collapse.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
