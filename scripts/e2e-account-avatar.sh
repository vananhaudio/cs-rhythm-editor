#!/usr/bin/env bash
# E2E Account Avatar V1 (admin không có hồ sơ học sinh tự đổi ảnh) trên stack LOCAL của scripts/e2e-learning-thread.sh.
# DB tạm: + account_avatar_v1_setup.sql (regex URL nới cho proxy http://127.0.0.1 — CHỈ trong DB tạm) + N = admin.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-account-avatar.sh            (chỉ kịch bản avatar)
#   E2E_FULL=1 PUPPETEER_DIR=… bash scripts/e2e-account-avatar.sh            (toàn bộ kịch bản cũ trước — hồi quy)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvaavx.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
sed 's#\^https://\[a-z0-9-\]+\\\.supabase\\\.co/#^(https://[a-z0-9-]+\\.supabase\\.co|http://127\\.0\\.0\\.1:[0-9]+)/#' \
  "$ROOT/db/account_avatar_v1_setup.sql" > "$TMPX/extra.sql"
grep -q 'http://127' "$TMPX/extra.sql" || { echo "FAIL: không nới được regex URL cho stack local"; exit 1; }
cat >> "$TMPX/extra.sql" <<'SQL'
alter table public.app_users drop constraint app_users_avatar_url_check;   -- proxy local là http
update public.app_users set role = 'admin', name = 'Quản trị' where id = 'eeeeeeee-0000-4000-8000-00000000000e';
delete from public.edu_students where user_id = 'eeeeeeee-0000-4000-8000-00000000000e';
SQL
if [ -n "${E2E_FULL:-}" ]; then SKIP=""; else SKIP=1; fi
E2E_CHECKPOINTS=1 E2E_SKIP_BASE="$SKIP" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-account-avatar.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
