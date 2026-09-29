#!/usr/bin/env bash
# E2E Learning Thread P1 trên stack LOCAL (không production):
#   PostgreSQL 17 tạm (baseline Social + fixture giáo trình/lớp + migration P1) → PostgREST (JWT thật)
#   → proxy giả lập Supabase auth (scripts/e2e-learning-thread-proxy.mjs) → Vite dev (VITE_SUPABASE_URL = proxy)
#   → Chrome (puppeteer-core) chạy tests/e2e-learning-thread/run.mjs.
# Cần: postgresql@17, postgrest (Homebrew), Google Chrome, và puppeteer-core ở PUPPETEER_DIR (thư mục có node_modules/puppeteer-core).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-learning-thread.sh
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
: "${PUPPETEER_DIR:?đặt PUPPETEER_DIR = thư mục chứa node_modules/puppeteer-core}"
TMP="$(mktemp -d /tmp/tvae2e.XXXXXX)"
PORT=$((56500 + RANDOM % 300)); API_PORT=$((PORT + 300)); PROXY_PORT=$((PORT + 600)); VITE_PORT=$((PORT + 900))
PIDS=()
cleanup() {
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
  "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  [ -n "${KEEP_TMP:-}" ] || rm -rf "$TMP"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=127.0.0.1" -l "$TMP/pg.log" -w start >/dev/null
psqld() { PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d e2e -v ON_ERROR_STOP=1 "$@"; }
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres e2e
psqld -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
         class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
  psqld -f "$ROOT/db/$f.sql" >/dev/null
done
psqld -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
psqld -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
psqld -f "$ROOT/db/learning_threads_p2_setup.sql" >/dev/null
# Chỉ cho stack E2E: cổng công cụ của App (ToolRouteGate) mở; Thầy cấu hình 2 bài (bài 2 KHÔNG cấu hình)
psqld >/dev/null <<'SQL'
create or replace function public.my_tool_route_access(p_path text) returns boolean language sql stable as $$ select true $$;
grant execute on function public.my_tool_route_access(text) to anon, authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-00000000000d","role":"authenticated"}', false);
select public.lt_set_lesson_settings('e0000000-0000-4000-8000-000000000001', 'allowed', 'allowed',
  'Bạn có thể gửi phần thực hành của bài này hoặc đặt câu hỏi cho Thầy.');
select public.lt_set_lesson_settings('e0000000-0000-4000-8000-000000000003', 'off', 'allowed');
SQL
echo "── DB local sẵn sàng (migration P1 + P2 + 2 bài đã cấu hình)"

SECRET="e2e-local-secret-e2e-local-secret-0000000"
cat > "$TMP/pgrst.conf" <<EOF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:$PORT/e2e"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $API_PORT
server-host = "127.0.0.1"
EOF
postgrest "$TMP/pgrst.conf" >"$TMP/pgrst.log" 2>&1 & PIDS+=($!)

USERS='{"a@test.local":"aaaaaaaa-0000-4000-8000-00000000000a","b@test.local":"bbbbbbbb-0000-4000-8000-00000000000b","c@test.local":"cccccccc-0000-4000-8000-00000000000c","t@test.local":"dddddddd-0000-4000-8000-00000000000d","n@test.local":"eeeeeeee-0000-4000-8000-00000000000e"}'
PROXY_PORT=$PROXY_PORT PGRST_URL="http://127.0.0.1:$API_PORT" JWT_SECRET="$SECRET" E2E_USERS="$USERS" \
  node "$ROOT/scripts/e2e-learning-thread-proxy.mjs" >"$TMP/proxy.log" 2>&1 & PIDS+=($!)
ANON_KEY="$(JWT_SECRET="$SECRET" node -e '
const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"e2e",exp:4102444800});
console.log(h+"."+p+"."+c.createHmac("sha256",process.env.JWT_SECRET).update(h+"."+p).digest("base64url"))')"

(cd "$ROOT" && VITE_SUPABASE_URL="http://127.0.0.1:$PROXY_PORT" VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
  npx vite --port "$VITE_PORT" --strictPort --host 127.0.0.1 >"$TMP/vite.log" 2>&1) & PIDS+=($!)
for i in $(seq 1 60); do curl -sf "http://127.0.0.1:$VITE_PORT/" >/dev/null 2>&1 && break; sleep 0.5; done
curl -sf "http://127.0.0.1:$API_PORT/" >/dev/null || { cat "$TMP/pgrst.log"; exit 1; }
echo "── Stack: PostgREST :$API_PORT · proxy :$PROXY_PORT · vite :$VITE_PORT"

set +e
VITE_PORT=$VITE_PORT PUPPETEER_DIR="$PUPPETEER_DIR" SHOTS="${SHOTS:-$TMP/shots}" node "$ROOT/tests/e2e-learning-thread/run.mjs"
RC=$?
set -e
echo "── proxy log (lỗi REST ≥400 / endpoint chưa giả lập):"; grep -v '→ http' "$TMP/proxy.log" | head -30 || true
PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d e2e -tAc \
  "select 'threads=' || count(*) from learning_threads union all select 'events=' || count(*) from learning_thread_events
   union all select 'progress=' || count(*) from edu_lesson_progress union all select 'class_posts=' || count(*) from class_posts"
exit $RC
