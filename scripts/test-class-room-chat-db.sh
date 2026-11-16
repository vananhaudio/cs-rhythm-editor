#!/usr/bin/env bash
# Test Chat List V2 (db/chat_list_v2_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-chat-list-v2-db.sh
# Phủ: preflight · migration ×2 · khoá · test SQL theo identity (quyền, rò rỉ qua tìm kiếm, ghim, con trỏ, Thầy/Admin) · tương thích RPC cũ ·
#      dữ liệu LỚN (hàng nghìn hội thoại: duyệt hết bằng con trỏ, tìm hội thoại chưa tải, thời gian) · postflight · rollback ×2 + cài lại ·
#      cổng va chạm tên · hồi quy dm_v1_test trên DB đã có Chat List V2 + md5 hàm dm_*/bandchat_* không đổi (chat cá nhân/Band không đổi).
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvacr.XXXXXX)"
PORT="${PORT:-$((56800 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
sed -n '/^create or replace function public.dm_conversations_safe/,/^grant execute on function public.dm_conversations_safe/p' "$ROOT/db/class_ugc_safety_v1_setup.sql" > "$TMP/dm_safe.sql"
[ -s "$TMP/dm_safe.sql" ] || fail "không trích được dm_conversations_safe"
FIRST=1
baseline() {   # giả lập production: fixture Social + dm_v1 + nền UGC an toàn + Band Chat V1/V1.1/V1.2/V1.3 + bảng TeamLab giả
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup account_avatar_v1_setup dm_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" >/dev/null
  psqld "$db" -f "$TMP/dm_safe.sql" >/dev/null
  psqld "$db" >/dev/null <<'SQL'
create table public.projects (id uuid primary key, name text not null, avatar_path text);
create table public.teamlab_bands (id uuid primary key, project_id uuid not null references public.projects(id), name text not null, cover_path text);
create table public.teamlab_band_members (band_id uuid not null references public.teamlab_bands(id), user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key (band_id, user_id));
create table public.teamlab_band_roles (band_id uuid not null references public.teamlab_bands(id), project_id uuid not null, user_id uuid not null,
  role text not null check (role in ('leader','deputy','music_editor')), granted_by uuid, created_at timestamptz not null default now(),
  primary key (band_id, user_id, role));
insert into public.projects values ('11111111-0000-4000-8000-0000000000b1', 'Team Một', 'p1/avatar.jpg'),
                                   ('11111111-0000-4000-8000-0000000000b2', 'Team Hai', null);
insert into public.teamlab_bands values ('11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000b1', 'Band X', null),
                                        ('11111111-0000-4000-8000-0000000000a2', '11111111-0000-4000-8000-0000000000b1', 'Band Y', null),
                                        ('11111111-0000-4000-8000-0000000000a3', '11111111-0000-4000-8000-0000000000b2', 'Band Z', null);
insert into public.teamlab_band_members (band_id, user_id, created_at) values
  ('11111111-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-00000000000a', now() - interval '30 days'),
  ('11111111-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-00000000000b', now() - interval '30 days'),
  ('11111111-0000-4000-8000-0000000000a2', 'cccccccc-0000-4000-8000-00000000000c', now() - interval '30 days');
SQL
  if [ "${EXTRAS:-1}" = 1 ]; then psqld "$db" >/dev/null <<'SQL'
insert into auth.users (id, email) values ('0d0d0d0d-0000-4000-8000-0000000000d4', 'd@test.local'), ('0e0e0e0e-0000-4000-8000-0000000000e5', 'e@test.local'),
                                          ('5a5a5a5a-0000-4000-8000-0000000000a5', 's@test.local');
insert into public.app_users (id, role, name, email) values ('0d0d0d0d-0000-4000-8000-0000000000d4', 'student', 'Dũng', 'd@test.local'),
                                                            ('0e0e0e0e-0000-4000-8000-0000000000e5', 'student', 'Em', 'e@test.local'),
                                                            ('5a5a5a5a-0000-4000-8000-0000000000a5', 'admin', 'Thầy Văn Anh', 'vananhaudio@gmail.com');
insert into public.edu_students (user_id, full_name, display_name, email, level) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4', 'Phạm Dũng', 'Dũng', 'd@test.local', 'beginner'),
  ('0e0e0e0e-0000-4000-8000-0000000000e5', 'Em', 'Em', 'e@test.local', 'beginner');
SQL
  fi
  psqld "$db" -f "$ROOT/db/band_chat_v1_setup.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/band_chat_v1_1_roles_setup.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/band_chat_v1_2_support_list_setup.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/band_chat_v1_3_companion_setup.sql" >/dev/null
}
# ── Nền Chat Lớp: Chat List V2 + lớp/nhóm lớp (view canonical thật) + helper UGC đầy đủ ──
sed -n '/^create or replace function public.class_ugc_text_blocked/,/^revoke all on function public.class_ugc_text_blocked/p' "$ROOT/db/class_ugc_safety_v1_setup.sql" > "$TMP/ugc_text.sql"
[ -s "$TMP/ugc_text.sql" ] || fail "không trích được class_ugc_text_blocked"
classbase() {   # baseline production + Chat List V2 + lớp học giả (view canonical y hệt production)
  local db=$1
  baseline "$db"
  mig "$db" "$ROOT/db/chat_list_v2_setup.sql" >/dev/null
  psqld "$db" >/dev/null <<'SQL'
create table if not exists public.class_ugc_blocklist (id bigserial primary key, pattern text not null, severity text not null default 'block', active boolean not null default true);
alter table public.edu_students add column if not exists blocked_at timestamptz;
SQL
  psqld "$db" -f "$TMP/ugc_text.sql" >/dev/null
  psqld "$db" -f "$ROOT/db/class_schedule_setup.sql" >/dev/null
  psqld "$db" >/dev/null <<'SQL'
create schema if not exists tva_private;
alter table public.class_schedule add column if not exists status text, add column if not exists cohort_group_id uuid;
create or replace view tva_private.class_memberships as
  select cs.id as class_id, gm.group_id, gm.user_id, gm.source, gm.created_at as joined_at
  from public.class_schedule cs join public.edu_group_members gm on gm.group_id = cs.cohort_group_id and gm.status = 'active';
insert into public.edu_groups (id, name) values
  ('33333333-0000-4000-8000-0000000000c1', 'G K1'), ('33333333-0000-4000-8000-0000000000c2', 'G K2'),
  ('33333333-0000-4000-8000-0000000000c3', 'G K3'), ('33333333-0000-4000-8000-0000000000c4', 'G K4');
insert into public.class_schedule (id, code, name, status, cohort_group_id) values
  ('22222222-0000-4000-8000-0000000000c1', 'K1', 'Lớp K1', 'active', '33333333-0000-4000-8000-0000000000c1'),
  ('22222222-0000-4000-8000-0000000000c2', 'K2', 'Lớp K2', 'active', '33333333-0000-4000-8000-0000000000c2'),
  ('22222222-0000-4000-8000-0000000000c3', 'K3', 'Lớp K3', 'active', '33333333-0000-4000-8000-0000000000c3'),
  ('22222222-0000-4000-8000-0000000000c4', 'K4', 'Lớp K4', 'active', '33333333-0000-4000-8000-0000000000c4');
insert into auth.users (id, email) values ('7a7a7a7a-0000-4000-8000-0000000000a7', 'g@test.local') on conflict do nothing;
insert into public.app_users (id, role, name, email) values ('7a7a7a7a-0000-4000-8000-0000000000a7', 'teacher', 'Cô Giáo', 'g@test.local') on conflict do nothing;
insert into public.edu_group_members (user_id, group_id, status, created_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-0000000000c1', 'active', now() - interval '30 days'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '33333333-0000-4000-8000-0000000000c1', 'active', now() - interval '30 days'),
  ('dddddddd-0000-4000-8000-00000000000d', '33333333-0000-4000-8000-0000000000c1', 'active', now() - interval '30 days'),
  ('cccccccc-0000-4000-8000-00000000000c', '33333333-0000-4000-8000-0000000000c2', 'active', now() - interval '30 days'),
  ('aaaaaaaa-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-0000000000c3', 'active', now() - interval '30 days'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '33333333-0000-4000-8000-0000000000c3', 'active', now() - interval '30 days'),
  ('aaaaaaaa-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-0000000000c4', 'active', now() - interval '30 days');
SQL
}
TPRE="$(sed -n '/^grant usage on schema t/,/^grant execute on all functions in schema t/p' "$ROOT/db/tests/band_chat_v1_test.sql")"
run_t() {  # run_t <db> <file...> : nạp helper t.* (+ u('G')) rồi test
  local db=$1; shift
  { echo '\set ON_ERROR_STOP on'; echo 'drop schema if exists t cascade; create schema t;'; echo "$TPRE" | sed "s/when 'N' then/when 'G' then '7a7a7a7a-0000-4000-8000-0000000000a7'::uuid when 'N' then/";
    for f in "$@"; do grep -v '^\\set ON_ERROR_STOP' "$f"; done; } > "$TMP/run_t.sql"
  PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 -f "$TMP/run_t.sql" 2>&1 \
    | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/t.out"
  [ "${PIPESTATUS[0]}" = "0" ] || return 1
  ! grep -q '^FAIL' "$TMP/t.out"
}
echo "── md5 hàm Hộp thư V2 gốc"
classbase tva_md
ORIG_BASE="$(q tva_md "select md5(prosrc) from pg_proc where proname='chat_inbox_base'")"; ORIG_SUM="$(q tva_md "select md5(prosrc) from pg_proc where proname='chat_inbox_summary'")"
echo "BASE=$ORIG_BASE SUM=$ORIG_SUM"

echo "── Tĩnh"
for f in setup safety_setup inbox_setup rollback; do
  grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/class_room_chat_v1_${f}.sql" && fail "class_room_chat_v1_${f}.sql có begin/commit" || true
done; ok "4 file migration không có begin/commit"
grep -hv '^[[:space:]]*--' "$ROOT"/db/class_room_chat_v1_*setup.sql | grep -qi 'create policy' && fail "có CREATE POLICY" || ok "không CREATE POLICY (không dính khoá policy_grants)"
grep -hv '^[[:space:]]*--' "$ROOT"/db/class_room_chat_v1_setup.sql "$ROOT"/db/class_room_chat_v1_safety_setup.sql | grep -qiE '(alter|drop|update|delete from|insert into) +(public\.)?(dm_|bandchat_|teamlab_|class_schedule|edu_)' \
  && fail "lõi/an toàn đụng bảng dm_/bandchat_/teamlab_/class_schedule/edu_" || ok "lõi + an toàn không sửa/ghi bảng ngoài classchat_*"

echo "── Baseline + preflight md5"
classbase tva_cr
FP0="$(q tva_cr "select string_agg(p.proname || '/' || p.pronargs || '=' || md5(p.prosrc), ',' order by p.proname, p.pronargs) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname like 'bandchat\_%' or p.proname in ('class_public_identity','chat_inbox','chat_conversation_info','chat_pin_set','chat_fold'))")"
fpnow() { q "$1" "select string_agg(p.proname || '/' || p.pronargs || '=' || md5(p.prosrc), ',' order by p.proname, p.pronargs) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname like 'bandchat\_%' or p.proname in ('class_public_identity','chat_inbox','chat_conversation_info','chat_pin_set','chat_fold'))"; }
DM0="$(q tva_cr "select count(*) from public.dm_messages")/$(q tva_cr "select count(*) from public.bandchat_messages")"

echo "── Migration ×2 (lõi → an toàn → hộp thư)"
for i in 1 2; do
  for f in setup safety_setup inbox_setup; do mig tva_cr "$ROOT/db/class_room_chat_v1_${f}.sql" >/dev/null || fail "migration $f lần $i"; done
  ok "migration lần $i (3 file)"
done
[ "$(fpnow tva_cr)" = "$FP0" ] && ok "dm_*, bandchat_*, chat_inbox/info/pin, class_public_identity KHÔNG đổi (md5 khớp)" || fail "hàm nền bị đổi"
[ "$(q tva_cr "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'classchat\_%' and c.relkind='r'")" = "3" ] && ok "đúng 3 bảng classchat_*" || fail "số bảng"
[ "$(q tva_cr "select count(*) from information_schema.role_table_grants where table_name like 'classchat\_%' and grantee in ('anon','authenticated','public')")" = "0" ] && ok "classchat_*: 0 grant cho anon/authenticated" || fail "có grant bảng"
[ "$(q tva_cr "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'classchat\_%' and c.relkind='r' and not c.relrowsecurity")" = "0" ] && ok "RLS bật trên cả 3 bảng" || fail "thiếu RLS"
[ "$(q tva_cr "select count(*) from pg_policies where tablename like 'classchat\_%'")" = "0" ] && ok "0 policy (chỉ qua RPC)" || fail "có policy"

echo "── Khoá trong migration"
classbase tva_lock
LOCKS="$(psqld tva_lock -tA <<SQL
begin;
\i $ROOT/db/class_room_chat_v1_setup.sql
\i $ROOT/db/class_room_chat_v1_safety_setup.sql
\i $ROOT/db/class_room_chat_v1_inbox_setup.sql
select coalesce(string_agg(distinct n.nspname || '.' || c.relname || ':' || l.mode, ', ' order by n.nspname || '.' || c.relname || ':' || l.mode), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname not like 'classchat\_%' and c.relname <> 'classchat_v1_backup' and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock', 'RowExclusiveLock');
rollback;
SQL
)"
echo "   khoá mạnh ngoài classchat_*: ${LOCKS:-(không)}"
case "$LOCKS" in
  ""|"auth.users:ShareRowExclusiveLock") ok "chỉ khoá bảng classchat_* (+ auth.users ngắn cho FK)";;
  *) fail "khoá không mong đợi: $LOCKS";;
esac

echo "── Test SQL theo identity (quyền · cách ly · lịch sử · huỷ/gộp · Thầy · an toàn)"
run_t tva_cr "$ROOT/db/tests/class_room_chat_v1_test.sql" || fail "test SQL lõi"
ok "test lõi: $(grep -c '^PASS' "$TMP/t.out") PASS, 0 FAIL"

echo "── Hộp thư V2 có lớp (lọc/ghim/đếm/tìm/info)"
run_t tva_cr "$ROOT/db/tests/class_room_chat_v1_inbox_test.sql" || fail "test hộp thư"
ok "test hộp thư: $(grep -c '^PASS' "$TMP/t.out") PASS, 0 FAIL"

echo "── Gửi ĐỒNG THỜI (8 phiên, một phòng)"
classbase tva_cc; for f in setup safety_setup inbox_setup; do mig tva_cc "$ROOT/db/class_room_chat_v1_${f}.sql" >/dev/null; done
for i in 1 2 3 4 5 6 7 8; do
  U=$([ $((i % 2)) = 0 ] && echo aaaaaaaa-0000-4000-8000-00000000000a || echo bbbbbbbb-0000-4000-8000-00000000000b)
  psqld tva_cc -tA -c "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$U\",\"role\":\"authenticated\"}', false); select public.classchat_send('22222222-0000-4000-8000-0000000000c1', 'song song $i');" >/dev/null &
done
wait
R="$(q tva_cc "select (select count(*) from public.classchat_rooms) || '/' || (select count(*) from public.classchat_messages) || '/' || (select count(distinct seq) from public.classchat_messages) || '/' || (select max(seq) from public.classchat_messages) || '/' || (select last_seq from public.classchat_rooms)")"
[ "$R" = "1/8/8/8/8" ] && ok "8 gửi đồng thời → 1 phòng, 8 tin, seq 1..8 ($R)" || fail "đồng thời: $R"

echo "── Rollback ×2 + cài lại"
classbase tva_rb; FPB="$(fpnow tva_rb)"
BASE_MD5="$(q tva_rb "select md5(prosrc) from pg_proc where proname='chat_inbox_base'")"; SUM_MD5="$(q tva_rb "select md5(prosrc) from pg_proc where proname='chat_inbox_summary'")"
for f in setup safety_setup inbox_setup; do mig tva_rb "$ROOT/db/class_room_chat_v1_${f}.sql" >/dev/null; done
mig tva_rb "$ROOT/db/class_room_chat_v1_rollback.sql" >/dev/null || fail "rollback 1"; ok "rollback lần 1"
mig tva_rb "$ROOT/db/class_room_chat_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback lần 2 (idempotent)"
[ "$(q tva_rb "select md5(prosrc) from pg_proc where proname='chat_inbox_base'")" = "$BASE_MD5" ] && [ "$(q tva_rb "select md5(prosrc) from pg_proc where proname='chat_inbox_summary'")" = "$SUM_MD5" ] \
  && ok "rollback: chat_inbox_base/summary về ĐÚNG bản gốc (md5 khớp)" || fail "rollback không khôi phục nguyên văn"
[ "$(fpnow tva_rb)" = "$FPB" ] && ok "rollback: dm_*/bandchat_*/chat_* nguyên vẹn" || fail "rollback đụng hàm nền"
[ "$(q tva_rb "select count(*) from pg_proc where proname like 'classchat\_%'")" = "0" ] && [ "$(q tva_rb "select count(*) from pg_class where relname like 'classchat\_%'")" = "0" ] \
  && ok "rollback: hết classchat_* (hàm, bảng, backup)" || fail "rollback còn sót"
for f in setup safety_setup inbox_setup; do mig tva_rb "$ROOT/db/class_room_chat_v1_${f}.sql" >/dev/null || fail "cài lại $f"; done; ok "cài lại sau rollback"

echo "── Cổng va chạm tên"
classbase tva_gate; psqld tva_gate -c "create table public.classchat_rooms (x int)" >/dev/null
mig tva_gate "$ROOT/db/class_room_chat_v1_setup.sql" >/dev/null 2>&1 && fail "bảng lạ trùng tên mà vẫn migrate" || ok "bảng lạ classchat_rooms → migration DỪNG"
classbase tva_gate2; psqld tva_gate2 -c "create or replace function public.chat_inbox_summary() returns table(dm_total int, band_total int, class_total int, unread_dm int, unread_band int, unread_class int, pinned_total int, support_total int) language sql as 'select 1,1,1,1,1,1,1,1'" >/dev/null
for f in setup safety_setup; do mig tva_gate2 "$ROOT/db/class_room_chat_v1_${f}.sql" >/dev/null; done
mig tva_gate2 "$ROOT/db/class_room_chat_v1_inbox_setup.sql" >/dev/null 2>&1 && fail "hàm Hộp thư bị sửa mà vẫn migrate" || ok "chat_inbox_summary khác bản gốc → migration Hộp thư DỪNG (drift gate)"

echo "── Hồi quy: dm_v1_test trên DB đã có Chat Lớp"
EXTRAS=0 classbase tva_dm; for f in setup safety_setup inbox_setup; do mig tva_dm "$ROOT/db/class_room_chat_v1_${f}.sql" >/dev/null; done
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_dm -v ON_ERROR_STOP=1 -f "$ROOT/db/tests/dm_v1_test.sql" 2>&1 \
  | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' > "$TMP/dm.out" || { tail -5 "$TMP/dm.out"; fail "dm_v1_test"; }
grep -q '^FAIL' "$TMP/dm.out" && fail "dm_v1_test có FAIL" || ok "dm_v1_test: $(grep -c '^PASS' "$TMP/dm.out") PASS, 0 FAIL"
echo "ALL CLASS ROOM CHAT V1 DB TESTS PASSED"
