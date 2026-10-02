#!/usr/bin/env bash
# Test CLASS MEMBERSHIP CANONICAL V1 trên cluster PostgreSQL 17 TẠM (tự xoá). KHÔNG kết nối production.
#   bash scripts/test-class-membership-canonical-db.sh            # chạy toàn bộ
#   bash scripts/test-class-membership-canonical-db.sh --new-md5  # in md5 thân hàm V1 (để ghi vào cổng setup)
# Phủ: cổng setup (chưa canonical → DỪNG) · setup ×2 · rls_setup · test ngữ nghĩa theo từng danh tính
# · rollback ×2 (thân hàm về nguyên văn) · cài lại. Dữ liệu GIẢ. Phần DỮ LIỆU production (mapping id thật, sĩ số,
# cổng drift, no-loss/no-expansion) được test ở hạ tầng PRIVATE: prod-migrations/class-membership-canonical-v1/test-data.sh.
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvaccm.XXXXXX)"
PORT="${PORT:-$((55900 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

FNS="'activate_class_membership','backfill_class','grant_class_courses_on_join','lt_identity_snapshot','manage_class_curriculum_access','manage_class_membership','my_class_leaderboard','my_membership','social_class_card','social_class_members_of','social_learning_identities','can_read_class_curriculum'"
FN_MD5() { q "$1" "select string_agg(n.nspname || '.' || p.proname || '=' || md5(p.prosrc), ' ' order by n.nspname, p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname in ($FNS) and n.nspname in ('public','tva_private')"; }

grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
base() {   # $1 db · $2 fixture (roles lần đầu) · $3 = "data" để nạp dữ liệu Lớp của tôi V1
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  psqld "$db" -f "$2" >/dev/null
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null; done
  psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
  [ "${3:-}" = "data" ] && psqld "$db" -f "$ROOT/db/tests/local/class_checkpoints_fixture_data.sql" >/dev/null
  psqld "$db" -c "begin;" -f "$ROOT/db/class_checkpoints_v1_setup.sql" -c "commit;" >/dev/null
  psqld "$db" -c "begin;" -f "$ROOT/db/social_learning_identity_v1_setup.sql" -c "commit;" >/dev/null
  psqld "$db" -f "$ROOT/db/tests/local/class_membership_canonical_fixture.sql" >/dev/null
}
# Bản setup cho cluster tạm: thay md5 production trong cổng bằng md5 thân hàm "trước V1" của fixture (cổng vẫn chạy thật).
local_setup() {
  local db=$1 out=$2 s
  cp "$ROOT/db/class_membership_canonical_v1_setup.sql" "$out"
  for pair in $(FN_MD5 "$db"); do
    local fn=${pair%%=*} md=${pair##*=}
    s=$(grep -o "\"$fn\": \[\"[0-9a-f]*\"" "$out" | grep -o '[0-9a-f]\{32\}')
    [ -n "$s" ] || fail "không thấy hằng md5 của $fn trong cổng"
    sed -i '' "s/\"$fn\": \[\"$s\"/\"$fn\": [\"$md\"/" "$out"
  done
}
run_tx() { local db=$1; shift; local args=(); for f in "$@"; do args+=(-f "$f"); done; psqld "$db" -c "begin;" "${args[@]}" -c "commit;"; }

grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT"/db/class_membership_canonical_v1_*.sql \
  && fail "file migration có begin/commit (prod-db.py sở hữu transaction)" || ok "file setup/rollback không tự begin/commit"
grep -qE "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}" "$ROOT"/db/class_membership_canonical_v1_*.sql \
  && fail "file migration public chứa uuid (topology production phải ở private)" || ok "file migration public KHÔNG chứa id production"
grep -q '@NEW:' "$ROOT/db/class_membership_canonical_v1_setup.sql" && [ "${1:-}" != "--new-md5" ] \
  && fail "cổng setup còn chỗ giữ @NEW — chạy --new-md5 và ghi md5 V1 vào cổng"

if [ "${1:-}" = "--new-md5" ]; then
  base t_md5 "$ROOT/db/tests/local/social_fixture.sql" data
  psqld t_md5 -c "update public.class_schedule set cohort_group_id = coalesce(cohort_group_id, group_id), group_id = coalesce(cohort_group_id, group_id)" >/dev/null
  sed '/^do \$gate\$/,/^end \$gate\$;/d' "$ROOT/db/class_membership_canonical_v1_setup.sql" > "$TMP/nogate.sql"
  run_tx t_md5 "$TMP/nogate.sql" >/dev/null
  FN_MD5 t_md5 | tr ' ' '\n'
  exit 0
fi

echo "── NGỮ NGHĨA: từng danh tính (học sinh lớp Zalo cũ, học sinh cohort, thầy, khách, ngoài lớp)"
base t_sem "$ROOT/db/tests/local/social_fixture.sql" data
psqld t_sem >/dev/null <<'SQL'
insert into auth.users (id, email) values ('dddd0000-0000-4000-8000-0000000000d1', 'd@test.local');
insert into public.app_users (id, role, name, email) values ('dddd0000-0000-4000-8000-0000000000d1', 'student', 'Dũng', 'd@test.local');
insert into public.edu_students (user_id, full_name, email) values ('dddd0000-0000-4000-8000-0000000000d1', 'Phạm Dũng', 'd@test.local');
insert into public.edu_groups (id, name, group_type, code, zalo_url) values
  ('f9000000-0000-4000-8000-000000000001', 'Nhóm Zalo ZZ', 'zalo', 'Z-CODE-ZZ', 'https://zalo.me/g/zz'),
  ('f9000000-0000-4000-8000-000000000002', 'Mồi trùng mã', 'zalo', 'SOLO01.TH02', null),
  ('f9000000-0000-4000-8000-000000000003', 'Nhóm lớp huỷ', 'zalo', 'CXL.T1', null);
insert into public.class_schedule (code, name, status, group_id, main_course_id, course_ids, public_product, start_date) values
  ('ZZ.T9', 'Lớp Zalo cũ', 'active', 'f9000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000d2',
   '{c0000000-0000-4000-8000-0000000000d2}', 'guitar_can_ban', current_date - 3),
  ('CXL.T1', 'Lớp huỷ', 'cancelled', 'f9000000-0000-4000-8000-000000000003', null, '{}', null, null),
  ('NOGRP.T1', 'Lớp chưa có nhóm', 'upcoming', null, null, '{}', null, null);
insert into public.edu_group_members (user_id, group_id, source, status) values
  ('cccccccc-0000-4000-8000-00000000000c', 'f9000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'f9000000-0000-4000-8000-000000000002', 'admin', 'active');
insert into public.packages (package_code, name, status, config) values ('CLASS_MONTHLY', 'Membership tháng', 'active', '{"plan":"monthly"}');
insert into public.leads (student_id, note, class_name, status)
  select id, '[plan:monthly] ccm-test', 'Lớp Zalo cũ · ZZ.T9', 'Mới đăng ký' from public.edu_students where user_id = 'dddd0000-0000-4000-8000-0000000000d1';
SQL
BASE_MD5="$(FN_MD5 t_sem)"
[ "$(q t_sem "select count(*) from public.social_class_members_of((select id from public.class_schedule where code = 'SOLO01.TH02'))")" = "2" ] \
  && ok "TRƯỚC: luật Social cũ tính B vào SOLO01.TH02 nhờ nhóm trùng mã (2 người)" || fail "trước: luật cũ"
local_setup t_sem "$TMP/setup_sem.sql"
run_tx t_sem "$TMP/setup_sem.sql" >/dev/null 2>"$TMP/e0" && fail "setup chạy được khi lớp còn group_id ≠ cohort"
grep -q "chạy phần dữ liệu trước" "$TMP/e0" && ok "cổng setup: lớp chưa canonical → DỪNG" || fail "setup gate: $(cat "$TMP/e0")"
# phần dữ liệu tổng quát cho fixture (production dùng mapping chốt ở private): lớp Zalo cũ → canonical = nhóm đang gắn
psqld t_sem -c "update public.class_schedule set cohort_group_id = coalesce(cohort_group_id, group_id), group_id = coalesce(cohort_group_id, group_id)" >/dev/null
run_tx t_sem "$TMP/setup_sem.sql" >/dev/null && run_tx t_sem "$TMP/setup_sem.sql" >/dev/null && ok "setup ×2 (idempotent)"
psqld t_sem -f "$ROOT/db/rls_setup.sql" >/dev/null
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_sem -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_membership_canonical_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL canonical"
echo "── JOIN CODE V1: setup ×2 · test · rollback (cần gỡ trước canonical)"
run_tx t_sem "$ROOT/db/class_join_code_v1_setup.sql" >/dev/null && run_tx t_sem "$ROOT/db/class_join_code_v1_setup.sql" >/dev/null && ok "Join Code setup ×2"
[ "$(q t_sem "select count(*) from information_schema.routine_privileges where routine_name in ('class_join','class_join_preview','admin_class_join_code','class_learning_entry','class_for_join_code','normalize_join_code') and grantee in ('anon','PUBLIC')")" = "0" ] \
  && ok "Join Code: anon không EXECUTE; hàm nội bộ không cấp" || fail "Join Code quyền"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_sem -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_join_code_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | grep -v "drop cascades\|^DETAIL"
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL Join Code"
run_tx t_sem "$ROOT/db/class_membership_canonical_v1_rollback.sql" >/dev/null 2>"$TMP/e2" && fail "rollback canonical chạy khi Join Code còn cài"
grep -q "Join Code V1 đang cài" "$TMP/e2" && ok "rollback canonical tự DỪNG khi Join Code còn cài" || fail "thứ tự rollback: $(cat "$TMP/e2")"
run_tx t_sem "$ROOT/db/class_join_code_v1_rollback.sql" >/dev/null && run_tx t_sem "$ROOT/db/class_join_code_v1_rollback.sql" >/dev/null
[ "$(q t_sem "select count(*) from pg_proc where proname in ('class_join','class_join_preview','admin_class_join_code','class_learning_entry')")/$(q t_sem "select count(*) from public.edu_group_claim_tokens where is_active and token ~ '^[A-HJ-KM-NP-Z2-9]{8}\$'")" = "0/0" ] \
  && ok "Join Code rollback ×2: gỡ RPC, mã đã phát bị TẮT (không xoá), thành viên giữ nguyên" || fail "Join Code rollback"
echo "── Rollback ×2 (thân hàm nguyên văn) rồi cài lại"
run_tx t_sem "$ROOT/db/class_membership_canonical_v1_rollback.sql" >/dev/null && run_tx t_sem "$ROOT/db/class_membership_canonical_v1_rollback.sql" >/dev/null
[ "$(FN_MD5 t_sem)" = "$BASE_MD5" ] && ok "rollback ×2: 12 hàm về ĐÚNG thân cũ (md5 khớp)" || fail "md5 sau rollback: $(FN_MD5 t_sem)"
[ "$(q t_sem "select to_regclass('tva_private.class_memberships') is null and to_regclass('tva_private.ccm_v1_backup') is null and to_regprocedure('public.my_class_memberships()') is null and not exists (select 1 from pg_constraint where conname = 'class_schedule_one_member_group')")" = "t" ] \
  && ok "rollback: gỡ view/bảng sao lưu/RPC/CHECK" || fail "rollback sót"
run_tx t_sem "$TMP/setup_sem.sql" >/dev/null && [ "$(q t_sem "select count(*) from tva_private.class_memberships where class_id = (select id from public.class_schedule where code = 'ZZ.T9')")" -ge 1 ] \
  && ok "cài lại sau rollback" || fail "cài lại"
echo "ALL PASS — Class Membership Canonical V1 (DB)"
