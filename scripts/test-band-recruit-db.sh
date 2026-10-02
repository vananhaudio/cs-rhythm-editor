#!/usr/bin/env bash
# Test Band — Tuyển thành viên V1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).
#   bash scripts/test-band-recruit-db.sh
# Phủ: preflight GATE (trước/sau) · migration ×2 (idempotent, chạy như prod-db: một transaction) · seed ×2
# · chạy lại rls_setup.sql (self_managed) · quyền bảng/EXECUTE · test SQL theo identity · postflight GATE
# · rollback chặn khi có đơn · rollback ×2 + cài lại · cổng drift (is_teacher lệch / bảng lạ trùng tên).
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaband.XXXXXX)"
PORT="${PORT:-$((55900 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
# Như scripts/prod-db.py migrate: cả file trong MỘT transaction
mig() { psqld "$1" -1 -f "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
baseline() {
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup; do psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null; done
}
PRE="$(cat "$ROOT/db/band_recruit_v1_preflight.sql")"
POST="$(cat "$ROOT/db/band_recruit_v1_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }

echo "── Baseline (fixture + community_setup như production)"
baseline tva_band
[ "$(q tva_band "select md5(prosrc) from pg_proc where proname = 'is_teacher'")" = "19b164504b4ce59b9bbdb4b0b64e48ad" ] \
  && ok "md5 is_teacher bản repo = production" || fail "md5 is_teacher lệch"
[ "$(gate tva_band)" = "PASS" ] && ok "preflight trên baseline: GATE = PASS" || fail "preflight baseline"

echo "── Migration ×2 + seed ×2 + chạy lại rls_setup.sql"
mig tva_band "$ROOT/db/band_recruit_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_band "$ROOT/db/band_recruit_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(gate tva_band)" = "PASS" ] && ok "preflight sau migration vẫn PASS (chạy lại được)" || fail "preflight sau migration"
mig tva_band "$ROOT/db/band_la_mua_thu_seed.sql" >/dev/null || fail "seed 1"; ok "seed Lá Mùa Thu lần 1"
mig tva_band "$ROOT/db/band_la_mua_thu_seed.sql" >/dev/null || fail "seed 2"; ok "seed lần 2 (idempotent)"
[ "$(q tva_band "select count(*) || '/' || (select count(*) from band_rule_versions) || '/' || (select count(*) from band_recruitments) from bands")" = "1/1/1" ] \
  && ok "seed ×2 không tạo trùng (1 band / 1 rule / 1 đợt)" || fail "seed tạo trùng"
psqld tva_band -f "$ROOT/db/rls_setup.sql" >/dev/null || fail "rls_setup"; ok "chạy lại rls_setup.sql"
[ "$(postgate tva_band)" = "PASS" ] && ok "postflight: GATE = PASS (RLS, 0 policy, 0 quyền bảng, anon chỉ 2 RPC)" \
  || { psqld tva_band -c "${POST%;}"; fail "postflight"; }

echo "── Test SQL (quyền / validate / versioning / Band thứ 2)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_band -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/band_recruit_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/t.log" | grep -v '^$' || true
grep -q "ALL PASS" "$TMP/t.log" || fail "test SQL"
echo "  ($(grep -c '^PASS' "$TMP/t.log") assertion PASS)"

echo "── Rollback"
if mig tva_band "$ROOT/db/band_recruit_v1_rollback.sql" >/dev/null 2>&1; then fail "rollback lẽ ra phải DỪNG khi có đơn"; fi
[ "$(q tva_band "select count(*) from band_applications")" -gt 0 ] && ok "rollback DỪNG khi có đơn thật — dữ liệu còn nguyên" || fail "mất đơn"
q tva_band "delete from band_applications" >/dev/null
mig tva_band "$ROOT/db/band_recruit_v1_rollback.sql" >/dev/null || fail "rollback lần 1"; ok "rollback lần 1 (không còn đơn)"
mig tva_band "$ROOT/db/band_recruit_v1_rollback.sql" >/dev/null || fail "rollback lần 2"; ok "rollback lần 2 (idempotent)"
[ "$(q tva_band "select count(*) from pg_proc where proname like 'band\_%'")/$(q tva_band "select count(*) from pg_class where relname = 'bands' or relname like 'band\_%'")" = "0/0" ] \
  && ok "rollback gỡ sạch hàm + bảng" || fail "rollback còn sót"
[ "$(q tva_band "select md5(prosrc) from pg_proc where proname = 'is_teacher'")" = "19b164504b4ce59b9bbdb4b0b64e48ad" ] && ok "is_teacher không bị đụng" || fail "is_teacher đổi"
mig tva_band "$ROOT/db/band_recruit_v1_setup.sql" >/dev/null && mig tva_band "$ROOT/db/band_la_mua_thu_seed.sql" >/dev/null \
  && [ "$(postgate tva_band)" = "PASS" ] && ok "cài lại sau rollback: postflight PASS" || fail "cài lại"

echo "── Cổng drift"
baseline tva_drift1
q tva_drift1 "create or replace function public.is_teacher() returns boolean language sql security definer set search_path = '' stable as \$\$ select true \$\$" >/dev/null
[ "$(gate tva_drift1)" = "FAIL" ] && ok "preflight: is_teacher bị sửa tay → GATE FAIL" || fail "preflight không bắt is_teacher lệch"
if mig tva_drift1 "$ROOT/db/band_recruit_v1_setup.sql" >/dev/null 2>&1; then fail "migration lẽ ra phải dừng"; fi
[ "$(q tva_drift1 "select count(*) from pg_class where relname = 'bands'")" = "0" ] && ok "migration DỪNG, không tạo nửa chừng" || fail "nửa migration"
baseline tva_drift2
q tva_drift2 "create table public.bands (id int)" >/dev/null
[ "$(gate tva_drift2)" = "FAIL" ] && ok "preflight: đã có bảng bands lạ → GATE FAIL" || fail "preflight không bắt bảng lạ"
if mig tva_drift2 "$ROOT/db/band_recruit_v1_setup.sql" >/dev/null 2>&1; then fail "migration lẽ ra phải dừng (bảng lạ)"; fi
ok "migration DỪNG khi tên bảng bị chiếm"
echo "ALL DB TESTS PASS"
