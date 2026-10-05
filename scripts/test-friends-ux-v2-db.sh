#!/usr/bin/env bash
# Test Friends UX V2 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).
#   bash scripts/test-friends-ux-v2-db.sh
# Phủ: md5 hàm bản repo = production · preflight GATE · migration ×2 (một transaction như prod-db) trên bảng CÓ DỮ LIỆU
# (dấu vân tay friendships không đổi) · chạy lại rls_setup.sql · test SQL theo identity · postflight GATE · rollback ×2
# (md5 về bản cũ, dữ liệu không đổi) + cài lại · cổng drift · cổng dữ liệu (migration lỡ ghi friendships → huỷ cả transaction).
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvafv2.XXXXXX)"
PORT="${PORT:-$((56300 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }   # như scripts/prod-db.py: cả file trong MỘT transaction
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

OLD_MD5=a09b7ad5f7f402a2a35a7b262f3dd40a
NEW_MD5=8f03c840dc8ab3607851c824d40d566e
OUT_MD5=7b2e12aa4c3bf8c54877f9256dd984fe
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
}
# Dữ liệu giống production về HÌNH DẠNG: accepted + pending hai chiều + một hàng declined cũ
seed() {
  q "$1" "insert into public.friendships (requester_id, addressee_id, status, created_at, responded_at) values
    ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b', 'accepted', now() - interval '3 days', now() - interval '2 days'),
    ('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'pending', now() - interval '1 day', null),
    ('bbbbbbbb-0000-4000-8000-00000000000b', 'cccccccc-0000-4000-8000-00000000000c', 'declined', now() - interval '5 days', now() - interval '4 days')" >/dev/null
}
PRE="$(cat "$ROOT/db/friends_ux_v2_preflight.sql")"
POST="$(cat "$ROOT/db/friends_ux_v2_postflight.sql")"
gate() { q "$1" "select item from (${PRE%;}) z where section = 'GATE'"; }
postgate() { q "$1" "select item from (${POST%;}) z where section = 'GATE'"; }
fp() { q "$1" "select item from (${PRE%;}) z where item like 'friendships dấu vân tay:%'"; }
md5r() { q "$1" "select md5(prosrc) from pg_proc where proname = 'respond_friend_request'"; }

echo "── Hằng md5: setup/preflight/postflight/script khớp nhau"
grep -q "'$NEW_MD5'" "$ROOT/db/friends_ux_v2_setup.sql" && grep -q "'$NEW_MD5'" "$ROOT/db/friends_ux_v2_preflight.sql" \
  && grep -q "'$NEW_MD5'" "$ROOT/db/friends_ux_v2_postflight.sql" && grep -q "'$OUT_MD5'" "$ROOT/db/friends_ux_v2_postflight.sql" \
  && grep -q "'$OLD_MD5'" "$ROOT/db/friends_ux_v2_setup.sql" && ok "md5 cũ/mới giống nhau ở mọi file" || fail "hằng md5 lệch"
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/friends_ux_v2_rollback.sql" \
  && fail "file migration có begin/commit (prod-db sở hữu transaction)" || ok "setup/rollback không có begin/commit"

echo "── Baseline (giả lập production) + dữ liệu"
baseline tva_fv2
seed tva_fv2
FP0="$(fp tva_fv2)"
[ "$(md5r tva_fv2)" = "$OLD_MD5" ] && ok "md5 respond_friend_request bản repo = production ($OLD_MD5)" || fail "md5 baseline: $(md5r tva_fv2)"
[ "$(gate tva_fv2)" = "PASS" ] && ok "preflight baseline: GATE = PASS" || { psqld tva_fv2 -c "${PRE%;}"; fail "preflight baseline"; }

echo "── Migration ×2 + rls_setup.sql"
mig tva_fv2 "$ROOT/db/friends_ux_v2_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_fv2 "$ROOT/db/friends_ux_v2_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(fp tva_fv2)" = "$FP0" ] && ok "dữ liệu friendships y hệt trước migration ($FP0)" || fail "dữ liệu đổi: $(fp tva_fv2)"
[ "$(md5r tva_fv2)" = "$NEW_MD5" ] && ok "md5 respond_friend_request mới = $NEW_MD5" || fail "md5 mới: $(md5r tva_fv2)"
psqld tva_fv2 -f "$ROOT/db/rls_setup.sql" >/dev/null || fail "rls_setup"; ok "chạy lại rls_setup.sql"
[ "$(gate tva_fv2)" = "PASS" ] && ok "preflight sau migration vẫn PASS" || fail "preflight sau migration"
[ "$(postgate tva_fv2)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld tva_fv2 -c "${POST%;}"; fail "postflight"; }

echo "── Test SQL theo identity (bảng trống, dữ liệu seed tạm gỡ)"
q tva_fv2 "create table seed_backup as select * from public.friendships; delete from public.friendships" >/dev/null
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_fv2 -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/friends_ux_v2_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"
q tva_fv2 "insert into public.friendships select * from seed_backup; drop table seed_backup" >/dev/null
[ "$(fp tva_fv2)" = "$FP0" ] && ok "dữ liệu seed khôi phục nguyên vẹn" || fail "khôi phục seed"

echo "── Rollback ×2 + cài lại"
mig tva_fv2 "$ROOT/db/friends_ux_v2_rollback.sql" >/dev/null || fail "rollback 1"; ok "rollback lần 1"
mig tva_fv2 "$ROOT/db/friends_ux_v2_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback lần 2 (idempotent)"
[ "$(md5r tva_fv2)" = "$OLD_MD5" ] && ok "rollback: md5 respond_friend_request về đúng bản production" || fail "rollback md5: $(md5r tva_fv2)"
[ "$(q tva_fv2 "select count(*) from pg_proc where proname = 'outgoing_friend_requests'")" = "0" ] && ok "rollback: hết outgoing_friend_requests" || fail "rollback còn sót"
[ "$(fp tva_fv2)" = "$FP0" ] && ok "rollback: dữ liệu friendships không đổi" || fail "rollback đổi dữ liệu"
[ "$(gate tva_fv2)" = "PASS" ] && ok "preflight sau rollback: PASS" || fail "preflight sau rollback"
mig tva_fv2 "$ROOT/db/friends_ux_v2_setup.sql" >/dev/null || fail "cài lại"; ok "cài lại sau rollback"
[ "$(postgate tva_fv2)" = "PASS" ] && ok "postflight sau cài lại: PASS" || fail "postflight cài lại"

echo "── Cổng drift"
baseline tva_drift
q tva_drift "create or replace function public.unfriend(p_user uuid) returns text language sql security definer set search_path = '' as \$\$ select 'none'::text \$\$" >/dev/null
[ "$(gate tva_drift)" = "FAIL" ] && ok "unfriend bị sửa tay → GATE FAIL" || fail "drift unfriend không bị bắt"
baseline tva_drift2
q tva_drift2 "create policy bad_read on public.friendships for select to authenticated using (true)" >/dev/null
[ "$(gate tva_drift2)" = "FAIL" ] && ok "có policy trên friendships → GATE FAIL" || fail "drift policy không bị bắt"
baseline tva_drift3
q tva_drift3 "create or replace function public.respond_friend_request(p_user uuid, p_accept boolean) returns text language sql security definer set search_path = '' as \$\$ select 'x'::text \$\$" >/dev/null
[ "$(gate tva_drift3)" = "FAIL" ] && ok "respond_friend_request bị sửa tay → preflight GATE FAIL" || fail "drift respond (preflight)"
mig tva_drift3 "$ROOT/db/friends_ux_v2_setup.sql" >/dev/null 2>"$TMP/d3.err" && fail "migration chạy được trên production lệch"
grep -q "DỪNG — respond_friend_request trên production khác repo" "$TMP/d3.err" && ok "migration tự DỪNG khi respond_friend_request lệch repo" || fail "cổng trong migration: $(cat "$TMP/d3.err")"

echo "── Cổng dữ liệu: migration lỡ ghi friendships → cả transaction bị huỷ"
baseline tva_guard
seed tva_guard
FPG="$(fp tva_guard)"
awk '{print} /^-- 2\) Xác nhận/ && !done {print "update public.friendships set responded_at = now() where status = '"'"'pending'"'"'; -- LỖI CỐ Ý"; done=1}' \
  "$ROOT/db/friends_ux_v2_setup.sql" > "$TMP/broken.sql"
grep -q "LỖI CỐ Ý" "$TMP/broken.sql" || fail "không chèn được lỗi"
mig tva_guard "$TMP/broken.sql" >/dev/null 2>"$TMP/broken.err" && fail "migration ghi dữ liệu mà không bị chặn"
grep -q "DỪNG — dữ liệu friendships đổi trong migration" "$TMP/broken.err" || fail "lỗi không đúng: $(cat "$TMP/broken.err")"
[ "$(fp tva_guard)" = "$FPG" ] && [ "$(md5r tva_guard)" = "$OLD_MD5" ] \
  && [ "$(q tva_guard "select count(*) from pg_proc where proname = 'outgoing_friend_requests'")" = "0" ] \
  && ok "migration lỡ ghi dữ liệu → DỪNG, dữ liệu + hàm y như trước (không nửa chừng)" || fail "nửa migration"

echo "ALL PASS"
