#!/usr/bin/env bash
# E2E System Chat Sound V1 (Class 2.0) trên stack LOCAL của scripts/e2e-learning-thread.sh (DB tạm, KHÔNG production, không thông báo thật).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-class-system-sound.sh
# DB tạm: nền mặc định (Chat/Share/…) + db/class_system_chat_v1_setup.sql TRƯỚC mọi kịch bản. Chấm bài đi qua UI + lt_respond THẬT.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvasce.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_share_v1_setup.sql" \
    "$ROOT/db/bms_share_lifecycle_v1_setup.sql" "$ROOT/db/universal_share_v1_setup.sql" "$ROOT/db/class_system_chat_v1_setup.sql" > "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-system-sound.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
