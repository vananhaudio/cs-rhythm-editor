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
psqld t_post -c "create table if not exists public.student_action_logs (id uuid primary key default gen_random_uuid(), user_id uuid, action_type text, lesson_id uuid, created_at timestamptz default now());
  insert into public.student_action_logs (user_id, action_type, lesson_id) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'submitted_video_self_report', '5f7acacd-9214-48f3-9349-93cc382649fb')" >/dev/null
DIAG_GATE() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/learning_threads_p1_diag.sql")) z where section = 'CONFIG_GATE'"; }
[ "$(DIAG_GATE t_post)" = "STOP - CONFIG MISSING" ] && ok "diag TRƯỚC khi cấu hình: CONFIG_GATE = STOP (0 dòng không thể bị báo là đã cấu hình)" || fail "diag trước: $(DIAG_GATE t_post)"
POST_OUT="$(psqld t_post -tA -F ' | ' -f "$ROOT/db/learning_threads_p1_post_migration.sql")"
echo "$POST_OUT" | grep -q "^GATE | PASS" && echo "$POST_OUT" | grep -q "^smoke | SMOKE PASS 23/23" \
  && echo "$POST_OUT" | grep -q "^counts | .* | 3 / 0 / 0" \
  && ok "post-migration: cổng OK · $(echo "$POST_OUT" | grep -o 'SMOKE PASS [0-9/]*') · 3 bài DH2 bật · 0 thread/event còn lại" || fail "post-migration: $POST_OUT"
[ "$(q t_post "select string_agg(submission_mode || '/' || question_mode, ',') from public.learning_lesson_settings")" = "allowed/allowed,allowed/allowed,allowed/allowed" ] \
  && [ "$(q t_post "select count(*) from public.learning_lesson_settings s join public.app_users a on a.id = s.updated_by where a.role in ('admin','teacher')")" = "3" ] \
  && ok "3 bài: allowed/allowed (không required), ghi người cấu hình = Thầy/admin" || fail "cấu hình DH2 sai"
[ "$(DIAG_GATE t_post)" = "PASS" ] && ok "diag SAU khi cấu hình (đọc lại DB + RPC dưới danh tính học sinh): CONFIG_GATE = PASS" || fail "diag sau: $(DIAG_GATE t_post)"
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

echo "── P2 (Feed · Tường · Hành trình): preflight → migration ×2 → test → rollback"
p2c() { grep -o '"can_view_wall": \[[^]]*\], "class_public_identity": \[[^]]*\], "is_class_member": \[[^]]*\], "is_teacher": \[[^]]*\]' "$1"; }
[ -n "$(p2c "$ROOT/db/learning_threads_p2_setup.sql")" ] && [ "$(p2c "$ROOT/db/learning_threads_p2_setup.sql")" = "$(p2c "$ROOT/db/learning_threads_p2_preflight.sql")" ] \
  && ok "P2: hằng md5 giống hệt giữa preflight và migration" || fail "P2: hằng lệch"
baseline t_p2 "$TMP/fixture_noroles.sql"
[ "$(q t_p2 "select md5(prosrc) from pg_proc where proname = 'can_view_wall'")" = "72be0399a709b62fb512bbf0be34294b" ] && ok "P2: md5 can_view_wall (repo) = hằng kỳ vọng" || fail "can_view_wall md5"
P2GATE() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/learning_threads_p2_preflight.sql")) z where section = 'GATE'"; }
[ "$(P2GATE t_p2)" = "STOP - DO NOT MIGRATE" ] && ok "P2 preflight khi CHƯA có P1: STOP" || fail "P2 preflight thiếu P1: $(P2GATE t_p2)"
psqld t_p2 -f "$ROOT/db/learning_threads_p2_setup.sql" >/dev/null 2>"$TMP/p2a.err" && fail "P2 chạy khi chưa có P1"
grep -q "thiếu Learning Thread P1" "$TMP/p2a.err" && ok "P2 migration tự DỪNG khi chưa có P1" || fail "p2 gate: $(cat "$TMP/p2a.err")"
psqld t_p2 -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
[ "$(P2GATE t_p2)" = "PASS" ] && ok "P2 preflight: GATE = PASS" || fail "P2 preflight: $(P2GATE t_p2)"
psqld t_p2 -f "$ROOT/db/learning_threads_p2_setup.sql" >/dev/null && psqld t_p2 -f "$ROOT/db/learning_threads_p2_setup.sql" >/dev/null && ok "P2 migration ×2 (idempotent)"
psqld t_p2 -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_p2 "select count(*) from information_schema.routine_privileges where routine_name in ('social_feed','user_wall','learning_journey','lt_thread_card') and grantee = 'anon'")" = "0" ] \
  && ok "P2: anon không EXECUTE hàm P2 nào" || fail "P2 anon exec"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_p2 -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/learning_threads_p2_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL P2"
BEFORE_P2RB="$(q t_p2 "select count(*) from learning_threads")/$(q t_p2 "select count(*) from learning_thread_events")"
psqld t_p2 -f "$ROOT/db/learning_threads_p2_rollback.sql" >/dev/null && psqld t_p2 -f "$ROOT/db/learning_threads_p2_rollback.sql" >/dev/null
[ "$(q t_p2 "select count(*) from pg_proc where proname in ('social_feed','user_wall','learning_journey','lt_thread_card')")" = "0" ] \
  && [ "$(q t_p2 "select count(*) from learning_threads")/$(q t_p2 "select count(*) from learning_thread_events")" = "$BEFORE_P2RB" ] \
  && ok "P2 rollback ×2: gỡ 4 hàm, dữ liệu thread P1 giữ nguyên ($BEFORE_P2RB)" || fail "P2 rollback"

echo "── SOCIAL UX + LỚP HỌC V1: md5 cổng = thân hàm repo · preflight → migration ×2 → test → rollback về P2"
scc() { grep -o "fn_expected constant jsonb := '[^']*'" "$1" | sed "s/.*:= //"; }
[ "$(grep -o "'{\"class_public_identity[^']*'" "$ROOT/db/social_classes_v1_preflight.sql" | head -1)" = "$(scc "$ROOT/db/social_classes_v1_setup.sql")" ] \
  && ok "V1: hằng md5 giống hệt giữa preflight và migration" || fail "V1: hằng lệch"
baseline t_sc "$TMP/fixture_noroles.sql"
psqld t_sc -f "$ROOT/db/learning_threads_p1_setup.sql" >/dev/null
SCGATE() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/social_classes_v1_preflight.sql")) z where section = 'GATE'"; }
[ "$(SCGATE t_sc)" = "STOP - DO NOT MIGRATE" ] && ok "V1 preflight khi CHƯA có P2: STOP" || fail "V1 preflight thiếu P2"
psqld t_sc -f "$ROOT/db/learning_threads_p2_setup.sql" >/dev/null
[ "$(q t_sc "select md5(prosrc) from pg_proc where proname = 'social_feed'")/$(q t_sc "select md5(prosrc) from pg_proc where proname = 'lt_thread_card'")" = "0916ccb443782eb7b8070a1bb439ed00/172c1d1d323e637944097493b5bf5344" ] \
  && ok "V1: md5 social_feed/lt_thread_card (bản P2 đã chạy) = hằng cổng" || fail "md5 P2 lệch hằng cổng"
[ "$(SCGATE t_sc)" = "PASS" ] && ok "V1 preflight: GATE = PASS" || fail "V1 preflight: $(SCGATE t_sc)"
psqld t_sc -f "$ROOT/db/social_classes_v1_setup.sql" >/dev/null && psqld t_sc -f "$ROOT/db/social_classes_v1_setup.sql" >/dev/null && ok "V1 migration ×2 (idempotent, cổng nhận bản V1 của social_feed)"
[ "$(q t_sc "select md5(prosrc) from pg_proc where proname = 'social_feed'")" = "d62b6a78984817b787e7731e46c2a0e5" ] && ok "V1: md5 social_feed mới = hằng cổng" || fail "md5 V1 lệch"
psqld t_sc -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_sc "select count(*) from information_schema.routine_privileges where routine_name like 'social\_%' and grantee = 'anon'")" = "0" ] \
  && ok "V1: anon không EXECUTE hàm social_* nào" || fail "V1 anon exec"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_sc -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/social_classes_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL V1"
psqld t_sc -f "$ROOT/db/social_classes_v1_rollback.sql" >/dev/null && psqld t_sc -f "$ROOT/db/social_classes_v1_rollback.sql" >/dev/null
[ "$(q t_sc "select count(*) from pg_proc where proname like 'social\_%class%' or proname in ('social_my_classes','social_discover_classes')")/$(q t_sc "select md5(prosrc) from pg_proc where proname = 'social_feed'")" = "0/0916ccb443782eb7b8070a1bb439ed00" ] \
  && ok "V1 rollback ×2: gỡ hàm lớp, social_feed về ĐÚNG bản P2" || fail "V1 rollback"

echo "── FEED V1 (social_feed_scoped): md5 cổng · preflight → migration ×2 → test → rollback (social_feed không đổi)"
sfc() { grep -o "fn_expected constant jsonb := '[^']*'" "$1" | sed "s/.*:= //"; }
[ "$(grep -o "'{\"class_public_identity[^']*'" "$ROOT/db/social_feed_v1_preflight.sql" | head -1)" = "$(sfc "$ROOT/db/social_feed_v1_setup.sql")" ] \
  && ok "Feed V1: hằng md5 giống hệt giữa preflight và migration" || fail "Feed V1: hằng lệch"
baseline t_sf "$TMP/fixture_noroles.sql"
for f in learning_threads_p1_setup learning_threads_p2_setup; do psqld t_sf -f "$ROOT/db/$f.sql" >/dev/null; done
SFGATE() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/social_feed_v1_preflight.sql")) z where section = 'GATE'"; }
[ "$(SFGATE t_sf)" = "STOP - DO NOT MIGRATE" ] && ok "Feed V1 preflight khi CHƯA có Lớp học V1: STOP" || fail "Feed V1 preflight thiếu V1"
psqld t_sf -f "$ROOT/db/social_feed_v1_setup.sql" >/dev/null 2>"$TMP/sf.err" && fail "Feed V1 chạy khi chưa có V1"
grep -q "DỪNG — production khác repo" "$TMP/sf.err" && ok "Feed V1 migration tự DỪNG khi chưa có Lớp học V1" || fail "Feed V1 gate: $(cat "$TMP/sf.err")"
psqld t_sf -f "$ROOT/db/social_classes_v1_setup.sql" >/dev/null
SF_BEFORE="$(q t_sf "select md5(prosrc) from pg_proc where proname = 'social_feed'")"
[ "$(SFGATE t_sf)" = "PASS" ] && ok "Feed V1 preflight: GATE = PASS" || fail "Feed V1 preflight: $(SFGATE t_sf)"
psqld t_sf -f "$ROOT/db/social_feed_v1_setup.sql" >/dev/null && psqld t_sf -f "$ROOT/db/social_feed_v1_setup.sql" >/dev/null && ok "Feed V1 migration ×2 (idempotent)"
[ "$(q t_sf "select md5(prosrc) from pg_proc where proname = 'social_feed'")" = "$SF_BEFORE" ] && ok "Feed V1: social_feed (Dành cho bạn) KHÔNG đổi" || fail "social_feed bị đổi"
psqld t_sf -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_sf "select count(*) from information_schema.routine_privileges where routine_name in ('social_feed_scoped','social_post_card') and grantee in ('anon','PUBLIC')")/$(q t_sf "select count(*) from information_schema.routine_privileges where routine_name = 'social_post_card' and grantee = 'authenticated'")" = "0/0" ] \
  && ok "Feed V1: anon không EXECUTE; social_post_card là hàm nội bộ" || fail "Feed V1 quyền hàm"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_sf -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/social_feed_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL Feed V1"
psqld t_sf -f "$ROOT/db/social_feed_v1_rollback.sql" >/dev/null && psqld t_sf -f "$ROOT/db/social_feed_v1_rollback.sql" >/dev/null
[ "$(q t_sf "select count(*) from pg_proc where proname in ('social_feed_scoped','social_post_card')")/$(q t_sf "select md5(prosrc) from pg_proc where proname = 'social_feed'")" = "0/$SF_BEFORE" ] \
  && ok "Feed V1 rollback ×2: gỡ 2 hàm, social_feed nguyên vẹn" || fail "Feed V1 rollback"

echo "── LEARNING IDENTITY V1 (social_learning_identities): md5 cổng · preflight → migration ×2 → test → rollback"
lic() { grep -o "fn_expected constant jsonb := '[^']*'" "$1" | sed "s/.*:= //"; }
[ "$(grep -o "'{\"is_class_member[^']*'" "$ROOT/db/social_learning_identity_v1_preflight.sql" | head -1)" = "$(lic "$ROOT/db/social_learning_identity_v1_setup.sql")" ] \
  && ok "Identity V1: hằng md5 giống hệt giữa preflight và migration" || fail "Identity V1: hằng lệch"
baseline t_li "$TMP/fixture_noroles.sql"
for f in learning_threads_p1_setup learning_threads_p2_setup; do psqld t_li -f "$ROOT/db/$f.sql" >/dev/null; done
LIGATE() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/social_learning_identity_v1_preflight.sql")) z where section = 'GATE'"; }
[ "$(LIGATE t_li)" = "STOP - DO NOT MIGRATE" ] && ok "Identity V1 preflight khi CHƯA có Lớp học V1: STOP" || fail "Identity V1 preflight thiếu V1"
psqld t_li -f "$ROOT/db/social_classes_v1_setup.sql" >/dev/null
[ "$(LIGATE t_li)" = "PASS" ] && ok "Identity V1 preflight: GATE = PASS" || fail "Identity V1 preflight: $(LIGATE t_li)"
[ "$(q t_li "select count(*) from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/social_learning_identity_v1_preflight.sql")) z where section = 'info'")" -ge 4 ] \
  && ok "Identity V1 preflight: có thống kê gộp chỉ đọc (status lớp, chương trình, khoá, completed)" || fail "Identity V1 preflight info"
psqld t_li -f "$ROOT/db/social_learning_identity_v1_setup.sql" >/dev/null && psqld t_li -f "$ROOT/db/social_learning_identity_v1_setup.sql" >/dev/null && ok "Identity V1 migration ×2 (idempotent)"
psqld t_li -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_li "select count(*) from information_schema.routine_privileges where routine_name = 'social_learning_identities' and grantee in ('anon','PUBLIC')")" = "0" ] \
  && ok "Identity V1: anon không EXECUTE" || fail "Identity V1 quyền hàm"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_li -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/social_learning_identity_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL Identity V1"
psqld t_li -f "$ROOT/db/social_learning_identity_v1_rollback.sql" >/dev/null && psqld t_li -f "$ROOT/db/social_learning_identity_v1_rollback.sql" >/dev/null
[ "$(q t_li "select count(*) from pg_proc where proname = 'social_learning_identities'")" = "0" ] && ok "Identity V1 rollback ×2: gỡ hàm" || fail "Identity V1 rollback"

echo "── TOOL SHARE V1 (class_posts.tool_share + social_share_tool_result): setup ×2 → test → rollback ×2"
baseline t_ts "$TMP/fixture_noroles.sql"
for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld t_ts -f "$ROOT/db/$f.sql" >/dev/null; done
TYPEDEF_BEFORE="$(q t_ts "select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.class_posts'::regclass and conname = 'class_posts_type_check'")"
POSTS_BEFORE="$(q t_ts "select count(*) from public.class_posts")"
psqld t_ts -c "begin;" -f "$ROOT/db/social_tool_share_v1_setup.sql" -c "commit;" >/dev/null && psqld t_ts -c "begin;" -f "$ROOT/db/social_tool_share_v1_setup.sql" -c "commit;" >/dev/null && ok "Tool Share migration ×2 (idempotent)"
psqld t_ts -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_ts "select count(*) from information_schema.routine_privileges where routine_name = 'social_share_tool_result' and grantee in ('anon','PUBLIC')")" = "0" ] \
  && ok "Tool Share: anon không EXECUTE" || fail "Tool Share quyền hàm"
[ "$(q t_ts "select count(*) from public.class_posts")" = "$POSTS_BEFORE" ] && ok "Tool Share: không đụng bài hiện có" || fail "Tool Share đổi bài hiện có"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_ts -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/social_tool_share_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL Tool Share"
psqld t_ts -c "begin;" -f "$ROOT/db/social_tool_share_v1_rollback.sql" -c "commit;" >/dev/null && psqld t_ts -c "begin;" -f "$ROOT/db/social_tool_share_v1_rollback.sql" -c "commit;" >/dev/null
[ "$(q t_ts "select count(*) from information_schema.columns where table_name = 'class_posts' and column_name = 'tool_share'")/$(q t_ts "select count(*) from pg_proc where proname = 'social_share_tool_result'")/$(q t_ts "select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.class_posts'::regclass and conname = 'class_posts_type_check'")" = "0/0/$TYPEDEF_BEFORE" ] \
  && ok "Tool Share rollback ×2 (chưa có bài): gỡ RPC + cột, type_check về đúng bản cũ" || fail "Tool Share rollback"

echo "── BMS ARTIFACT V1 (tool_artifacts + nhánh bms): setup ×2 → rls_setup → test → rollback ×2"
baseline t_ba "$TMP/fixture_noroles.sql"
for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup social_tool_share_v1_setup; do psqld t_ba -f "$ROOT/db/$f.sql" >/dev/null; done
TS_V1_MD5="$(q t_ba "select md5(prosrc) from pg_proc where proname = 'social_share_tool_result'")"
psqld t_ba -c "begin;" -f "$ROOT/db/social_bms_artifact_v1_setup.sql" -c "commit;" >/dev/null && psqld t_ba -c "begin;" -f "$ROOT/db/social_bms_artifact_v1_setup.sql" -c "commit;" >/dev/null && ok "BMS artifact migration ×2 (idempotent)"
psqld t_ba -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_ba "select count(*) from pg_policies where tablename = 'tool_artifacts'")/$(q t_ba "select policyname from pg_policies where tablename = 'tool_artifacts'")" = "1/tool_artifacts_read" ] \
  && ok "BMS artifact: rls_setup.sql KHÔNG áp policy rộng (self_managed)" || fail "rls_setup áp policy lên tool_artifacts"
[ "$(q t_ba "select count(*) from information_schema.role_table_grants where table_name = 'tool_artifacts' and grantee in ('anon','PUBLIC')")/$(q t_ba "select string_agg(privilege_type, ',') from information_schema.role_table_grants where table_name = 'tool_artifacts' and grantee = 'authenticated'")" = "0/SELECT" ] \
  && ok "BMS artifact: anon không quyền; authenticated chỉ SELECT" || fail "BMS artifact grants"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_ba -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/social_bms_artifact_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL BMS artifact"
psqld t_ba -c "begin;" -f "$ROOT/db/social_bms_artifact_v1_rollback.sql" -c "commit;" >/dev/null && psqld t_ba -c "begin;" -f "$ROOT/db/social_bms_artifact_v1_rollback.sql" -c "commit;" >/dev/null
[ "$(q t_ba "select count(*) from pg_class where relname = 'tool_artifacts'")/$(q t_ba "select md5(prosrc) from pg_proc where proname = 'social_share_tool_result'")/$(q t_ba "select count(*) from pg_proc where proname in ('bms_song_normalize','social_delete_tool_artifact')")" = "0/$TS_V1_MD5/0" ] \
  && ok "BMS artifact rollback ×2 (chưa có artifact): gỡ bảng + hàm, RPC về đúng bản Tool Share V1" || fail "BMS artifact rollback"

echo "── NHỊP & PHÁCH ARTIFACT V1 (tool_artifacts.content + nhánh nhipphach): setup ×2 → rls_setup → test → rollback ×2"
baseline t_np "$TMP/fixture_noroles.sql"
for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup social_tool_share_v1_setup; do psqld t_np -f "$ROOT/db/$f.sql" >/dev/null; done
psqld t_np -c "begin;" -f "$ROOT/db/social_bms_artifact_v1_setup.sql" -c "commit;" >/dev/null
BMS_MD5="$(q t_np "select md5(prosrc) from pg_proc where proname = 'social_share_tool_result'")"
[ "$BMS_MD5" = "$(grep -o "md5(v_src) <> '[0-9a-f]*'" "$ROOT/db/social_nhipphach_artifact_v1_setup.sql" | grep -o "[0-9a-f]\{32\}")" ] \
  && ok "Nhịp & Phách: cổng md5 = đúng RPC BMS trong repo" || fail "md5 cổng Nhịp & Phách lệch RPC BMS ($BMS_MD5)"
psqld t_np -c "begin;" -f "$ROOT/db/social_nhipphach_artifact_v1_setup.sql" -c "commit;" >/dev/null && psqld t_np -c "begin;" -f "$ROOT/db/social_nhipphach_artifact_v1_setup.sql" -c "commit;" >/dev/null && ok "Nhịp & Phách artifact migration ×2 (idempotent)"
psqld t_np -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_np "select count(*) from pg_policies where tablename = 'tool_artifacts'")/$(q t_np "select string_agg(privilege_type, ',') from information_schema.role_table_grants where table_name = 'tool_artifacts' and grantee in ('anon','authenticated','PUBLIC')")" = "1/SELECT" ] \
  && ok "Nhịp & Phách: tool_artifacts vẫn 1 policy đọc; chỉ authenticated SELECT" || fail "Nhịp & Phách quyền bảng"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_np -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/social_nhipphach_artifact_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL Nhịp & Phách artifact"
psqld t_np -c "begin;" -f "$ROOT/db/social_nhipphach_artifact_v1_rollback.sql" -c "commit;" >/dev/null && psqld t_np -c "begin;" -f "$ROOT/db/social_nhipphach_artifact_v1_rollback.sql" -c "commit;" >/dev/null
[ "$(q t_np "select count(*) from information_schema.columns where table_name = 'tool_artifacts' and column_name = 'content'")/$(q t_np "select md5(prosrc) from pg_proc where proname = 'social_share_tool_result'")/$(q t_np "select count(*) from pg_proc where proname like 'nhipphach_%check' or proname = 'nhipphach_settings_normalize'")" = "0/$BMS_MD5/0" ] \
  && ok "Nhịp & Phách rollback ×2 (chưa có bản nào): gỡ cột + hàm, RPC về đúng bản BMS" || fail "Nhịp & Phách rollback"

echo "── LỚP CỦA TÔI V1 (checkpoint + tiến độ buổi): md5 cổng · setup ×2 · rls_setup · test · rollback (giữ dữ liệu / sạch) · cài lại · drift"
CP_EXPECTED="lt_detail=5b8f57d71b7b2392a17bfe73fcd61a56 lt_set_visibility=60c4201a6afc69ec3cb1d196bfd6163f social_class_activity=560d9faa6251606acb288f800deefa09"
CP_MD5() { q "$1" "select string_agg(proname || '=' || md5(prosrc), ' ' order by proname) from pg_proc where proname in ('lt_detail', 'lt_set_visibility', 'social_class_activity')"; }
CP_CONS() { q "$1" "select string_agg(conname || ':' || pg_get_constraintdef(oid), ' | ' order by conname) from pg_constraint where conrelid = 'public.learning_threads'::regclass"; }
cp_base() {
  baseline "$1" "$TMP/fixture_noroles.sql"
  for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld "$1" -f "$ROOT/db/$f.sql" >/dev/null; done
  psqld "$1" -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
}
cp_setup() { psqld "$1" -c "begin;" -f "$ROOT/db/class_checkpoints_v1_setup.sql" -c "commit;" >/dev/null; }
cp_rollback() { psqld "$1" -c "begin;" -f "$ROOT/db/class_checkpoints_v1_rollback.sql" -c "commit;" >/dev/null 2>&1; }
grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/class_checkpoints_v1_setup.sql" "$ROOT/db/class_checkpoints_v1_rollback.sql" \
  && fail "file migration V1 có begin/commit (prod-db.py sở hữu transaction)" || ok "setup/rollback V1 không tự begin/commit (đúng luật prod-db.py)"
cp_base t_cp
[ "$(CP_MD5 t_cp)" = "$CP_EXPECTED" ] && ok "V1: md5 3 hàm bị thay (bản repo) = md5 production 01/10" || fail "V1: md5 repo khác production: $(CP_MD5 t_cp)"
CONS_BEFORE="$(CP_CONS t_cp)"
[ "$(grep -o '"lt_detail": "[0-9a-f]*", "lt_set_visibility": "[0-9a-f]*", "social_class_activity": "[0-9a-f]*"' "$ROOT/db/class_checkpoints_v1_setup.sql" | tr -d '",' | sed 's/: /=/g')" = "$CP_EXPECTED" ] \
  && ok "V1: hằng md5 trong cổng = md5 kỳ vọng" || fail "V1: hằng md5 cổng lệch"
[ "$(grep -o '"lt_detail": "[0-9a-f]*", "lt_set_visibility": "[0-9a-f]*", "social_class_activity": "[0-9a-f]*"' "$ROOT/db/class_checkpoints_v1_preflight.sql")" = "$(grep -o '"lt_detail": "[0-9a-f]*", "lt_set_visibility": "[0-9a-f]*", "social_class_activity": "[0-9a-f]*"' "$ROOT/db/class_checkpoints_v1_setup.sql")" ] \
  && ok "V1: hằng md5 giống hệt giữa preflight và migration" || fail "V1: hằng preflight ↔ migration lệch"
CPGATE() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/class_checkpoints_v1_preflight.sql")) z where section = 'GATE'"; }
[ "$(CPGATE t_cp)" = "PASS" ] && ok "V1 preflight: GATE = PASS" || fail "V1 preflight: $(CPGATE t_cp)"
cp_setup t_cp && cp_setup t_cp && ok "V1 migration ×2 (idempotent; cổng nhận bản V1 đã chạy)"
[ "$(CPGATE t_cp)" = "PASS" ] && ok "V1 preflight sau migration: GATE = PASS (chạy lại an toàn)" || fail "V1 preflight sau migration: $(CPGATE t_cp)"
psqld t_cp -f "$ROOT/db/rls_setup.sql" >/dev/null
[ "$(q t_cp "select count(*) from pg_policies where tablename = 'learning_session_progress'")" = "0" ] \
  && ok "V1: rls_setup.sql KHÔNG áp policy lên learning_session_progress (self_managed)" || fail "rls_setup mở policy lên bảng tiến độ"
[ "$(q t_cp "select count(*) from information_schema.role_table_grants where table_name = 'learning_session_progress' and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "V1: anon/authenticated không có quyền bảng tiến độ" || fail "V1: còn quyền bảng tiến độ"
[ "$(q t_cp "select count(*) from information_schema.routine_privileges where routine_name in ('class_learning_state','lt_submit_checkpoint','lt_detail','lt_set_visibility','social_class_activity') and grantee in ('anon','PUBLIC')")" = "0" ] \
  && [ "$(q t_cp "select count(*) from information_schema.routine_privileges where routine_name in ('lsp_sync','lsp_try_complete','cl_session_checkpoints','cl_next_session','lsp_on_checkpoint_passed','lsp_guard_history') and grantee in ('anon','authenticated','PUBLIC')")" = "0" ] \
  && ok "V1: anon không EXECUTE RPC; hàm nội bộ không cấp cho ai" || fail "V1: quyền hàm sai"
POSTFLIGHT() { q "$1" "select item from ($(sed 's/;[[:space:]]*$//' "$ROOT/db/class_checkpoints_v1_postflight.sql")) z where section = 'GATE'"; }
[ "$(POSTFLIGHT t_cp)" = "PASS" ] && ok "V1 postflight: GATE = PASS" || fail "V1 postflight: $(POSTFLIGHT t_cp)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d t_cp -v ON_ERROR_STOP=1 \
  -f "$ROOT/db/tests/class_checkpoints_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //'
[ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL Lớp của tôi V1"
CP_DATA="$(q t_cp "select count(*) from learning_threads where content_kind = 'program_checkpoint'")/$(q t_cp "select count(*) from learning_session_progress")"
cp_rollback t_cp && cp_rollback t_cp
[ "$(CP_MD5 t_cp)" = "$CP_EXPECTED" ] && [ "$(q t_cp "select count(*) from pg_proc where proname in ('class_learning_state','lt_submit_checkpoint','lsp_sync')")" = "0" ] \
  && [ "$(q t_cp "select count(*) from learning_threads where content_kind = 'program_checkpoint'")/$(q t_cp "select count(*) from learning_session_progress")" = "$CP_DATA" ] \
  && ok "V1 rollback ×2 khi ĐÃ có dữ liệu ($CP_DATA): 3 hàm về đúng md5 production, gỡ RPC, GIỮ bài trả + tiến độ" || fail "V1 rollback có dữ liệu"
cp_setup t_cp && [ "$(q t_cp "select count(*) from pg_proc where proname = 'class_learning_state'")" = "1" ] && ok "V1 cài lại sau rollback (dữ liệu cũ còn nguyên)" || fail "V1 cài lại"
cp_base t_cp2
cp_setup t_cp2 && cp_rollback t_cp2 && cp_rollback t_cp2
[ "$(q t_cp2 "select to_regclass('public.learning_session_progress') is null")" = "t" ] && [ "$(CP_CONS t_cp2)" = "$CONS_BEFORE" ] \
  && [ "$(q t_cp2 "select count(*) from information_schema.columns where table_name = 'learning_threads' and column_name = 'checkpoint_id'")" = "0" ] \
  && [ "$(CP_MD5 t_cp2)" = "$CP_EXPECTED" ] \
  && ok "V1 rollback ×2 khi CHƯA có dữ liệu: gỡ bảng + cột, ràng buộc learning_threads về ĐÚNG bản trước" || fail "V1 rollback sạch"
cp_base t_cp3
psqld t_cp3 -c "create or replace function public.lt_set_visibility(p_thread_id uuid, p_visibility text) returns void language sql as \$\$ select \$\$;" >/dev/null
[ "$(CPGATE t_cp3)" = "STOP - DO NOT MIGRATE" ] && ok "V1 preflight: lt_set_visibility sửa tay → GATE = STOP" || fail "V1 preflight drift: $(CPGATE t_cp3)"
psqld t_cp3 -c "begin;" -f "$ROOT/db/class_checkpoints_v1_setup.sql" -c "commit;" >/dev/null 2>"$TMP/cp3.err" && fail "V1 migration chạy dù hàm bị thay lệch"
grep -q "DỪNG — production khác repo.*lt_set_visibility" "$TMP/cp3.err" && [ "$(q t_cp3 "select to_regclass('public.learning_session_progress') is null")" = "t" ] \
  && ok "V1 migration tự DỪNG khi hàm bị thay lệch — không tạo gì" || fail "V1 drift gate: $(cat "$TMP/cp3.err")"

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
