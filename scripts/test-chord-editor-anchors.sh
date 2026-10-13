#!/usr/bin/env bash
# Test Thư viện hợp âm V1.6 (Biên tập lưu vạch nhịp bài của mình) trên cluster PostgreSQL TẠM.
# KHÔNG kết nối production. Cần postgresql@17 (Homebrew).   bash scripts/test-chord-editor-anchors.sh
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaanch.XXXXXX)"; PORT="${PORT:-$((55900 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
DB=chord_anchors
psqld() { PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"; }
FAIL=0
ok() { echo "PASS $*"; }; bad() { echo "FAIL $*"; FAIL=1; }
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$DB"
for f in db/tests/local/social_fixture.sql db/package_student_identity_guard.sql db/community_setup.sql db/tests/local/chord_library_fixture.sql db/nhipphach_capabilities_setup.sql; do
  psqld -f "$ROOT/$f" >/dev/null
done
psqld -1 -f "$ROOT/db/chord_library_v1_setup.sql" >/dev/null
psqld -f "$ROOT/db/tests/chord_editor_publish/00_pre.sql" >/dev/null
psqld -1 -f "$ROOT/db/chord_library_v1_5_editor_publish_setup.sql" >/dev/null

FPC() { psqld -tA -c "select md5(string_agg(p.oid::regprocedure::text || md5(p.prosrc), '|' order by p.oid::regprocedure::text)) from pg_proc p where p.proname in ('chord_sheet_contribute','chord_sheet_accept_anchors','chord_sheet_contribute_publish','chord_sheet_search','chord_sheet_get')"; }
ORIG_FN=$(FPC)
echo "── Migration V1.6 (một transaction) ×2"
psqld -1 -f "$ROOT/db/chord_library_v1_6_editor_anchors_setup.sql" >/dev/null && ok "migrate lần 1" || bad "migrate lần 1"
psqld -1 -f "$ROOT/db/chord_library_v1_6_editor_anchors_setup.sql" >/dev/null && ok "migrate lần 2 (idempotent)" || bad "migrate lần 2"
psqld -f "$ROOT/db/tests/chord_editor_anchors/10_post.sql" >/dev/null
N=$(psqld -tA -c "select max(n) from t.res"); psqld -tA -c "select case when ok then 'PASS' else 'FAIL' end || ' ' || msg from t.res order by n" | tee "$TMP/res.txt"
grep -q '^FAIL' "$TMP/res.txt" && FAIL=1
echo "→ $(grep -c '^PASS' "$TMP/res.txt") PASS"
echo "── Rollback"
FP_BEFORE=$(psqld -tA -c "select md5(string_agg(v::text, '|' order by v.id)) from public.chord_sheet_versions v")
psqld -1 -f "$ROOT/db/chord_library_v1_6_editor_anchors_rollback.sql" >/dev/null && ok "rollback COMMIT" || bad "rollback"
[ "$(psqld -tA -c "select md5(string_agg(v::text, '|' order by v.id)) from public.chord_sheet_versions v")" = "$FP_BEFORE" ] && ok "rollback KHÔNG đổi phiên bản nào" || bad "rollback đổi dữ liệu"
[ "$(FPC)" = "$ORIG_FN" ] && ok "rollback → hàm ĐÚNG bản V1.5 (md5 thân hàm)" || bad "hàm không khớp bản trước sau rollback"
psqld -1 -f "$ROOT/db/chord_library_v1_6_editor_anchors_rollback.sql" >/dev/null && ok "rollback idempotent" || bad "rollback lần 2"
psqld -f "$ROOT/db/tests/chord_editor_anchors/20_rollback_check.sql" >/dev/null
psqld -tA -c "select case when ok then 'PASS' else 'FAIL' end || ' ' || msg from t.res where n > $N order by n" | tee "$TMP/res2.txt"
grep -q '^FAIL' "$TMP/res2.txt" && FAIL=1
psqld -1 -f "$ROOT/db/chord_library_v1_6_editor_anchors_setup.sql" >/dev/null && ok "migrate lại sau rollback" || bad "migrate lại"
echo "== $( [ $FAIL = 0 ] && echo ALL PASS || echo HAS FAILURES )"
exit $FAIL
