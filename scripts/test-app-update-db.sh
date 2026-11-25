#!/usr/bin/env bash
# App Update Manager V1 — test DB trên cluster PostgreSQL 17 TẠM. KHÔNG kết nối production.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaau.XXXXXX)"
PORT="${PORT:-$((56900 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
run() { "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d au -v ON_ERROR_STOP=1 "$@"; }
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres au
# Nền tối thiểu: vai trò Supabase, auth.uid(), app_users, is_admin() giống db/nhipphach_capabilities_setup.sql
run <<'SQL'
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
create table public.app_users (id uuid primary key, role text);
insert into public.app_users values ('00000000-0000-0000-0000-00000000000a','admin'),
  ('00000000-0000-0000-0000-00000000000b','student'), ('00000000-0000-0000-0000-00000000000c','teacher');
create function public.is_admin() returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.app_users au where au.id = auth.uid() and au.role = 'admin') $$;
SQL
echo "── preflight";  run -f "$ROOT/db/app_update_v1_preflight.sql"
echo "── migration ×2"; run -1 -f "$ROOT/db/app_update_v1_setup.sql" >/dev/null; run -1 -f "$ROOT/db/app_update_v1_setup.sql" >/dev/null
echo "── postflight"; out="$(run -tA -f "$ROOT/db/app_update_v1_postflight.sql")"; echo "$out"; [[ "$out" != *f* ]] || { echo "FAIL postflight"; exit 1; }
echo "── quyền + luật"; run -f "$ROOT/db/tests/app_update_v1_test.sql" >/dev/null 2>"$TMP/t.log" || { cat "$TMP/t.log"; exit 1; }; grep -c "PASS" "$TMP/t.log" | sed 's/^/PASS: /'
echo "── chạy lại KHÔNG ghi đè chính sách"; run -1 -f "$ROOT/db/app_update_v1_setup.sql" >/dev/null
[[ "$(run -tAc "select latest_build from public.app_update_policy where platform='android'")" == 18 ]] || { echo FAIL; exit 1; }
echo "── rollback ×2 + cài lại"; run -1 -f "$ROOT/db/app_update_v1_rollback.sql" >/dev/null; run -1 -f "$ROOT/db/app_update_v1_rollback.sql" >/dev/null; run -1 -f "$ROOT/db/app_update_v1_setup.sql" >/dev/null
echo "TẤT CẢ PASS"
