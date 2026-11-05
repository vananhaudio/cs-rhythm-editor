#!/usr/bin/env bash
# Test Mira cạnh màn chấm bài (vé ngắn hạn + đọc ngữ cảnh) ở tầng DB trên cluster PostgreSQL 17 TẠM. KHÔNG kết nối production.
#   bash scripts/test-mira-grading-db.sh
# Phủ: preflight GATE · migration ×2 (idempotent) · quyền bảng/hàm · test SQL theo từng identity · rollback ×2 + cài lại.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvamg.XXXXXX)"
PORT="${PORT:-$((56500 + RANDOM % 400))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d mg -v ON_ERROR_STOP=1 "$@"; }
q() { psqld -tA -c "$1"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres mg
psqld -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
         class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do psqld -f "$ROOT/db/$f.sql" >/dev/null; done
psqld -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld -f "$ROOT/db/$f.sql" >/dev/null; done
psqld -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
psqld -f "$ROOT/db/tests/local/class_checkpoints_fixture_data.sql" >/dev/null
psqld -c "begin;" -f "$ROOT/db/class_checkpoints_v1_setup.sql" -c "commit;" >/dev/null
psqld -c "begin;" -f "$ROOT/db/social_learning_identity_v1_setup.sql" -c "commit;" >/dev/null
psqld -1 -f "$ROOT/db/student_360_p1_setup.sql" >/dev/null

gate() { q "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/mira_grading_v1_preflight.sql")) z where section = 'GATE'"; }
echo "── Preflight (chỉ đọc)"
[ "$(gate)" = "PASS" ] && ok "preflight trên baseline: GATE = PASS" || fail "preflight baseline: $(gate)"
echo "── Migration lần 1 + 2"
psqld -1 -f "$ROOT/db/mira_grading_v1_setup.sql" >/dev/null && ok "migration lần 1"
psqld -1 -f "$ROOT/db/mira_grading_v1_setup.sql" >/dev/null && ok "migration lần 2 (idempotent)"
[ "$(gate)" = "STOP" ] && ok "preflight sau migration: STOP (chặn chạy lại nhầm)" || fail "preflight sau migration"
[ "$(q "select count(*) from pg_proc where proname like 'mira\_grading\_%'")" = "3" ] && ok "đúng 3 hàm mira_grading_*" || fail "số hàm"
psqld -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "chạy lại rls_setup.sql"
[ "$(q "select count(*) from information_schema.role_table_grants where table_name like 'mira\_grading\_%' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "sau rls_setup: anon/authenticated vẫn không có quyền bảng mira_grading_*" || fail "rls_setup/grant mặc định mở quyền bảng"
[ "$(q "select count(*) from pg_policies where tablename like 'mira\_grading\_%'")" = "0" ] && ok "không có policy nào trên bảng mira_grading_*" || fail "có policy"
[ "$(q "select count(*) from pg_constraint where contype = 'f' and conrelid in ('public.mira_grading_keys'::regclass, 'public.mira_grading_tickets'::regclass)")" = "0" ] \
  && ok "2 bảng mới không có FK (không khoá auth.users / learning_threads)" || fail "có FK"
post() { q "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/mira_grading_v1_postflight.sql")) z where section = 'GATE'"; }
[ "$(post)" = "PASS" ] && ok "postflight (chỉ đọc): GATE = PASS — quyền/cấu hình đúng thiết kế" || { q "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/mira_grading_v1_postflight.sql")) z where item like 'FAIL%'"; fail "postflight"; }
[ "$(q "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/mira_grading_v1_postflight.sql")) z where section = 'KEY'")" = "CHƯA đặt khoá Mira (bước cuối trước khi bật)" ] && ok "postflight báo đúng: chưa đặt khoá Mira" || fail "KEY"


echo "── Test SQL (quyền/RPC theo từng identity)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d mg -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/mira_grading_v1_test.sql" 2>&1 | sed -E "s/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //" | grep -E "^(PASS|FAIL|XONG|ERROR|CONTEXT)|^[A-Za-z_]+:" 
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Rollback ×2 + cài lại"
FN_BEFORE="$(q "select md5(string_agg(proname || prosrc, '' order by proname)) from pg_proc where proname like 'student\_360\_%' or proname in ('is_teacher','class_public_identity','lt_detail')")"
psqld -1 -f "$ROOT/db/mira_grading_v1_rollback.sql" >/dev/null && ok "rollback lần 1"
psqld -1 -f "$ROOT/db/mira_grading_v1_rollback.sql" >/dev/null && ok "rollback lần 2 (idempotent)"
[ "$(gate)" = "PASS" ] && ok "sau rollback: preflight PASS lại" || fail "preflight sau rollback"
[ "$(q "select md5(string_agg(proname || prosrc, '' order by proname)) from pg_proc where proname like 'student\_360\_%' or proname in ('is_teacher','class_public_identity','lt_detail')")" = "$FN_BEFORE" ] \
  && ok "migration/rollback không đổi thân hàm Class nào (student_360_*, is_teacher, class_public_identity, lt_detail)" || fail "hàm Class bị đổi"
# Ảnh hưởng khoá: trong CHÍNH giao dịch migration, bảng nào ngoài 2 bảng mới bị giữ khoá GHI (ngoài AccessShare/RowShare)? Phải là 0.
{ echo "begin;"; cat "$ROOT/db/mira_grading_v1_setup.sql"; echo "select 'LOCKS=' || count(*) from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
        where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname in ('public', 'auth') and c.relname not like 'mira\\_grading\\_%'
          and l.mode not in ('AccessShareLock', 'RowShareLock') and c.relkind in ('r', 'v', 'm');"; echo "rollback;"; } > "$TMP/lockprobe.sql"
LOCKS="$(psqld -tA -f "$TMP/lockprobe.sql" | grep '^LOCKS=')"
[ "$LOCKS" = "LOCKS=0" ] && ok "migration không giữ khoá ghi lên bảng Class nào (${LOCKS})" || fail "migration giữ khoá lên bảng ngoài: $LOCKS"
# Đối chứng dương: nếu migration có FK tới learning_threads thì thăm dò PHẢI thấy khoá → chứng minh phép đo không mù
sed 's/^begin;$/begin; lock table public.learning_threads in share row exclusive mode;/' "$TMP/lockprobe.sql" > "$TMP/lockprobe_pos.sql"
POS="$(psqld -tA -f "$TMP/lockprobe_pos.sql" | grep '^LOCKS=')"; [ "$POS" != "LOCKS=0" ] && ok "đối chứng dương: thăm dò phát hiện khoá khi có (${POS})" || fail "thăm dò khoá mù"
[ "$(gate)" = "PASS" ] && ok "thăm dò khoá đã rollback sạch (preflight PASS)" || fail "thăm dò khoá để lại dấu"
psqld -1 -f "$ROOT/db/mira_grading_v1_setup.sql" >/dev/null && ok "cài lại sau rollback"
echo "XONG: Mira grading DB — mọi kiểm tra đạt"
