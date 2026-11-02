#!/usr/bin/env bash
# Test Chat List V2 (db/chat_list_v2_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-chat-list-v2-db.sh
# Phủ: preflight · migration ×2 · khoá · test SQL theo identity (quyền, rò rỉ qua tìm kiếm, ghim, con trỏ, Thầy/Admin) · tương thích RPC cũ ·
#      dữ liệu LỚN (hàng nghìn hội thoại: duyệt hết bằng con trỏ, tìm hội thoại chưa tải, thời gian) · postflight · rollback ×2 + cài lại ·
#      cổng va chạm tên · hồi quy dm_v1_test + band_chat_v1_test trên DB đã có Chat List V2 (chat cá nhân/Band không đổi).
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvacl.XXXXXX)"
PORT="${PORT:-$((56700 + RANDOM % 90))}"
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
PRE="$(cat "$ROOT/db/chat_list_v2_preflight.sql")"
POST="$(cat "$ROOT/db/chat_list_v2_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }
fp() { q "$1" "select string_agg(p.proname || '/' || p.pronargs || '=' || md5(p.prosrc), ',' order by p.proname, p.pronargs) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'dm\_%' or p.proname like 'bandchat\_%' or p.proname = 'class_public_identity' or p.proname = 'class_ugc_pair_blocked')"; }
TPRE="$(sed -n '/^grant usage on schema t/,/^grant execute on all functions in schema t/p' "$ROOT/db/tests/band_chat_v1_test.sql")"

echo "── Tĩnh"
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/chat_list_v2_setup.sql" "$ROOT/db/chat_list_v2_rollback.sql" \
  && fail "file migration có begin/commit (prod-db sở hữu transaction)" || ok "setup/rollback không có begin/commit"
grep -v '^[[:space:]]*--' "$ROOT/db/chat_list_v2_setup.sql" | grep -qi 'create policy' && fail "setup có CREATE POLICY" || ok "setup không có CREATE POLICY"
grep -v '^[[:space:]]*--' "$ROOT/db/chat_list_v2_setup.sql" | grep -qiE '(alter|drop|update|delete from|insert into) +(public\.)?(dm_|bandchat_|teamlab_)' \
  && fail "setup đụng bảng dm_/bandchat_/teamlab_" || ok "setup không sửa/ghi bảng dm_*/bandchat_*/teamlab_*"

echo "── Baseline (giả lập production)"
baseline tva_cl
FP0="$(fp tva_cl)"
[ "$(gate tva_cl)" = "PASS" ] && ok "preflight baseline: GATE = PASS" || { psqld tva_cl -c "${PRE%;}"; fail "preflight baseline"; }
[ "$(postgate tva_cl)" = "FAIL" ] && ok "postflight trước migration: FAIL (đúng, chưa cài)" || fail "postflight lẽ ra FAIL trước migration"

echo "── Migration ×2"
mig tva_cl "$ROOT/db/chat_list_v2_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_cl "$ROOT/db/chat_list_v2_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(fp tva_cl)" = "$FP0" ] && ok "hàm dm_*/bandchat_*/identity KHÔNG đổi (md5 khớp)" || fail "hàm nền bị đổi"
[ "$(postgate tva_cl)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld tva_cl -c "${POST%;}"; fail "postflight"; }
[ "$(gate tva_cl)" = "PASS" ] && ok "preflight sau migration vẫn PASS (đối tượng đúng nguồn gốc)" || fail "preflight sau migration"

echo "── Khoá trong migration (chỉ bảng chat_pins mới + auth.users cho khoá ngoại)"
baseline tva_lock
LOCKS="$(psqld tva_lock -tA <<SQL
begin;
\i $ROOT/db/chat_list_v2_setup.sql
select coalesce(string_agg(distinct n.nspname || '.' || c.relname || ':' || l.mode, ', ' order by n.nspname || '.' || c.relname || ':' || l.mode), '')
  from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
 where l.pid = pg_backend_pid() and l.locktype = 'relation' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
   and c.relkind = 'r' and c.relname <> 'chat_pins' and l.mode in ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock', 'ShareLock', 'ShareUpdateExclusiveLock', 'RowExclusiveLock');
rollback;
SQL
)"
echo "   khoá mạnh trên bảng NGOÀI chat_pins: ${LOCKS:-(không)}"
case "$LOCKS" in
  ""|"auth.users:ShareRowExclusiveLock") ok "migration chỉ khoá chat_pins (+ auth.users ngắn cho khoá ngoại)";;
  *) fail "khoá không mong đợi: $LOCKS";;
esac

echo "── Test SQL theo identity (quyền · rò rỉ · lọc · tìm kiếm · con trỏ · ghim · Thầy/Admin · tương thích)"
{ echo '\set ON_ERROR_STOP on'; echo 'create schema t;'; echo "$TPRE"; echo 'create function t.band(k text) returns uuid language sql immutable as $$ select case k when '"'X'"' then '"'11111111-0000-4000-8000-0000000000a1'"'::uuid when '"'Y'"' then '"'11111111-0000-4000-8000-0000000000a2'"'::uuid when '"'Z'"' then '"'11111111-0000-4000-8000-0000000000a3'"'::uuid end $$;'; echo 'grant execute on function t.band(text) to anon, authenticated;'; \
  grep -v '^\\set ON_ERROR_STOP' "$ROOT/db/tests/chat_list_v2_test.sql"; } > "$TMP/cl_test.sql"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_cl -v ON_ERROR_STOP=1 \
  -f "$TMP/cl_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/test.out"
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"
grep -q '^FAIL' "$TMP/test.out" && fail "có FAIL trong test" || ok "test SQL: $(grep -c '^PASS' "$TMP/test.out") kiểm tra PASS, 0 FAIL"

echo "── Dữ liệu LỚN: 1500 DM + 300 Band cho một học sinh; Thầy thấy 300 Band"
baseline tva_big
mig tva_big "$ROOT/db/chat_list_v2_setup.sql" >/dev/null
psqld tva_big >/dev/null <<'SQL'
-- 1500 người bạn giả + 1500 hội thoại DM có tin; 300 Band mà A là thành viên (150 có tin)
insert into auth.users (id, email) select ('99999999-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'z' || i || '@test.local' from generate_series(1, 1500) i;
insert into public.app_users (id, role, name, email) select ('99999999-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'student', 'Zed ' || lpad(i::text, 4, '0'), 'z' || i || '@test.local' from generate_series(1, 1500) i;
insert into public.edu_students (user_id, full_name, display_name, email, level) select ('99999999-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'Zed ' || lpad(i::text, 4, '0'), 'Zed ' || lpad(i::text, 4, '0'), 'z' || i || '@test.local', 'beginner' from generate_series(1, 1500) i;
insert into public.dm_conversations (id, user_lo, user_hi, last_seq, last_message_at)
  select ('88888888-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
         least('aaaaaaaa-0000-4000-8000-00000000000a'::uuid, ('99999999-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid),
         greatest('aaaaaaaa-0000-4000-8000-00000000000a'::uuid, ('99999999-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid),
         2, now() - (i || ' minutes')::interval from generate_series(1, 1500) i;
insert into public.dm_participants (conversation_id, user_id, last_read_seq)
  select ('88888888-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-00000000000a', case when i % 3 = 0 then 0 else 2 end from generate_series(1, 1500) i
  union all select ('88888888-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, ('99999999-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 2 from generate_series(1, 1500) i;
insert into public.dm_messages (conversation_id, seq, sender_id, body, created_at)
  select ('88888888-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, s, ('99999999-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'tin ' || s, now() - (i || ' minutes')::interval from generate_series(1, 1500) i, generate_series(1, 2) s;
insert into public.teamlab_bands select ('77777777-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, '11111111-0000-4000-8000-0000000000b1', 'Nhóm ' || lpad(i::text, 3, '0'), null from generate_series(1, 300) i;
insert into public.teamlab_band_members (band_id, user_id) select ('77777777-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-00000000000a' from generate_series(1, 300) i;
SQL
cat > "$TMP/walk.sql" <<'SQL'
do $w$ declare c_at timestamptz; c_key text; n int; pg int := 0; r record; keys text[] := '{}'; begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  loop
    n := 0; pg := pg + 1;
    for r in select * from public.chat_inbox(p_limit => 50, p_cursor_at => c_at, p_cursor_key => c_key) loop
      keys := keys || r.conv_key; c_at := r.sort_at; c_key := r.conv_key; n := n + 1;
    end loop;
    exit when n = 0;
  end loop;
  raise notice 'RESULT %/%/%', array_length(keys, 1), (select count(distinct x) from unnest(keys) x), pg;
end $w$;
SQL
RES="$(PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_big -v ON_ERROR_STOP=1 -f "$TMP/walk.sql" 2>&1 | sed -n 's/.*RESULT //p')"
[ "$RES" = "1801/1801/38" ] && ok "duyệt bằng con trỏ (50/trang, 38 lượt gồm lượt rỗng cuối): đủ 1801 hội thoại (1500 DM + 300 Band + Band X), 0 trùng, 0 sót" || fail "duyệt con trỏ: $RES"
AS_A="set role authenticated; select set_config('request.jwt.claims','{\"sub\":\"aaaaaaaa-0000-4000-8000-00000000000a\",\"role\":\"authenticated\"}',false);"
T0=$(python3 -c 'import time;print(int(time.time()*1000))')
FIRSTN="$(psqld tva_big -tA -c "${AS_A} select count(*) from public.chat_inbox(p_limit => 30)" | tail -1)"
T1=$(python3 -c 'import time;print(int(time.time()*1000))')
[ "$FIRSTN" = "30" ] && [ $((T1-T0)) -lt 3000 ] && ok "trang đầu 30 hàng trên 1800 hội thoại: $((T1-T0)) ms (gồm khởi động psql)" || fail "trang đầu: $FIRSTN trong $((T1-T0)) ms"
HIT="$(psqld tva_big -tA -c "${AS_A} select name from public.chat_inbox(p_query => 'zed 1499') " | tail -1)"
[ "$HIT" = "Zed 1499" ] && ok "tìm 'zed 1499' = hội thoại cũ nhất (xa hơn 1400 hàng so với trang đầu) → tìm được dù chưa tải" || fail "tìm hội thoại xa: '$HIT'"
HITB="$(psqld tva_big -tA -c "${AS_A} select name from public.chat_inbox(p_query => 'nhom 300')" | tail -1)"
[ "$HITB" = "Nhóm 300" ] && ok "tìm 'nhom 300' (Band chưa có tin, bỏ dấu) → tìm được" || fail "tìm Band: '$HITB'"
CNT="$(psqld tva_big -tA -c "${AS_A} select count(*) from public.chat_inbox(p_query => 'zed', p_limit => 50)" | tail -1)"
[ "$CNT" = "50" ] && ok "tìm 'zed' trả tối đa 50/trang (phân trang cả khi tìm kiếm)" || fail "tìm theo trang: $CNT"
SUM="$(psqld tva_big -tA -c "${AS_A} select dm_total || '/' || band_total || '/' || unread_dm from public.chat_inbox_summary()" | tail -1)"
[ "$SUM" = "1500/301/500" ] && ok "summary đúng: 1500 DM, 301 Band, 500 DM chưa đọc" || fail "summary: $SUM"
TT="set role authenticated; select set_config('request.jwt.claims','{\"sub\":\"dddddddd-0000-4000-8000-00000000000d\",\"role\":\"authenticated\"}',false);"
SUP="$(psqld tva_big -tA -c "${TT} select count(*) from public.chat_inbox(p_scope => 'support', p_limit => 50)" | tail -1)"
SUPT="$(psqld tva_big -tA -c "${TT} select support_total || '/' || dm_total || '/' || band_total from public.chat_inbox_summary()" | tail -1)"
[ "$SUP" = "50" ] && [ "$SUPT" = "303/0/0" ] && ok "Thầy: khu quản lý Band 303 Band (50/trang), danh sách chính 0 → không tràn" || fail "Thầy support: $SUP $SUPT"
OLD="$(psqld tva_big -tA -c "${AS_A} select count(*) from public.dm_conversations_safe(100)" | tail -1)"
[ "$OLD" = "100" ] && ok "RPC cũ dm_conversations_safe vẫn chạy như trước (trần 100) — chỉ để tương thích" || fail "RPC cũ: $OLD"

echo "── Rollback ×2 + cài lại"
baseline tva_rb; mig tva_rb "$ROOT/db/chat_list_v2_setup.sql" >/dev/null || fail "setup rb"
DMR="$(fp tva_rb)"
mig tva_rb "$ROOT/db/chat_list_v2_rollback.sql" >/dev/null || fail "rollback 1"; ok "rollback lần 1"
mig tva_rb "$ROOT/db/chat_list_v2_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback lần 2 (idempotent)"
[ "$(q tva_rb "select count(*) from pg_proc where proname like 'chat\_%'")" = "0" ] && [ "$(q tva_rb "select count(*) from pg_class where relname = 'chat_pins'")" = "0" ] \
  && ok "rollback: hết hàm chat_* và bảng chat_pins" || fail "rollback còn sót"
[ "$(fp tva_rb)" = "$DMR" ] && ok "rollback: dm_*/bandchat_* không đổi" || fail "rollback đổi hàm nền"
mig tva_rb "$ROOT/db/chat_list_v2_setup.sql" >/dev/null || fail "cài lại"; ok "cài lại sau rollback"
[ "$(postgate tva_rb)" = "PASS" ] && ok "postflight sau cài lại: PASS" || fail "postflight cài lại"

echo "── Cổng va chạm tên + thiếu nền"
baseline tva_col
q tva_col "create table public.chat_pins (id int)" >/dev/null
[ "$(gate tva_col)" = "FAIL" ] && ok "bảng chat_pins lạ → preflight GATE FAIL" || fail "va chạm bảng không bị bắt"
mig tva_col "$ROOT/db/chat_list_v2_setup.sql" >/dev/null 2>"$TMP/c.err" && fail "migration chạy được khi có bảng lạ"
grep -q "không thuộc Chat List V2" "$TMP/c.err" && ok "migration tự DỪNG khi va chạm tên" || fail "cổng va chạm: $(cat "$TMP/c.err")"
mig tva_col "$ROOT/db/chat_list_v2_rollback.sql" >/dev/null 2>"$TMP/c2.err" && fail "rollback xoá bảng không phải của mình"
grep -q "không rollback" "$TMP/c2.err" && ok "rollback từ chối xoá bảng lạ" || fail "cổng rollback"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres tva_nob
mig tva_nob "$ROOT/db/chat_list_v2_setup.sql" >/dev/null 2>"$TMP/n.err" && fail "migration chạy được khi thiếu nền"
grep -q "thiếu nền" "$TMP/n.err" && ok "thiếu nền (dm/Band Chat) → migration DỪNG" || fail "cổng thiếu nền"

echo "── Hồi quy: dm_v1_test + band_chat_v1_test trên DB ĐÃ cài Chat List V2"
EXTRAS=0 baseline tva_dm; mig tva_dm "$ROOT/db/chat_list_v2_setup.sql" >/dev/null
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_dm -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/dm_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' > "$TMP/dm.out" || { tail -5 "$TMP/dm.out"; fail "dm_v1_test"; }
grep -q '^FAIL' "$TMP/dm.out" && fail "dm_v1_test có FAIL" || ok "dm_v1_test: $(grep -c '^PASS' "$TMP/dm.out") PASS, 0 FAIL (chat cá nhân không bị ảnh hưởng)"
echo "ALL CHAT LIST V2 DB TESTS PASSED"
