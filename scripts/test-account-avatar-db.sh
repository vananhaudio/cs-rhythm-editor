#!/usr/bin/env bash
# Test Account Avatar V1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).
#   bash scripts/test-account-avatar-db.sh
# Phủ: md5 class_public_identity bản repo = production · preflight GATE (trước/sau) · migration ×2 (một transaction
# như prod-db) · chạy lại rls_setup.sql · test SQL theo identity · postflight GATE · rollback ×2 (md5 về bản cũ) + cài lại
# · cổng drift (class_public_identity sửa tay / có policy ghi app_users).
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaavatar.XXXXXX)"
PORT="${PORT:-$((56100 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }   # như scripts/prod-db.py: cả file trong MỘT transaction
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

OLD_MD5=9bda0938889c533040fb52f3301f3152
NEW_MD5=c1129bf0314c9ee6954a177059368562
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
baseline() {
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
}
PRE="$(cat "$ROOT/db/account_avatar_v1_preflight.sql")"
POST="$(cat "$ROOT/db/account_avatar_v1_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }
md5id() { q "$1" "select md5(prosrc) from pg_proc where proname = 'class_public_identity'"; }

echo "── Hằng md5 bản mới: preflight = postflight = script"
grep -q "'$NEW_MD5'" "$ROOT/db/account_avatar_v1_preflight.sql" && grep -q "'$NEW_MD5'" "$ROOT/db/account_avatar_v1_postflight.sql" \
  && ok "md5 mới giống nhau ở preflight/postflight" || fail "hằng md5 lệch"

echo "── Baseline (giả lập production)"
baseline tva_av
[ "$(md5id tva_av)" = "$OLD_MD5" ] && ok "md5 class_public_identity bản repo = production ($OLD_MD5)" || fail "md5 baseline: $(md5id tva_av)"
[ "$(gate tva_av)" = "PASS" ] && ok "preflight baseline: GATE = PASS" || { psqld tva_av -c "${PRE%;}"; fail "preflight baseline"; }

echo "── Migration ×2 + rls_setup.sql"
mig tva_av "$ROOT/db/account_avatar_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_av "$ROOT/db/account_avatar_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(md5id tva_av)" = "$NEW_MD5" ] && ok "md5 class_public_identity mới = $NEW_MD5" || fail "md5 mới: $(md5id tva_av)"
psqld tva_av -f "$ROOT/db/rls_setup.sql" >/dev/null || fail "rls_setup"; ok "chạy lại rls_setup.sql"
[ "$(gate tva_av)" = "PASS" ] && ok "preflight sau migration vẫn PASS" || fail "preflight sau migration"
[ "$(postgate tva_av)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld tva_av -c "${POST%;}"; fail "postflight"; }

echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_av -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/account_avatar_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Rollback ×2 + cài lại"
mig tva_av "$ROOT/db/account_avatar_v1_rollback.sql" >/dev/null || fail "rollback 1"; ok "rollback lần 1"
mig tva_av "$ROOT/db/account_avatar_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback lần 2 (idempotent)"
[ "$(md5id tva_av)" = "$OLD_MD5" ] && ok "rollback: md5 về đúng bản production" || fail "rollback md5: $(md5id tva_av)"
[ "$(q tva_av "select count(*) from information_schema.columns where table_name = 'app_users' and column_name = 'avatar_url'")" = "0" ] \
  && [ "$(q tva_av "select count(*) from pg_proc where proname = 'class_set_my_avatar'")" = "0" ] \
  && ok "rollback: hết cột + hết RPC" || fail "rollback còn sót"
[ "$(gate tva_av)" = "PASS" ] && ok "preflight sau rollback: PASS" || fail "preflight sau rollback"
mig tva_av "$ROOT/db/account_avatar_v1_setup.sql" >/dev/null || fail "cài lại"; ok "cài lại sau rollback"
[ "$(postgate tva_av)" = "PASS" ] && ok "postflight sau cài lại: PASS" || fail "postflight cài lại"

echo "── Cổng drift"
baseline tva_drift
psqld tva_drift -c "create or replace function public.class_public_identity(p_user_id uuid)
  returns table(name text, avatar_url text, role text, ht_member boolean)
  language sql security definer set search_path = '' stable as \$\$ select 'x'::text, null::text, 'student'::text, false \$\$" >/dev/null
[ "$(gate tva_drift)" = "FAIL" ] && ok "class_public_identity bị sửa tay → GATE FAIL" || fail "drift identity không bị bắt"
baseline tva_drift2
psqld tva_drift2 -c "create policy bad_write on public.app_users for update to authenticated using (true)" >/dev/null
[ "$(gate tva_drift2)" = "FAIL" ] && ok "có policy ghi app_users → GATE FAIL" || fail "drift policy không bị bắt"

echo "ALL PASS"
