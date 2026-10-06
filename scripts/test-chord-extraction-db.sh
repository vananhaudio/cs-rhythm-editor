#!/usr/bin/env bash
# Test Thư viện hợp âm V1.3 (extraction) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG production.
#   bash scripts/test-chord-extraction-db.sh        (cần postgresql@17 Homebrew)
# Phủ: setup V1 + migration V1.3 ×2 (idempotent, một transaction) · không object sẵn có nào bị đổi · rls_setup.sql không áp policy rộng ·
# test SQL theo identity (quyền, idempotency, vòng đời, lease, bất biến, trần, xoá tài khoản) · dry-run (rollback transaction) ·
# rollback chặn khi có dữ liệu · rollback ×2 + cài lại.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaext.XXXXXX)"
PORT="${PORT:-$((55900 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
SETUP="$ROOT/db/chord_library_v1_3_extractions_setup.sql"
ROLLBACK="$ROOT/db/chord_library_v1_3_extractions_rollback.sql"

echo "── Rào chắn tĩnh"
for f in "$SETUP" "$ROLLBACK"; do
  [ "$(grep -v '^[[:space:]]*--' "$f" | grep -ciE 'musicxml|storage\.objects|chord_sheet_versions[[:space:]]+(set|add|alter)' || true)" = "0" ] || fail "$(basename "$f") đụng MusicXML/Storage/ALTER versions"
  [ "$(grep -v '^[[:space:]]*--' "$f" | grep -ciE '^[[:space:]]*(begin|commit)[[:space:]]*;' || true)" = "0" ] || fail "$(basename "$f") tự begin/commit"
done
ok "setup + rollback: không nhắc MusicXML/Storage, không ALTER chord_sheet_versions, không tự begin/commit"

echo "── Baseline (fixture + community + capabilities + chord_library_v1 như production)"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres tva_ext
psqld tva_ext -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
for f in package_student_identity_guard community_setup; do psqld tva_ext -f "$ROOT/db/$f.sql" >/dev/null; done
psqld tva_ext -f "$ROOT/db/tests/local/chord_library_fixture.sql" >/dev/null
psqld tva_ext -f "$ROOT/db/nhipphach_capabilities_setup.sql" >/dev/null
mig tva_ext "$ROOT/db/chord_library_v1_setup.sql" >/dev/null || fail "setup V1"
others() { q "$1" "select md5(
    coalesce((select string_agg(p.proname || md5(p.prosrc) || coalesce(p.proacl::text, ''), ',' order by p.proname, p.oid::regprocedure::text)
       from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname in ('public', 'storage', 'auth') and p.proname not like 'chord\_extraction%' and p.proname <> 'chord_extractions_guard'), '')
 || coalesce((select string_agg(c.relname || '.' || tg.tgname || md5(pg_get_triggerdef(tg.oid)), ',' order by c.relname, tg.tgname)
       from pg_trigger tg join pg_class c on c.oid = tg.tgrelid where not tg.tgisinternal and c.relname <> 'chord_sheet_extractions'), '')
 || coalesce((select string_agg(schemaname || tablename || policyname || cmd || roles::text || coalesce(qual, '') || coalesce(with_check, ''), ',' order by schemaname, tablename, policyname) from pg_policies), '')
 || coalesce((select string_agg(c.relname || coalesce(c.relacl::text, '') || c.relrowsecurity::text, ',' order by c.relname)
       from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and c.relname <> 'chord_sheet_extractions'), ''))"; }
OTH0="$(others tva_ext)"

echo "── Dry-run (chạy migration trong begin … rollback: không để lại gì)"
{ echo "begin;"; cat "$SETUP"; echo "rollback;"; } > "$TMP/dry.sql"
psqld tva_ext -f "$TMP/dry.sql" >/dev/null || fail "dry-run"
[ "$(q tva_ext "select to_regclass('public.chord_sheet_extractions') is null")" = "t" ] && ok "dry-run chạy sạch và KHÔNG để lại bảng" || fail "dry-run để lại bảng"

echo "── Migration ×2"
mig tva_ext "$SETUP" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_ext "$SETUP" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(others tva_ext)" = "$OTH0" ] && ok "không hàm / trigger / policy / quyền bảng sẵn có nào bị đổi — migration chỉ THÊM" || fail "object sẵn có bị đổi"

echo "── Chạy rls_setup.sql (bảng mới nằm trong self_managed)"
psqld tva_ext -f "$ROOT/db/rls_setup.sql" >/dev/null || fail "rls_setup"
[ "$(q tva_ext "select count(*) from pg_policies where tablename = 'chord_sheet_extractions'")" = "0" ] \
  && ok "sau rls_setup.sql: bảng extraction VẪN 0 policy" || fail "rls_setup áp policy rộng lên bảng extraction"
OTH1="$(others tva_ext)"   # mốc so sánh cho rollback (rls_setup.sql tự nó đã đổi policy các bảng khác)

echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_ext -v ON_ERROR_STOP=1 -f "$ROOT/db/tests/chord_extraction_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/t.log" | grep -v '^$' || true
grep -q 'ALL PASS' "$TMP/t.log" || fail "test SQL không đạt"
! grep -q 'FAIL' "$TMP/t.log" || fail "có FAIL trong test SQL"
ok "test SQL: $(grep -c '^PASS' "$TMP/t.log") kiểm tra đạt"

echo "── END-TO-END: worker THẬT + engine Python THẬT + SQL THẬT (cụm tạm)"
VALPY="${CHORD_VALIDATOR_PYTHON:-$HOME/Documents/VAA-Work-In-Progress/chord-library-pdf-extract/.venv/bin/python}"
[ -x "$VALPY" ] || VALPY=""
CHORD_PSQL="$PGBIN/psql" CHORD_PGHOST="$TMP" CHORD_PGPORT="$PORT" CHORD_PGDATABASE=tva_ext CHORD_VALIDATOR_PYTHON="$VALPY" \
  node --experimental-strip-types --no-warnings --test --test-concurrency=1 "$ROOT/tests/chord-extract-worker/e2e.test.ts" > "$TMP/e2e.log" 2>&1 || { cat "$TMP/e2e.log"; fail "end-to-end worker ↔ engine ↔ DB"; }
grep -E "^# (tests|pass|fail|skipped)" "$TMP/e2e.log" | tr '\n' ' '; echo
ok "end-to-end worker ↔ engine ↔ DB"

echo "── Rollback"
# Sau e2e đã có extraction thật → rollback phải DỪNG, dữ liệu còn nguyên.
NV="$(q tva_ext "select count(*) from public.chord_sheet_versions")"; NE="$(q tva_ext "select count(*) from public.chord_sheet_extractions")"
[ "$NE" -gt 0 ] || fail "e2e không để lại extraction nào"
if mig tva_ext "$ROLLBACK" >/dev/null 2>&1; then fail "rollback lẽ ra phải DỪNG khi có extraction"; fi
[ "$(q tva_ext "select count(*) from public.chord_sheet_extractions")" = "$NE" ] && ok "rollback DỪNG khi có dữ liệu extraction ($NE hàng) — dữ liệu còn nguyên" || fail "mất dữ liệu"
# Dọn có chủ đích (như hướng dẫn trong file rollback: export rồi xoá) rồi gỡ thật.
q tva_ext "alter table public.chord_sheet_extractions disable trigger chord_extractions_guard_trg; delete from public.chord_sheet_extractions; alter table public.chord_sheet_extractions enable trigger chord_extractions_guard_trg" >/dev/null
mig tva_ext "$ROLLBACK" >/dev/null || fail "rollback lần 1"; ok "rollback lần 1 (bảng rỗng)"
mig tva_ext "$ROLLBACK" >/dev/null || fail "rollback lần 2"; ok "rollback lần 2 (idempotent)"
[ "$(q tva_ext "select count(*) from pg_proc where proname like 'chord\_extraction%' or proname = 'chord_extractions_guard'")/$(q tva_ext "select count(*) from pg_class where relname = 'chord_sheet_extractions'")" = "0/0" ] \
  && ok "rollback gỡ sạch hàm + bảng extraction" || fail "rollback còn sót"
[ "$(q tva_ext "select count(*) from public.chord_sheet_versions")" = "$NV" ] && [ "$(others tva_ext)" = "$OTH1" ] \
  && ok "rollback không đụng chord_sheets/versions, không đổi object sẵn có nào" || fail "rollback đụng dữ liệu/object khác"
mig tva_ext "$SETUP" >/dev/null && ok "cài lại sau rollback" || fail "cài lại"
echo "ALL DB GATES PASS"
