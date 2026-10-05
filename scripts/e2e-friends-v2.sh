#!/usr/bin/env bash
# E2E Friends UX V2 trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: + db/friends_ux_v2_setup.sql TRƯỚC mọi kịch bản; trước kịch bản Friends: xoá quan hệ cũ + tên C thật dài (kiểm bố cục).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-friends-v2.sh            (chỉ kịch bản Friends V2)
#   E2E_FULL=1 PUPPETEER_DIR=… bash scripts/e2e-friends-v2.sh            (toàn bộ kịch bản cũ trên DB đã migrate — hồi quy)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvafrx.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat > "$TMPX/extra.sql" <<'SQL'
delete from public.friendships;
update public.edu_students set display_name = 'Chi Nguyễn Hoàng Bảo Ngọc Phương Thảo Minh Châu' where user_id = 'cccccccc-0000-4000-8000-00000000000c';
SQL
if [ -n "${E2E_FULL:-}" ]; then SKIP=""; else SKIP=1; fi
# Production đã có Account Avatar V1 (app_users.avatar_url) → DB tạm cũng phải có, rồi mới tới Friends UX V2
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" > "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE="$SKIP" E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-friends-v2.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
