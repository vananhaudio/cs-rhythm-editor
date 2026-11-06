#!/usr/bin/env bash
# Test Feed Comments Paging V1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-feed-comments-paging-db.sh
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvafcp.XXXXXX)"
PORT="${PORT:-$((57300 + RANDOM % 300))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
DB=tva_fcp
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
mig $DB "$ROOT/db/class_system_chat_v1_setup.sql" >/dev/null
mig $DB "$ROOT/db/feed_likes_v1_setup.sql" >/dev/null
mig $DB "$ROOT/db/feed_comments_v2_setup.sql" >/dev/null
psqld $DB -f "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" >/dev/null
psqld $DB -1 -f "$ROOT/db/feed_comments_safety_v1_setup.sql" >/dev/null
ok "nền (Social + Thread/TeamLab + Feed Comments V2 + Safety V1) đã cài"

FN_BEFORE="$(q $DB "select md5(string_agg(md5(prosrc), ',' order by proname)) from pg_proc where proname in ('class_add_comment','class_comments_for_posts','class_comments_for_posts_safe','feed_comment_list','feed_comment_add','class_post_comments_before_write','class_moderate')")"
CPC_BEFORE="$(q $DB "select md5(string_agg(policyname||cmd||coalesce(qual,'')||coalesce(with_check,''), '|' order by policyname)) from pg_policies where tablename in ('class_post_comments','feed_comments')")"
echo "── Migration ×2 (idempotent)"
mig $DB "$ROOT/db/feed_comments_paging_v1_setup.sql" >/dev/null && ok "migration lần 1" || fail "migration lần 1 (xem thông báo trên)"
mig $DB "$ROOT/db/feed_comments_paging_v1_setup.sql" >/dev/null && ok "migration lần 2"
[ "$(q $DB "select md5(string_agg(md5(prosrc), ',' order by proname)) from pg_proc where proname in ('class_add_comment','class_comments_for_posts','class_comments_for_posts_safe','feed_comment_list','feed_comment_add','class_post_comments_before_write','class_moderate')")" = "$FN_BEFORE" ] && ok "hàm/RPC cũ không đổi" || fail "đổi hàm cũ"
[ "$(q $DB "select md5(string_agg(policyname||cmd||coalesce(qual,'')||coalesce(with_check,''), '|' order by policyname)) from pg_policies where tablename in ('class_post_comments','feed_comments')")" = "$CPC_BEFORE" ] && ok "policy bình luận không đổi" || fail "đổi policy"
[ "$(q $DB "select has_function_privilege('anon','public.feed_comment_page(text,uuid,bigint,int)','execute') or has_function_privilege('anon','public.class_comments_page_safe(uuid,bigint,int)','execute')")" = "f" ] && ok "anon không có quyền thực thi" || fail "anon gọi được"
echo "── Test SQL theo identity"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d $DB -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/feed_comments_paging_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"
echo "── Rollback ×2"
psqld $DB -1 -f "$ROOT/db/feed_comments_paging_v1_rollback.sql" >/dev/null && psqld $DB -1 -f "$ROOT/db/feed_comments_paging_v1_rollback.sql" >/dev/null && ok "rollback ×2"
[ "$(q $DB "select count(*) from pg_proc where proname in ('feed_comment_page','class_comments_page_safe')")" = "0" ] && ok "rollback gỡ hai hàm" || fail "còn hàm"
[ "$(q $DB "select md5(string_agg(md5(prosrc), ',' order by proname)) from pg_proc where proname in ('class_add_comment','class_comments_for_posts','class_comments_for_posts_safe','feed_comment_list','feed_comment_add','class_post_comments_before_write','class_moderate')")" = "$FN_BEFORE" ] && ok "hàm cũ không đổi sau rollback" || fail "rollback đụng hàm cũ"
mig $DB "$ROOT/db/feed_comments_paging_v1_setup.sql" >/dev/null && ok "cài lại sau rollback"
echo "══ TẤT CẢ PASS"
