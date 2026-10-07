#!/usr/bin/env bash
# Test BMS Share Lifecycle V1 (db/bms_share_lifecycle_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-bms-share-lifecycle-db.sh
# Phủ: cổng drift · migration ×2 (một transaction như prod-db) · khoá (không auth.users/storage) · test SQL theo identity (riêng tư/grant qua DM/
# promote/idempotent/gỡ bài) · HỒI QUY test Chat V1a + V1b + md5 hàm chung · đồng thời (save/publish song song → 1 artifact, 1 bài) · rollback ×2.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvabsl.XXXXXX)"
PORT="${PORT:-$((56700 + RANDOM % 90))}"
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
baseline() { # db → nền production giả lập ĐẾN Chat V1b (dm_v1 + dm_share_v1)
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup \
           social_tool_share_v1_setup social_bms_artifact_v1_setup social_nhipphach_artifact_v1_setup account_avatar_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/rls_setup.sql" >/dev/null
  mig "$db" "$ROOT/db/dm_v1_setup.sql" >/dev/null
  mig "$db" "$ROOT/db/dm_share_v1_setup.sql" >/dev/null
}
RPC_MD5=932a8b041487bd5a75d72884485d2c35
POL_BASE="((owner_id = auth.uid()) OR ((visibility = 'class'::text) AND is_class_member()))"
SHAREDFN="select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('social_share_tool_result','social_delete_tool_artifact','dm_share','dm_messages','dm_append','dm_open','dm_rule','dm_start','dm_send','bms_song_normalize')"
PRE="$(cat "$ROOT/db/bms_share_lifecycle_v1_preflight.sql")"; POST="$(cat "$ROOT/db/bms_share_lifecycle_v1_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/bms_share_lifecycle_v1_setup.sql" "$ROOT/db/bms_share_lifecycle_v1_rollback.sql" && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/bms_share_lifecycle_v1_setup.sql" | grep -qi 'create policy\|auth\.users\|references ' && fail "setup có CREATE POLICY/FK" || ok "setup không có CREATE POLICY / FK (dùng ALTER POLICY, không khoá auth.users)"

echo "── Baseline = V1b (production hiện tại)"
baseline lc
[ "$(q lc "select md5(prosrc) from pg_proc where proname = 'social_share_tool_result'")" = "$RPC_MD5" ] && ok "baseline: social_share_tool_result đúng md5 production" || fail "md5 RPC baseline $(q lc "select md5(prosrc) from pg_proc where proname = 'social_share_tool_result'")"
[ "$(q lc "select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.tool_artifacts'::regclass")" = "$POL_BASE" ] && ok "baseline: policy tool_artifacts_read đúng như production" || fail "policy baseline khác production"
[ "$(gate lc)" = "PASS" ] && ok "preflight trên baseline: GATE = PASS" || { psqld lc -c "${PRE%;}"; fail "preflight baseline"; }
SH0="$(q lc "$SHAREDFN")"

echo "── Khoá trong migration"
LOCKS="$(psqld lc -tA <<SQL
begin;
\i $ROOT/db/bms_share_lifecycle_v1_setup.sql
select coalesce(string_agg(distinct n.nspname || '.' || c.relname, ', ' order by n.nspname || '.' || c.relname), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname not in ('tool_artifacts', 'class_posts', 'dm_messages') and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock', 'RowExclusiveLock');
rollback;
SQL
)"
[ -z "$LOCKS" ] && ok "migration chỉ khoá tool_artifacts/class_posts/dm_messages (không auth.users, storage, realtime)" || fail "khoá ngoài phạm vi: $LOCKS"

echo "── Migration ×2"
mig lc "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig lc "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(q lc "select md5(prosrc) from pg_proc where proname = 'social_share_tool_result'")" = "$RPC_MD5" ] && ok "social_share_tool_result KHÔNG đổi (md5)" || fail "RPC chung bị đổi"
SH1="$(q lc "$SHAREDFN")"; [ "$SH0" = "$SH1" ] && ok "social_share_tool_result/delete/dm_share/dm_messages/dm_append/dm_open/dm_rule/dm_start/dm_send/bms_song_normalize KHÔNG đổi" || fail "hàm chung bị đổi"
[ "$(postgate lc)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld lc -c "${POST%;}"; fail "postflight"; }
[ "$(gate lc)" = "PASS" ] && ok "preflight sau migration vẫn PASS (chạy lại an toàn)" || fail "preflight sau migration"
[ "$(q lc "select count(*) from pg_policy where polrelid = 'public.tool_artifacts'::regclass")" = "1" ] && ok "tool_artifacts vẫn đúng 1 policy" || fail "số policy đổi"

echo "── Cổng drift"
baseline lc_d1; q lc_d1 "alter policy tool_artifacts_read on public.tool_artifacts using (true)" >/dev/null
mig lc_d1 "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null 2>"$TMP/d1.err" && fail "migration chạy khi policy bị sửa tay" || { grep -q "policy tool_artifacts_read khác baseline" "$TMP/d1.err" && ok "policy bị sửa tay → migration DỪNG" || fail "cổng policy: $(cat "$TMP/d1.err")"; }
[ "$(gate lc_d1)" = "FAIL" ] && ok "preflight FAIL khi policy lệch" || fail "preflight không bắt drift policy"
baseline lc_d2; q lc_d2 "create or replace function public.dm_rule(p_a uuid, p_b uuid) returns boolean language sql security definer set search_path = '' as \$\$ select true \$\$" >/dev/null
mig lc_d2 "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null 2>"$TMP/d2.err" && fail "migration chạy khi dm_rule bị sửa" || { grep -q "khác baseline" "$TMP/d2.err" && ok "dm_rule bị sửa tay → migration DỪNG" || fail "cổng dm_rule: $(cat "$TMP/d2.err")"; }
baseline lc_d3; q lc_d3 "create or replace function public.social_share_tool_result(p_tool text, p_result jsonb, p_client_key uuid) returns uuid language sql security definer set search_path = '' as \$\$ select null::uuid \$\$" >/dev/null
mig lc_d3 "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null 2>"$TMP/d3.err" && fail "migration chạy khi RPC chung bị sửa" || { grep -q "social_share_tool_result khác baseline" "$TMP/d3.err" && ok "RPC chung bị sửa → migration DỪNG" || fail "cổng RPC: $(cat "$TMP/d3.err")"; }

echo "── Test SQL theo identity"
run_test lc "$ROOT/db/tests/bms_share_lifecycle_v1_test.sql"
ok "test lifecycle: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"

echo "── HỒI QUY: test Chat V1b + V1a chạy trên DB đã có lifecycle"
baseline lc_r1; mig lc_r1 "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null
run_test lc_r1 "$ROOT/db/tests/dm_share_v1_test.sql"; ok "hồi quy V1b: $(grep -c '^PASS' "$TMP/test.out") PASS"
baseline lc_r2; mig lc_r2 "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null
run_test lc_r2 "$ROOT/db/tests/dm_v1_test.sql"; ok "hồi quy V1a: $(grep -c '^PASS' "$TMP/test.out") PASS"

echo "── HỒI QUY: BMS Artifact + Nhịp & Phách (test SQL cũ, gồm RPC Tool Share dùng chung) chạy trên DB đã có lifecycle"
for t in social_bms_artifact_v1_test social_nhipphach_artifact_v1_test; do   # (social_tool_share_v1_test chỉ đúng trước khi có BMS — gốc chạy ở bước t_ts của test-learning-threads-db.sh)
  baseline lc_r3; mig lc_r3 "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null
  run_test lc_r3 "$ROOT/db/tests/$t.sql"; ok "hồi quy $t: $(grep -c '^PASS' "$TMP/test.out") PASS"
  "$PGBIN/dropdb" -h "$TMP" -p "$PORT" -U postgres lc_r3
done
echo "── Đồng thời: hai phiên song song save/publish cùng một bài"
baseline lc_cc; mig lc_cc "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null
SONG="\$j\${\"title\":\"Song song\",\"video_id\":\"dQw4w9WgXcQ\",\"lyrics\":\"la la la\",\"fit\":{\"bpm\":90,\"beat_duration\":0.6667,\"grid_offset\":0.5},\"time_signature\":4,\"downbeat_position\":1,\"group_beats\":true,\"anchors\":[{\"word_index\":0,\"beat_index\":0}],\"chords\":[{\"word_index\":0,\"name\":\"C\"}]}\$j\$"
worker() { psqld lc_cc -q <<SQL
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
do \$\$ declare i int; a uuid; begin
  for i in 1..15 loop
    a := public.bms_save_for_share($SONG::jsonb);
    if i % 3 = 0 then perform public.social_publish_tool_artifact(a); end if;
  end loop; end \$\$;
SQL
}
worker & W1=$!; worker & W2=$!; worker & W3=$!
wait $W1 && wait $W2 && wait $W3 || fail "phiên song song lỗi"
[ "$(q lc_cc "select count(*) from public.tool_artifacts where data ->> 'title' = 'Song song'")" = "1" ] && ok "3 phiên × 15 lần save → ĐÚNG 1 artifact" || fail "nhân bản artifact: $(q lc_cc "select count(*) from public.tool_artifacts where data ->> 'title' = 'Song song'")"
[ "$(q lc_cc "select count(*) from public.class_posts where tool_share ->> 'tool' = 'bms'")/$(q lc_cc "select visibility from public.tool_artifacts where data ->> 'title' = 'Song song'")" = "1/class" ] && ok "3 phiên × 5 lần publish song song → ĐÚNG 1 bài Feed, artifact đã promote (class)" || fail "nhân bản bài Feed"

echo "── Đồng thời: đăng / gỡ khỏi cộng đồng đua nhau (không trạng thái nửa vời)"
q lc_cc "insert into public.friendships (requester_id, addressee_id, status, responded_at) values ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','accepted',now()) on conflict do nothing" >/dev/null
song_json() { echo "\$j\${\"title\":\"$1\",\"video_id\":\"dQw4w9WgXcQ\",\"lyrics\":\"la la la\",\"fit\":{\"bpm\":90,\"beat_duration\":0.6667,\"grid_offset\":0.5},\"time_signature\":4,\"downbeat_position\":1,\"group_beats\":true,\"anchors\":[{\"word_index\":0,\"beat_index\":0}],\"chords\":[{\"word_index\":0,\"name\":\"C\"}]}\$j\$"; }
SONGD="$(song_json 'Race DM')"; SONGN="$(song_json 'Race NoDM')"
psqld lc_cc -q >/dev/null <<SQL
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
do \$\$ declare a uuid; begin a := public.bms_save_for_share($SONGD::jsonb); perform public.social_publish_tool_artifact(a); perform public.dm_share('bbbbbbbb-0000-4000-8000-00000000000b','tool_artifact',a::text); end \$\$;
SQL
race() { psqld lc_cc -q >/dev/null <<SQL
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
do \$\$ declare i int; a uuid; begin
  for i in 1..25 loop
    begin
      a := public.bms_save_for_share($1::jsonb);
      if random() < 0.5 then perform public.social_publish_tool_artifact(a); else perform public.social_unpublish_tool_artifact(a); end if;
    exception when others then null;
    end;
  end loop; end \$\$;
SQL
}
race "$SONGD" & R1=$!; race "$SONGD" & R2=$!; race "$SONGD" & R3=$!
wait $R1 && wait $R2 && wait $R3 || fail "phiên đua lỗi"
INV="$(q lc_cc "select (select count(*) from public.tool_artifacts where title = 'Race DM') || '/' || (select visibility from public.tool_artifacts where title = 'Race DM') || '/' || (select count(*) from public.class_posts where tool_share ->> 'title' = 'Race DM')")"
case "$INV" in "1/class/1"|"1/shared/0") ok "artifact ĐÃ gửi DM sau 75 thao tác đăng/gỡ đua nhau: giữ đúng 1 artifact, trạng thái nhất quán ($INV = artifact/visibility/số bài Feed)";; *) fail "trạng thái nửa vời (DM): $INV";; esac
[ "$(q lc_cc "select count(*) from public.dm_messages where ref_type is not null")" -ge "1" ] && ok "tin DM không bị ảnh hưởng bởi đua đăng/gỡ" || fail "mất tin DM"
race "$SONGN" & R1=$!; race "$SONGN" & R2=$!; race "$SONGN" & R3=$!
wait $R1 && wait $R2 && wait $R3 || fail "phiên đua lỗi (không DM)"
NA="$(q lc_cc "select count(*) from public.tool_artifacts where title = 'Race NoDM'")"; NP="$(q lc_cc "select count(*) from public.class_posts where tool_share ->> 'title' = 'Race NoDM'")"; NV="$(q lc_cc "select coalesce(max(visibility), '-') from public.tool_artifacts where title = 'Race NoDM'")"
case "$NA/$NV/$NP" in "1/class/1"|"1/shared/0"|"0/-/0") ok "artifact CHƯA gửi DM sau 75 thao tác đua nhau: nhất quán ($NA/$NV/$NP), không mồ côi, không trùng bài Feed";; *) fail "trạng thái nửa vời (không DM): $NA/$NV/$NP";; esac

echo "── Rollback ×2 (có artifact shared → giữ check, KHÔNG mất dữ liệu)"
baseline lc_rb; mig lc_rb "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null
psqld lc_rb -q <<SQL
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
select public.bms_save_for_share($SONG::jsonb);
SQL
mig lc_rb "$ROOT/db/bms_share_lifecycle_v1_rollback.sql" >/dev/null || fail "rollback 1"; mig lc_rb "$ROOT/db/bms_share_lifecycle_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback ×2 (idempotent)"
[ "$(q lc_rb "select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.tool_artifacts'::regclass")" = "$POL_BASE" ] && ok "rollback: policy về ĐÚNG như production" || fail "policy rollback"
[ "$(q lc_rb "select count(*) from pg_proc where proname in ('bms_save_for_share','social_publish_tool_artifact','social_unpublish_tool_artifact','tool_artifact_demote_or_delete','dm_artifact_granted')")" = "0" ] && ok "rollback: gỡ 5 hàm lifecycle" || fail "còn hàm"
[ "$(q lc_rb "select md5(prosrc) from pg_proc where proname = 'tool_artifacts_cleanup_on_post_delete'")" = "084462af8e4a71394dafe2b6b5b0b2ad" ] && [ "$(q lc_rb "select md5(prosrc) from pg_proc where proname = 'social_delete_tool_artifact'")" = "cbcac72830a72003d414863d1aee8806" ] && ok "rollback: trigger xoá-bài-Feed về ĐÚNG nguyên văn baseline (md5 production)" || fail "trigger không về baseline"
[ "$(q lc_rb "select count(*) from public.tool_artifacts where visibility = 'shared'")" = "1" ] && ok "rollback: artifact shared KHÔNG bị xoá (chỉ chủ bài đọc được)" || fail "mất artifact"
[ "$(q lc_rb "select pg_get_constraintdef(oid) from pg_constraint where conname = 'tool_artifacts_visibility_check'")" = "CHECK ((visibility = ANY (ARRAY['class'::text, 'shared'::text])))" ] && ok "rollback: còn dữ liệu shared → giữ check nhận 'shared'" || fail "check rollback: $(q lc_rb "select pg_get_constraintdef(oid) from pg_constraint where conname = 'tool_artifacts_visibility_check'")"
q lc_rb "delete from public.tool_artifacts where visibility = 'shared'" >/dev/null; mig lc_rb "$ROOT/db/bms_share_lifecycle_v1_rollback.sql" >/dev/null
[ "$(q lc_rb "select pg_get_constraintdef(oid) from pg_constraint where conname = 'tool_artifacts_visibility_check'")" = "CHECK ((visibility = 'class'::text))" ] && ok "rollback khi không còn shared: check về đúng 'class'" || fail "check không về baseline"
[ "$(gate lc_rb)" = "PASS" ] && ok "sau rollback: preflight PASS (baseline)" || fail "preflight sau rollback"
mig lc_rb "$ROOT/db/bms_share_lifecycle_v1_setup.sql" >/dev/null && ok "cài lại sau rollback" || fail "cài lại"
[ "$(postgate lc_rb)" = "PASS" ] && ok "postflight sau cài lại: PASS" || fail "postflight cài lại"
echo "ALL BMS SHARE LIFECYCLE DB TESTS PASSED"
