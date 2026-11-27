#!/usr/bin/env bash
# Test migration vá quyền Story trên PostgreSQL tạm cục bộ. KHÔNG production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; BIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
T="$(mktemp -d /tmp/tvast.XXXXXX)"; trap '"$BIN/pg_ctl" -D "$T/d" -m immediate stop >/dev/null 2>&1; rm -rf "$T"' EXIT
LC_ALL=C "$BIN/initdb" -D "$T/d" -U postgres -E UTF8 --locale=C >/dev/null
LC_ALL=C "$BIN/pg_ctl" -D "$T/d" -o "-k $T -c listen_addresses=''" -l "$T/log" -w start >/dev/null
P=("$BIN/psql" -h "$T" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${P[@]}" -f "$ROOT/tests/story-security/db-fixture.sql"
"${P[@]}" -1 -f "$ROOT/db/story_security_lat0_setup.sql"
"${P[@]}" -1 -f "$ROOT/db/story_security_lat0_setup.sql"   # idempotent
"${P[@]}" -o /dev/null -f "$ROOT/tests/story-security/db-assert.sql" 2>&1 | sed -E 's/.*NOTICE: +//'
"${P[@]}" -1 -f "$ROOT/db/story_lat01_setup.sql"
"${P[@]}" -1 -f "$ROOT/db/story_lat01_setup.sql"   # idempotent
"${P[@]}" -o /dev/null -f "$ROOT/tests/story-security/db-assert-lat01.sql" 2>&1 | sed -E 's/.*NOTICE: +//'
