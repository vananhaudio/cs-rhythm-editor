#!/usr/bin/env bash
# Test Share Note V1 (db/share_note_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-share-note-db.sh
# Phủ: cổng tĩnh · khoá · migration ×2 · cổng drift · test theo identity (db/tests/share_note_v1_test.sql) · HỒI QUY dm_share/Chat ·
# đua 12 phiên cùng khoá chống trùng · rollback ×2 về ĐÚNG md5 LIVE (dm_share chord_share_v1) + giữ dữ liệu · cài lại.
# Nền = production giả lập: Social + Learning Thread + Lớp của tôi (class_checkpoints_fixture: class_sessions/class_lesson_content/
# can_read_class_curriculum như production) + Chat V1a/V1b + BMS lifecycle + Universal Share + đoạn dm_share/CHECK của chord_share_v1
# (cả file chord_share_v1 đòi bảng hợp âm thật → chỉ nạp đúng đoạn dm_share + CHECK; chord_share_ok = stub TEST-ONLY).
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvasn.XXXXXX)"
PORT="${PORT:-$((57400 + RANDOM % 90))}"
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
    | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | grep -v 'SET LOCAL' | tee "$TMP/test.out"
  [ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL $2"
  grep -q '^FAIL' "$TMP/test.out" && fail "có FAIL trong $2" || true
}
SETUP="$ROOT/db/share_note_v1_setup.sql"; RB="$ROOT/db/share_note_v1_rollback.sql"
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
python3 - "$ROOT/db/chord_share_v1_setup.sql" > "$TMP/chord_part.sql" <<'PY'
import sys
t = open(sys.argv[1]).read()
c = t[t.index('alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;'):t.index('create or replace function public.chord_share_ok')]
end = 'grant execute on function public.dm_share(uuid, text, text) to authenticated;'
d = t[t.index('create or replace function public.dm_share'):t.index(end) + len(end)]
print(c); print(d)
PY
FIRST=1
baseline() { # db → nền production giả lập ĐẾN chord_share_v1 (LIVE)
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null 2>&1
  done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup \
           social_tool_share_v1_setup social_bms_artifact_v1_setup social_nhipphach_artifact_v1_setup account_avatar_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null 2>&1
  done
  psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture_data.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/rls_setup.sql" >/dev/null
  for f in dm_v1_setup dm_share_v1_setup bms_share_lifecycle_v1_setup universal_share_v1_setup; do mig "$db" "$ROOT/db/$f.sql" >/dev/null; done
  q "$db" "create function public.chord_share_ok(p uuid) returns boolean language sql stable as \$\$ select false \$\$" >/dev/null
  psqld "$db" -f "$TMP/chord_part.sql" >/dev/null
}
LIVE_FN="select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname collate \"C\") from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('dm_share')"
KEEP_FN="select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname collate \"C\") from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('dm_append','dm_messages','dm_open','dm_rule','dm_start','dm_send','dm_conversations','dm_mark_read','dm_unread_count','dm_find','dm_can_message','social_share_tool_result','social_share_chord_sheet','social_publish_tool_artifact','tool_artifacts_cleanup_on_post_delete','is_class_member','is_teacher')"

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$SETUP" "$RB" && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$SETUP" | grep -qiE 'create policy|alter policy|auth\.users|references ' && fail "setup có policy/FK" || ok "setup không đụng policy / FK (không khoá auth.users)"
grep -q "'share_notes'" "$ROOT/db/rls_setup.sql" && ok "rls_setup: share_notes nằm trong self_managed (không bị áp policy rộng)" || fail "rls_setup thiếu share_notes"

echo "── Baseline = LIVE hiện tại (… Universal Share + chord_share_v1)"
baseline sn
LIVE0="$(q sn "$LIVE_FN")"; KEEP0="$(q sn "$KEEP_FN")"
[ "$LIVE0" = "dm_share=202766fca632bc9cf22d092b07f0251b" ] && ok "baseline dm_share = md5 production LIVE 202766fc… (đọc chỉ-đọc 02/11)" || fail "baseline dm_share lệch: $LIVE0"

echo "── Khoá trong migration"
LOCKS="$(psqld sn -tA <<SQL
begin;
\i $SETUP
select coalesce(string_agg(distinct n.nspname || '.' || c.relname, ', ' order by n.nspname || '.' || c.relname), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname not in ('dm_messages', 'share_notes') and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock');
rollback;
SQL
)"
[ -z "$LOCKS" ] && ok "migration chỉ khoá mạnh dm_messages (đổi CHECK) + bảng mới share_notes: không auth.users / class_posts / giáo trình" || fail "khoá ngoài phạm vi: $LOCKS"

echo "── Migration ×2"
mig sn "$SETUP" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig sn "$SETUP" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(q sn "$KEEP_FN")" = "$KEEP0" ] && ok "hàm nền KHÔNG đổi (dm_append/messages/open/rule/start/send…, Feed share, is_class_member, is_teacher)" || fail "hàm nền bị đổi"
[ "$(q sn "select count(*) from pg_policy where polrelid = 'public.share_notes'::regclass")" = "0" ] && ok "share_notes: RLS bật, 0 policy (đóng)" || fail "share_notes có policy"
psqld sn -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q sn "select count(*) from pg_policy where polrelid = 'public.share_notes'::regclass")" = "0" ] && ok "chạy lại rls_setup.sql KHÔNG gắn policy rộng lên share_notes" || fail "rls_setup gắn policy lên share_notes"

echo "── Cổng drift"
baseline sn_d1; q sn_d1 "create or replace function public.dm_share(p_user uuid, p_ref_type text, p_ref_key text) returns table(conversation_id uuid, seq bigint) language sql security definer set search_path = '' as \$\$ select null::uuid, null::bigint \$\$" >/dev/null
mig sn_d1 "$SETUP" >/dev/null 2>"$TMP/d1.err" && fail "migration chạy khi dm_share bị sửa" || { grep -q "khác baseline LIVE" "$TMP/d1.err" && ok "dm_share bị sửa tay → migration DỪNG" || fail "cổng dm_share: $(cat "$TMP/d1.err")"; }
baseline sn_d2; q sn_d2 "alter table public.dm_messages drop constraint dm_messages_ref_valid_check" >/dev/null
mig sn_d2 "$SETUP" >/dev/null 2>"$TMP/d2.err" && fail "migration chạy khi CHECK lệch" || { grep -q "dm_messages_ref_valid_check khác baseline" "$TMP/d2.err" && ok "CHECK tham chiếu lệch → migration DỪNG" || fail "cổng CHECK: $(cat "$TMP/d2.err")"; }

echo "── Test SQL theo identity"
( run_test sn "$ROOT/db/tests/share_note_v1_test.sql" ) > "$TMP/rt.log" 2>&1 || { tail -25 "$TMP/rt.log"; fail "test SQL Share Note"; }
ok "test Share Note: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"
grep '^PASS' "$TMP/test.out" | sed 's/^/   /'

echo "── Đua đồng thời: 12 phiên cùng (tác giả, client_key)"
baseline sn_cc; mig sn_cc "$SETUP" >/dev/null
q sn_cc "update public.class_lesson_content set blocks = blocks || '[{\"kind\":\"score\",\"tex\":\"\\\\ts 4 4\\n:4 c4 c4 c4 c4\"}]'::jsonb where session_id = '51000000-0000-4000-8000-000000000001'" >/dev/null
IDX="$(q sn_cc "select jsonb_array_length(blocks) - 1 from public.class_lesson_content where session_id = '51000000-0000-4000-8000-000000000001'")"
for i in $(seq 1 12); do
  ( PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -tA -h "$TMP" -p "$PORT" -U postgres -d sn_cc -c "begin; select set_config('request.jwt.claims','{\"sub\":\"aaaaaaaa-0000-4000-8000-00000000000a\",\"role\":\"authenticated\"}',true); set local role authenticated; select public.share_note_create('51000000-0000-4000-8000-000000000001', $IDX, array['tex'], 1, 1, 'đua', 'race-key-0001'); commit;" >> "$TMP/race.out" 2>&1 ) &
done; wait
N="$(q sn_cc "select count(*) from public.share_notes where client_key = 'race-key-0001'")"
D="$( (grep -E '^[0-9a-f]{8}-' "$TMP/race.out" || true) | sort -u | wc -l | tr -d ' ')"
[ "$N" = "1" ] && [ "$D" = "1" ] && ok "12 phiên song song → 1 hàng, mọi phiên nhận CÙNG 1 id" || { head -5 "$TMP/race.out"; fail "đua: hàng=$N id khác nhau=$D"; }
NID="$(q sn_cc "select id from public.share_notes where client_key = 'race-key-0001'")"
for i in $(seq 1 8); do
  ( PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -tA -h "$TMP" -p "$PORT" -U postgres -d sn_cc -c "begin; select set_config('request.jwt.claims','{\"sub\":\"aaaaaaaa-0000-4000-8000-00000000000a\",\"role\":\"authenticated\"}',true); set local role authenticated; select public.social_share_share_note('$NID'); commit;" >> "$TMP/race2.out" 2>&1 ) &
done; wait
[ "$(q sn_cc "select count(*) from public.class_posts where tool_share ->> 'note_id' = '$NID'")" = "1" ] && ok "8 phiên đăng Feed song song → đúng 1 bài" || fail "đăng Feed đua: $(q sn_cc "select count(*) from public.class_posts where tool_share ->> 'note_id' = '$NID'")"

echo "── Rollback ×2 (có tin share_note + note → giữ dữ liệu)"
baseline sn_rb; mig sn_rb "$SETUP" >/dev/null
psqld sn_rb -q >/dev/null <<SQL
insert into public.friendships (requester_id, addressee_id, status, responded_at) values ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','accepted',now());
update public.class_lesson_content set blocks = blocks || '[{"kind":"score","tex":"\\\\ts 4 4\\n:4 c4 c4 c4 c4"}]'::jsonb where session_id = '51000000-0000-4000-8000-000000000001';
select jsonb_array_length(blocks) - 1 as idx from public.class_lesson_content where session_id = '51000000-0000-4000-8000-000000000001' \\gset
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}',false);
set role authenticated;
select public.dm_share('bbbbbbbb-0000-4000-8000-00000000000b', 'share_note',
  public.share_note_create('51000000-0000-4000-8000-000000000001', :idx, array['tex'], 1, 1, 'giữ lại', 'rb-key-00001')::text);
SQL
MSGS="$(q sn_rb "select count(*) from public.dm_messages")"; SNAP="$(q sn_rb "select md5(string_agg(c::text, '|' order by session_id)) from public.class_lesson_content c")"
mig sn_rb "$RB" >/dev/null || fail "rollback 1"; mig sn_rb "$RB" >/dev/null || fail "rollback 2"; ok "rollback ×2 (idempotent)"
[ "$(q sn_rb "$LIVE_FN")" = "$LIVE0" ] && ok "rollback: dm_share về ĐÚNG md5 LIVE ($LIVE0)" || fail "rollback không về md5 LIVE: $(q sn_rb "$LIVE_FN")"
[ "$(q sn_rb "$KEEP_FN")" = "$KEEP0" ] && ok "rollback: hàm nền không đổi" || fail "rollback đổi hàm nền"
[ "$(q sn_rb "select count(*) from pg_proc where proname like 'share_note%' or proname = 'social_share_share_note'")" = "0" ] && ok "rollback: gỡ mọi hàm share_note" || fail "còn hàm share_note"
[ "$(q sn_rb "select count(*) from public.dm_messages")" = "$MSGS" ] && [ "$(q sn_rb "select count(*) from public.share_notes")" = "1" ] && ok "rollback: tin Chat ($MSGS) và note KHÔNG bị xoá" || fail "mất dữ liệu"
[ "$(q sn_rb "select md5(string_agg(c::text, '|' order by session_id)) from public.class_lesson_content c")" = "$SNAP" ] && ok "rollback: giáo trình không bị chạm" || fail "giáo trình đổi"
[ "$(q sn_rb "select pg_get_constraintdef(oid) from pg_constraint where conname = 'dm_messages_ref_valid_check'" | grep -c share_note)" = "1" ] && ok "rollback: còn tin share_note → GIỮ CHECK rộng" || fail "CHECK bị thu hẹp khi còn tin share_note"
q sn_rb "delete from public.dm_messages where ref_type = 'share_note'; delete from public.share_notes" >/dev/null; mig sn_rb "$RB" >/dev/null
[ "$(q sn_rb "select pg_get_constraintdef(oid) from pg_constraint where conname = 'dm_messages_ref_valid_check'" | grep -c share_note || true)" = "0" ] && ok "rollback khi hết dữ liệu: CHECK về baseline" || fail "CHECK không thu hẹp"
[ "$(q sn_rb "select coalesce(to_regclass('public.share_notes')::text, 'none')")" = "none" ] && ok "rollback khi bảng rỗng: gỡ share_notes" || fail "bảng rỗng còn"
mig sn_rb "$SETUP" >/dev/null && ok "cài lại sau rollback: migration chạy (cổng nhận baseline LIVE)" || fail "cài lại"
echo "ALL SHARE NOTE DB TESTS PASSED"
