#!/usr/bin/env bash
# Test Learning Thread P1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew).
#   bash scripts/test-learning-threads-db.sh
# Phủ: hằng md5 cổng = bản repo (khớp production 29/09) · preflight GATE (thường + dồn một dòng) · migration ×2
# · chạy lại rls_setup.sql · test SQL theo từng identity · rollback ×2 + cài lại · lỗi giữa migration
# · cổng drift (hàm phụ thuộc sửa tay / thiếu cột) · hằng số preflight = migration.
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvalt.XXXXXX)"
PORT="${PORT:-$((55500 + RANDOM % 400))}"

cleanup() {
  "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
baseline() {
  local db=$1 fixture=$2
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  psqld "$db" -f "$fixture" >/dev/null
  for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup \
           class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do
    psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null
  done
  psqld "$db" -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
}
PREFLIGHT_SQL="$(cat "$ROOT/db/learning_threads_p1_preflight.sql")"
gate() { q "$1" "select item from (${PREFLIGHT_SQL%;}) z where section = 'GATE'"; }
state() { q "$1" "select (to_regclass('public.learning_threads') is not null)::text || '/' ||
                   (select count(*) from pg_proc where proname like 'lt\_%')"; }

echo "── Hằng số cổng: preflight = migration, và = md5 bản repo của hàm phụ thuộc"
extract() { grep -o "\"class_public_identity\": \[[^]]*\], \"is_class_member\": \[[^]]*\], \"is_teacher\": \[[^]]*\]" "$1"; }
cols() { grep -o '"edu_course_lessons": \[.*"app_users": \["id", "role"\]' "$1"; }
[ -n "$(extract "$ROOT/db/learning_threads_p1_setup.sql")" ] && [ "$(extract "$ROOT/db/learning_threads_p1_setup.sql")" = "$(extract "$ROOT/db/learning_threads_p1_preflight.sql")" ] \
  && [ "$(cols "$ROOT/db/learning_threads_p1_setup.sql")" = "$(cols "$ROOT/db/learning_threads_p1_preflight.sql")" ] \
  && ok "hằng md5 + danh sách cột GIỐNG HỆT giữa preflight và migration" || fail "hằng số lệch preflight ↔ migration"

echo "── Baseline (giả lập production: Social đã chạy + giáo trình + lớp)"
baseline tva_lt "$ROOT/db/tests/local/social_fixture.sql"
ACTUAL="$(q tva_lt "select string_agg(proname || '=' || md5(prosrc), ' ' order by proname) from pg_proc
                    where proname in ('is_teacher', 'is_class_member', 'class_public_identity')")"
[ "$ACTUAL" = "class_public_identity=9bda0938889c533040fb52f3301f3152 is_class_member=459786921eb5bbd4ff07c83bdb4db480 is_teacher=19b164504b4ce59b9bbdb4b0b64e48ad" ] \
  && ok "md5 hàm phụ thuộc trên bản repo = md5 production (preflight 29/09)" || fail "md5 repo khác production: $ACTUAL"
[ "$(gate tva_lt)" = "PASS" ] && ok "preflight trên baseline: GATE = PASS" || fail "preflight baseline: $(gate tva_lt)"
PREFLIGHT_ONELINE="$(tr '\n' ' ' < "$ROOT/db/learning_threads_p1_preflight.sql")"
[ "$(q tva_lt "select item from (${PREFLIGHT_ONELINE%;*}) z where section = 'GATE'")" = "PASS" ] \
  && ok "preflight dồn thành MỘT dòng (mất xuống dòng khi copy) vẫn chạy: GATE = PASS" || fail "preflight một dòng"

echo "── Migration lần 1 + lần 2 (idempotent) + chạy lại rls_setup.sql"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "migration lần 1"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "migration lần 2 (idempotent)"
[ "$(gate tva_lt)" = "PASS" ] && ok "preflight sau migration: GATE = PASS" || fail "preflight sau migration"
psqld tva_lt -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "chạy lại rls_setup.sql"
[ "$(q tva_lt "select count(*) from pg_policies where tablename like 'learning\_%'")" = "0" ] \
  && ok "rls_setup.sql KHÔNG áp policy rộng lên bảng P1 (self_managed)" || fail "rls_setup mở policy lên bảng P1"
[ "$(q tva_lt "select count(*) from information_schema.role_table_grants where table_name like 'learning\_%' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "anon/authenticated không có quyền bảng nào trên bảng P1 (dù default privileges rộng)" || fail "còn quyền bảng"
[ "$(q tva_lt "select count(*) from information_schema.routine_privileges where routine_name like 'lt\_%' and grantee = 'anon'")" = "0" ] \
  && ok "anon không EXECUTE được hàm lt_* nào" || fail "anon còn EXECUTE lt_*"

echo "── Test SQL (quyền/RPC/workflow theo từng identity)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_lt -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/learning_threads_p1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL"

echo "── Smoke production tự huỷ (trên DB mới migrate) → PASS và không để lại dữ liệu"
baseline t_smoke "$TMP/fixture_noroles.sql"
psqld t_smoke -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
SEQ_BEFORE="$(q t_smoke "select count(*) from public.edu_lesson_progress")"
psqld t_smoke -f "$ROOT/db/tests/learning_threads_p1_prod_smoke.sql" >/dev/null 2>"$TMP/smoke.err" && fail "smoke không tự huỷ (không RAISE)"
grep -o "SMOKE PASS [0-9]*/[0-9]*" "$TMP/smoke.err" >/dev/null && ok "smoke: $(grep -o 'SMOKE PASS [0-9]*/[0-9]*' "$TMP/smoke.err")" || fail "smoke: $(cat "$TMP/smoke.err")"
[ "$(q t_smoke "select (select count(*) from public.learning_threads) + (select count(*) from public.learning_thread_events) + (select count(*) from public.learning_lesson_settings)")" = "0" ] \
  && [ "$(q t_smoke "select count(*) from public.edu_lesson_progress")" = "$SEQ_BEFORE" ] \
  && ok "smoke dọn sạch: 0 thread / 0 event / 0 cấu hình bài còn lại" || fail "smoke để lại dữ liệu"
SMOKE_ONELINE="$(tr '\n' ' ' < "$ROOT/db/tests/learning_threads_p1_prod_smoke.sql")"
psqld t_smoke -c "$SMOKE_ONELINE" >/dev/null 2>"$TMP/smoke1.err" || true
grep -q "SMOKE PASS" "$TMP/smoke1.err" && ok "smoke dồn thành MỘT dòng vẫn chạy: PASS" || fail "smoke một dòng: $(cat "$TMP/smoke1.err")"

echo "── Script SAU MIGRATION (cổng + smoke tự huỷ + bật 3 bài DH2 thật) — một lần dán"
python3 "$ROOT/scripts/build-lt-post-migration.py" >/dev/null
git -C "$ROOT" diff --quiet -- db/learning_threads_p1_post_migration.sql 2>/dev/null \
  && ok "db/learning_threads_p1_post_migration.sql đồng bộ với smoke (generator không đổi gì)" || fail "post_migration.sql lệch smoke — chạy lại generator và commit"
dh2_fixture() {   # 3 bài DH2 THẬT (id + tên như production) để bước cấu hình khớp
  psqld "$1" >/dev/null <<'SQL'
insert into public.edu_courses (id, name, code, track) values ('c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2 (thật)', 'DH2', 'dem_hat');
insert into public.edu_modules (id, course_id, name, order_index, level) values
  ('d2000044-0000-4000-8000-000000000044', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 4: Điệu Bolero & kỹ thuật móc', 3, 2),
  ('974b0073-61d3-4b76-857a-e4f01c738d42', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 6: Áp dụng vào bài hát thực tế', 5, 2);
insert into public.edu_course_lessons (id, module_id, title, lesson_type, order_index) values
  ('5f7acacd-9214-48f3-9349-93cc382649fb', 'd2000044-0000-4000-8000-000000000044', 'Bài 4.3 — Bolero móc kiểu 1', 'video', 2),
  ('a85592d5-b519-470d-84d0-4d9182d224b3', 'd2000044-0000-4000-8000-000000000044', 'Bài 4.4 — Bolero móc kiểu 2', 'video', 3),
  ('d2c00805-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Bài 6.3 — Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp', 'text', 2);
SQL
}
baseline t_post "$TMP/fixture_noroles.sql"; dh2_fixture t_post
psqld t_post -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
POST_OUT="$(psqld t_post -tA -F ' | ' -f "$ROOT/db/learning_threads_p1_post_migration.sql")"
echo "$POST_OUT" | grep -q "^GATE | PASS" && echo "$POST_OUT" | grep -q "^smoke | SMOKE PASS 23/23" \
  && echo "$POST_OUT" | grep -q "^counts | .* | 3 / 0 / 0" \
  && ok "post-migration: cổng OK · $(echo "$POST_OUT" | grep -o 'SMOKE PASS [0-9/]*') · 3 bài DH2 bật · 0 thread/event còn lại" || fail "post-migration: $POST_OUT"
[ "$(q t_post "select string_agg(submission_mode || '/' || question_mode, ',') from public.learning_lesson_settings")" = "allowed/allowed,allowed/allowed,allowed/allowed" ] \
  && [ "$(q t_post "select count(*) from public.learning_lesson_settings s join public.app_users a on a.id = s.updated_by where a.role in ('admin','teacher')")" = "3" ] \
  && ok "3 bài: allowed/allowed (không required), ghi người cấu hình = Thầy/admin" || fail "cấu hình DH2 sai"
POST_ONELINE="$(tr '\n' ' ' < "$ROOT/db/learning_threads_p1_post_migration.sql")"
psqld t_post -c "$POST_ONELINE" >/dev/null 2>"$TMP/post2.err" && fail "chạy lại post-migration lẽ ra phải DỪNG"
grep -q "SMOKE FAIL" "$TMP/post2.err" && [ "$(q t_post "select count(*) from public.learning_lesson_settings")" = "3" ] \
  && ok "chạy lại (dồn một dòng) → DỪNG an toàn, không đổi gì" || fail "chạy lại post: $(cat "$TMP/post2.err")"
baseline t_post_bad "$TMP/fixture_noroles.sql"; dh2_fixture t_post_bad
psqld t_post_bad -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
psqld t_post_bad -c "grant select on public.learning_threads to authenticated" >/dev/null
psqld t_post_bad -f "$ROOT/db/learning_threads_p1_post_migration.sql" >/dev/null 2>"$TMP/post3.err" && fail "post chạy dù quyền bảng sai"
grep -q "cổng hậu migration STOP.*quyền bảng learning_threads" "$TMP/post3.err" && [ "$(q t_post_bad "select count(*) from public.learning_lesson_settings")" = "0" ] \
  && ok "cổng hậu migration bắt quyền bảng sai → DỪNG, không cấu hình gì" || fail "post gate: $(cat "$TMP/post3.err")"
baseline t_post_nodh2 "$TMP/fixture_noroles.sql"
psqld t_post_nodh2 -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
psqld t_post_nodh2 -f "$ROOT/db/learning_threads_p1_post_migration.sql" >/dev/null 2>"$TMP/post4.err" && fail "post chạy dù bài DH2 không khớp"
grep -q "bài DH2 không khớp" "$TMP/post4.err" && [ "$(q t_post_nodh2 "select count(*) from public.learning_lesson_settings")" = "0" ] \
  && ok "bài DH2 không khớp id/tên/khoá → DỪNG, không cấu hình gì" || fail "post dh2: $(cat "$TMP/post4.err")"

echo "── Rollback ×2 (idempotent) → cài lại"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_rollback.sql" >/dev/null && ok "rollback lần 1"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_rollback.sql" >/dev/null && ok "rollback lần 2 (idempotent)"
[ "$(state tva_lt)" = "false/0" ] && ok "rollback gỡ hết bảng + hàm lt_*" || fail "rollback: $(state tva_lt)"
[ "$(q tva_lt "select count(*) from public.class_posts")/$(q tva_lt "select count(*) from public.edu_course_lessons")" = "0/4" ] \
  && ok "rollback không đụng Social/giáo trình" || fail "rollback đụng bảng khác"
psqld tva_lt -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "cài lại sau rollback"

echo "── Giao dịch: lỗi GIỮA migration → không còn gì nửa chừng"
baseline t_fail "$TMP/fixture_noroles.sql"
awk '{print} /^-- ── 5\) Hàm nội bộ/ && !done {print "select 1/0; -- LỖI CỐ Ý"; done=1}' "$ROOT/db/learning_threads_p1_setup.sql" > "$TMP/broken.sql"
grep -q "LỖI CỐ Ý" "$TMP/broken.sql" || fail "không chèn được lỗi"
psqld t_fail -f "$TMP/broken.sql" >/dev/null 2>"$TMP/broken.err" && fail "migration lỗi mà không báo"
grep -q "division by zero" "$TMP/broken.err" || fail "lỗi không đúng: $(cat "$TMP/broken.err")"
[ "$(state t_fail)" = "false/0" ] && ok "lỗi sau khi đã tạo 3 bảng → rollback sạch, không bảng/hàm nào còn lại" || fail "nửa migration: $(state t_fail)"
psqld t_fail -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null && ok "chạy lại bản đúng sau lỗi: PASS"

echo "── Cổng drift: hàm phụ thuộc bị sửa tay / thiếu cột → preflight STOP + migration tự từ chối"
baseline t_drift "$TMP/fixture_noroles.sql"
psqld t_drift -c "create or replace function public.is_teacher() returns boolean language sql security definer set search_path = '' stable as \$\$ select true \$\$;" >/dev/null
[ "$(gate t_drift)" = "STOP - DO NOT MIGRATE" ] && ok "preflight: is_teacher sửa tay → GATE = STOP" || fail "preflight drift: $(gate t_drift)"
psqld t_drift -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null 2>"$TMP/drift.err" && fail "migration chạy dù hàm phụ thuộc lệch"
grep -q "DỪNG — production khác repo.*hàm is_teacher" "$TMP/drift.err" && [ "$(state t_drift)" = "false/0" ] \
  && ok "migration tự DỪNG khi is_teacher lệch — không tạo gì" || fail "gate: $(cat "$TMP/drift.err")"
baseline t_cols "$TMP/fixture_noroles.sql"
psqld t_cols -c "alter table public.class_stages drop column public_title" >/dev/null
[ "$(gate t_cols)" = "STOP - DO NOT MIGRATE" ] && ok "preflight: thiếu cột class_stages.public_title → GATE = STOP" || fail "preflight cột"
psqld t_cols -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null 2>"$TMP/cols.err" && fail "migration chạy dù thiếu cột"
grep -q "thiếu cột class_stages.public_title" "$TMP/cols.err" && ok "migration DỪNG khi thiếu cột" || fail "gate cột: $(cat "$TMP/cols.err")"

echo "ALL LEARNING THREAD DB CHECKS PASS"
