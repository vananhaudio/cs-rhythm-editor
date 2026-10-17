#!/usr/bin/env bash
# Test Band Chat V1 (db/band_chat_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-band-chat-v1-db.sh
# Phủ: preflight · migration ×2 (một transaction) · khoá · test SQL theo identity · gửi ĐỒNG THỜI (một phòng) ·
#      postflight · rollback ×2 + cài lại · cổng va chạm tên · hồi quy dm_v1 (chat cá nhân không đổi).
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvabc.XXXXXX)"
PORT="${PORT:-$((56600 + RANDOM % 90))}"
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
FIRST=1
baseline() {   # giả lập production: fixture Social + dm_v1 + bảng Teamlab giả tối thiểu
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup account_avatar_v1_setup dm_v1_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
}
teamlab() {   # Band/Team giả (schema production của TeamLab: chỉ cột Band Chat dùng)
  psqld "$1" >/dev/null <<'SQL'
create table public.projects (id uuid primary key, name text not null, avatar_path text);
create table public.teamlab_bands (id uuid primary key, project_id uuid not null references public.projects(id), name text not null, cover_path text);
create table public.teamlab_band_members (band_id uuid not null references public.teamlab_bands(id), user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key (band_id, user_id));
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
}
extra_users() {
  psqld "$1" >/dev/null <<'SQL'
insert into auth.users (id, email) values ('0d0d0d0d-0000-4000-8000-0000000000d4', 'd@test.local'), ('0e0e0e0e-0000-4000-8000-0000000000e5', 'e@test.local');
insert into public.app_users (id, role, name, email) values ('0d0d0d0d-0000-4000-8000-0000000000d4', 'student', 'Dũng', 'd@test.local'),
                                                            ('0e0e0e0e-0000-4000-8000-0000000000e5', 'student', 'Em', 'e@test.local');
insert into public.edu_students (user_id, full_name, display_name, email, level) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4', 'Phạm Dũng', 'Dũng', 'd@test.local', 'beginner'),
  ('0e0e0e0e-0000-4000-8000-0000000000e5', 'Em', 'Em', 'e@test.local', 'beginner');
SQL
}
PRE="$(cat "$ROOT/db/band_chat_v1_preflight.sql")"
POST="$(cat "$ROOT/db/band_chat_v1_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }
dmfp() { q "$1" "select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname = 'class_public_identity')"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/band_chat_v1_setup.sql" "$ROOT/db/band_chat_v1_rollback.sql" \
  && fail "file migration có begin/commit (prod-db sở hữu transaction)" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/band_chat_v1_setup.sql" | grep -qi 'create policy' && fail "setup có CREATE POLICY" || ok "setup không có CREATE POLICY"

echo "── Baseline (giả lập production)"
baseline tva_bc; teamlab tva_bc; extra_users tva_bc
DMFP0="$(dmfp tva_bc)"
[ "$(gate tva_bc)" = "PASS" ] && ok "preflight baseline: GATE = PASS" || { psqld tva_bc -c "${PRE%;}"; fail "preflight baseline"; }

echo "── Migration ×2"
mig tva_bc "$ROOT/db/band_chat_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_bc "$ROOT/db/band_chat_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(dmfp tva_bc)" = "$DMFP0" ] && ok "hàm dm_* + class_public_identity không đổi" || fail "hàm nền bị đổi"
[ "$(gate tva_bc)" = "PASS" ] && ok "preflight sau migration vẫn PASS" || fail "preflight sau migration"
[ "$(postgate tva_bc)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld tva_bc -c "${POST%;}"; fail "postflight"; }

echo "── Khoá trong migration (chỉ bảng bandchat_* mới + auth.users cho FK)"
baseline tva_lock; teamlab tva_lock
LOCKS="$(psqld tva_lock -tA <<SQL
begin;
\i $ROOT/db/band_chat_v1_setup.sql
select coalesce(string_agg(distinct n.nspname || '.' || c.relname || ':' || l.mode, ', ' order by n.nspname || '.' || c.relname || ':' || l.mode), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname not like 'bandchat\_%' and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock', 'RowExclusiveLock');
rollback;
SQL
)"
echo "   khoá mạnh trên bảng NGOÀI bandchat_*: ${LOCKS:-(không)}"
case "$LOCKS" in
  ""|"auth.users:ShareRowExclusiveLock") ok "migration chỉ khoá bảng bandchat_* (+ auth.users ngắn cho khoá ngoại)";;
  *) fail "khoá không mong đợi: $LOCKS";;
esac

echo "── Test SQL theo identity (a–e, g, i, l, m, k)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_bc -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/band_chat_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/test.out"
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"
grep -q '^FAIL' "$TMP/test.out" && fail "có FAIL trong test" || ok "test SQL: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"

echo "── f. Mở/gửi ĐỒNG THỜI không sinh nhóm trùng (8 phiên song song, Band mới)"
baseline tva_cc; teamlab tva_cc; extra_users tva_cc; mig tva_cc "$ROOT/db/band_chat_v1_setup.sql" >/dev/null
q tva_cc "insert into public.teamlab_band_members (band_id, user_id) values ('11111111-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-00000000000a'), ('11111111-0000-4000-8000-0000000000a3', 'bbbbbbbb-0000-4000-8000-00000000000b')" >/dev/null
for i in 1 2 3 4 5 6 7 8; do
  U=$([ $((i % 2)) = 0 ] && echo aaaaaaaa-0000-4000-8000-00000000000a || echo bbbbbbbb-0000-4000-8000-00000000000b)
  psqld tva_cc -tA -c "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$U\",\"role\":\"authenticated\"}', false); select public.bandchat_send('11111111-0000-4000-8000-0000000000a3', 'song song $i');" >/dev/null &
done
wait
R="$(q tva_cc "select (select count(*) from public.bandchat_rooms) || '/' || (select count(*) from public.bandchat_messages) || '/' || (select count(distinct seq) from public.bandchat_messages) || '/' || (select max(seq) from public.bandchat_messages) || '/' || (select last_seq from public.bandchat_rooms)")"
[ "$R" = "1/8/8/8/8" ] && ok "8 gửi đồng thời → 1 phòng, 8 tin, seq 1..8 không trùng ($R)" || fail "đồng thời: $R"

echo "── Rollback ×2 + cài lại"
baseline tva_rb; teamlab tva_rb; mig tva_rb "$ROOT/db/band_chat_v1_setup.sql" >/dev/null || fail "setup rb"
DMR="$(dmfp tva_rb)"
mig tva_rb "$ROOT/db/band_chat_v1_rollback.sql" >/dev/null || fail "rollback 1"; ok "rollback lần 1"
mig tva_rb "$ROOT/db/band_chat_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback lần 2 (idempotent)"
[ "$(q tva_rb "select count(*) from pg_class where relname like 'bandchat\_%'")" = "0" ] && [ "$(q tva_rb "select count(*) from pg_proc where proname like 'bandchat\_%'")" = "0" ] \
  && ok "rollback: hết bảng/hàm bandchat_*" || fail "rollback còn sót"
[ "$(dmfp tva_rb)" = "$DMR" ] && [ "$(q tva_rb "select count(*) from public.teamlab_band_members")" = "3" ] && ok "rollback: dm_* + Band/thành viên không đổi" || fail "rollback đổi dữ liệu khác"
mig tva_rb "$ROOT/db/band_chat_v1_setup.sql" >/dev/null || fail "cài lại"; ok "cài lại sau rollback"
[ "$(postgate tva_rb)" = "PASS" ] && ok "postflight sau cài lại: PASS" || fail "postflight cài lại"

echo "── Cổng va chạm tên + thiếu nền"
baseline tva_col; teamlab tva_col
q tva_col "create table public.bandchat_messages (id int)" >/dev/null
[ "$(gate tva_col)" = "FAIL" ] && ok "bảng bandchat_messages lạ → preflight GATE FAIL" || fail "va chạm bảng không bị bắt"
mig tva_col "$ROOT/db/band_chat_v1_setup.sql" >/dev/null 2>"$TMP/c.err" && fail "migration chạy được khi có bảng lạ"
grep -q "không thuộc Band Chat V1" "$TMP/c.err" && ok "migration tự DỪNG khi va chạm tên" || fail "cổng va chạm: $(cat "$TMP/c.err")"
mig tva_col "$ROOT/db/band_chat_v1_rollback.sql" >/dev/null 2>"$TMP/c2.err" && fail "rollback xoá bảng không phải của mình"
grep -q "không rollback" "$TMP/c2.err" && ok "rollback từ chối xoá bảng lạ" || fail "cổng rollback"
baseline tva_nob
mig tva_nob "$ROOT/db/band_chat_v1_setup.sql" >/dev/null 2>"$TMP/n.err" && fail "migration chạy được khi thiếu bảng Teamlab"
grep -q "thiếu bảng/hàm nền" "$TMP/n.err" && ok "thiếu bảng Teamlab → migration DỪNG" || fail "cổng thiếu nền"

echo "── V1.1: vai trò quản trị theo TeamLab (Trưởng → Chủ nhóm, Phó → Quản trị viên)"
baseline tva_r; teamlab tva_r; extra_users tva_r; mig tva_r "$ROOT/db/band_chat_v1_setup.sql" >/dev/null
mig tva_r "$ROOT/db/band_chat_v1_1_roles_setup.sql" >/dev/null 2>"$TMP/r0.err" && fail "V1.1 chạy được khi thiếu teamlab_band_roles"
grep -q "teamlab_band_roles" "$TMP/r0.err" && ok "thiếu bảng nguồn vai trò → V1.1 DỪNG" || fail "cổng V1.1: $(cat "$TMP/r0.err")"
psqld tva_r >/dev/null <<'SQL'
create table public.teamlab_band_roles (band_id uuid not null references public.teamlab_bands(id), project_id uuid not null, user_id uuid not null,
  role text not null check (role in ('leader','deputy','music_editor')), granted_by uuid, created_at timestamptz not null default now(),
  primary key (band_id, user_id, role));
create unique index on public.teamlab_band_roles (band_id) where role = 'leader';
create unique index on public.teamlab_band_roles (band_id) where role = 'deputy';
SQL
mig tva_r "$ROOT/db/band_chat_v1_1_roles_setup.sql" >/dev/null || fail "V1.1 lần 1"; ok "V1.1 lần 1"
mig tva_r "$ROOT/db/band_chat_v1_1_roles_setup.sql" >/dev/null || fail "V1.1 lần 2"; ok "V1.1 lần 2 (idempotent)"
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/band_chat_v1_1_roles_setup.sql" "$ROOT/db/band_chat_v1_1_roles_rollback.sql" && fail "V1.1 có begin/commit" || ok "V1.1 không có begin/commit"
[ "$(postgate tva_r)" = "PASS" ] && ok "postflight V1 vẫn PASS sau V1.1" || fail "postflight sau V1.1"
{ echo '\set ON_ERROR_STOP on'; echo 'create schema t;'; sed -n '/^grant usage on schema t/,/^grant execute on all functions in schema t/p' "$ROOT/db/tests/band_chat_v1_test.sql"; \
  grep -v '^\\set ON_ERROR_STOP' "$ROOT/db/tests/band_chat_v1_1_test.sql"; } > "$TMP/v11_test.sql"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_r -v ON_ERROR_STOP=1 \
  -f "$TMP/v11_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/v11.out"
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL V1.1"
grep -q '^FAIL' "$TMP/v11.out" && fail "có FAIL trong test V1.1" || ok "test V1.1: $(grep -c '^PASS' "$TMP/v11.out") kiểm tra PASS, 0 FAIL"
MSG0="$(q tva_r "select count(*) from public.bandchat_messages")"
mig tva_r "$ROOT/db/band_chat_v1_1_roles_rollback.sql" >/dev/null || fail "rollback V1.1"; ok "rollback V1.1"
mig tva_r "$ROOT/db/band_chat_v1_1_roles_rollback.sql" >/dev/null || fail "rollback V1.1 lần 2"; ok "rollback V1.1 lần 2 (idempotent)"
[ "$(q tva_r "select count(*) from public.bandchat_messages")" = "$MSG0" ] && [ "$MSG0" -gt 0 ] && ok "rollback V1.1 giữ nguyên $MSG0 tin nhắn" || fail "rollback V1.1 đổi tin nhắn"
[ "$(q tva_r "select count(*) from pg_proc where proname in ('bandchat_group_role','bandchat_can_admin')")" = "0" ] \
  && [ "$(q tva_r "select count(*) from information_schema.parameters where specific_schema='public' and parameter_mode='OUT' and specific_name like 'bandchat_members%' and parameter_name='group_role'")" = "0" ] \
  && ok "rollback V1.1: bandchat_members về dạng V1, hết hàm vai trò" || fail "rollback V1.1 còn sót"
mig tva_r "$ROOT/db/band_chat_v1_1_roles_setup.sql" >/dev/null || fail "cài lại V1.1"; ok "cài lại V1.1 sau rollback"

echo "── V1.2: Thầy/Admin thấy mọi Band ở mục Hỗ trợ (kể cả chưa có phòng/tin)"
baseline tva_s; teamlab tva_s; extra_users tva_s; mig tva_s "$ROOT/db/band_chat_v1_setup.sql" >/dev/null
q tva_s "delete from public.teamlab_band_members where band_id = '11111111-0000-4000-8000-0000000000a2'" >/dev/null
q tva_s "insert into public.teamlab_band_members (band_id, user_id) values ('11111111-0000-4000-8000-0000000000a2', 'cccccccc-0000-4000-8000-00000000000c')" >/dev/null
q tva_s "insert into public.teamlab_bands values ('11111111-0000-4000-8000-0000000000a3', '11111111-0000-4000-8000-0000000000b2', 'Band Z', null) on conflict do nothing" >/dev/null
mig tva_s "$ROOT/db/band_chat_v1_2_support_list_setup.sql" >/dev/null || fail "V1.2 lần 1"; ok "V1.2 lần 1"
mig tva_s "$ROOT/db/band_chat_v1_2_support_list_setup.sql" >/dev/null || fail "V1.2 lần 2"; ok "V1.2 lần 2 (idempotent)"
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/band_chat_v1_2_support_list_setup.sql" "$ROOT/db/band_chat_v1_2_support_list_rollback.sql" && fail "V1.2 có begin/commit" || ok "V1.2 không có begin/commit"
[ "$(postgate tva_s)" = "PASS" ] && ok "postflight V1 vẫn PASS sau V1.2" || fail "postflight sau V1.2"
{ echo '\set ON_ERROR_STOP on'; echo 'create schema t;'; sed -n '/^grant usage on schema t/,/^grant execute on all functions in schema t/p' "$ROOT/db/tests/band_chat_v1_test.sql"; \
  grep -v '^\\set ON_ERROR_STOP' "$ROOT/db/tests/band_chat_v1_2_test.sql"; } > "$TMP/v12_test.sql"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_s -v ON_ERROR_STOP=1 \
  -f "$TMP/v12_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/v12.out"
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL V1.2"
grep -q '^FAIL' "$TMP/v12.out" && fail "có FAIL trong test V1.2" || ok "test V1.2: $(grep -c '^PASS' "$TMP/v12.out") kiểm tra PASS, 0 FAIL"
MSG1="$(q tva_s "select count(*) from public.bandchat_messages")"
mig tva_s "$ROOT/db/band_chat_v1_2_support_list_rollback.sql" >/dev/null || fail "rollback V1.2"; ok "rollback V1.2"
[ "$(q tva_s "select count(*) from public.bandchat_messages")" = "$MSG1" ] && ok "rollback V1.2 giữ nguyên tin nhắn ($MSG1)" || fail "rollback V1.2 đổi tin"
[ "$(q tva_s "select count(*) from pg_proc where prosrc like '%tb.id%' and proname = 'bandchat_rooms'")" = "0" ] && ok "rollback V1.2: bandchat_rooms về V1" || fail "rollback V1.2 còn sót"

echo "── V1.3: Thầy đồng hành (đọc + gửi mọi nhóm Band, không cần là thành viên)"
baseline tva_c; teamlab tva_c; extra_users tva_c; mig tva_c "$ROOT/db/band_chat_v1_setup.sql" >/dev/null
q tva_c "delete from public.teamlab_band_members where band_id = '11111111-0000-4000-8000-0000000000a2'" >/dev/null
q tva_c "insert into public.teamlab_band_members (band_id, user_id) values ('11111111-0000-4000-8000-0000000000a2', 'cccccccc-0000-4000-8000-00000000000c')" >/dev/null
q tva_c "insert into public.teamlab_bands values ('11111111-0000-4000-8000-0000000000a3', '11111111-0000-4000-8000-0000000000b2', 'Band Z', null) on conflict do nothing" >/dev/null
psqld tva_c >/dev/null <<'SQL'
insert into auth.users (id, email) values ('5a5a5a5a-0000-4000-8000-0000000000a5', 's@test.local');
insert into public.app_users (id, role, name, email) values ('5a5a5a5a-0000-4000-8000-0000000000a5', 'admin', 'Thầy Văn Anh', 'vananhaudio@gmail.com');
SQL
psqld tva_c >/dev/null <<'SQL'
create table public.teamlab_band_roles (band_id uuid not null references public.teamlab_bands(id), project_id uuid not null, user_id uuid not null,
  role text not null check (role in ('leader','deputy','music_editor')), granted_by uuid, created_at timestamptz not null default now(),
  primary key (band_id, user_id, role));
SQL
mig tva_c "$ROOT/db/band_chat_v1_1_roles_setup.sql" >/dev/null || fail "V1.1 trước V1.3"
mig tva_c "$ROOT/db/band_chat_v1_2_support_list_setup.sql" >/dev/null || fail "V1.2 trước V1.3"
ACC0="$(q tva_c "select md5(prosrc) from pg_proc where proname = 'bandchat_access'")"
mig tva_c "$ROOT/db/band_chat_v1_3_companion_setup.sql" >/dev/null || fail "V1.3 lần 1"; ok "V1.3 lần 1"
mig tva_c "$ROOT/db/band_chat_v1_3_companion_setup.sql" >/dev/null || fail "V1.3 lần 2"; ok "V1.3 lần 2 (idempotent)"
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/band_chat_v1_3_companion_setup.sql" "$ROOT/db/band_chat_v1_3_companion_rollback.sql" && fail "V1.3 có begin/commit" || ok "V1.3 không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/band_chat_v1_3_companion_setup.sql" | grep -qi 'create policy\|create table\|insert into\|grant ' && fail "V1.3 có policy/bảng/dữ liệu/grant" || ok "V1.3 không policy/bảng/dữ liệu/grant"
[ "$(postgate tva_c)" = "PASS" ] && ok "postflight V1 vẫn PASS sau V1.3" || fail "postflight sau V1.3"
{ echo '\set ON_ERROR_STOP on'; echo 'create schema t;'; sed -n '/^grant usage on schema t/,/^grant execute on all functions in schema t/p' "$ROOT/db/tests/band_chat_v1_test.sql"; \
  grep -v '^\\set ON_ERROR_STOP' "$ROOT/db/tests/band_chat_v1_3_test.sql"; } > "$TMP/v13_test.sql"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_c -v ON_ERROR_STOP=1 \
  -f "$TMP/v13_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/v13.out"
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL V1.3"
grep -q '^FAIL' "$TMP/v13.out" && fail "có FAIL trong test V1.3" || ok "test V1.3: $(grep -c '^PASS' "$TMP/v13.out") kiểm tra PASS, 0 FAIL"
MSG3="$(q tva_c "select count(*) from public.bandchat_messages")"
mig tva_c "$ROOT/db/band_chat_v1_3_companion_rollback.sql" >/dev/null || fail "rollback V1.3"; ok "rollback V1.3"
mig tva_c "$ROOT/db/band_chat_v1_3_companion_rollback.sql" >/dev/null || fail "rollback V1.3 lần 2"; ok "rollback V1.3 lần 2 (idempotent)"
[ "$(q tva_c "select md5(prosrc) from pg_proc where proname = 'bandchat_access'")" = "$ACC0" ] && ok "rollback V1.3: bandchat_access về ĐÚNG bản trước (md5 khớp)" || fail "rollback V1.3 không khớp bản cũ"
[ "$(q tva_c "select count(*) from pg_proc where proname = 'bandchat_is_companion'")" = "0" ] && [ "$(q tva_c "select count(*) from public.bandchat_messages")" = "$MSG3" ] && ok "rollback V1.3: hết hàm mới, giữ nguyên $MSG3 tin nhắn" || fail "rollback V1.3 còn sót/đổi tin"
q tva_c "set role authenticated; select set_config('request.jwt.claims','{\"sub\":\"5a5a5a5a-0000-4000-8000-0000000000a5\",\"role\":\"authenticated\"}',false); select public.bandchat_send('11111111-0000-4000-8000-0000000000a1','x')" >/dev/null 2>&1 \
  && fail "sau rollback Thầy vẫn gửi được" || ok "sau rollback Thầy lại chỉ đọc"
mig tva_c "$ROOT/db/band_chat_v1_3_companion_setup.sql" >/dev/null || fail "cài lại V1.3"; ok "cài lại V1.3 sau rollback"

echo "── Hồi quy chat cá nhân: dm_v1_test trên DB có cả Band Chat"
baseline tva_dm; teamlab tva_dm; mig tva_dm "$ROOT/db/band_chat_v1_setup.sql" >/dev/null
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_dm -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/dm_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' > "$TMP/dm.out" || { tail -5 "$TMP/dm.out"; fail "dm_v1_test"; }
grep -q '^FAIL' "$TMP/dm.out" && fail "dm_v1_test có FAIL" || ok "dm_v1_test: $(grep -c '^PASS' "$TMP/dm.out") PASS, 0 FAIL (chat cá nhân không bị ảnh hưởng)"
echo "ALL BAND CHAT V1 DB TESTS PASSED"
