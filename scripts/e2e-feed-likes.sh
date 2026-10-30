#!/usr/bin/env bash
# E2E Feed Likes V1 (/me, iPhone 390px): Thích trên bài Social / Learning Thread / bài TeamLab đã xuất bản. DB tạm cục bộ, KHÔNG production.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-feed-likes.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvafk.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
A=aaaaaaaa-0000-4000-8000-00000000000a
{
  cat "$ROOT/db/tests/local/teamlab_publications_fixture.sql" "$ROOT/db/social_feed_teamlab_publications_v1_setup.sql" \
      "$ROOT/db/social_feed_teamlab_publications_v2_setup.sql" "$ROOT/db/tests/local/teamlab_publications_seed.sql"
  cat <<SQL
insert into public.class_posts (id, author_user_id, type, audience, body, created_at)
  values ('00000000-fa00-4000-8000-000000000001', '$A', 'practice', 'class', 'LIKEPOST bài luyện tập để thích', now() - interval '1 minute');
SQL
  cat "$ROOT/db/feed_likes_v1_setup.sql"
} > "$TMPX/extra.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-feed-likes.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
