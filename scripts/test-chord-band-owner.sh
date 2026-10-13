#!/usr/bin/env bash
# Test Thư viện hợp âm V1.7 (Band sở hữu bài: band_id, RPC bọc, trigger, quyền) trên cluster PostgreSQL TẠM.
# KHÔNG kết nối production. Cần postgresql@17 (Homebrew).   bash scripts/test-chord-editor-publish.sh
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaband.XXXXXX)"; PORT="${PORT:-$((55900 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
DB=chord_editor
psqld() { PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"; }
FAIL=0
ok() { echo "PASS $*"; }; bad() { echo "FAIL $*"; FAIL=1; }
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$DB"
for f in db/tests/local/social_fixture.sql db/package_student_identity_guard.sql db/community_setup.sql db/tests/local/chord_library_fixture.sql db/nhipphach_capabilities_setup.sql; do
  psqld -f "$ROOT/$f" >/dev/null
done
psqld -1 -f "$ROOT/db/chord_library_v1_setup.sql" >/dev/null
psqld -f "$ROOT/db/tests/chord_band_owner/00_pre.sql" >/dev/null
psqld -1 -f "$ROOT/db/chord_library_v1_5_editor_publish_setup.sql" >/dev/null
psqld -1 -f "$ROOT/db/chord_library_v1_6_editor_anchors_setup.sql" >/dev/null
report() { psqld -tA -F ' | ' -c "select case when ok then 'PASS' else 'FAIL' end || ' ' || msg from t.res where n > $1 order by n"; psqld -tA -c "select coalesce(max(n),0) from t.res"; }
FPALL() { psqld -tA -c "select md5(string_agg(p.oid::regprocedure::text || md5(p.prosrc), '|' order by p.oid::regprocedure::text)) from pg_proc p where p.proname like 'chord_sheet_%' and p.proname not in ('chord_sheet_contribute_publish_band')"; }
ORIG_FN=$(FPALL)

echo "── Migration V1.7 (một transaction) ×2"
psqld -1 -f "$ROOT/db/chord_library_v1_7_band_owner_setup.sql" >/dev/null && ok "migrate lần 1" || bad "migrate lần 1"
psqld -1 -f "$ROOT/db/chord_library_v1_7_band_owner_setup.sql" >/dev/null && ok "migrate lần 2 (idempotent)" || bad "migrate lần 2"
[ "$(psqld -tA -c "select count(*) from pg_proc where proname in ('chord_sheet_approve','chord_sheet_reject','chord_sheet_accept_anchors','chordlib_can','my_chordlib_caps')" )" = 5 ] && ok "approve/reject/accept_anchors/chordlib_can còn nguyên" || bad "thiếu hàm"
[ "$(psqld -tA -c "select has_function_privilege('anon','public.chord_sheet_contribute_publish_band(text,text,text,jsonb,integer,jsonb,uuid,uuid,uuid,jsonb,uuid)','execute')")" = f ] && ok "anon không gọi được hàm mới" || bad "anon gọi được"
[ "$(psqld -tA -c "select has_function_privilege('authenticated','public.chord_sheet_contribute_publish_band(text,text,text,jsonb,integer,jsonb,uuid,uuid,uuid,jsonb,uuid)','execute')")" = t ] && ok "authenticated gọi được hàm mới" || bad "authenticated không gọi được"
[ "$(psqld -tA -c "select count(*) from pg_policies where tablename like 'chord_sheet%'")" = 0 ] && ok "bảng chord_* vẫn 0 policy (chỉ qua RPC)" || bad "có policy"
psqld -f "$ROOT/db/tests/chord_band_owner/10_post.sql" >/dev/null
N=$(psqld -tA -c "select max(n) from t.res"); psqld -tA -c "select case when ok then 'PASS' else 'FAIL' end || ' ' || msg from t.res order by n" | tee "$TMP/res.txt"
grep -q '^FAIL' "$TMP/res.txt" && FAIL=1
NPASS=$(grep -c '^PASS' "$TMP/res.txt"); echo "→ $NPASS PASS trong bộ V1.7"

echo "── Rollback"
FP_BEFORE=$(psqld -tA -c "select md5(string_agg(v::text, '|' order by v.id)) from public.chord_sheet_versions v")
psqld -1 -f "$ROOT/db/chord_library_v1_7_band_owner_rollback.sql" >/dev/null && ok "rollback COMMIT" || bad "rollback"
[ "$(psqld -tA -c "select md5(string_agg(v::text, '|' order by v.id)) from public.chord_sheet_versions v")" = "$FP_BEFORE" ] && ok "rollback KHÔNG đổi phiên bản nào" || bad "rollback đổi dữ liệu"
[ "$(FPALL)" = "$ORIG_FN" ] && ok "rollback → search/get/update_info ĐÚNG bản gốc (md5 thân hàm)" || bad "hàm gốc không khớp sau rollback"
psqld -1 -f "$ROOT/db/chord_library_v1_7_band_owner_rollback.sql" >/dev/null && ok "rollback idempotent" || bad "rollback lần 2"
psqld -f "$ROOT/db/tests/chord_band_owner/20_rollback_check.sql" >/dev/null
psqld -tA -c "select case when ok then 'PASS' else 'FAIL' end || ' ' || msg from t.res where n > $N order by n" | tee "$TMP/res2.txt"
grep -q '^FAIL' "$TMP/res2.txt" && FAIL=1
psqld -1 -f "$ROOT/db/chord_library_v1_7_band_owner_setup.sql" >/dev/null && ok "migrate lại sau rollback" || bad "migrate lại"
echo "== $( [ $FAIL = 0 ] && echo ALL PASS || echo HAS FAILURES )"
exit $FAIL
