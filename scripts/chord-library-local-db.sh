#!/usr/bin/env bash
# Thư viện hợp âm chạy trên DB THẬT nhưng TẠM, để thử giao diện /thuvien bằng adapter RPC — KHÔNG đụng production.
#   bash scripts/chord-library-local-db.sh          # dựng cluster tạm (nếu chưa có) + chạy cầu HTTP ở 127.0.0.1:54399
#   bash scripts/chord-library-local-db.sh --reset  # xoá cluster tạm, dựng lại từ đầu
# Rồi mở trang thử với ?db=local (xem tests/thuvien-ui/proof/main.tsx). Dừng script = dừng cả Postgres tạm.
# Cần: postgresql@17 (Homebrew), node.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
DIR="${CHORD_LOCALDB_DIR:-/tmp/chord-library-localdb}"
PORT="${CHORD_PGPORT:-55780}"
DB=chord_local
[ "${1:-}" = "--reset" ] && { "$PGBIN/pg_ctl" -D "$DIR/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
mkdir -p "$DIR"
stop() { "$PGBIN/pg_ctl" -D "$DIR/data" -m fast stop >/dev/null 2>&1 || true; }
trap stop EXIT
psqld() { PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 "$@"; }
if [ ! -d "$DIR/data" ]; then
  "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
  "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/pg.log" -w start >/dev/null
  "$PGBIN/createdb" -h "$DIR" -p "$PORT" -U postgres "$DB"
  for f in db/tests/local/social_fixture.sql db/package_student_identity_guard.sql db/community_setup.sql \
           db/tests/local/chord_library_fixture.sql db/nhipphach_capabilities_setup.sql; do psqld -d "$DB" -f "$ROOT/$f" >/dev/null; done
  psqld -d "$DB" -1 -f "$ROOT/db/chord_library_v1_setup.sql" >/dev/null
  echo "Đã dựng DB tạm $DB (Unix socket $DIR, cổng $PORT) — chưa có bài nào."
else
  "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/pg.log" -w start >/dev/null
  echo "Dùng lại DB tạm $DB ($(psqld -d "$DB" -tA -c 'select count(*) from chord_sheets') bài)."
fi
CHORD_PSQL="$PGBIN/psql" CHORD_PGHOST="$DIR" CHORD_PGPORT="$PORT" CHORD_PGDATABASE="$DB" \
  node --experimental-strip-types --no-warnings "$ROOT/tests/thuvien-db/local-bridge.ts"
