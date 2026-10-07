#!/usr/bin/env bash
# Test Class Chat V1b (db/dm_share_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).   bash scripts/test-dm-share-v1-db.sh
# Phủ: migration ×2 (một transaction như prod-db) · cổng drift · test SQL theo identity · REGRESSION toàn bộ test V1a trên DB đã lên V1b ·
# seq đồng thời (hai phiên song song) · rollback ×2 (trả đúng md5 V1a; giữ cột khi có tin share; không mất tin) · cài lại.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvadms.XXXXXX)"
PORT="${PORT:-$((56600 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
run_test() { # db file
  PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 -f "$2" 2>&1 \
    | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/test.out"
  [ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL $2"
  grep -q '^FAIL' "$TMP/test.out" && fail "có FAIL trong $2" || true
}
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
baseline() { # db → nền production giả lập ĐẾN Chat V1a
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup \
           class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup \
           social_tool_share_v1_setup social_bms_artifact_v1_setup social_nhipphach_artifact_v1_setup account_avatar_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/rls_setup.sql" >/dev/null
  mig "$db" "$ROOT/db/dm_v1_setup.sql" >/dev/null
}
V1A_APPEND=07e8750b2391ef413f8c7ee258031241; V1A_MSGS=e01f291a572f31eb103d9d963e28cf4b
FNMD5="select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('dm_rule','dm_start','dm_send','dm_conversations','dm_mark_read','dm_unread_count','dm_can_message','dm_find')"

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/dm_share_v1_setup.sql" "$ROOT/db/dm_share_v1_rollback.sql" && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/dm_share_v1_setup.sql" | grep -qi 'create policy\|auth\.users\|references ' && fail "setup có policy/FK (không được)" || ok "setup không có CREATE POLICY / FK (không khoá auth.users)"

echo "── Baseline = V1a trên nền production giả lập"
baseline v1b
[ "$(q v1b "select md5(prosrc) from pg_proc where proname = 'dm_append'")" = "$V1A_APPEND" ] && [ "$(q v1b "select md5(prosrc) from pg_proc where proname = 'dm_messages'")" = "$V1A_MSGS" ] && ok "baseline V1a: md5 dm_append/dm_messages đúng như production" || fail "baseline không khớp production"
PRE="$(cat "$ROOT/db/dm_share_v1_preflight.sql")"; POST="$(cat "$ROOT/db/dm_share_v1_postflight.sql")"
FN0="$(q v1b "$FNMD5")"
q v1b "insert into auth.users (id,email) values ('aaaaaaaa-1111-4000-8000-0000000000a1','pre@test.local') on conflict do nothing" >/dev/null || true

echo "── Khoá trong migration"
LOCKS="$(psqld v1b -tA <<SQL
begin;
\i $ROOT/db/dm_share_v1_setup.sql
select coalesce(string_agg(distinct n.nspname || '.' || c.relname || ':' || l.mode, ', ' order by n.nspname || '.' || c.relname || ':' || l.mode), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname <> 'dm_messages' and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock', 'RowExclusiveLock');
rollback;
SQL
)"
[ -z "$LOCKS" ] && ok "migration chỉ khoá dm_messages (không đụng auth.users/tool_artifacts/bảng khác)" || fail "khoá ngoài dm_messages: $LOCKS"

[ "$(q v1b "select item from (${PRE%;}) z where section = 'GATE'")" = "PASS" ] && ok "preflight trên baseline V1a: GATE = PASS" || fail "preflight baseline"
echo "── Migration ×2"
mig v1b "$ROOT/db/dm_share_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig v1b "$ROOT/db/dm_share_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(q v1b "$FNMD5")" = "$FN0" ] && ok "dm_rule/dm_start/dm_send/dm_conversations/dm_mark_read/dm_unread_count/dm_can_message/dm_find KHÔNG đổi (md5)" || fail "hàm V1a bị đổi"
[ "$(q v1b "select count(*) from pg_proc where proname = 'dm_append' and pronargs = 3")" = "0" ] && ok "không còn overload dm_append 3 tham số" || fail "còn overload cũ"
[ "$(q v1b "select count(*) from information_schema.role_table_grants where table_name like 'dm\_%' and grantee in ('anon','authenticated','PUBLIC')")/$(q v1b "select count(*) from pg_policies where tablename like 'dm\_%'")" = "0/0" ] && ok "bảng dm_*: vẫn 0 grant client, 0 policy" || fail "quyền bảng đổi"
[ "$(q v1b "select count(*) from pg_proc p where p.proname in ('dm_share','dm_messages') and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')")" = "2" ] \
  && [ "$(q v1b "select count(*) from pg_proc p where p.proname in ('dm_append','dm_open') and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))")" = "0" ] \
  && ok "quyền hàm: dm_share/dm_messages chỉ authenticated; dm_append/dm_open nội bộ" || fail "quyền hàm sai"

POST="$(cat "$ROOT/db/dm_share_v1_postflight.sql")"
[ "$(q v1b "select item from (${POST%;}) z where section = 'GATE'")" = "PASS" ] && ok "postflight V1b: GATE = PASS (md5 ghim đúng)" || { psqld v1b -c "${POST%;}"; fail "postflight"; }
[ "$(q v1b "select item from (${PRE%;}) z where section = 'GATE'")" = "PASS" ] && ok "preflight sau migration vẫn PASS (chạy lại an toàn)" || fail "preflight sau migration"
echo "── Cổng drift"
baseline v1b_drift
q v1b_drift "create or replace function public.dm_rule(p_a uuid, p_b uuid) returns boolean language sql security definer set search_path = '' as \$\$ select true \$\$" >/dev/null
mig v1b_drift "$ROOT/db/dm_share_v1_setup.sql" >/dev/null 2>"$TMP/d.err" && fail "migration chạy được khi dm_rule bị sửa" || { grep -q "DỪNG — hàm Chat V1a" "$TMP/d.err" && ok "dm_rule bị sửa tay → migration DỪNG" || fail "cổng drift: $(cat "$TMP/d.err")"; }
baseline v1b_drift2
q v1b_drift2 "create or replace function public.dm_messages(p_conversation uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30) returns table(seq bigint, sender_id uuid, mine boolean, body text, created_at timestamptz) language sql as \$\$ select 1::bigint, null::uuid, true, 'x', now() \$\$" >/dev/null
mig v1b_drift2 "$ROOT/db/dm_share_v1_setup.sql" >/dev/null 2>"$TMP/d2.err" && fail "migration chạy được khi dm_messages bị sửa" || { grep -q "khác baseline V1a" "$TMP/d2.err" && ok "dm_messages bị sửa tay → migration DỪNG" || fail "cổng drift 2: $(cat "$TMP/d2.err")"; }

echo "── Test SQL V1b theo identity"
run_test v1b "$ROOT/db/tests/dm_share_v1_test.sql"
ok "test V1b: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"

echo "── REGRESSION: toàn bộ test Chat V1a chạy trên DB đã lên V1b"
baseline v1b_reg
mig v1b_reg "$ROOT/db/dm_share_v1_setup.sql" >/dev/null
run_test v1b_reg "$ROOT/db/tests/dm_v1_test.sql"
ok "regression V1a: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"

echo "── seq đồng thời: hai phiên song song gửi text + share vào CÙNG hội thoại"
baseline v1b_cc
mig v1b_cc "$ROOT/db/dm_share_v1_setup.sql" >/dev/null
psqld v1b_cc -q <<'SQL'
insert into public.friendships (requester_id, addressee_id, status, responded_at) values ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','accepted',now());
insert into public.tool_artifacts (id, owner_id, tool, kind, schema_version, title, data, client_key)
  values ('a1111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','bms','song',1,'x','{}',gen_random_uuid());
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated; select conversation_id from public.dm_share('bbbbbbbb-0000-4000-8000-00000000000b','tool_artifact','a1111111-0000-4000-8000-000000000001');
SQL
mk() { # $1 user $2 peer $3 mode
  psqld v1b_cc -q <<SQL
select set_config('request.jwt.claims','{"sub":"$1","role":"authenticated"}',false);
set role authenticated;
do \$\$ declare i int; begin
  for i in 1..12 loop
    if i % 2 = 0 then perform public.dm_share('$2','tool_artifact','a1111111-0000-4000-8000-000000000001');
    else perform public.dm_start('$2', 'tin ' || i); end if;
  end loop; end \$\$;
SQL
}
mk aaaaaaaa-0000-4000-8000-00000000000a bbbbbbbb-0000-4000-8000-00000000000b & P1=$!
mk bbbbbbbb-0000-4000-8000-00000000000b aaaaaaaa-0000-4000-8000-00000000000a & P2=$!
wait $P1 && wait $P2 || fail "phiên song song lỗi"
[ "$(q v1b_cc "select count(*)||'/'||count(distinct seq)||'/'||max(seq)||'/'||min(seq) from public.dm_messages")" = "25/25/25/1" ] && [ "$(q v1b_cc "select count(*) from public.dm_conversations")" = "1" ] \
  && ok "25 tin (1 + 12 + 12) từ hai phiên song song: seq 1..25 liên tục, không trùng, đúng 1 hội thoại" || fail "seq đồng thời: $(q v1b_cc "select count(*)||'/'||count(distinct seq)||'/'||max(seq) from public.dm_messages")"
[ "$(q v1b_cc "select count(*) from public.dm_messages where ref_type is not null and body <> 'Đã chia sẻ một nội dung'")" = "0" ] && ok "mọi tin share có body cố định" || fail "body share lệch"

echo "── Rollback ×2 (có tin share → giữ cột, KHÔNG mất tin) + cài lại"
SHARES="$(q v1b_cc "select count(*) from public.dm_messages where ref_type is not null")"; ALL="$(q v1b_cc "select count(*) from public.dm_messages")"
mig v1b_cc "$ROOT/db/dm_share_v1_rollback.sql" >/dev/null || fail "rollback 1"; mig v1b_cc "$ROOT/db/dm_share_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback ×2 (idempotent)"
[ "$(q v1b_cc "select md5(prosrc) from pg_proc where proname = 'dm_append'")" = "$V1A_APPEND" ] && [ "$(q v1b_cc "select md5(prosrc) from pg_proc where proname = 'dm_messages'")" = "$V1A_MSGS" ] \
  && ok "rollback: dm_append/dm_messages về ĐÚNG md5 V1a" || fail "rollback không khôi phục nguyên văn"
[ "$(q v1b_cc "select count(*) from pg_proc where proname in ('dm_share','dm_open')")" = "0" ] && ok "rollback: gỡ dm_share/dm_open" || fail "còn dm_share"
[ "$(q v1b_cc "select count(*) from public.dm_messages")" = "$ALL" ] && [ "$(q v1b_cc "select count(*) from information_schema.columns where table_name='dm_messages' and column_name='ref_type'")" = "1" ] \
  && ok "rollback: còn $SHARES tin share → GIỮ cột, $ALL tin nguyên vẹn" || fail "rollback làm mất tin/cột"
[ "$(q v1b_cc "$FNMD5")" = "$FN0" ] && ok "rollback: hàm V1a khác không đổi" || fail "rollback đổi hàm V1a"
mig v1b_cc "$ROOT/db/dm_share_v1_setup.sql" >/dev/null && ok "cài lại V1b sau rollback (cột giữ → idempotent)" || fail "cài lại"
baseline v1b_rb
mig v1b_rb "$ROOT/db/dm_share_v1_setup.sql" >/dev/null; mig v1b_rb "$ROOT/db/dm_share_v1_rollback.sql" >/dev/null
[ "$(q v1b_rb "select count(*) from information_schema.columns where table_name='dm_messages' and column_name in ('ref_type','ref_key')")" = "0" ] && ok "rollback khi chưa có tin share: gỡ sạch 2 cột" || fail "cột không gỡ"
run_test v1b_rb "$ROOT/db/tests/dm_v1_test.sql"
ok "sau rollback: test V1a vẫn PASS ($(grep -c '^PASS' "$TMP/test.out"))"
echo "ALL DM SHARE V1 DB TESTS PASSED"
