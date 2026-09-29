#!/usr/bin/env bash
# Test Learning Thread P1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).
#   bash scripts/test-learning-threads-db.sh
# Phủ: hằng md5 cổng = bản repo (khớp production 29/09) · preflight GATE (thường + dồn một dòng) · migration ×2
# · chạy lại rls_setup.sql · test SQL theo từng identity · rollback ×2 + cài lại · lỗi giữa migration
# · cổng drift (hàm phụ thuộc sửa tay / thiếu cột) · hằng số preflight = migration.
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvalt.XXXXXX)"
PORT="${PORT:-$((55500 + RANDOM % 400))}"

cleanup() {
  "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
baseline() {
  local db=$1 fixture=$2
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  psqld "$db" -f "$fixture" >/dev/null
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
}
PREFLIGHT_SQL="$(cat "$ROOT/db/learning_threads_p1_preflight.sql")"
gate() { q "$1" "select item from (${PREFLIGHT_SQL%;}) z where section = 'GATE'"; }
state() { q "$1" "select (to_regclass('public.learning_threads') is not null)::text || '/' ||
                   (select count(*) from pg_proc where proname like 'lt\_%')"; }

echo "── Hằng số cổng: preflight = migration, và = md5 bản repo của hàm phụ thuộc"
extract() { grep -o "\"class_public_identity\": \[[^]]*\], \"is_class_member\": \[[^]]*\], \"is_teacher\": \[[^]]*\]" "$1"; }
cols() { grep -o '"edu_course_lessons": \[.*"app_users": \["id", "role"\]' "$1"; }
[ -n "$(extract "$ROOT/db/learning_threads_p1_setup.sql")" ] && [ "$(extract "$ROOT/db/learning_threads_p1_setup.sql")" = "$(extract "$ROOT/db/learning_threads_p1_preflight.sql")" ] \
  && [ "$(cols "$ROOT/db/learning_threads_p1_setup.sql")" = "$(cols "$ROOT/db/learning_threads_p1_preflight.sql")" ] \
  && ok "hằng md5 + danh sách cột GIỐNG HỆT giữa preflight và migration" || fail "hằng số lệch preflight ↔ migration"

echo "── Baseline (giả lập production: Social đã chạy + giáo trình + lớp)"
baseline tva_lt "$ROOT/db/tests/local/social_fixture.sql"
ACTUAL="$(q tva_lt "select string_agg(proname || '=' || md5(prosrc), ' ' order by proname) from pg_proc
                    where proname in ('is_teacher', 'is_class_member', 'class_public_identity')")"
[ "$ACTUAL" = "class_public_identity=9bda0938889c533040fb52f3301f3152 is_class_member=459786921eb5bbd4ff07c83bdb4db480 is_teacher=19b164504b4ce59b9bbdb4b0b64e48ad" ] \
  && ok "md5 hàm phụ thuộc trên bản repo = md5 production (preflight 29/09)" || fail "md5 repo khác production: $ACTUAL"
[ "$(gate tva_lt)" = "PASS" ] && ok "preflight trên baseline: GATE = PASS" || fail "preflight baseline: $(gate tva_lt)"
PREFLIGHT_ONELINE="$(tr '\n' ' ' < "$ROOT/db/learning_threads_p1_preflight.sql")"
[ "$(q tva_lt "select item from (${PREFLIGHT_ONELINE%;*}) z where section = 'GATE'")" = "PASS" ] \
  && ok "preflight dồn thành MỘT dòng (mất xuống dòng khi copy) vẫn chạy: GATE = PASS" || fail "preflight một dòng"

echo "── Migration lần 1 + lần 2 (idempotent) + chạy lại rls_setup.sql"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "migration lần 1"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "migration lần 2 (idempotent)"
[ "$(gate tva_lt)" = "PASS" ] && ok "preflight sau migration: GATE = PASS" || fail "preflight sau migration"
psqld tva_lt -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "chạy lại rls_setup.sql"
[ "$(q tva_lt "select count(*) from pg_policies where tablename like 'learning\_%'")" = "0" ] \
  && ok "rls_setup.sql KHÔNG áp policy rộng lên bảng P1 (self_managed)" || fail "rls_setup mở policy lên bảng P1"
[ "$(q tva_lt "select count(*) from information_schema.role_table_grants where table_name like 'learning\_%' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "anon/authenticated không có quyền bảng nào trên bảng P1 (dù default privileges rộng)" || fail "còn quyền bảng"
[ "$(q tva_lt "select count(*) from information_schema.routine_privileges where routine_name like 'lt\_%' and grantee = 'anon'")" = "0" ] \
  && ok "anon không EXECUTE được hàm lt_* nào" || fail "anon còn EXECUTE lt_*"

echo "── Test SQL (quyền/RPC/workflow theo từng identity)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_lt -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/learning_threads_p1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Rollback ×2 (idempotent) → cài lại"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_rollback.sql" >/dev/null && ok "rollback lần 1"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_rollback.sql" >/dev/null && ok "rollback lần 2 (idempotent)"
[ "$(state tva_lt)" = "false/0" ] && ok "rollback gỡ hết bảng + hàm lt_*" || fail "rollback: $(state tva_lt)"
[ "$(q tva_lt "select count(*) from public.class_posts")/$(q tva_lt "select count(*) from public.edu_course_lessons")" = "0/4" ] \
  && ok "rollback không đụng Social/giáo trình" || fail "rollback đụng bảng khác"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "cài lại sau rollback"

echo "── Giao dịch: lỗi GIỮA migration → không còn gì nửa chừng"
baseline t_fail "$TMP/fixture_noroles.sql"
awk '{print} /^-- ── 5\) Hàm nội bộ/ && !done {print "select 1/0; -- LỖI CỐ Ý"; done=1}' "$ROOT/db/learning_threads_p1_setup.sql" > "$TMP/broken.sql"
grep -q "LỖI CỐ Ý" "$TMP/broken.sql" || fail "không chèn được lỗi"
psqld t_fail -f "$TMP/broken.sql" >/dev/null 2>"$TMP/broken.err" && fail "migration lỗi mà không báo"
grep -q "division by zero" "$TMP/broken.err" || fail "lỗi không đúng: $(cat "$TMP/broken.err")"
[ "$(state t_fail)" = "false/0" ] && ok "lỗi sau khi đã tạo 3 bảng → rollback sạch, không bảng/hàm nào còn lại" || fail "nửa migration: $(state t_fail)"
psqld t_fail -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "chạy lại bản đúng sau lỗi: PASS"

echo "── Cổng drift: hàm phụ thuộc bị sửa tay / thiếu cột → preflight STOP + migration tự từ chối"
baseline t_drift "$TMP/fixture_noroles.sql"
psqld t_drift -c "create or replace function public.is_teacher() returns boolean language sql security definer set search_path = '' stable as \$\$ select true \$\$;" >/dev/null
[ "$(gate t_drift)" = "STOP - DO NOT MIGRATE" ] && ok "preflight: is_teacher sửa tay → GATE = STOP" || fail "preflight drift: $(gate t_drift)"
psqld t_drift -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null 2>"$TMP/drift.err" && fail "migration chạy dù hàm phụ thuộc lệch"
grep -q "DỪNG — production khác repo.*hàm is_teacher" "$TMP/drift.err" && [ "$(state t_drift)" = "false/0" ] \
  && ok "migration tự DỪNG khi is_teacher lệch — không tạo gì" || fail "gate: $(cat "$TMP/drift.err")"
baseline t_cols "$TMP/fixture_noroles.sql"
psqld t_cols -c "alter table public.class_stages drop column public_title" >/dev/null
[ "$(gate t_cols)" = "STOP - DO NOT MIGRATE" ] && ok "preflight: thiếu cột class_stages.public_title → GATE = STOP" || fail "preflight cột"
psqld t_cols -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null 2>"$TMP/cols.err" && fail "migration chạy dù thiếu cột"
grep -q "thiếu cột class_stages.public_title" "$TMP/cols.err" && ok "migration DỪNG khi thiếu cột" || fail "gate cột: $(cat "$TMP/cols.err")"

echo "ALL LEARNING THREAD DB CHECKS PASS"
