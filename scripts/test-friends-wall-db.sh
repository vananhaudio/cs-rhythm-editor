#!/usr/bin/env bash
# Test Bạn bè + Tường ở tầng DB và Data API trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew), postgrest (tuỳ chọn — bỏ qua phần API nếu thiếu), node.
#   bash scripts/test-friends-wall-db.sh
# Phủ: preflight (GATE), generator khôi phục edu_students, migration ×2, test SQL + API, rollback tính năng ×2
# + cài lại, áp script khôi phục, và 3 DB phụ: lỗi giữa migration / production lệch repo / thiếu trigger guard.
set -euo pipefail
export LC_ALL=C LANG=C   # postmaster macOS cần locale hợp lệ ("became multithreaded during startup")

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvafw.XXXXXX)"   # đường dẫn ngắn: Unix socket giới hạn ~104 ký tự
PORT="${PORT:-$((54000 + RANDOM % 1000))}"
API_PORT=$((PORT + 1000))
PGRST_PID=""

cleanup() {
  [ -n "$PGRST_PID" ] && kill "$PGRST_PID" 2>/dev/null || true
  "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=127.0.0.1" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

# Baseline giả lập production: fixture (role chỉ tạo MỘT lần — role là cấp cluster) + trigger guard + Social hiện có
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
baseline() {
  local db=$1 fixture=$2
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  psqld "$db" -f "$fixture" >/dev/null
  for f in package_student_identity_guard community_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
}
PREFLIGHT_SQL="$(cat "$ROOT/db/class_social_friends_wall_preflight.sql")"
gate() { q "$1" "select item from (${PREFLIGHT_SQL%;}) z where section = 'GATE'"; }
edu_fp() { q "$1" "select md5(coalesce((select string_agg(policyname||cmd||array_to_string(roles,',')||coalesce(qual,'')||coalesce(with_check,''), '|' order by policyname) from pg_policies where tablename='edu_students'),'')
                    ||coalesce((select string_agg(grantee||privilege_type, ',' order by grantee, privilege_type) from information_schema.role_table_grants where table_name='edu_students' and grantee in ('anon','authenticated')),'')
                    ||(select relrowsecurity::text from pg_class where oid='public.edu_students'::regclass))"; }
state() { q "$1" "select (to_regclass('public.friendships') is not null)::text || '/' ||
                   (select count(*) from information_schema.columns where table_name='class_posts' and column_name='audience') || '/' ||
                   (select md5(prosrc) from pg_proc where proname='class_feed') || '/' ||
                   (select count(*) from pg_proc where proname='get_user_wall')"; }

echo "── Baseline (giả lập production) + preflight + generator khôi phục edu_students"
baseline tva_test "$ROOT/db/tests/local/social_fixture.sql"
[ "$(gate tva_test)" = "PASS" ] && ok "preflight trên baseline: GATE = PASS" || fail "preflight baseline: $(gate tva_test)"
# Copy từ trình duyệt/khung chat có thể làm MẤT dấu xuống dòng → file phải chạy y hệt khi dồn thành một dòng
PREFLIGHT_ONELINE="$(tr '\n' ' ' < "$ROOT/db/class_social_friends_wall_preflight.sql")"
[ "$(q tva_test "select item from (${PREFLIGHT_ONELINE%;*}) z where section = 'GATE'")" = "PASS" ] \
  && ok "preflight dồn thành MỘT dòng (mất xuống dòng khi copy) vẫn chạy: GATE = PASS" || fail "preflight một dòng"
RECOVERY_ONELINE="$(tr '\n' ' ' < "$ROOT/db/class_social_friends_wall_edu_students_recovery.sql")"
[ "$(q tva_test "$RECOVERY_ONELINE" | sed 1d)" = "$(q tva_test "$(cat "$ROOT/db/class_social_friends_wall_edu_students_recovery.sql")" | sed 1d)" ] \
  && ok "generator khôi phục dồn thành MỘT dòng vẫn sinh đúng cùng script" || fail "generator một dòng"
q tva_test "$(cat "$ROOT/db/class_social_friends_wall_edu_students_recovery.sql")" > "$TMP/recovery.sql"
EDU_BEFORE="$(edu_fp tva_test)"
grep -q "create policy rls_authenticated_all" "$TMP/recovery.sql" && ok "generator chụp đúng policy edu_students đang có (không đoán)" || fail "generator"

echo "── Migration lần 1 + lần 2 (idempotent) + chạy lại rls_setup.sql"
psqld tva_test -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null && ok "migration lần 1"
psqld tva_test -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null && ok "migration lần 2 (idempotent, cổng drift nhận bản SAU)"
[ "$(gate tva_test)" = "PASS" ] && ok "preflight sau migration: GATE = PASS" || fail "preflight sau migration"
psqld tva_test -f "$ROOT/db/rls_setup.sql" >/dev/null
EDU_AFTER="$(edu_fp tva_test)"

echo "── Test SQL (RLS/GRANT/RPC theo từng identity)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_test -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_social_friends_wall_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "$(edu_fp tva_test)" = "$EDU_AFTER" ] && ok "rls_setup.sql chạy lại KHÔNG mở lại policy rộng edu_students" || fail "rls_setup đổi edu_students"

if ! command -v postgrest >/dev/null; then
  echo "(bỏ qua test Data API: không có postgrest)"
else
  echo "── Test Data API (PostgREST + JWT thật)"
  SECRET="local-test-secret-local-test-secret-000000"
  cat > "$TMP/pgrst.conf" <<EOF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:$PORT/tva_test"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $API_PORT
server-host = "127.0.0.1"
EOF
  postgrest "$TMP/pgrst.conf" >"$TMP/pgrst.log" 2>&1 &
  PGRST_PID=$!
  API="http://127.0.0.1:$API_PORT" SECRET="$SECRET" node "$ROOT/scripts/test-friends-wall-api.mjs"
  kill "$PGRST_PID" 2>/dev/null || true; PGRST_PID=""
fi

echo "── Rollback tính năng ×2 (idempotent) → edu_students giữ nguyên → cài lại"
psqld tva_test -f "$ROOT/db/class_social_friends_wall_rollback.sql" >/dev/null && ok "rollback lần 1"
psqld tva_test -f "$ROOT/db/class_social_friends_wall_rollback.sql" >/dev/null && ok "rollback lần 2 (idempotent)"
[ "$(q tva_test "select count(*) from public.class_posts where type='status'")" = "0" ] && [ "$(state tva_test | cut -d/ -f1,2,4)" = "false/0/0" ] \
  && ok "rollback gỡ friendships + cột audience + RPC + bài tường; Trả bài còn $(q tva_test "select count(*) from public.class_posts")" || fail "rollback: $(state tva_test)"
[ "$(edu_fp tva_test)" = "$EDU_AFTER" ] && ok "rollback tính năng KHÔNG mở lại quyền edu_students" || fail "rollback đổi edu_students"
[ "$(gate tva_test)" = "PASS" ] && ok "preflight sau rollback: GATE = PASS (hàm trở về đúng bản repo)" || fail "preflight sau rollback: $(gate tva_test)"
psqld tva_test -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null && ok "cài lại sau rollback"

echo "── Script khôi phục edu_students (sinh từ generator) trả về ĐÚNG trạng thái trước migration"
psqld tva_test -f "$TMP/recovery.sql" >/dev/null
[ "$(edu_fp tva_test)" = "$EDU_BEFORE" ] && ok "khôi phục edu_students: policy + grant + RLS khớp ảnh chụp TRƯỚC migration" || fail "recovery lệch"

echo "── Giao dịch: lỗi GIỮA migration (sau khi đã tạo friendships + cột audience) → không còn gì nửa chừng"
baseline t_fail "$TMP/fixture_noroles.sql"
BEFORE_STATE="$(state t_fail)"; BEFORE_EDU="$(edu_fp t_fail)"
awk '{print} /^-- ── 4\) Feed Cộng đồng/ && !done {print "select 1/0; -- LỖI CỐ Ý"; done=1}' "$ROOT/db/class_social_friends_wall_setup.sql" > "$TMP/broken.sql"
grep -q "LỖI CỐ Ý" "$TMP/broken.sql" || fail "không chèn được lỗi"
psqld t_fail -f "$TMP/broken.sql" >/dev/null 2>"$TMP/broken.err" && fail "migration lỗi mà không báo"
grep -q "division by zero" "$TMP/broken.err" || fail "lỗi không đúng: $(cat "$TMP/broken.err")"
[ "$(state t_fail)" = "$BEFORE_STATE" ] && [ "$(edu_fp t_fail)" = "$BEFORE_EDU" ] \
  && ok "lỗi giữa chừng (psql -f thường, không -1): friendships/audience/hàm/policy edu_students y như trước" || fail "nửa migration: $(state t_fail)"
psqld t_fail -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null && ok "chạy lại bản đúng sau lỗi: PASS"

echo "── Cổng drift: production khác repo → preflight STOP + migration tự từ chối, không đổi gì"
baseline t_drift "$TMP/fixture_noroles.sql"
psqld t_drift -c "create or replace function public.class_feed(p_before timestamptz default null, p_before_id uuid default null, p_limit int default 20)
  returns table(id uuid, type text, body text, media_type text, media_provider text, media_url text, external_media_id text, created_at timestamptz, updated_at timestamptz,
                author_user_id uuid, author_name text, author_avatar_url text, author_role text, author_ht_member boolean, is_mine boolean, is_hidden boolean, comment_count int)
  language sql security definer set search_path = '' stable as \$\$ select null::uuid, ''::text, ''::text, null, null, null, null, now(), now(), null::uuid, '', null, '', false, false, false, 0 where false \$\$;" >/dev/null
psqld t_drift -c "create policy sua_tay on public.edu_students for select to authenticated using (true);" >/dev/null
DRIFT_STATE="$(state t_drift)"
[ "$(gate t_drift)" = "STOP - DO NOT MIGRATE" ] && ok "preflight phát hiện hàm + policy sửa tay: GATE = STOP" || fail "preflight drift: $(gate t_drift)"
psqld t_drift -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null 2>"$TMP/drift.err" && fail "migration chạy dù production lệch"
grep -q "DỪNG — production khác repo" "$TMP/drift.err" && [ "$(state t_drift)" = "$DRIFT_STATE" ] \
  && ok "migration tự DỪNG ($(grep -o 'hàm class_feed[^;]*\|policy bảng edu_students[^;]*' "$TMP/drift.err" | head -2 | tr '\n' ' ')) — không ghi đè gì" || fail "gate: $(cat "$TMP/drift.err")"

echo "── Thiếu trigger guard edu_students → migration DỪNG (policy INSERT chính chủ cần trigger)"
baseline t_trig "$TMP/fixture_noroles.sql"
psqld t_trig -c "drop trigger student_package_identity_guard on public.edu_students" >/dev/null
[ "$(gate t_trig)" = "STOP - DO NOT MIGRATE" ] && ok "preflight: thiếu trigger → GATE = STOP" || fail "preflight trigger"
psqld t_trig -f "$ROOT/db/class_social_friends_wall_setup.sql" >/dev/null 2>"$TMP/trig.err" && fail "migration chạy dù thiếu trigger"
grep -q "trigger student_package_identity_guard" "$TMP/trig.err" && [ "$(q t_trig "select to_regclass('public.friendships') is null")" = "t" ] \
  && ok "migration DỪNG khi thiếu trigger, không tạo gì" || fail "trigger gate"

echo "ALL DB CHECKS PASS"
