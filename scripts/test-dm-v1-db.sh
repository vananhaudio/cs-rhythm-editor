#!/usr/bin/env bash
# Test Class Chat V1a (db/dm_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).
#   bash scripts/test-dm-v1-db.sh
# Phủ: preflight GATE (baseline) · migration ×2 (một transaction như prod-db) · khoá giữ trong migration (chỉ bảng dm_* + auth.users)
# · test SQL theo identity (quyền, RLS đóng, cô lập, huỷ kết bạn, phân trang, tốc độ) · postflight GATE · rollback ×2 (gỡ sạch,
# không đụng friendships) + cài lại · cổng va chạm tên · cổng drift hàm nền.
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvadm.XXXXXX)"
PORT="${PORT:-$((56500 + RANDOM % 90))}"
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

grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
baseline() {
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup account_avatar_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
}
PRE="$(cat "$ROOT/db/dm_v1_preflight.sql")"
POST="$(cat "$ROOT/db/dm_v1_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }
fp() { q "$1" "select count(*)::text || ':' || md5(coalesce(string_agg(f.id::text || f.requester_id::text || f.addressee_id::text || f.status, ',' order by f.id), '')) from public.friendships f"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_v1_rollback.sql" \
  && fail "file migration có begin/commit (prod-db sở hữu transaction)" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/dm_v1_setup.sql" | grep -qi 'create policy' && fail "setup có CREATE POLICY (dính khoá policy_grants)" || ok "setup không có CREATE POLICY"

echo "── Baseline (giả lập production)"
baseline tva_dm
q tva_dm "insert into public.friendships (requester_id, addressee_id, status, responded_at) values ('cccccccc-0000-4000-8000-00000000000c','aaaaaaaa-0000-4000-8000-00000000000a','pending',null)" >/dev/null
FP0="$(fp tva_dm)"
[ "$(gate tva_dm)" = "PASS" ] && ok "preflight baseline: GATE = PASS" || { psqld tva_dm -c "${PRE%;}"; fail "preflight baseline"; }

echo "── Migration ×2"
mig tva_dm "$ROOT/db/dm_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_dm "$ROOT/db/dm_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(fp tva_dm)" = "$FP0" ] && ok "friendships không đổi" || fail "friendships đổi"
[ "$(gate tva_dm)" = "PASS" ] && ok "preflight sau migration vẫn PASS (nhận ra đối tượng của chính Chat V1a)" || fail "preflight sau migration"
[ "$(postgate tva_dm)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld tva_dm -c "${POST%;}"; fail "postflight"; }

echo "── Khoá trong migration (chỉ bảng mới dm_* và auth.users cho FK)"
baseline tva_lock
LOCKS="$(psqld tva_lock -tA <<SQL
begin;
\i $ROOT/db/dm_v1_setup.sql
select coalesce(string_agg(distinct n.nspname || '.' || c.relname || ':' || l.mode, ', ' order by n.nspname || '.' || c.relname || ':' || l.mode), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname not like 'dm\_%' and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock', 'RowExclusiveLock');
rollback;
SQL
)"
echo "   khoá mạnh trên bảng NGOÀI dm_*: ${LOCKS:-(không)}"
case "$LOCKS" in
  ""|"auth.users:ShareRowExclusiveLock") ok "migration chỉ khoá bảng dm_* (+ auth.users ShareRowExclusive ngắn cho khoá ngoại)";;
  *) fail "khoá không mong đợi: $LOCKS";;
esac

echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_dm -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/dm_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/test.out"
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"
PASSES="$(grep -c '^PASS' "$TMP/test.out" || true)"
grep -q '^FAIL' "$TMP/test.out" && fail "có FAIL trong test" || ok "test SQL: $PASSES kiểm tra PASS, 0 FAIL"

echo "── Rollback ×2 + cài lại"
baseline tva_rb
mig tva_rb "$ROOT/db/dm_v1_setup.sql" >/dev/null || fail "setup rb"
FPR="$(fp tva_rb)"
mig tva_rb "$ROOT/db/dm_v1_rollback.sql" >/dev/null || fail "rollback 1"; ok "rollback lần 1"
mig tva_rb "$ROOT/db/dm_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback lần 2 (idempotent)"
[ "$(q tva_rb "select count(*) from pg_class where relname like 'dm\_%'")" = "0" ] && [ "$(q tva_rb "select count(*) from pg_proc where proname like 'dm\_%'")" = "0" ] \
  && ok "rollback: hết bảng/hàm dm_*" || fail "rollback còn sót"
[ "$(fp tva_rb)" = "$FPR" ] && ok "rollback: friendships không đổi" || fail "rollback đổi friendships"
[ "$(gate tva_rb)" = "PASS" ] && ok "preflight sau rollback: PASS" || fail "preflight sau rollback"
mig tva_rb "$ROOT/db/dm_v1_setup.sql" >/dev/null || fail "cài lại"; ok "cài lại sau rollback"
[ "$(postgate tva_rb)" = "PASS" ] && ok "postflight sau cài lại: PASS" || fail "postflight cài lại"

echo "── Cổng va chạm tên + drift"
baseline tva_col
q tva_col "create table public.dm_messages (id int)" >/dev/null
[ "$(gate tva_col)" = "FAIL" ] && ok "bảng dm_messages lạ → preflight GATE FAIL" || fail "va chạm bảng không bị bắt"
mig tva_col "$ROOT/db/dm_v1_setup.sql" >/dev/null 2>"$TMP/c.err" && fail "migration chạy được khi có dm_messages lạ"
grep -q "DỪNG — đã có bảng dm_messages không thuộc Chat V1a" "$TMP/c.err" && ok "migration tự DỪNG khi va chạm tên" || fail "cổng va chạm: $(cat "$TMP/c.err")"
mig tva_col "$ROOT/db/dm_v1_rollback.sql" >/dev/null 2>"$TMP/c2.err" && fail "rollback xoá bảng không phải của mình"
grep -q "không thuộc Chat V1a, không rollback" "$TMP/c2.err" && ok "rollback từ chối xoá bảng dm_messages lạ" || fail "cổng rollback: $(cat "$TMP/c2.err")"
baseline tva_drift
q tva_drift "create or replace function public.is_friend_of(p_other uuid) returns boolean language sql security definer set search_path = '' as \$\$ select true \$\$" >/dev/null
[ "$(gate tva_drift)" = "FAIL" ] && ok "is_friend_of bị sửa tay → preflight GATE FAIL" || fail "drift is_friend_of không bị bắt"
echo "ALL DM V1 DB TESTS PASSED"
