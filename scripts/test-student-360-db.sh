#!/usr/bin/env bash
# Test Student 360 P1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-student-360-db.sh
# Phủ: migration ×2 (idempotent) · rls_setup.sql không mở policy · quyền bảng/hàm · test SQL theo identity
# · rollback ×2 + cài lại. Dữ liệu hoàn toàn giả lập (db/tests/local/social_fixture.sql).
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvas3.XXXXXX)"
PORT="${PORT:-$((56000 + RANDOM % 400))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d s360 -v ON_ERROR_STOP=1 "$@"; }
q() { psqld -tA -c "$1"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres s360
psqld -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
for f in package_student_identity_guard community_setup; do psqld -f "$ROOT/db/$f.sql" >/dev/null; done

echo "── Preflight (chỉ đọc)"
gate() { q "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/student_360_p1_preflight.sql")) z where section = 'GATE'"; }
[ "$(gate)" = "PASS" ] && ok "preflight trên baseline: GATE = PASS" || fail "preflight baseline: $(gate)"
echo "── Migration lần 1 + 2 + rls_setup.sql"
psqld -1 -f "$ROOT/db/student_360_p1_setup.sql" >/dev/null && ok "migration lần 1"
psqld -1 -f "$ROOT/db/student_360_p1_setup.sql" >/dev/null && ok "migration lần 2 (idempotent)"
[ "$(gate)" = "STOP" ] && ok "preflight sau migration: GATE = STOP (tên đã tồn tại, chặn chạy lại nhầm)" || fail "preflight sau migration"
psqld -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "chạy lại rls_setup.sql"
[ "$(q "select count(*) from pg_policies where tablename like 'student\_360\_%'")" = "0" ] && ok "rls_setup KHÔNG áp policy rộng lên bảng 360" || fail "rls_setup mở policy"
[ "$(q "select count(*) from information_schema.role_table_grants where table_name like 'student\_360\_%' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "anon/authenticated không có quyền bảng trực tiếp" || fail "còn quyền bảng"
[ "$(q "select count(*) from information_schema.routine_privileges where routine_name like 'student\_360\_%' and grantee in ('anon','PUBLIC')")" = "0" ] \
  && ok "anon/PUBLIC không EXECUTE hàm student_360_*" || fail "anon còn EXECUTE"

echo "── Test SQL (quyền/RPC theo từng identity)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d s360 -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/student_360_p1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── P2: preflight + migration ×2 + test set_visibility + rollback"
gate2() { q "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/student_360_p2_preflight.sql")) z where section = 'GATE'"; }
[ "$(gate2)" = "PASS" ] && ok "preflight P2: GATE = PASS" || fail "preflight P2: $(gate2)"
psqld -1 -f "$ROOT/db/student_360_p2_setup.sql" >/dev/null && ok "migration P2 lần 1"
psqld -1 -f "$ROOT/db/student_360_p2_setup.sql" >/dev/null && ok "migration P2 lần 2 (idempotent)"
[ "$(gate2)" = "STOP" ] && ok "preflight P2 sau migration: STOP (chặn chạy lại nhầm)" || fail "preflight P2 sau migration"
[ "$(q "select count(*) from information_schema.routine_privileges where routine_name = 'student_360_set_visibility' and grantee in ('anon','PUBLIC')")" = "0" ] \
  && ok "anon/PUBLIC không EXECUTE set_visibility" || fail "set_visibility lộ cho anon"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d s360 -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/student_360_p2_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL P2"
psqld -1 -f "$ROOT/db/student_360_p2_rollback.sql" >/dev/null && psqld -1 -f "$ROOT/db/student_360_p2_rollback.sql" >/dev/null \
  && [ "$(q "select count(*) from pg_proc where proname = 'student_360_set_visibility'")" = "0" ] \
  && [ "$(q "select count(*) from pg_proc where proname = 'student_360_get'")" = "1" ] \
  && ok "rollback P2 ×2 sạch, P1 nguyên vẹn" || fail "rollback P2"

echo "── Rollback ×2 + cài lại"
psqld -1 -f "$ROOT/db/student_360_p1_rollback.sql" >/dev/null && ok "rollback lần 1"
psqld -1 -f "$ROOT/db/student_360_p1_rollback.sql" >/dev/null && ok "rollback lần 2 (idempotent)"
[ "$(q "select count(*) from pg_proc where proname like 'student\_360\_%'")" = "0" ] && [ "$(q "select to_regclass('public.student_360_facts') is null")" = "t" ] \
  && ok "rollback sạch hàm + bảng" || fail "rollback còn sót"
[ "$(q "select count(*) from public.edu_students")" = "3" ] && ok "bảng Class (edu_students) nguyên vẹn sau rollback" || fail "edu_students đổi"
psqld -1 -f "$ROOT/db/student_360_p1_setup.sql" >/dev/null && ok "cài lại sau rollback"
echo "ALL PASS"
