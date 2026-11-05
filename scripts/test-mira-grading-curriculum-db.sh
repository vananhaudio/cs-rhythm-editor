#!/usr/bin/env bash
# Test hàm thuần mira_grading_curriculum_data (db/mira_grading_curriculum_v2_setup.sql) trên Postgres TẠM — không production, không mạng.
# Dữ liệu vào: khối giáo trình MẪU trong repo (src/data/solo01) và, nếu có, bản export của hàng published (MIRA_CURRICULUM_EXPORT_DIR/th01-s{1,4}.json).
#   bash scripts/test-mira-grading-curriculum-db.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(pg_config --bindir 2>/dev/null || echo /opt/homebrew/opt/postgresql@17/bin)"
TMP="$(mktemp -d)"; PORT=$((56000 + RANDOM % 900))
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=" -l "$TMP/pg.log" -w start >/dev/null
export PGHOST="$TMP" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
"$PGBIN/psql" -q -c 'create role anon nologin; create role authenticated nologin;' >/dev/null
# chỉ nạp khối HELPERS (đúng chữ sẽ chạy ở production)
sed -n '/^-- ==== HELPERS BEGIN/,/^-- ==== HELPERS END/p' "$ROOT/db/mira_grading_curriculum_v2_setup.sql" | "$PGBIN/psql" -v ON_ERROR_STOP=1 -q -f - >/dev/null
(cd "$ROOT" && npx tsx tests/mira-grading-curriculum/dump-blocks.ts > "$TMP/template-blocks.json")
export TEMPLATE_BLOCKS="$TMP/template-blocks.json" PSQL="$PGBIN/psql" TMP_DIR="$TMP"
node --experimental-strip-types --test "$ROOT/tests/mira-grading-curriculum/curriculum-data.test.mjs"
