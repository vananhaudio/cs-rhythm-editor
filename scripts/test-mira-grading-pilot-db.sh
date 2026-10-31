#!/usr/bin/env bash
# Test Mira grading PILOT (V1.1) ở tầng DB trên cluster PostgreSQL 17 TẠM. KHÔNG kết nối production.
#   bash scripts/test-mira-grading-pilot-db.sh
# Phủ: hằng md5 V1 trong preflight = thân hàm V1 thật · cổng bản lạ · migration ×2 · postflight · quyền (Owner/teacher khác/học viên/anon)
# · gỡ pilot vô hiệu vé ngay · khoá DDL (pg_locks, có đối chứng dương) · rollback ×2 trả đúng thân V1 và giữ bảng vé/khoá · tương thích V1.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvamp.XXXXXX)"
PORT="${PORT:-$((57000 + RANDOM % 400))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
baseline() {   # $1 = tên db; dựng nền Class + Student 360 + V1 (giống production trước pilot)
  local db=$1; "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0; else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null; done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null; done
  psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture_data.sql" >/dev/null
  psqld "$db" -c "begin;" -f "$ROOT/db/class_checkpoints_v1_setup.sql" -c "commit;" >/dev/null
  psqld "$db" -c "begin;" -f "$ROOT/db/social_learning_identity_v1_setup.sql" -c "commit;" >/dev/null
  psqld "$db" -1 -f "$ROOT/db/student_360_p1_setup.sql" >/dev/null
  psqld "$db" -1 -f "$ROOT/db/mira_grading_v1_setup.sql" >/dev/null
}
sect() { sed 's/;[[:space:]]*$//' "$ROOT/db/$2.sql" > "$TMP/gate.sql"; q "$1" "select item from ($(cat "$TMP/gate.sql")) z where section = '$3'"; }
gate() { sect "$1" "$2" GATE; }

echo "── Nền V1 + hằng md5"
baseline mgp
V1T="$(q mgp "select md5(prosrc) from pg_proc where proname = 'mira_grading_ticket'")"; V1C="$(q mgp "select md5(prosrc) from pg_proc where proname = 'mira_grading_context'")"
grep -q "$V1T" "$ROOT/db/mira_grading_pilot_v1_preflight.sql" && grep -q "$V1C" "$ROOT/db/mira_grading_pilot_v1_preflight.sql" && ok "hằng md5 trong preflight = thân V1 thật (ticket $V1T, context $V1C)" || fail "hằng md5 preflight lệch thân V1 thật"
grep -q "$V1T" "$ROOT/db/mira_grading_pilot_v1_setup.sql" && grep -q "$V1C" "$ROOT/db/mira_grading_pilot_v1_setup.sql" && ok "hằng md5 trong migration = thân V1 thật" || fail "hằng md5 migration lệch"
[ "$(gate mgp mira_grading_pilot_v1_preflight)" = "PASS" ] && ok "preflight pilot trên nền V1: GATE = PASS" || fail "preflight: $(gate mgp mira_grading_pilot_v1_preflight)"

echo "── Cổng bản lạ: thân hàm V1 bị sửa tay → migration phải DỪNG, không để lại gì"
baseline mgbad
psqld mgbad -c "create or replace function public.mira_grading_end(p_thread uuid) returns integer language sql as 'select 1'" >/dev/null
BODY="$(q mgbad "select pg_get_functiondef(oid) from pg_proc where proname = 'mira_grading_ticket'" | sed "s/'forbidden'/'forbidden_tamper'/")"
psqld mgbad -c "$BODY" >/dev/null
if psqld mgbad -1 -f "$ROOT/db/mira_grading_pilot_v1_setup.sql" >/dev/null 2>"$TMP/bad.err"; then fail "migration chạy dù thân hàm lạ"; fi
grep -q "khác bản V1 đã nghiệm thu" "$TMP/bad.err" && ok "bản lạ → migration dừng với thông báo rõ" || fail "sai thông báo: $(cat "$TMP/bad.err")"
[ "$(q mgbad "select count(*) from pg_class where relname = 'mira_grading_pilot'")" = "0" ] && ok "dừng sạch: chưa tạo bảng pilot" || fail "để lại bảng pilot"
[ "$(gate mgbad mira_grading_pilot_v1_preflight)" = "STOP" ] && ok "preflight cũng báo STOP trên bản lạ" || fail "preflight không chặn bản lạ"

echo "── Migration ×2, postflight, khoá DDL"
{ echo "begin;"; cat "$ROOT/db/mira_grading_pilot_v1_setup.sql"; echo "select 'LOCKS=' || count(*) from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
        where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname in ('public', 'auth') and c.relname not like 'mira\\_grading\\_%'
          and l.mode not in ('AccessShareLock', 'RowShareLock') and c.relkind in ('r', 'v', 'm');"; echo "rollback;"; } > "$TMP/lock.sql"
LOCKS="$(psqld mgp -tA -f "$TMP/lock.sql" | grep '^LOCKS=')"; [ "$LOCKS" = "LOCKS=0" ] && ok "migration pilot không giữ khoá ghi lên bảng Class nào ($LOCKS)" || fail "khoá: $LOCKS"
sed 's/^begin;$/begin; lock table public.learning_threads in share row exclusive mode;/' "$TMP/lock.sql" > "$TMP/lock_pos.sql"
POS="$(psqld mgp -tA -f "$TMP/lock_pos.sql" | grep '^LOCKS=')"; [ "$POS" != "LOCKS=0" ] && ok "đối chứng dương: thăm dò phát hiện khoá khi có ($POS)" || fail "thăm dò khoá mù"
[ "$(gate mgp mira_grading_pilot_v1_preflight)" = "PASS" ] && ok "thăm dò khoá đã rollback sạch" || fail "thăm dò để lại dấu"
BEFORE_OTHERS="$(q mgp "select md5(string_agg(proname || prosrc, '' order by proname)) from pg_proc where proname in ('is_teacher','class_public_identity','lt_detail') or proname like 'student\_360\_%' or proname = 'mira_grading_end'")"
psqld mgp -1 -f "$ROOT/db/mira_grading_pilot_v1_setup.sql" >/dev/null && ok "migration pilot lần 1"
psqld mgp -1 -f "$ROOT/db/mira_grading_pilot_v1_setup.sql" >/dev/null && ok "migration pilot lần 2 (idempotent)"
[ "$(gate mgp mira_grading_pilot_v1_preflight)" = "STOP" ] && ok "preflight sau migration: STOP (chặn chạy lại nhầm)" || fail "preflight sau migration"
[ "$(gate mgp mira_grading_pilot_v1_postflight)" = "PASS" ] && ok "postflight pilot: GATE = PASS (quyền, RLS, thân hàm = bản nghiệm thu)" || { sect mgp mira_grading_pilot_v1_postflight CHECK; fail "postflight"; }
[ "$(sect mgp mira_grading_pilot_v1_postflight PILOT)" = "0 tài khoản trong danh sách pilot" ] && ok "pilot rỗng sau migration: không ai được thêm sẵn" || fail "pilot không rỗng"
[ "$(q mgp "select md5(string_agg(proname || prosrc, '' order by proname)) from pg_proc where proname in ('is_teacher','class_public_identity','lt_detail') or proname like 'student\_360\_%' or proname = 'mira_grading_end'")" = "$BEFORE_OTHERS" ] && ok "không đổi thân hàm Class nào (is_teacher, class_public_identity, lt_detail, student_360_*) và mira_grading_end" || fail "đổi hàm khác"
psqld mgp -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "chạy lại rls_setup.sql"
[ "$(q mgp "select count(*) from pg_policies where tablename like 'mira\_grading\_%'")" = "0" ] && [ "$(q mgp "select count(*) from information_schema.role_table_grants where table_name like 'mira\_grading\_%' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "sau rls_setup: 3 bảng mira_grading_* vẫn không policy, không quyền cho client" || fail "rls_setup mở quyền"

echo "── Test SQL (Owner/teacher khác/học viên/anon/vé giả/quyền bảng)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d mgp -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/mira_grading_pilot_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | grep -E "^(PASS|FAIL|XONG|ERROR|CONTEXT)|^[A-Za-z_]+:" | sed 's/^XONG.*/&/'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL pilot"

echo "── Tương thích: toàn bộ test V1 vẫn đạt trên DB đã có pilot (khi T nằm trong pilot)"
baseline mgc
psqld mgc -1 -f "$ROOT/db/mira_grading_pilot_v1_setup.sql" >/dev/null
psqld mgc -c "insert into public.mira_grading_pilot (user_id, note) values ('dddddddd-0000-4000-8000-00000000000d', 'tương thích V1')" >/dev/null
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d mgc -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/mira_grading_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' > "$TMP/v1compat.out"
[ "${PIPESTATUS[0]}" = "0" ] || { tail -5 "$TMP/v1compat.out"; fail "test V1 vỡ trên DB có pilot"; }
N="$(grep -c '^PASS' "$TMP/v1compat.out")"; ok "test V1 trên DB đã có pilot: $N kiểm tra đạt (hành vi V1 giữ nguyên cho tài khoản trong pilot)"

echo "── Rollback pilot ×2: trả đúng thân V1, giữ nguyên bảng vé/khoá"
psqld mgp -c "insert into public.mira_grading_pilot (user_id) values ('dddddddd-0000-4000-8000-00000000000d') on conflict do nothing; insert into public.mira_grading_tickets (ticket_hash, teacher_id, thread_id, expires_at) values (repeat('a',64), 'dddddddd-0000-4000-8000-00000000000d', gen_random_uuid(), now() + interval '5 minutes') on conflict do nothing" >/dev/null
KEYS_BEFORE="$(q mgp "select count(*) from public.mira_grading_keys")"; TK_BEFORE="$(q mgp "select count(*) from public.mira_grading_tickets")"
psqld mgp -1 -f "$ROOT/db/mira_grading_pilot_v1_rollback.sql" >/dev/null && ok "rollback pilot lần 1"
psqld mgp -1 -f "$ROOT/db/mira_grading_pilot_v1_rollback.sql" >/dev/null && ok "rollback pilot lần 2 (idempotent)"
[ "$(q mgp "select md5(prosrc) from pg_proc where proname = 'mira_grading_ticket'")" = "$V1T" ] && [ "$(q mgp "select md5(prosrc) from pg_proc where proname = 'mira_grading_context'")" = "$V1C" ] && ok "sau rollback: thân ticket/context = đúng bản V1 (md5 khớp)" || fail "rollback không trả đúng thân V1"
[ "$(q mgp "select (to_regclass('public.mira_grading_pilot') is null)::text || (to_regprocedure('public.mira_grading_pilot_enabled()') is null)::text")" = "truetrue" ] && ok "bảng và hàm pilot đã gỡ" || fail "còn sót pilot"
[ "$(q mgp "select count(*) from public.mira_grading_keys")" = "$KEYS_BEFORE" ] && [ "$(q mgp "select count(*) from public.mira_grading_tickets")" = "$TK_BEFORE" ] && ok "bảng khoá ($KEYS_BEFORE) và vé ($TK_BEFORE) còn nguyên dữ liệu" || fail "rollback làm mất dữ liệu V1"
[ "$(gate mgp mira_grading_pilot_v1_preflight)" = "PASS" ] && ok "sau rollback: preflight pilot PASS lại (về đúng trạng thái V1)" || fail "preflight sau rollback"
[ "$(q mgp "select (has_function_privilege('authenticated','public.mira_grading_ticket(uuid)','execute') and not has_function_privilege('anon','public.mira_grading_ticket(uuid)','execute') and has_function_privilege('anon','public.mira_grading_context(text,text)','execute'))::text")" = "true" ] && ok "quyền EXECUTE của ticket/context sau rollback = như V1" || fail "ACL sai sau rollback"
psqld mgp -1 -f "$ROOT/db/mira_grading_pilot_v1_setup.sql" >/dev/null && ok "cài lại pilot sau rollback"
[ "$(gate mgp mira_grading_pilot_v1_postflight)" = "PASS" ] && ok "postflight PASS sau cài lại" || fail "postflight sau cài lại"
echo "XONG: Mira grading PILOT DB — mọi kiểm tra đạt"
