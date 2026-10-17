#!/usr/bin/env bash
# Test Class System Chat V1 (bản NHÁP) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-class-system-chat-db.sh
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvasc.XXXXXX)"
PORT="${PORT:-$((56500 + RANDOM % 300))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }   # như prod-db.py: cả file trong MỘT transaction
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
DB=tva_sc
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$DB"
psqld $DB -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
         class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
  psqld $DB -f "$ROOT/db/$f.sql" >/dev/null
done
psqld $DB -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
psqld $DB -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "nền Learning Thread P1 đã cài"

echo "── Migration ×2 (idempotent) + rls_setup.sql"
mig $DB "$ROOT/db/class_system_chat_v1_setup.sql" >/dev/null && ok "migration lần 1"
mig $DB "$ROOT/db/class_system_chat_v1_setup.sql" >/dev/null && ok "migration lần 2"
psqld $DB -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "rls_setup.sql chạy lại"
[ "$(q $DB "select count(*) from pg_policies where tablename like 'class\_system\_%'")" = "0" ] && ok "không có policy nào trên bảng hệ thống" || fail "có policy"
[ "$(q $DB "select count(*) from information_schema.role_table_grants where table_name like 'class\_system\_%' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "anon/authenticated không có quyền bảng" || fail "còn quyền bảng"

echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d $DB -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_system_chat_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Rollback ×2 + cài lại"
BEFORE="$(q $DB "select count(*) from pg_proc where proname like 'lt\_%' or proname like 'dm\_%'")"
psqld $DB -1 -f "$ROOT/db/class_system_chat_v1_rollback.sql" >/dev/null && psqld $DB -1 -f "$ROOT/db/class_system_chat_v1_rollback.sql" >/dev/null && ok "rollback ×2"
[ "$(q $DB "select count(*) from pg_class where relname like 'class\_system\_%'")" = "0" ] && ok "bảng đã gỡ" || fail "còn bảng"
[ "$(q $DB "select count(*) from pg_trigger where tgname = 'class_system_notice_on_event'")" = "0" ] && ok "trigger đã gỡ" || fail "còn trigger"
[ "$(q $DB "select count(*) from pg_proc where proname like 'lt\_%' or proname like 'dm\_%'")" = "$BEFORE" ] && ok "hàm lt_*/dm_* không đổi sau rollback" || fail "rollback đụng lt/dm"
[ "$(q $DB "select count(*) from public.learning_threads")" = "1" ] && ok "dữ liệu learning_threads còn nguyên" || fail "mất dữ liệu thread"
mig $DB "$ROOT/db/class_system_chat_v1_setup.sql" >/dev/null && ok "cài lại sau rollback"

echo "══ Class System Chat V2 (DB riêng: nền + V1 + V2)"
DB2=tva_sc2
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$DB2"
grep -vE '^(create role|grant anon, authenticated to authenticator)' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/social_fixture_db2.sql"   # role là cấp cluster: đã tạo ở DB đầu
psqld $DB2 -f "$TMP/social_fixture_db2.sql" >/dev/null
for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
         class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
  psqld $DB2 -f "$ROOT/db/$f.sql" >/dev/null
done
psqld $DB2 -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
psqld $DB2 -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
fnmd5() { q $DB2 "select md5(pg_get_functiondef('public.class_system_notice_on_event()'::regprocedure))"; }
echo "── Cổng V2: thiếu V1 → DỪNG"
psqld $DB2 -1 -f "$ROOT/db/class_system_chat_v2_setup.sql" >/dev/null 2>&1 && fail "V2 chạy được khi chưa có V1" || ok "thiếu V1 → V2 DỪNG"
mig $DB2 "$ROOT/db/class_system_chat_v1_setup.sql" >/dev/null && ok "V1 đã cài"
V1MD5="$(fnmd5)"
echo "── Cổng V2: thiếu tva_private.class_memberships → DỪNG"
psqld $DB2 -1 -f "$ROOT/db/class_system_chat_v2_setup.sql" >/dev/null 2>&1 && fail "V2 chạy được khi thiếu class_memberships" || ok "thiếu class_memberships → V2 DỪNG"
# Giả lập view canonical của production (db/class_membership_canonical_v1_setup.sql §3) — fixture cluster tạm
psqld $DB2 -c "create schema if not exists tva_private; create or replace view tva_private.class_memberships as
  select cs.id as class_id, gm.group_id, gm.user_id, gm.source, gm.created_at as joined_at
  from public.class_schedule cs join public.edu_group_members gm on gm.group_id = cs.cohort_group_id and gm.status = 'active';" >/dev/null
mig $DB2 "$ROOT/db/class_system_chat_v2_setup.sql" >/dev/null && ok "V2 lần 1"
mig $DB2 "$ROOT/db/class_system_chat_v2_setup.sql" >/dev/null && ok "V2 lần 2 (idempotent)"
psqld $DB2 -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "rls_setup.sql chạy lại"
[ "$(q $DB2 "select count(*) from pg_policies where tablename like 'class\_system\_%'")" = "0" ] && ok "V2: vẫn không có policy trên bảng hệ thống" || fail "có policy"
[ "$(q $DB2 "select count(*) from information_schema.role_table_grants where table_name like 'class\_system\_%' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "V2: anon/authenticated vẫn không có quyền bảng" || fail "còn quyền bảng"
[ "$(q $DB2 "select count(*) from pg_class where relname like 'class\_system\_%' and relkind='r'")" = "2" ] && ok "V2: không thêm bảng (vẫn 2 bảng)" || fail "số bảng đổi"
echo "── Test SQL V2 theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d $DB2 -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_system_chat_v2_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL V2"
echo "── Rollback V2 ×2 → trở về đúng V1"
KEEP="$(q $DB2 "select count(*) from public.class_system_notices where kind = 'checkpoint_graded'")"
psqld $DB2 -1 -f "$ROOT/db/class_system_chat_v2_rollback.sql" >/dev/null && psqld $DB2 -1 -f "$ROOT/db/class_system_chat_v2_rollback.sql" >/dev/null && ok "rollback V2 ×2"
[ "$(fnmd5)" = "$V1MD5" ] && ok "hàm trigger trở về ĐÚNG V1 (md5 khớp)" || fail "hàm trigger khác V1 sau rollback"
[ "$(q $DB2 "select count(*) from public.class_system_notices where kind <> 'checkpoint_graded'")" = "0" ] && ok "thông báo V2 đã gỡ" || fail "còn thông báo V2"
[ "$(q $DB2 "select count(*) from public.class_system_notices where kind = 'checkpoint_graded'")" = "$KEEP" ] && ok "thông báo chấm bài V1 được GIỮ NGUYÊN ($KEEP)" || fail "mất thông báo V1"
[ "$(q $DB2 "select pg_get_constraintdef(oid) from pg_constraint where conname='class_system_notices_kind_check'")" = "CHECK ((kind = 'checkpoint_graded'::text))" ] && ok "CHECK kind trở về V1" || fail "CHECK kind"
mig $DB2 "$ROOT/db/class_system_chat_v2_setup.sql" >/dev/null && ok "cài lại V2 sau rollback"
echo "ALL DB PASS"
