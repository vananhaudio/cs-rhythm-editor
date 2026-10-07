#!/usr/bin/env bash
# Test Class Universal Share V1 (db/universal_share_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-universal-share-db.sh
# Phủ: cổng drift · migration ×2 · khoá · test SQL theo identity (Nhịp & Phách lifecycle, lớp/buổi học tham chiếu, rate limit) · HỒI QUY:
# lifecycle BMS + Chat V1b + V1a + BMS Artifact + Nhịp & Phách (test cũ) trên DB đã có Universal Share · đồng thời (save/đăng/gỡ Nhịp & Phách) · rollback ×2 về đúng md5 LIVE.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaus.XXXXXX)"
PORT="${PORT:-$((56800 + RANDOM % 90))}"
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
baseline() { # db → nền production giả lập ĐẾN BMS Share Lifecycle (hiện LIVE) + class_sessions tối thiểu
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/tests/local/universal_share_fixture.sql" >/dev/null
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup \
           social_tool_share_v1_setup social_bms_artifact_v1_setup social_nhipphach_artifact_v1_setup account_avatar_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/rls_setup.sql" >/dev/null
  mig "$db" "$ROOT/db/dm_v1_setup.sql" >/dev/null
  mig "$db" "$ROOT/db/dm_share_v1_setup.sql" >/dev/null
  mig "$db" "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null
}
LIVE_FN="select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname collate \"C\") from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('bms_save_for_share','social_publish_tool_artifact','social_unpublish_tool_artifact','dm_share')"
KEEP_FN="select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname collate \"C\") from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('dm_append','dm_messages','dm_open','dm_rule','dm_artifact_granted','tool_artifact_demote_or_delete','social_delete_tool_artifact','social_share_tool_result','tool_artifacts_cleanup_on_post_delete','dm_start','dm_send','dm_conversations','dm_mark_read','dm_unread_count','dm_find','dm_can_message','bms_song_normalize','nhipphach_musicxml_check','nhipphach_settings_normalize')"
PRE="$(cat "$ROOT/db/universal_share_v1_preflight.sql")"; POST="$(cat "$ROOT/db/universal_share_v1_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/universal_share_v1_setup.sql" "$ROOT/db/universal_share_v1_rollback.sql" && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/universal_share_v1_setup.sql" | grep -qi 'create policy\|alter policy\|auth\.users\|references ' && fail "setup có policy/FK" || ok "setup không đụng policy / FK (không khoá auth.users)"

echo "── Baseline = LIVE hiện tại (V1a+V1b+BMS Lifecycle)"
baseline us
[ "$(gate us)" = "PASS" ] && ok "preflight trên baseline LIVE: GATE = PASS" || { psqld us -c "${PRE%;}"; fail "preflight baseline"; }
LIVE0="$(q us "$LIVE_FN")"; KEEP0="$(q us "$KEEP_FN")"
echo "$LIVE0" | tr ',' '\n' | sed 's/^/   LIVE /' | cut -c1-60

echo "── Khoá trong migration"
LOCKS="$(psqld us -tA <<SQL
begin;
\i $ROOT/db/universal_share_v1_setup.sql
select coalesce(string_agg(distinct n.nspname || '.' || c.relname, ', ' order by n.nspname || '.' || c.relname), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname <> 'dm_messages' and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock', 'RowExclusiveLock');
rollback;
SQL
)"
[ -z "$LOCKS" ] && ok "migration chỉ khoá dm_messages (đổi CHECK): không auth.users / tool_artifacts / class_posts / storage" || fail "khoá ngoài phạm vi: $LOCKS"

echo "── Migration ×2"
mig us "$ROOT/db/universal_share_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig us "$ROOT/db/universal_share_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(q us "$KEEP_FN")" = "$KEEP0" ] && ok "hàm nền KHÔNG đổi (dm_append/messages/open/rule, artifact_granted, demote_or_delete, social_delete, social_share_tool_result, trigger Feed, dm_start/send/…)" || fail "hàm nền bị đổi"
[ "$(postgate us)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld us -c "${POST%;}"; fail "postflight"; }
[ "$(gate us)" = "PASS" ] && ok "preflight sau migration vẫn PASS (chạy lại an toàn)" || fail "preflight sau migration"

echo "── Cổng drift"
baseline us_d1; q us_d1 "create or replace function public.dm_share(p_user uuid, p_ref_type text, p_ref_key text) returns table(conversation_id uuid, seq bigint) language sql security definer set search_path = '' as \$\$ select null::uuid, null::bigint \$\$" >/dev/null
mig us_d1 "$ROOT/db/universal_share_v1_setup.sql" >/dev/null 2>"$TMP/d1.err" && fail "migration chạy khi dm_share bị sửa" || { grep -q "khác baseline LIVE" "$TMP/d1.err" && ok "dm_share bị sửa tay → migration DỪNG" || fail "cổng dm_share: $(cat "$TMP/d1.err")"; }
[ "$(gate us_d1)" = "FAIL" ] && ok "preflight FAIL khi dm_share lệch" || fail "preflight không bắt drift"
baseline us_d2; q us_d2 "create or replace function public.dm_rule(p_a uuid, p_b uuid) returns boolean language sql security definer set search_path = '' as \$\$ select true \$\$" >/dev/null
mig us_d2 "$ROOT/db/universal_share_v1_setup.sql" >/dev/null 2>"$TMP/d2.err" && fail "migration chạy khi dm_rule bị sửa" || { grep -q "hàm nền khác baseline" "$TMP/d2.err" && ok "dm_rule bị sửa tay → migration DỪNG" || fail "cổng dm_rule: $(cat "$TMP/d2.err")"; }

echo "── Test SQL theo identity"
run_test us "$ROOT/db/tests/universal_share_v1_test.sql"
ok "test Universal Share: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"

echo "── HỒI QUY: test cũ chạy trên DB đã có Universal Share"
for t in bms_share_lifecycle_v1_test dm_share_v1_test dm_v1_test social_bms_artifact_v1_test social_nhipphach_artifact_v1_test; do
  baseline us_r; mig us_r "$ROOT/db/universal_share_v1_setup.sql" >/dev/null
  run_test us_r "$ROOT/db/tests/$t.sql"; ok "hồi quy $t: $(grep -c '^PASS' "$TMP/test.out") PASS"
  "$PGBIN/dropdb" -h "$TMP" -p "$PORT" -U postgres us_r
done

echo "── Đồng thời: lưu/đăng/gỡ Nhịp & Phách đua nhau"
baseline us_cc; mig us_cc "$ROOT/db/universal_share_v1_setup.sql" >/dev/null
q us_cc "insert into public.friendships (requester_id, addressee_id, status, responded_at) values ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','accepted',now())" >/dev/null
np_json() { echo "\$j\${\"title\":\"$1\",\"composer\":null,\"musicxml\":\"<?xml version=\\\"1.0\\\"?><score-partwise version=\\\"4.0\\\"><part-list><score-part id=\\\"P1\\\"><part-name>G</part-name></score-part></part-list><part id=\\\"P1\\\"><measure number=\\\"1\\\"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes><note><rest/><duration>4</duration></note></measure></part></score-partwise>\",\"settings\":{\"showBeats\":true,\"countingLevel\":\"beats\",\"compoundCountingMode\":\"pulses\",\"orientation\":\"portrait\",\"color\":\"#DC2626\",\"sizePt\":7,\"distance\":2,\"grouping\":{}}}\$j\$"; }
NPD="$(np_json 'Race NP DM')"; NPN="$(np_json 'Race NP NoDM')"
psqld us_cc -q >/dev/null <<SQL
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
do \$\$ declare a uuid; begin a := public.tool_artifact_save_for_share('nhipphach', $NPD::jsonb); perform public.social_publish_tool_artifact(a); perform public.dm_share('bbbbbbbb-0000-4000-8000-00000000000b','tool_artifact',a::text); end \$\$;
SQL
race() { psqld us_cc -q >/dev/null <<SQL
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
do \$\$ declare i int; a uuid; begin
  for i in 1..25 loop
    begin
      a := public.tool_artifact_save_for_share('nhipphach', $1::jsonb);
      if random() < 0.5 then perform public.social_publish_tool_artifact(a); else perform public.social_unpublish_tool_artifact(a); end if;
    exception when others then null;
    end;
  end loop; end \$\$;
SQL
}
race "$NPD" & R1=$!; race "$NPD" & R2=$!; race "$NPD" & R3=$!
wait $R1 && wait $R2 && wait $R3 || fail "phiên đua lỗi"
INV="$(q us_cc "select (select count(*) from public.tool_artifacts where title = 'Race NP DM') || '/' || (select visibility from public.tool_artifacts where title = 'Race NP DM') || '/' || (select count(*) from public.class_posts where tool_share ->> 'title' = 'Race NP DM')")"
case "$INV" in "1/class/1"|"1/shared/0") ok "Nhịp & Phách đã gửi DM, 75 thao tác đua nhau: đúng 1 artifact, nhất quán ($INV)";; *) fail "nửa vời (DM): $INV";; esac
race "$NPN" & R1=$!; race "$NPN" & R2=$!; race "$NPN" & R3=$!
wait $R1 && wait $R2 && wait $R3 || fail "phiên đua lỗi (không DM)"
NA="$(q us_cc "select count(*) from public.tool_artifacts where title = 'Race NP NoDM'")"; NP="$(q us_cc "select count(*) from public.class_posts where tool_share ->> 'title' = 'Race NP NoDM'")"; NV="$(q us_cc "select coalesce(max(visibility), '-') from public.tool_artifacts where title = 'Race NP NoDM'")"
case "$NA/$NV/$NP" in "1/class/1"|"1/shared/0"|"0/-/0") ok "Nhịp & Phách chưa gửi DM, 75 thao tác: nhất quán ($NA/$NV/$NP), không mồ côi/không trùng";; *) fail "nửa vời (không DM): $NA/$NV/$NP";; esac

echo "── Rollback ×2 (có tin class/class_session + artifact nhipphach → giữ dữ liệu)"
baseline us_rb; mig us_rb "$ROOT/db/universal_share_v1_setup.sql" >/dev/null
psqld us_rb -q >/dev/null <<SQL
insert into public.friendships (requester_id, addressee_id, status, responded_at) values ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','accepted',now());
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
select public.dm_share('bbbbbbbb-0000-4000-8000-00000000000b','class','b0000000-0000-4000-8000-0000000000c1');
select public.tool_artifact_save_for_share('nhipphach', $NPN::jsonb);
SQL
MSGS="$(q us_rb "select count(*) from public.dm_messages")"
mig us_rb "$ROOT/db/universal_share_v1_rollback.sql" >/dev/null || fail "rollback 1"; mig us_rb "$ROOT/db/universal_share_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback ×2 (idempotent)"
[ "$(q us_rb "$LIVE_FN")" = "$LIVE0" ] && ok "rollback: bms_save/publish/unpublish/dm_share về ĐÚNG md5 LIVE" || fail "rollback không về md5 LIVE"
[ "$(q us_rb "$KEEP_FN")" = "$KEEP0" ] && ok "rollback: hàm nền không đổi" || fail "rollback đổi hàm nền"
[ "$(q us_rb "select count(*) from pg_proc where proname = 'tool_artifact_save_for_share'")" = "0" ] && ok "rollback: gỡ tool_artifact_save_for_share" || fail "còn hàm"
[ "$(q us_rb "select count(*) from public.dm_messages")" = "$MSGS" ] && [ "$(q us_rb "select count(*) from public.tool_artifacts where tool = 'nhipphach'")" = "1" ] && ok "rollback: tin ($MSGS) và artifact nhipphach shared KHÔNG bị xoá" || fail "mất dữ liệu"
[ "$(q us_rb "select pg_get_constraintdef(oid) from pg_constraint where conname = 'dm_messages_ref_valid_check'" | grep -c class_session)" = "1" ] && ok "rollback: còn tin class → GIỮ check rộng (không hỏng dữ liệu)" || fail "check bị thu hẹp khi còn tin class"
q us_rb "delete from public.dm_messages where ref_type in ('class','class_session')" >/dev/null; mig us_rb "$ROOT/db/universal_share_v1_rollback.sql" >/dev/null
[ "$(q us_rb "select pg_get_constraintdef(oid) from pg_constraint where conname = 'dm_messages_ref_valid_check'" | grep -c class_session || true)" = "0" ] && ok "rollback khi hết tin class: check về chỉ tool_artifact" || fail "check không thu hẹp"
[ "$(gate us_rb)" = "PASS" ] && ok "sau rollback: preflight PASS (baseline LIVE)" || fail "preflight sau rollback"
mig us_rb "$ROOT/db/universal_share_v1_setup.sql" >/dev/null && [ "$(postgate us_rb)" = "PASS" ] && ok "cài lại sau rollback: postflight PASS" || fail "cài lại"
echo "ALL UNIVERSAL SHARE DB TESTS PASSED"
