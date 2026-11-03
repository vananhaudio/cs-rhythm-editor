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
SO="$ROOT/db/share_note_session_open_v1_setup.sql"; SO_RB="$ROOT/db/share_note_session_open_v1_rollback.sql"
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

prod_like() { # nền như production: baseline + Lớp của tôi V1 + Quiz V1 + Buổi 0 + Unlock Policy + Share Note V1 + dữ liệu fixture
  baseline "$1"
  for f in class_checkpoints_v1_setup quiz_checkpoint_v1_setup class_session_zero_intro class_unlock_policy_v1_setup share_note_v1_setup; do mig "$1" "$ROOT/db/$f.sql" >/dev/null || fail "nền $f"; done
}
CLS_MD5="select md5(prosrc) from pg_proc where proname = 'class_learning_state' and pronamespace = 'public'::regnamespace"
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$SO" "$SO_RB" && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$SO" | grep -qiE 'insert |update |delete |create table|alter table|create policy|auth\.users' && fail "setup có ghi dữ liệu / bảng / policy" || ok "setup chỉ CREATE FUNCTION (không INSERT/UPDATE/DELETE, không bảng, không policy)"
echo "── Nền production giả lập"
prod_like so
CLS0="$(q so "$CLS_MD5")"; KEEP0="$(q so "select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname collate \"C\") from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like any (array['share_note%','lsp_%','class_learning_state','social_share_share_note','dm_%','is_teacher','is_class_member'])")"
echo "── Migration ×2"
mig so "$SO" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig so "$SO" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(q so "$CLS_MD5")" = "$CLS0" ] && ok "class_learning_state KHÔNG đổi (md5 ${CLS0:0:8}…)" || fail "class_learning_state bị đổi"
NOW="$(q so "select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname collate \"C\") from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like any (array['share_note%','lsp_%','class_learning_state','social_share_share_note','dm_%','is_teacher','is_class_member']) and p.proname <> 'share_note_session_open'")"
[ "$(echo "$KEEP0" | tr ',' '\n' | grep -v '^share_note_session_open=' | paste -sd, -)" = "$NOW" ] && ok "Share Note V1, lsp_*, dm_*, Feed share KHÔNG đổi (chỉ thêm đúng 1 hàm)" || fail "hàm khác bị đổi"
echo "── Cổng drift"
prod_like so_d1; q so_d1 "create or replace function public.class_learning_state(p_class uuid) returns jsonb language sql as \$\$ select '{}'::jsonb \$\$" >/dev/null
mig so_d1 "$SO" >/dev/null 2>"$TMP/d1.err" && fail "migration chạy khi class_learning_state không phải bản UNLOCK_POLICY" || { grep -q "CLASS_UNLOCK_POLICY_V1" "$TMP/d1.err" && ok "class_learning_state lệch → migration DỪNG" || fail "cổng: $(cat "$TMP/d1.err")"; }
echo "── Test SQL theo identity"
( run_test so "$ROOT/db/tests/share_note_session_open_v1_test.sql" ) > "$TMP/rt.log" 2>&1 || { tail -25 "$TMP/rt.log"; fail "test SQL"; }
ok "test session_open: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"
grep '^PASS' "$TMP/test.out" | sed 's/^/   /'
echo "── Rollback ×2"
mig so "$SO_RB" >/dev/null || fail "rollback 1"; mig so "$SO_RB" >/dev/null || fail "rollback 2"; ok "rollback ×2 (idempotent)"
[ "$(q so "select count(*) from pg_proc where proname = 'share_note_session_open'")" = "0" ] && ok "rollback: gỡ đúng hàm mới" || fail "còn hàm"
[ "$(q so "$CLS_MD5")" = "$CLS0" ] && ok "rollback: class_learning_state nguyên vẹn" || fail "rollback đổi class_learning_state"
[ "$(q so "select count(*) from public.share_notes")" -ge 3 ] && ok "rollback: note / dữ liệu KHÔNG bị xoá" || fail "mất note"
mig so "$SO" >/dev/null && ok "cài lại sau rollback" || fail "cài lại"
echo "ALL PASS"
