#!/usr/bin/env bash
# Test CLASS_UNLOCK_POLICY_V1 (tách ĐIỂM NỘP BÀI khỏi MỞ KHOÁ TUẦN TỰ) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).
#   bash scripts/test-class-unlock-policy-db.sh
# Phủ: xem docs/CLASS-UNLOCK-POLICY-V1.md (mục Kiểm thử).
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

cp_base() {
  local fx="$TMP/fixture_noroles.sql"
  [ -f "$TMP/.roles" ] || { fx="$ROOT/db/tests/local/social_fixture.sql"; touch "$TMP/.roles"; }   # DB đầu tiên tạo role cho cả cluster
  baseline "$1" "$fx"
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld "$1" -f "$ROOT/db/$f.sql" >/dev/null; done
  psqld "$1" -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
  psqld "$1" -f "$ROOT/db/tests/local/class_checkpoints_fixture_data.sql" >/dev/null
}
cp_setup() { psqld "$1" -c "begin;" -f "$ROOT/db/class_checkpoints_v1_setup.sql" -c "commit;" >/dev/null; }
qz_setup() { psqld "$1" -c "begin;" -f "$ROOT/db/quiz_checkpoint_v1_setup.sql" -c "commit;" >/dev/null; }
up_setup() { psqld "$1" -c "begin;" -f "$ROOT/db/class_unlock_policy_v1_setup.sql" -c "commit;" >/dev/null; }
up_rollback() { psqld "$1" -c "begin;" -f "$ROOT/db/class_unlock_policy_v1_rollback.sql" -c "commit;" >/dev/null; }
UP_MD5() { q "$1" "select string_agg(proname || '=' || md5(prosrc), ' ' order by proname) from pg_proc where proname in ('lsp_sync', 'class_learning_state')"; }
UPGATE() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/class_unlock_policy_v1_preflight.sql")) z where section = 'GATE'"; }
UPPOST() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/class_unlock_policy_v1_postflight.sql")) z where section = 'GATE'"; }
UP_EXPECTED="class_learning_state=db9015ea8a462af44a7750a5bbc26f86 lsp_sync=c85a6a5255959b7a03be96a3f188427c"

echo "── CLASS_UNLOCK_POLICY_V1: không begin/commit · md5 cổng = bản repo · preflight · setup ×2 · postflight · test · rollback · cài lại · drift"
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/class_unlock_policy_v1_setup.sql" "$ROOT/db/class_unlock_policy_v1_rollback.sql" \
  && fail "file migration có begin/commit (prod-db.py sở hữu transaction)" || ok "setup/rollback không tự begin/commit (đúng luật prod-db.py)"
cp_base t_up && cp_setup t_up && qz_setup t_up
[ "$(UP_MD5 t_up)" = "$UP_EXPECTED" ] && ok "md5 2 hàm bị thay (repo: V1 + QUIZ) = hằng md5 trong cổng" || fail "md5 repo khác hằng cổng: $(UP_MD5 t_up)"
[ "$(UPGATE t_up)" = "PASS" ] && ok "preflight: GATE = PASS" || fail "preflight: $(UPGATE t_up)"
up_setup t_up && up_setup t_up && ok "migration ×2 (idempotent; cổng nhận bản đã chạy)"
[ "$(UPGATE t_up)" = "PASS" ] && ok "preflight sau migration: GATE = PASS" || fail "preflight sau: $(UPGATE t_up)"
[ "$(UPPOST t_up)" = "PASS" ] && ok "postflight: GATE = PASS" || fail "postflight: $(UPPOST t_up)"
[ "$(q t_up "select count(*) from public.class_schedule where unlock_policy <> 'sequential'")" = "0" ] \
  && ok "mọi lớp hiện có giữ 'sequential' (không đổi chính sách lớp đang chạy)" || fail "có lớp bị đổi chính sách"
psqld t_up -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "rls_setup.sql chạy lại được sau migration"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_up -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_unlock_policy_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL class_unlock_policy_v1"
# Rollback khi một lớp đang 'open' + đã có tiến độ: hàm về đúng md5, GIỮ cột + dữ liệu (không xoá chính sách/tiến độ)
[ "$(q t_up "select count(*) from public.class_schedule where unlock_policy = 'open'")" -ge 1 ] || fail "test chưa để lại lớp 'open' để thử rollback"
PROG_BEFORE="$(q t_up "select count(*) from public.learning_session_progress")"
up_rollback t_up && up_rollback t_up
[ "$(UP_MD5 t_up)" = "$UP_EXPECTED" ] && [ "$(q t_up "select count(*) from public.learning_session_progress")" = "$PROG_BEFORE" ] \
  && [ "$(q t_up "select count(*) from information_schema.columns where table_name = 'class_schedule' and column_name = 'unlock_policy'")" = "1" ] \
  && ok "rollback ×2 khi có lớp 'open': 2 hàm về đúng md5 trước, GIỮ cột + tiến độ ($PROG_BEFORE dòng)" || fail "rollback có dữ liệu"
q t_up "update public.class_schedule set unlock_policy = 'sequential'" >/dev/null
up_rollback t_up
[ "$(q t_up "select count(*) from information_schema.columns where table_name = 'class_schedule' and column_name = 'unlock_policy'")" = "0" ] \
  && ok "rollback khi mọi lớp 'sequential': gỡ cột" || fail "rollback không gỡ cột"
up_setup t_up && [ "$(UPGATE t_up)" = "PASS" ] && [ "$(UPPOST t_up)" = "PASS" ] && ok "cài lại sau rollback: preflight + postflight PASS"
# Cổng drift: sửa tay một hàm phụ thuộc → migration phải DỪNG, không đổi gì
cp_base t_up2 && cp_setup t_up2 && qz_setup t_up2
psqld t_up2 -c "create or replace function public.lsp_sync(p_user uuid, p_class uuid, p_program text) returns void language plpgsql security definer set search_path = '' as \$f\$ begin null; end \$f\$;" >/dev/null
[ "$(UPGATE t_up2)" = "STOP - DO NOT MIGRATE" ] && ok "preflight bắt hàm lsp_sync bị sửa tay → STOP" || fail "preflight không bắt drift: $(UPGATE t_up2)"
psqld t_up2 -c "begin;" -f "$ROOT/db/class_unlock_policy_v1_setup.sql" -c "commit;" >/dev/null 2>"$TMP/up2.err" && fail "migration chạy dù hàm lệch"
grep -q "DỪNG" "$TMP/up2.err" && [ "$(q t_up2 "select count(*) from information_schema.columns where table_name = 'class_schedule' and column_name = 'unlock_policy'")" = "0" ] \
  && ok "migration DỪNG khi drift, không thêm cột" || fail "migration drift: $(cat "$TMP/up2.err")"
echo "TẤT CẢ ĐẠT — CLASS_UNLOCK_POLICY_V1"
