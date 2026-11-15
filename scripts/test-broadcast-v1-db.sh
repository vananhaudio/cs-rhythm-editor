#!/usr/bin/env bash
# Test Broadcast V1 (db/broadcast_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM. KHÔNG kết nối production, KHÔNG gửi tin thật.
#   bash scripts/test-broadcast-v1-db.sh
# Phủ: migration ×2 · test SQL theo identity (quyền admin, loại trừ, snapshot, Thông báo, Chat, retry, hủy, kiểm lại trước khi phát) ·
#      worker chạy SONG SONG trên 600 học viên giả (không trùng/không sót) · dm_*/friendships không đổi · rollback ×2 + cài lại · cổng nền.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvabc.XXXXXX)"
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
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
FIRST=1
baseline() {
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  # production có sẵn các cột/hàm này (auth.users.deleted_at/banned_until, edu_students.blocked_at, is_admin)
  psqld "$db" >/dev/null <<'SQL'
alter table auth.users add column if not exists deleted_at timestamptz;
alter table auth.users add column if not exists banned_until timestamptz;
alter table public.edu_students add column if not exists blocked_at timestamptz;
alter table public.edu_students add column if not exists blocked_reason text;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $f$
  select exists (select 1 from public.app_users au where au.id = auth.uid() and au.role = 'admin') $f$;
SQL
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup account_avatar_v1_setup dm_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
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
-- System Chat V1 (nền thông báo): bảng Learning Thread tối thiểu để file V1 chạy được
create table public.learning_threads (id uuid primary key, learner_user_id uuid, session_no int);
create table public.learning_thread_events (id uuid primary key default gen_random_uuid(), thread_id uuid, seq bigint, author_role text, kind text, verdict text, hidden_at timestamptz);
SQL
  psqld "$db" -f "$ROOT/db/class_system_chat_v1_setup.sql" >/dev/null
}
fp() { q "$1" "select (select count(*) from public.friendships) || ':' || (select md5(string_agg(proname || '/' || md5(prosrc), ',' order by proname)) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname = 'friendship_status' or p.proname = 'is_class_member')) || ':' || (select count(*) from public.dm_messages)"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/broadcast_v1_setup.sql" "$ROOT/db/broadcast_v1_rollback.sql" && fail "file migration có begin/commit" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/broadcast_v1_setup.sql" | grep -qi 'create policy' && fail "setup có CREATE POLICY" || ok "setup không có CREATE POLICY"
grep -v '^[[:space:]]*--' "$ROOT/db/broadcast_v1_setup.sql" | grep -qiE '(insert into|update|delete from|alter table) +(public\.)?(dm_messages|friendships)' && fail "setup ghi thẳng dm_messages/friendships" || ok "setup không ghi thẳng dm_messages/friendships (tin đi qua dm_append)"

baseline tva_bc
FP0="$(fp tva_bc)"
mig tva_bc "$ROOT/db/broadcast_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_bc "$ROOT/db/broadcast_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(fp tva_bc)" = "$FP0" ] && ok "dm_*/friendships/is_class_member không đổi sau migration" || fail "dữ liệu/hàm Chat đổi"
[ "$(q tva_bc "select count(*) from public.broadcast_campaigns")" = "0" ] && ok "migration không tạo chiến dịch nào" || fail "có chiến dịch"
[ "$(q tva_bc "select count(*) from pg_policies where tablename like 'broadcast%'")" = "0" ] && ok "bảng broadcast_*: không policy" || fail "có policy"
[ "$(q tva_bc "select relrowsecurity::text || has_table_privilege('authenticated','public.broadcast_campaigns','select')::text || has_table_privilege('anon','public.broadcast_recipients','insert')::text from pg_class where oid='public.broadcast_campaigns'::regclass")" = "truefalsefalse" ] && ok "RLS bật, client không có quyền bảng" || fail "RLS/grant"

# Kết quả test SQL: đếm PASS/FAIL ở lần chạy thật (phải thoát 0)
baseline tva_bc2; mig tva_bc2 "$ROOT/db/broadcast_v1_setup.sql" >/dev/null
OUT="$TMP/t.out"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_bc2 -v ON_ERROR_STOP=1 -f "$ROOT/db/tests/broadcast_v1_test.sql" >"$OUT" 2>&1 \
  || { grep -E "FAIL|ERROR" "$OUT" | head -5; fail "test SQL"; }
echo "PASS: test SQL theo identity: $(grep -c 'NOTICE:  PASS' "$OUT") kiểm tra"
! grep -q "NOTICE:  FAIL" "$OUT" || fail "có FAIL"

echo "── Song song: 600 học viên giả, 3 worker cùng chạy"
baseline tva_cc; mig tva_cc "$ROOT/db/broadcast_v1_setup.sql" >/dev/null
psqld tva_cc >/dev/null <<'SQL'
insert into auth.users (id, email) select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'bulk' || g || '@test.local' from generate_series(1, 600) g;
insert into public.app_users (id, role, name, email) select id, 'student', 'Bulk ' || email, email from auth.users where email like 'bulk%';
insert into public.edu_students (user_id, full_name, display_name, email, level) select id, 'Bulk', 'Bulk', email, 'beginner' from auth.users where email like 'bulk%';
insert into auth.users (id, email) values ('abcdabcd-0000-4000-8000-0000000000a1', 'z@test.local');
insert into public.app_users (id, role, name, email) values ('abcdabcd-0000-4000-8000-0000000000a1', 'admin', 'Owner', 'z@test.local');
SQL
for CH in notice chat; do
  CID="$(psqld tva_cc -tA -c "set role postgres; select set_config('request.jwt.claims','{\"sub\":\"abcdabcd-0000-4000-8000-0000000000a1\",\"role\":\"authenticated\"}', false); set role authenticated; select public.broadcast_confirm('par-$CH','$CH','students',null,'T','Tin song song',null,(select eligible from public.broadcast_preview('$CH','students',null)))" | tail -1)"
  [ -n "$CID" ] || fail "không tạo được chiến dịch $CH"
  for w in 1 2 3; do ( for i in $(seq 1 30); do psqld tva_cc -c "select public.broadcast_tick(50)" >/dev/null || exit 1; done ) & done; wait
  S="$(q tva_cc "select status || count(*) from public.broadcast_recipients where campaign_id='$CID' group by status order by 1" | tr "\n" " ")"; [ "$(q tva_cc "select count(*) from public.broadcast_recipients where campaign_id='$CID' and status='sent'")" = "$(q tva_cc "select eligible_total from public.broadcast_campaigns where id='$CID'")" ] && ok "[$CH] song song: mọi người nhận hợp lệ đều sent" || fail "[$CH] thiếu/thừa: $S"
  [ "$(q tva_cc "select status from public.broadcast_campaigns where id='$CID'")" = "completed" ] && ok "[$CH] chiến dịch completed" || fail "[$CH] trạng thái"
done
[ "$(q tva_cc "select count(*) from (select user_id from public.class_system_notices where kind='broadcast' group by 1 having count(*)>1) x")" = "0" ] && ok "song song: không thông báo trùng" || fail "trùng thông báo"
[ "$(q tva_cc "select count(*) from public.dm_messages where body='Tin song song'")" = "$(q tva_cc "select count(*) from public.class_system_notices where kind='broadcast'")" ] && ok "song song: số tin Chat = số thông báo (mỗi người đúng một)" || fail "lệch số tin"
[ "$(q tva_cc "select count(*) from (select user_lo,user_hi from public.dm_conversations group by 1,2 having count(*)>1) x")" = "0" ] && ok "song song: không hội thoại trùng" || fail "hội thoại trùng"
[ "$(q tva_cc "select count(*) from public.dm_conversations")" = "$(q tva_cc "select eligible_total from public.broadcast_campaigns where channel='chat'")" ] && ok "mỗi người nhận đúng một hội thoại RIÊNG (không nhóm)" || fail "số hội thoại"

echo "── Rollback ×2 + cài lại"
mig tva_bc "$ROOT/db/broadcast_v1_rollback.sql" >/dev/null || fail "rollback 1"
mig tva_bc "$ROOT/db/broadcast_v1_rollback.sql" >/dev/null || fail "rollback 2"
[ "$(q tva_bc "select count(*) from pg_proc where proname like 'broadcast\_%'")" = "0" ] && ok "rollback ×2 gỡ sạch hàm" || fail "rollback sót hàm"
[ "$(fp tva_bc)" = "$FP0" ] && ok "rollback: Chat/bạn bè không đổi" || fail "rollback đổi Chat"
mig tva_bc "$ROOT/db/broadcast_v1_setup.sql" >/dev/null || fail "cài lại"; ok "cài lại sau rollback"

echo "── Cổng nền"
baseline tva_nob; q tva_nob "drop table public.teamlab_band_members" >/dev/null
mig tva_nob "$ROOT/db/broadcast_v1_setup.sql" >/dev/null 2>"$TMP/n.err" && fail "migration chạy khi thiếu nền"
grep -q "DỪNG — thiếu nền" "$TMP/n.err" && ok "thiếu nền → DỪNG" || fail "$(cat "$TMP/n.err")"
echo "ALL PASS"
