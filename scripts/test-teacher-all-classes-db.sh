#!/usr/bin/env bash
# Test Teacher All Classes V1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá). KHÔNG kết nối production.
#   bash scripts/test-teacher-all-classes-db.sh
# Phủ: preflight GATE · migration ×2 (một transaction như prod-db) · hàm cũ (my/discover/detail/card) KHÔNG đổi md5 ·
# rls_setup chạy lại · test SQL theo identity (teacher, admin không hồ sơ HS, học sinh, khách) · postflight GATE ·
# rollback ×2 + cài lại · cổng drift is_teacher.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvatac.XXXXXX)"
PORT="${PORT:-$((56400 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
base() {   # cùng baseline với scripts/test-class-membership-canonical-db.sh (dữ liệu Lớp của tôi V1)
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0; else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null; done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null; done
  psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture_data.sql" >/dev/null
  psqld "$db" -c "begin;" -f "$ROOT/db/class_checkpoints_v1_setup.sql" -c "commit;" >/dev/null
  psqld "$db" -c "begin;" -f "$ROOT/db/social_learning_identity_v1_setup.sql" -c "commit;" >/dev/null
}
PRE="$(cat "$ROOT/db/teacher_all_classes_v1_preflight.sql")"; POST="$(cat "$ROOT/db/teacher_all_classes_v1_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }
oldfns() { q "$1" "select string_agg(proname || '=' || md5(prosrc), ',' order by proname) from pg_proc where proname in ('is_teacher','social_class_card','social_my_classes','social_discover_classes','social_class_detail','social_class_members','class_learning_state','class_learning_entry')"; }
datafp() { q "$1" "select item from (${PRE%;}) z where item like 'dữ liệu lớp:%'"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT"/db/teacher_all_classes_v1_{setup,rollback}.sql && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -qE "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}" "$ROOT"/db/teacher_all_classes_v1_*.sql && fail "migration chứa uuid" || ok "migration không chứa id"
[ "$(grep -c 'create or replace function' "$ROOT/db/teacher_all_classes_v1_setup.sql")" = "1" ] && grep -q 'create or replace function public.social_all_classes()' "$ROOT/db/teacher_all_classes_v1_setup.sql" \
  && ok "setup chỉ tạo đúng MỘT hàm (social_all_classes) — không sửa hàm cũ" || fail "setup đụng hàm khác"

echo "── Baseline + migration"
base tva
[ "$(gate tva)" = "PASS" ] && ok "preflight baseline: GATE = PASS" || { psqld tva -c "${PRE%;}"; fail "preflight"; }
OLD="$(oldfns tva)"; FP0="$(datafp tva)"
# "Lớp của tôi" + "Khám phá" của từng học sinh TRƯỚC migration (so lại sau)
lists() { local out=""; for u in aaaaaaaa-0000-4000-8000-00000000000a bbbbbbbb-0000-4000-8000-00000000000b cccccccc-0000-4000-8000-00000000000c; do
  out="$out|$(q "$1" "begin; select set_config('request.jwt.claims', '{\"sub\":\"$u\",\"role\":\"authenticated\"}', true); set local role authenticated;
    select (select coalesce(string_agg(c->>'id', ',' order by c->>'id'), '') from public.social_my_classes() c) || '/' ||
           (select coalesce(string_agg(c->>'id', ',' order by c->>'id'), '') from public.social_discover_classes(100) c); commit;" | tail -1)"; done; echo "$out"; }
L0="$(lists tva)"
mig tva "$ROOT/db/teacher_all_classes_v1_setup.sql" >/dev/null && ok "migration lần 1"
mig tva "$ROOT/db/teacher_all_classes_v1_setup.sql" >/dev/null && ok "migration lần 2 (idempotent)"
[ "$(oldfns tva)" = "$OLD" ] && ok "8 hàm lớp/giáo trình cũ KHÔNG đổi md5 (đường học sinh y nguyên)" || fail "hàm cũ đổi"
[ "$(lists tva)" = "$L0" ] && ok "Lớp của tôi + Khám phá của học sinh A/B/C y hệt trước migration" || fail "danh sách học sinh đổi"
[ "$(datafp tva)" = "$FP0" ] && ok "dữ liệu lớp không đổi: ${FP0#dữ liệu lớp: }" || fail "dữ liệu đổi"
if [ "${1:-}" = "--new-md5" ]; then q tva "select md5(prosrc) from pg_proc where proname = 'social_all_classes'"; exit 0; fi
psqld tva -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "chạy lại rls_setup.sql"
[ "$(postgate tva)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld tva -c "${POST%;}"; fail "postflight"; }

echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/teacher_all_classes_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Rollback ×2 + cài lại"
mig tva "$ROOT/db/teacher_all_classes_v1_rollback.sql" >/dev/null && mig tva "$ROOT/db/teacher_all_classes_v1_rollback.sql" >/dev/null && ok "rollback ×2"
[ "$(q tva "select count(*) from pg_proc where proname = 'social_all_classes'")" = "0" ] && [ "$(oldfns tva)" = "$OLD" ] && ok "rollback: hết hàm mới, hàm cũ y nguyên" || fail "rollback"
[ "$(gate tva)" = "PASS" ] && mig tva "$ROOT/db/teacher_all_classes_v1_setup.sql" >/dev/null && [ "$(postgate tva)" = "PASS" ] && ok "cài lại sau rollback: postflight PASS" || fail "cài lại"

echo "── Cổng drift"
base tva_drift
q tva_drift "create or replace function public.is_teacher() returns boolean language sql security definer set search_path = '' stable as \$\$ select true \$\$" >/dev/null
[ "$(gate tva_drift)" = "FAIL" ] && ok "is_teacher bị sửa (vd. mở cho mọi người) → GATE FAIL" || fail "drift is_teacher không bị bắt"
echo "ALL PASS"
