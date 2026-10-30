#!/usr/bin/env bash
# Test Feed Likes V1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-feed-likes-db.sh
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvafl.XXXXXX)"
PORT="${PORT:-$((57000 + RANDOM % 300))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }   # như prod-db.py: cả file trong MỘT transaction
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
DB=tva_fl
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$DB"
psqld $DB -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
         class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
  psqld $DB -f "$ROOT/db/$f.sql" >/dev/null
done
psqld $DB -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
psqld $DB -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
psqld $DB -f "$ROOT/db/tests/local/teamlab_publications_fixture.sql" >/dev/null
psqld $DB -f "$ROOT/db/tests/local/teamlab_publications_seed.sql" >/dev/null
ok "nền (Social + Learning Thread + TeamLab publications) đã cài"

echo "── Cổng: thiếu nền → DỪNG"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres tva_fl_empty
psqld tva_fl_empty -1 -f "$ROOT/db/feed_likes_v1_setup.sql" >/dev/null 2>&1 && fail "chạy được khi thiếu nền" || ok "thiếu nền → migration DỪNG"

echo "── Migration ×2 (idempotent) + rls_setup.sql"
mig $DB "$ROOT/db/feed_likes_v1_setup.sql" >/dev/null && ok "migration lần 1"
mig $DB "$ROOT/db/feed_likes_v1_setup.sql" >/dev/null && ok "migration lần 2"
psqld $DB -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "rls_setup.sql chạy lại"
[ "$(q $DB "select count(*) from pg_policies where tablename = 'feed_likes'")" = "0" ] && ok "feed_likes không có policy" || fail "có policy trên feed_likes"
[ "$(q $DB "select count(*) from information_schema.role_table_grants where table_name = 'feed_likes' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "anon/authenticated không có quyền bảng" || fail "còn quyền bảng"

echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d $DB -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/feed_likes_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Hàm Feed hiện có KHÔNG đổi"
[ "$(q $DB "select count(*) from pg_proc where proname in ('class_feed','class_add_comment','class_comments_for_posts') ")" -ge 3 ] && ok "hàm Feed/bình luận còn nguyên" || fail "mất hàm"

echo "── Rollback ×2 + cài lại"
psqld $DB -1 -f "$ROOT/db/feed_likes_v1_rollback.sql" >/dev/null && psqld $DB -1 -f "$ROOT/db/feed_likes_v1_rollback.sql" >/dev/null && ok "rollback ×2"
[ "$(q $DB "select count(*) from pg_class where relname = 'feed_likes'")" = "0" ] && ok "bảng đã gỡ" || fail "còn bảng"
[ "$(q $DB "select count(*) from pg_proc where proname like 'feed\_%'")" = "0" ] && ok "RPC đã gỡ" || fail "còn RPC"
[ "$(q $DB "select count(*) from public.class_posts")" -ge 3 ] && ok "dữ liệu bài đăng còn nguyên sau rollback" || fail "mất dữ liệu"
mig $DB "$ROOT/db/feed_likes_v1_setup.sql" >/dev/null && ok "cài lại sau rollback"
echo "══ TẤT CẢ PASS"
