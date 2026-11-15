#!/usr/bin/env bash
# Test Friends V3 (db/friends_v3_*) ở tầng DB trên cluster PostgreSQL 17 TẠM. KHÔNG kết nối production.
#   bash scripts/test-friends-v3-db.sh
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvafv3.XXXXXX)"
PORT="${PORT:-$((56500 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
baseline() {
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup account_avatar_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  mig "$db" "$ROOT/db/friends_ux_v2_setup.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" >/dev/null
  psqld "$db" >/dev/null <<'SQL'
create schema if not exists tva_private;
create table public.class_schedule (id uuid primary key, name text, status text);
create table tva_private.class_memberships (class_id uuid, user_id uuid);
create table public.projects (id uuid primary key, name text not null, avatar_path text);
create table public.teamlab_bands (id uuid primary key, project_id uuid not null references public.projects(id), name text not null, cover_path text);
create table public.teamlab_band_members (band_id uuid not null references public.teamlab_bands(id), user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key (band_id, user_id));
insert into public.projects values ('11111111-0000-4000-8000-0000000000b1', 'Team Một', null);
insert into public.teamlab_bands values ('11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000b1', 'Band X', null);
insert into public.teamlab_band_members (band_id, user_id) values
  ('11111111-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-00000000000a'),
  ('11111111-0000-4000-8000-0000000000a1', 'cccccccc-0000-4000-8000-00000000000c');
SQL
}
fp() { q "$1" "select count(*) || ':' || md5(coalesce(string_agg(id::text||requester_id::text||addressee_id::text||status||created_at::text, ',' order by id), '')) from public.friendships"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/friends_v3_setup.sql" "$ROOT/db/friends_v3_rollback.sql" \
  && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/friends_v3_setup.sql" | grep -qi 'create policy' && fail "setup có CREATE POLICY" || ok "setup không có CREATE POLICY"

baseline tva_fv3
q tva_fv3 "insert into public.friendships (requester_id, addressee_id, status, responded_at) values ('aaaaaaaa-0000-4000-8000-00000000000a','eeeeeeee-0000-4000-8000-00000000000e','accepted',now())" >/dev/null
FP0="$(fp tva_fv3)"
mig tva_fv3 "$ROOT/db/friends_v3_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_fv3 "$ROOT/db/friends_v3_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(fp tva_fv3)" = "$FP0" ] && ok "dữ liệu friendships không đổi" || fail "dữ liệu đổi"
q tva_fv3 "delete from public.friendships" >/dev/null
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_fv3 -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/friends_v3_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

mig tva_fv3 "$ROOT/db/friends_v3_rollback.sql" >/dev/null || fail "rollback 1"
mig tva_fv3 "$ROOT/db/friends_v3_rollback.sql" >/dev/null || fail "rollback 2"
[ "$(q tva_fv3 "select count(*) from pg_proc where proname in ('friend_search','friend_suggestions','friends_ctx','friends_fold')")" = "0" ] && ok "rollback ×2 gỡ sạch" || fail "rollback sót"
[ "$(q tva_fv3 "select count(*) from pg_proc where proname = 'outgoing_friend_requests'")" = "1" ] && ok "rollback không đụng Friends UX V2" || fail "rollback đụng V2"
mig tva_fv3 "$ROOT/db/friends_v3_setup.sql" >/dev/null || fail "cài lại"; ok "cài lại sau rollback"

baseline tva_nob; q tva_nob "drop table public.teamlab_band_members" >/dev/null
mig tva_nob "$ROOT/db/friends_v3_setup.sql" >/dev/null 2>"$TMP/n.err" && fail "migration chạy khi thiếu nền Band"
grep -q "DỪNG — thiếu bảng nền" "$TMP/n.err" && ok "thiếu nền → DỪNG" || fail "$(cat "$TMP/n.err")"
echo "ALL PASS"
