#!/usr/bin/env bash
# Test Feed Comments V2 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-feed-likes-db.sh
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvafc2.XXXXXX)"
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
DB=tva_fc
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
mig $DB "$ROOT/db/class_system_chat_v1_setup.sql" >/dev/null && ok "nền System Chat V1 đã cài"

echo "── Cổng: thiếu Feed Likes V1 → DỪNG"
psqld $DB -1 -f "$ROOT/db/feed_comments_v2_setup.sql" >/dev/null 2>&1 && fail "chạy được khi thiếu Feed Likes V1" || ok "thiếu feed_target_visible → migration DỪNG"
mig $DB "$ROOT/db/feed_likes_v1_setup.sql" >/dev/null && ok "Feed Likes V1 đã cài"
CPC_BEFORE="$(q $DB "select md5(string_agg(c::text, '|' order by column_name)) from (select column_name, data_type, is_nullable from information_schema.columns where table_name='class_post_comments') c")"
POL_BEFORE="$(q $DB "select md5(string_agg(policyname||cmd||coalesce(qual,'')||coalesce(with_check,''), '|' order by policyname)) from pg_policies where tablename='class_post_comments'")"
FN_BEFORE="$(q $DB "select md5(string_agg(md5(prosrc), ',' order by proname)) from pg_proc where proname in ('class_add_comment','class_comments_for_posts','class_post_comments_before_write','class_post_visible','class_moderate')")"

echo "── Migration ×2 (idempotent) + rls_setup.sql"
mig $DB "$ROOT/db/feed_comments_v2_setup.sql" >/dev/null && ok "migration lần 1"
mig $DB "$ROOT/db/feed_comments_v2_setup.sql" >/dev/null && ok "migration lần 2"
psqld $DB -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "rls_setup.sql chạy lại"
[ "$(q $DB "select count(*) from pg_policies where tablename = 'feed_comments'")" = "0" ] && ok "feed_comments không có policy" || fail "có policy"
[ "$(q $DB "select count(*) from information_schema.role_table_grants where table_name = 'feed_comments' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "anon/authenticated không có quyền bảng" || fail "còn quyền bảng"
[ "$(q $DB "select md5(string_agg(c::text, '|' order by column_name)) from (select column_name, data_type, is_nullable from information_schema.columns where table_name='class_post_comments') c")" = "$CPC_BEFORE" ] && ok "class_post_comments: cột không đổi" || fail "đổi cột class_post_comments"
[ "$(q $DB "select md5(string_agg(policyname||cmd||coalesce(qual,'')||coalesce(with_check,''), '|' order by policyname)) from pg_policies where tablename='class_post_comments'")" = "$POL_BEFORE" ] && ok "class_post_comments: policy không đổi" || fail "đổi policy"
[ "$(q $DB "select md5(string_agg(md5(prosrc), ',' order by proname)) from pg_proc where proname in ('class_add_comment','class_comments_for_posts','class_post_comments_before_write','class_post_visible','class_moderate')")" = "$FN_BEFORE" ] && ok "RPC/trigger bình luận cũ không đổi" || fail "đổi hàm cũ"

echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d $DB -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/feed_comments_v2_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Rollback ×2 + cài lại"
psqld $DB -1 -f "$ROOT/db/feed_comments_v2_rollback.sql" >/dev/null && psqld $DB -1 -f "$ROOT/db/feed_comments_v2_rollback.sql" >/dev/null && ok "rollback ×2"
[ "$(q $DB "select count(*) from pg_class where relname = 'feed_comments'")" = "0" ] && ok "bảng đã gỡ" || fail "còn bảng"
[ "$(q $DB "select count(*) from pg_proc where proname like 'feed\_comment%'")" = "0" ] && ok "RPC/trigger hàm đã gỡ" || fail "còn hàm"
[ "$(q $DB "select count(*) from pg_trigger where tgname='feed_comment_notify'")" = "0" ] && ok "trigger đã gỡ" || fail "còn trigger"
[ "$(q $DB "select count(*) from pg_proc where proname = 'feed_like_set'")" = "1" ] && ok "Feed Likes V1 còn nguyên" || fail "rollback đụng Likes"
[ "$(q $DB "select md5(string_agg(md5(prosrc), ',' order by proname)) from pg_proc where proname in ('class_add_comment','class_comments_for_posts','class_post_comments_before_write','class_post_visible','class_moderate')")" = "$FN_BEFORE" ] && ok "hàm bình luận cũ không đổi sau rollback" || fail "rollback đụng hàm cũ"
mig $DB "$ROOT/db/feed_comments_v2_setup.sql" >/dev/null && ok "cài lại sau rollback"
echo "══ TẤT CẢ PASS"
