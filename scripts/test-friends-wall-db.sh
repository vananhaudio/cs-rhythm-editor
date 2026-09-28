#!/usr/bin/env bash
# Test Bạn bè + Tường ở tầng DB và Data API trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew), postgrest (tuỳ chọn — bỏ qua phần API nếu thiếu), node.
#   bash scripts/test-friends-wall-db.sh
set -euo pipefail
export LC_ALL=C LANG=C   # postmaster macOS cần locale hợp lệ ("became multithreaded during startup")

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvafw.XXXXXX)"   # đường dẫn ngắn: Unix socket giới hạn ~104 ký tự
PORT="${PORT:-$((54000 + RANDOM % 1000))}"
API_PORT=$((PORT + 1000))
PGRST_PID=""

cleanup() {
  [ -n "$PGRST_PID" ] && kill "$PGRST_PID" 2>/dev/null || true
  "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

LC_ALL=C "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=127.0.0.1" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres tva_test

psqlf() { PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_test -v ON_ERROR_STOP=1 "$@"; }

echo "── Baseline (giả lập production) + migration Social hiện có"
psqlf -f "$ROOT/db/tests/local/social_fixture.sql"
for f in community_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup; do
  psqlf -f "$ROOT/db/$f.sql" >/dev/null
done

echo "── Migration Bạn bè + Tường (chạy 2 lần: idempotent) + chạy lại rls_setup.sql"
psqlf -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null
psqlf -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null
psqlf -f "$ROOT/db/rls_setup.sql" >/dev/null

echo "── Test SQL (RLS/GRANT/RPC theo từng identity)"
psqlf -c "select 1" >/dev/null
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_test -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_social_friends_wall_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'

if ! command -v postgrest >/dev/null; then
  echo "(bỏ qua test Data API: không có postgrest)"
else
  echo "── Test Data API (PostgREST + JWT thật)"
  SECRET="local-test-secret-local-test-secret-000000"
  cat > "$TMP/pgrst.conf" <<EOF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:$PORT/tva_test"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $API_PORT
server-host = "127.0.0.1"
EOF
  postgrest "$TMP/pgrst.conf" >"$TMP/pgrst.log" 2>&1 &
  PGRST_PID=$!
  API="http://127.0.0.1:$API_PORT" SECRET="$SECRET" node "$ROOT/scripts/test-friends-wall-api.mjs"
fi

echo "── Rollback rồi cài lại (script rollback chạy sạch)"
psqlf -f "$ROOT/db/class_social_friends_wall_rollback.sql" >/dev/null
psqlf -c "do \$\$ begin if to_regclass('public.friendships') is not null then raise exception 'rollback còn friendships'; end if; end \$\$;"
psqlf -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null
echo "ROLLBACK OK"
