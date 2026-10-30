#!/usr/bin/env bash
# E2E Feed Comments V2 (/me, iPhone 390px): bình luận Learning Thread + bài TeamLab, trả lời một cấp, sửa/xoá, mất mạng, thông báo; sửa bình luận bài Social.
# DB tạm cục bộ, KHÔNG production.   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-feed-comments.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvafk2.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
A=aaaaaaaa-0000-4000-8000-00000000000a; B=bbbbbbbb-0000-4000-8000-00000000000b
{
  cat "$ROOT/db/tests/local/teamlab_publications_fixture.sql" "$ROOT/db/social_feed_teamlab_publications_v1_setup.sql" \
      "$ROOT/db/social_feed_teamlab_publications_v2_setup.sql" "$ROOT/db/tests/local/teamlab_publications_seed.sql"
  cat "$ROOT/db/tests/local/social_feed_safe_stub.sql"
  cat "$ROOT/db/class_system_chat_v1_setup.sql" "$ROOT/db/feed_likes_v1_setup.sql" "$ROOT/db/feed_comments_v2_setup.sql"
  cat <<SQL
insert into public.class_posts (id, author_user_id, type, audience, body, created_at)
  values ('00000000-fa00-4000-8000-000000000001', '$A', 'practice', 'class', 'CMTPOST bài luyện tập', now() - interval '1 minute');
insert into public.class_post_comments (post_id, author_user_id, body) values ('00000000-fa00-4000-8000-000000000001', '$B', 'POSTCMT của B');
insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, status, last_event_at, last_student_event_at, event_count)
  values ('00000000-fb00-4000-8000-000000000001', '$A', 'L:' || gen_random_uuid(), '{"lesson":{"title":"Bài thử bình luận"}}', 'community', 'waiting_teacher', now() - interval '30 seconds', now() - interval '30 seconds', 1);
SQL
} > "$TMPX/extra.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-feed-comments.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
