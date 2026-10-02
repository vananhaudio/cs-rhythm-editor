#!/usr/bin/env bash
# E2E Band — Tuyển thành viên V1 trên stack LOCAL (không production):
#   PostgreSQL 17 tạm (fixture + community_setup + band_recruit_v1 + seed Lá Mùa Thu) → PostgREST (JWT thật)
#   → proxy giả lập Supabase auth (scripts/e2e-learning-thread-proxy.mjs) → Vite dev → Chrome (tests/e2e-band/run.mjs).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-band-recruit.sh
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
: "${PUPPETEER_DIR:?đặt PUPPETEER_DIR = thư mục chứa node_modules/puppeteer-core}"
TMP="$(mktemp -d /tmp/tvaband-e2e.XXXXXX)"
PORT=$((57000 + RANDOM % 300)); API_PORT=$((PORT + 300)); PROXY_PORT=$((PORT + 600)); VITE_PORT=$((PORT + 900))
PIDS=()
cleanup() {
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
  pkill -f "vite --port $VITE_PORT --strictPort" 2>/dev/null || true
  pkill -f "postgrest $TMP/pgrst.conf" 2>/dev/null || true
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
for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup \
         social_learning_identity_v1_setup social_tool_share_v1_setup; do
  psqld -f "$ROOT/db/$f.sql" >/dev/null
done
psqld -1 -f "$ROOT/db/band_recruit_v1_setup.sql" >/dev/null
psqld -1 -f "$ROOT/db/band_la_mua_thu_seed.sql" >/dev/null
psqld -c "create or replace function public.my_tool_route_access(p_path text) returns boolean language sql stable as \$\$ select true \$\$;
          grant execute on function public.my_tool_route_access(text) to anon, authenticated;" >/dev/null
echo "── DB local sẵn sàng (Social + Band V1 + seed Lá Mùa Thu)"

SECRET="e2e-local-secret-e2e-local-secret-0000000"
cat > "$TMP/pgrst.conf" <<EOT
db-uri = "postgres://authenticator:authenticator@127.0.0.1:$PORT/e2e"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $API_PORT
server-host = "127.0.0.1"
EOT
postgrest "$TMP/pgrst.conf" >"$TMP/pgrst.log" 2>&1 & PIDS+=($!)
USERS='{"a@test.local":"aaaaaaaa-0000-4000-8000-00000000000a","b@test.local":"bbbbbbbb-0000-4000-8000-00000000000b","t@test.local":"dddddddd-0000-4000-8000-00000000000d"}'
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

# Psql cho runner (kiểm DB sau thao tác + tạo Band 2 bằng DỮ LIỆU)
export E2E_PSQL="$PGBIN/psql -X -q -h $TMP -p $PORT -U postgres -d e2e -tA -v ON_ERROR_STOP=1"
set +e
VITE_PORT=$VITE_PORT PUPPETEER_DIR="$PUPPETEER_DIR" SHOTS="${SHOTS:-$TMP/shots}" node "$ROOT/tests/e2e-band/run.mjs"
RC=$?
set -e
echo "── proxy log (lỗi REST ≥400):"; grep -v '→ http' "$TMP/proxy.log" | head -20 || true
exit $RC
